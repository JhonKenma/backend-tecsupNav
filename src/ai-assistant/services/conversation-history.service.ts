// src/ai-assistant/services/conversation-history.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface ConversationEntry {
  timestamp: Date;
  query: string;
  response: string;
  intent: string;
  userId: string;
}


@Injectable()
export class ConversationHistoryService {
  private readonly logger = new Logger(ConversationHistoryService.name);
  private conversationHistory = new Map<string, ConversationEntry[]>();
  private readonly MAX_HISTORY_PER_USER = 50;

  /**
   * Guardar interacción en el historial
   */
  saveInteraction(
    userId: string,
    query: string,
    response: string,
    intent: string
  ): void {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }

    const history = this.conversationHistory.get(userId);
    
    if (history) {
      history.push({
        timestamp: new Date(),
        query,
        response,
        intent,
        userId,
      });
    }

    // Mantener solo los últimos N mensajes
    if (history && history.length > this.MAX_HISTORY_PER_USER) {
      this.conversationHistory.set(userId, history.slice(-this.MAX_HISTORY_PER_USER));
    }

    this.logger.debug(`Saved interaction for user ${userId}: ${intent}`);
  }

  /**
   * Obtener historial de usuario
   */
  getHistory(userId: string, limit?: number): ConversationEntry[] {
    const history = this.conversationHistory.get(userId) || [];
    
    if (limit && limit > 0) {
      return history.slice(-limit);
    }
    
    return history;
  }

  /**
   * Obtener contexto reciente para IA
   */
  getRecentContext(userId: string, count: number = 5): string {
    const history = this.getHistory(userId, count);
    
    if (history.length === 0) {
      return 'No hay conversación previa.';
    }

    return history
      .map(entry => `Usuario: ${entry.query}\nAsistente: ${entry.response}`)
      .join('\n\n');
  }

  /**
   * Limpiar historial de usuario
   */
  clearHistory(userId: string): void {
    this.conversationHistory.delete(userId);
    this.logger.log(`Cleared history for user ${userId}`);
  }

  /**
   * Obtener estadísticas de usuario
   */
  getUserStats(userId: string): {
    totalInteractions: number;
    mostCommonIntent: string;
    lastInteraction: Date | null;
  } {
    const history = this.getHistory(userId);
    
    if (history.length === 0) {
      return {
        totalInteractions: 0,
        mostCommonIntent: 'none',
        lastInteraction: null,
      };
    }

    // Contar intenciones
    const intentCounts = new Map<string, number>();
    history.forEach(entry => {
      intentCounts.set(entry.intent, (intentCounts.get(entry.intent) || 0) + 1);
    });

    // Encontrar la más común
    let mostCommonIntent = 'unknown';
    let maxCount = 0;
    intentCounts.forEach((count, intent) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonIntent = intent;
      }
    });

    return {
      totalInteractions: history.length,
      mostCommonIntent,
      lastInteraction: history[history.length - 1].timestamp,
    };
  }

  /**
   * Obtener estadísticas globales
   */
  getGlobalStats(): {
    totalUsers: number;
    totalInteractions: number;
    intentDistribution: Record<string, number>;
  } {
    let totalInteractions = 0;
    const intentCounts = new Map<string, number>();

    this.conversationHistory.forEach((history) => {
      totalInteractions += history.length;
      history.forEach(entry => {
        intentCounts.set(entry.intent, (intentCounts.get(entry.intent) || 0) + 1);
      });
    });

    const intentDistribution: Record<string, number> = {};
    intentCounts.forEach((count, intent) => {
      intentDistribution[intent] = count;
    });

    return {
      totalUsers: this.conversationHistory.size,
      totalInteractions,
      intentDistribution,
    };
  }
}