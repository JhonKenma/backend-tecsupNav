// src/navigation/navigation-state.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { NavigationGateway } from './navigation.gateway';

export interface NavigationStats {
  totalSessions: number;
  activeSessions: number;
  completedToday: number;
  averageDuration: number;
  popularDestinations: string[];
}

@Injectable()
export class NavigationStateService {
  private readonly logger = new Logger(NavigationStateService.name);
  private sessionHistory: any[] = [];

  constructor(private navigationGateway: NavigationGateway) {}

  /**
   * Obtener estadísticas de navegación en tiempo real
   */
  getNavigationStats(): NavigationStats {
    const activeSessions = this.navigationGateway.getActiveSessions();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedToday = this.sessionHistory.filter(
      session => new Date(session.endTime) >= today && session.status === 'completed'
    ).length;

    const completedSessions = this.sessionHistory.filter(
      session => session.status === 'completed'
    );

    const averageDuration = completedSessions.length > 0 
      ? completedSessions.reduce((sum, session) => sum + session.duration, 0) / completedSessions.length
      : 0;

    const destinationCounts = new Map<string, number>();
    this.sessionHistory.forEach(session => {
      const dest = session.destinationName;
      destinationCounts.set(dest, (destinationCounts.get(dest) || 0) + 1);
    });

    const popularDestinations = Array.from(destinationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([dest]) => dest);

    return {
      totalSessions: this.sessionHistory.length,
      activeSessions: activeSessions.size,
      completedToday,
      averageDuration: Math.round(averageDuration),
      popularDestinations,
    };
  }

  /**
   * Registrar finalización de sesión
   */
  recordSessionEnd(userId: string, session: any, status: 'completed' | 'cancelled') {
    const endTime = new Date();
    const duration = endTime.getTime() - new Date(session.startTime).getTime();

    this.sessionHistory.push({
      userId,
      destinationId: session.destinationId,
      destinationName: session.route?.destination?.nombre || 'Desconocido',
      startTime: session.startTime,
      endTime,
      duration: Math.ceil(duration / (1000 * 60)), // en minutos
      status,
    });

    // Mantener solo los últimos 1000 registros para evitar consumo excesivo de memoria
    if (this.sessionHistory.length > 1000) {
      this.sessionHistory = this.sessionHistory.slice(-1000);
    }

    this.logger.log(`Session recorded: ${userId} -> ${session.route?.destination?.nombre} (${status})`);
  }

  /**
   * Obtener sesiones activas
   */
  getActiveSessions() {
    return Array.from(this.navigationGateway.getActiveSessions().entries()).map(([userId, session]) => ({
      userId,
      destinationName: session.route?.destination?.nombre,
      startTime: session.startTime,
      currentLocation: session.currentLocation,
    }));
  }


  /**
   * Enviar notificación a usuario específico
   */
  notifyUser(userId: string, message: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') {
    this.navigationGateway.notifyUser(userId, 'notification', {
      message,
      type,
      timestamp: new Date(),
    });
  }

  /**
   * Enviar notificación a todos los usuarios navegando
   */
  notifyAllNavigatingUsers(message: string, type: 'info' | 'warning' | 'success' | 'error' = 'info') {
    const activeSessions = this.navigationGateway.getActiveSessions();
    
    activeSessions.forEach((session, userId) => {
      if (session.isActive) {
        this.notifyUser(userId, message, type);
      }
    });

    this.logger.log(`Broadcast notification sent to ${activeSessions.size} active users: ${message}`);
  }
}