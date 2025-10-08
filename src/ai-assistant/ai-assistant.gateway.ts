// src/ai-assistant/ai-assistant.gateway.ts
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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AIAssistantService } from './ai-assistant.service';

interface VoiceSession {
  userId: string;
  isListening: boolean;
  conversationId: string;
  startTime: Date;
  currentLocation?: { lat: number; lng: number };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/ai-assistant',
})
export class AIAssistantGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AIAssistantGateway.name);
  private activeSessions = new Map<string, VoiceSession>();
  private clientSockets = new Map<string, Socket>();

  constructor(
    private aiAssistantService: AIAssistantService,
    private jwtService: JwtService,
  ) {}

  // Conexión del cliente
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      if (payload.role !== 'STUDENT') {
        this.logger.warn(`Non-student user ${userId} tried to connect to AI assistant`);
        client.disconnect();
        return;
      }

      this.clientSockets.set(userId, client);
      client.data.userId = userId;

      this.logger.log(`User ${userId} connected to AI assistant (${client.id})`);
      
      client.emit('connected', {
        message: 'Conectado al asistente de IA',
        userId,
        features: [
          'Comandos de voz',
          'Comandos de texto',
          'Navegación por voz',
          'Búsqueda inteligente',
        ],
      });

    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  // Desconexión del cliente
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.clientSockets.delete(userId);
      this.activeSessions.delete(userId);
      this.logger.log(`User ${userId} disconnected from AI assistant`);
    }
  }

  // Activar escucha del asistente (RF-401)
  @SubscribeMessage('activate_listening')
  handleActivateListening(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    
    try {
      const session: VoiceSession = {
        userId,
        isListening: true,
        conversationId: `${userId}_${Date.now()}`,
        startTime: new Date(),
      };

      this.activeSessions.set(userId, session);

      client.emit('listening_activated', {
        message: 'Escuchando... Puedes hablar ahora',
        conversationId: session.conversationId,
        status: 'listening',
      });

      this.logger.log(`Listening activated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error activating listening: ${error.message}`);
      client.emit('assistant_error', {
        error: 'ACTIVATION_FAILED',
        message: 'Error al activar la escucha. Verifica los permisos del micrófono.',
      });
    }
  }

  // Desactivar escucha
  @SubscribeMessage('deactivate_listening')
  handleDeactivateListening(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const session = this.activeSessions.get(userId);

    if (session) {
      session.isListening = false;
      client.emit('listening_deactivated', {
        message: 'Escucha desactivada',
      });
      this.logger.log(`Listening deactivated for user ${userId}`);
    }
  }

  // Procesar comando de voz (RF-402: Interpretar comando)
  @SubscribeMessage('voice_command')
  async handleVoiceCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      text: string;
      audio?: string; // Base64 audio (opcional, para futuras mejoras)
      currentLocation?: { lat: number; lng: number };
    },
  ) {
    const userId = client.data.userId;
    const session = this.activeSessions.get(userId);

    if (!session || !session.isListening) {
      client.emit('assistant_error', {
        error: 'NOT_LISTENING',
        message: 'El asistente no está escuchando. Activa la escucha primero.',
      });
      return;
    }

    try {
      this.logger.log(`Processing voice command for user ${userId}: "${data.text}"`);

      // Notificar que está procesando
      client.emit('processing_command', {
        message: 'Procesando tu comando...',
        text: data.text,
      });

      // Procesar comando con el servicio principal
      const response = await this.aiAssistantService.processCommand(
        userId,
        data.text,
        {
          currentLocation: data.currentLocation || session.currentLocation,
          conversationId: session.conversationId,
        }
      );

      // Enviar respuesta
      client.emit('command_processed', {
        query: data.text,
        response: response,
        timestamp: new Date(),
      });

      // Si la acción es navegar, iniciar navegación (RF-403)
      if (response.action === 'navigate' && response.data?.placeId) {
        client.emit('start_navigation', {
          destinationId: response.data.placeId,
          destination: response.data.place,
          message: 'Iniciando navegación...',
        });
      }

      this.logger.log(`Command processed successfully for user ${userId}`);

    } catch (error) {
      this.logger.error(`Error processing voice command: ${error.message}`);
      client.emit('assistant_error', {
        error: 'PROCESSING_FAILED',
        message: 'Error al procesar tu comando. Intenta de nuevo.',
        details: error.message,
      });
    }
  }

  // Procesar comando de texto
  @SubscribeMessage('text_command')
  async handleTextCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      text: string;
      currentLocation?: { lat: number; lng: number };
    },
  ) {
    const userId = client.data.userId;

    try {
      this.logger.log(`Processing text command for user ${userId}: "${data.text}"`);

      client.emit('processing_command', {
        message: 'Procesando...',
        text: data.text,
      });

      const response = await this.aiAssistantService.processCommand(
        userId,
        data.text,
        {
          currentLocation: data.currentLocation,
        }
      );

      client.emit('command_processed', {
        query: data.text,
        response: response,
        timestamp: new Date(),
      });

      if (response.action === 'navigate' && response.data?.placeId) {
        client.emit('start_navigation', {
          destinationId: response.data.placeId,
          destination: response.data.place,
          message: 'Iniciando navegación...',
        });
      }

    } catch (error) {
      this.logger.error(`Error processing text command: ${error.message}`);
      client.emit('assistant_error', {
        error: 'PROCESSING_FAILED',
        message: 'Error al procesar tu comando.',
        details: error.message,
      });
    }
  }

  // Confirmar selección de lugar (cuando hay múltiples opciones)
  @SubscribeMessage('confirm_selection')
  async handleConfirmSelection(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      placeId: string;
      currentLocation?: { lat: number; lng: number };
    },
  ) {
    const userId = client.data.userId;

    try {
      // Obtener información del lugar seleccionado
      const places = await this.aiAssistantService['navigationService'].searchPlaces({
        query: '',
        maxResults: 100,
      });

      const selectedPlace = places.find(p => p.id === data.placeId);

      if (!selectedPlace) {
        client.emit('assistant_error', {
          error: 'PLACE_NOT_FOUND',
          message: 'El lugar seleccionado no se encontró.',
        });
        return;
      }

      client.emit('selection_confirmed', {
        message: `Has seleccionado ${selectedPlace.nombre}. Iniciando navegación...`,
        place: selectedPlace,
      });

      client.emit('start_navigation', {
        destinationId: selectedPlace.id,
        destination: selectedPlace,
      });

      this.logger.log(`User ${userId} confirmed selection: ${selectedPlace.nombre}`);

    } catch (error) {
      this.logger.error(`Error confirming selection: ${error.message}`);
      client.emit('assistant_error', {
        error: 'CONFIRMATION_FAILED',
        message: 'Error al confirmar la selección.',
      });
    }
  }

  // Actualizar ubicación actual
  @SubscribeMessage('update_location')
  handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() location: { lat: number; lng: number },
  ) {
    const userId = client.data.userId;
    const session = this.activeSessions.get(userId);

    if (session) {
      session.currentLocation = location;
      this.logger.debug(`Location updated for user ${userId}: ${location.lat}, ${location.lng}`);
    }
  }

  // Obtener historial de conversación
  @SubscribeMessage('get_conversation_history')
  handleGetHistory(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    try {
      const history = this.aiAssistantService.getConversationHistory(userId);
      
      client.emit('conversation_history', {
        history: history,
        count: history.length,
      });

    } catch (error) {
      this.logger.error(`Error getting history: ${error.message}`);
      client.emit('assistant_error', {
        error: 'HISTORY_FAILED',
        message: 'Error al obtener el historial.',
      });
    }
  }

  // Limpiar historial
  @SubscribeMessage('clear_history')
  handleClearHistory(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    try {
      this.aiAssistantService.clearConversationHistory(userId);
      
      client.emit('history_cleared', {
        message: 'Historial limpiado correctamente',
      });

      this.logger.log(`History cleared for user ${userId}`);

    } catch (error) {
      this.logger.error(`Error clearing history: ${error.message}`);
    }
  }

  // Solicitar sugerencias de comandos
  @SubscribeMessage('get_suggestions')
  handleGetSuggestions(@ConnectedSocket() client: Socket) {
    const suggestions = [
      'Llévame a la biblioteca',
      'Buscar laboratorios',
      '¿Dónde está la cafetería?',
      'Quiero ir al pabellón B',
      'Mostrar aulas disponibles',
      '¿Qué es el laboratorio de redes?',
    ];

    client.emit('suggestions_response', {
      suggestions: suggestions,
      message: 'Aquí tienes algunos comandos que puedes usar:',
    });
  }

  // Métodos públicos para uso externo

  /**
   * Enviar notificación a un usuario específico
   */
  public notifyUser(userId: string, event: string, data: any) {
    const client = this.clientSockets.get(userId);
    if (client) {
      client.emit(event, data);
    }
  }

  /**
   * Obtener sesión activa de un usuario
   */
  public getSession(userId: string): VoiceSession | undefined {
    return this.activeSessions.get(userId);
  }

  /**
   * Verificar si un usuario está escuchando
   */
  public isListening(userId: string): boolean {
    const session = this.activeSessions.get(userId);
    return session?.isListening || false;
  }

  /**
   * Obtener estadísticas del gateway
   */
  public getStats() {
    return {
      connectedUsers: this.clientSockets.size,
      activeSessions: this.activeSessions.size,
      listeningUsers: Array.from(this.activeSessions.values()).filter(s => s.isListening).length,
    };
  }
}