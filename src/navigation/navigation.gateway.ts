// src/navigation/navigation.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { JwtService } from '@nestjs/jwt';

interface NavigationSession {
  userId: string;
  destinationId: string;
  startLocation: { lat: number; lng: number };
  currentLocation: { lat: number; lng: number };
  startTime: Date;
  isActive: boolean;
  route?: any;
}

interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/navigation',
  // ✅ NUEVO: Configuración de limpieza
  pingTimeout: 30000,
  pingInterval: 25000,
})
export class NavigationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NavigationGateway.name);
  private activeSessions = new Map<string, NavigationSession>();
  private clientSockets = new Map<string, Socket>();
  
  // ✅ NUEVO: Limpieza automática
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private navigationService: NavigationService,
    private jwtService: JwtService,
  ) {
    // ✅ NUEVO: Iniciar limpieza automática cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);
  }

  // ✅ NUEVO: Método de limpieza
  private cleanupInactiveSessions() {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, session] of this.activeSessions.entries()) {
      // Limpiar sesiones inactivas por más de 30 minutos
      const sessionAge = now - session.startTime.getTime();
      if (sessionAge > 30 * 60 * 1000 || !session.isActive) {
        this.activeSessions.delete(userId);
        cleaned++;
      }
    }

    // Limpiar sockets desconectados
    for (const [userId, socket] of this.clientSockets.entries()) {
      if (socket.disconnected) {
        this.clientSockets.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`🧹 Cleaned up ${cleaned} inactive sessions/sockets`);
    }
  }

  // Conexión de cliente
  async handleConnection(client: Socket) {
    try {
      // Extraer token de la query string o headers
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verificar JWT token
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Validar que sea estudiante
      if (payload.role !== 'STUDENT') {
        this.logger.warn(`Non-student user ${userId} tried to connect to navigation`);
        client.disconnect();
        return;
      }

      // Guardar cliente conectado
      this.clientSockets.set(userId, client);
      client.data.userId = userId;

      this.logger.log(`Student ${userId} connected to navigation (${client.id})`);
      
      // Enviar estado inicial
      client.emit('connected', {
        message: 'Conectado al sistema de navegación',
        userId,
        timestamp: new Date(),
      });

      // Si tiene una sesión activa, restaurarla
      const activeSession = this.activeSessions.get(userId);
      if (activeSession) {
        client.emit('session_restored', {
          session: activeSession,
          message: 'Sesión de navegación restaurada',
        });
      }

    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  // Desconexión de cliente
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      // Limpiar inmediatamente
      this.clientSockets.delete(userId);
      const session = this.activeSessions.get(userId);
      if (session) {
        session.isActive = false;
        // Mantener por 5 minutos en caso de reconexión
        setTimeout(() => {
          this.activeSessions.delete(userId);
        }, 5 * 60 * 1000);
      }
      
      this.logger.log(`Student ${userId} disconnected from navigation (${client.id})`);
    }
  }

  // Iniciar sesión de navegación
  @SubscribeMessage('start_navigation')
  async handleStartNavigation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      destinationId: string;
      currentLocation: { lat: number; lng: number };
      preferences?: any;
    },
  ) {
    const userId = client.data.userId;
    
    try {
      this.logger.log(`Starting navigation for user ${userId} to ${data.destinationId}`);

      // Validar ubicación GPS
      const gpsValidation = await this.navigationService.validateGPSLocation(data.currentLocation);
      if (!gpsValidation.valid) {
        client.emit('navigation_error', {
          error: 'GPS_INVALID',
          message: gpsValidation.message,
        });
        return;
      }

      // Crear ruta de navegación
      const navigation = await this.navigationService.createRouteFromCurrentLocation({
        currentLocation: data.currentLocation,
        destinationId: data.destinationId,
        preferences: data.preferences,
      });

      // Crear sesión de navegación
      const session: NavigationSession = {
        userId,
        destinationId: data.destinationId,
        startLocation: data.currentLocation,
        currentLocation: data.currentLocation,
        startTime: new Date(),
        isActive: true,
        route: navigation,
      };

      this.activeSessions.set(userId, session);

      // Notificar inicio de navegación
      client.emit('navigation_started', {
        session: session,
        navigation: navigation,
        message: `Navegación iniciada hacia ${navigation.destination.nombre}`,
      });

      // Iniciar tracking automático
      this.startLocationTracking(userId);

    } catch (error) {
      this.logger.error(`Error starting navigation for user ${userId}: ${error.message}`);
      client.emit('navigation_error', {
        error: 'START_FAILED',
        message: 'Error al iniciar la navegación: ' + error.message,
      });
    }
  }

  // Actualizar ubicación en tiempo real
  @SubscribeMessage('location_update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() location: LocationUpdate,
  ) {
    const userId = client.data.userId;
    const session = this.activeSessions.get(userId);

    if (!session || !session.isActive) {
      client.emit('navigation_error', {
        error: 'NO_ACTIVE_SESSION',
        message: 'No hay sesión de navegación activa',
      });
      return;
    }

    try {
      // Actualizar ubicación en la sesión
      session.currentLocation = { lat: location.lat, lng: location.lng };

      // Calcular progreso de navegación
      const update = await this.navigationService.getNavigationUpdate(
        { lat: location.lat, lng: location.lng },
        session.destinationId
      );

      // Verificar si llegó al destino
      if (update.llegada) {
        await this.handleArrival(userId, session);
        return;
      }

      // Verificar si se desvió mucho de la ruta
      const desvio = await this.checkRouteDeviation(session, location);
      if (desvio.isDeviated) {
        client.emit('route_deviation', {
          deviation: desvio,
          suggestion: 'Recalculando ruta...',
        });
        
        // Recalcular ruta automáticamente
        await this.recalculateRoute(userId, location);
      }

      // Enviar actualización de progreso
      client.emit('navigation_update', {
        location: { lat: location.lat, lng: location.lng },
        progress: update,
        session: session,
        timestamp: new Date(),
      });

      // Verificar proximidad a puntos de interés
      await this.checkNearbyPoints(userId, location);

    } catch (error) {
      this.logger.error(`Error updating location for user ${userId}: ${error.message}`);
      client.emit('navigation_error', {
        error: 'UPDATE_FAILED',
        message: 'Error al actualizar ubicación',
      });
    }
  }

  // Pausar navegación
  @SubscribeMessage('pause_navigation')
  handlePauseNavigation(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const session = this.activeSessions.get(userId);

    if (session) {
      session.isActive = false;
      client.emit('navigation_paused', {
        message: 'Navegación pausada',
        session: session,
      });
      this.logger.log(`Navigation paused for user ${userId}`);
    }
  }

  // Reanudar navegación
  @SubscribeMessage('resume_navigation')
  handleResumeNavigation(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const session = this.activeSessions.get(userId);

    if (session) {
      session.isActive = true;
      client.emit('navigation_resumed', {
        message: 'Navegación reanudada',
        session: session,
      });
      this.logger.log(`Navigation resumed for user ${userId}`);
    }
  }

  // Cancelar navegación
  @SubscribeMessage('cancel_navigation')
  handleCancelNavigation(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    this.endNavigation(userId, 'cancelled');
    client.emit('navigation_cancelled', {
      message: 'Navegación cancelada',
    });
  }

  // Solicitar recálculo de ruta
  @SubscribeMessage('recalculate_route')
  async handleRecalculateRoute(
    @ConnectedSocket() client: Socket,
    @MessageBody() location: { lat: number; lng: number },
  ) {
    const userId = client.data.userId;
    await this.recalculateRoute(userId, location);
  }

  // Métodos auxiliares privados

  private async handleArrival(userId: string, session: NavigationSession) {
    const client = this.clientSockets.get(userId);
    if (!client) return;

    const duration = new Date().getTime() - session.startTime.getTime();
    const durationMinutes = Math.ceil(duration / (1000 * 60));

    client.emit('navigation_completed', {
      message: `¡Has llegado a ${session.route?.destination?.nombre}!`,
      session: session,
      stats: {
        duration: durationMinutes,
        startTime: session.startTime,
        endTime: new Date(),
      },
    });

    this.endNavigation(userId, 'completed');
    this.logger.log(`User ${userId} arrived at destination`);
  }

  private async checkRouteDeviation(session: NavigationSession, currentLocation: LocationUpdate) {
    // Calcular distancia al punto más cercano de la ruta
    if (!session.route?.route?.puntos || !Array.isArray(session.route.route.puntos)) {
      return { isDeviated: false };
    }

    const routePoints = session.route.route.puntos;
    let minDistance = Infinity;

    for (const point of routePoints) {
      const distance = this.calculateDistance(
        currentLocation,
        { lat: point.lat, lng: point.lng }
      );
      minDistance = Math.min(minDistance, distance);
    }

    const deviationThreshold = 50; // 50 metros
    const isDeviated = minDistance > deviationThreshold;

    return {
      isDeviated,
      distance: minDistance,
      threshold: deviationThreshold,
    };
  }

  private async recalculateRoute(userId: string, currentLocation: { lat: number; lng: number }) {
    const client = this.clientSockets.get(userId);
    const session = this.activeSessions.get(userId);

    if (!client || !session) return;

    try {
      const newNavigation = await this.navigationService.createRouteFromCurrentLocation({
        currentLocation,
        destinationId: session.destinationId,
      });

      session.route = newNavigation;
      session.currentLocation = currentLocation;

      client.emit('route_recalculated', {
        navigation: newNavigation,
        message: 'Ruta recalculada',
      });

      this.logger.log(`Route recalculated for user ${userId}`);
    } catch (error) {
      client.emit('navigation_error', {
        error: 'RECALCULATION_FAILED',
        message: 'Error al recalcular la ruta',
      });
    }
  }

  private async checkNearbyPoints(userId: string, location: LocationUpdate) {
    const client = this.clientSockets.get(userId);
    if (!client) return;

    try {
      const nearbyPlaces = await this.navigationService.findNearbyPlaces(
        { lat: location.lat, lng: location.lng },
        30 // 30 metros
      );

      if (nearbyPlaces.length > 0) {
        const closestPlace = nearbyPlaces[0];
        client.emit('nearby_point', {
          place: closestPlace,
          message: `Estás cerca de ${closestPlace.nombre}`,
        });
      }
    } catch (error) {
      // Silently fail for nearby points
    }
  }

  private startLocationTracking(userId: string) {
    // Este método podría implementar tracking automático si es necesario
    // Por ahora, confiamos en que el cliente envíe actualizaciones
    this.logger.log(`Location tracking started for user ${userId}`);
  }

  private endNavigation(userId: string, reason: 'completed' | 'cancelled') {
    this.activeSessions.delete(userId);
    this.logger.log(`Navigation ended for user ${userId}: ${reason}`);
  }

  private calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = point1.lat * Math.PI/180;
    const φ2 = point2.lat * Math.PI/180;
    const Δφ = (point2.lat - point1.lat) * Math.PI/180;
    const Δλ = (point2.lng - point1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  // Métodos públicos para uso del servicio

  public notifyUser(userId: string, event: string, data: any) {
    const client = this.clientSockets.get(userId);
    if (client) {
      client.emit(event, data);
    }
  }

  public getActiveSession(userId: string): NavigationSession | undefined {
    return this.activeSessions.get(userId);
  }

  public getActiveSessions(): Map<string, NavigationSession> {
    return this.activeSessions;
  }

  // ✅ NUEVO: Destructor para limpiar interval
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}