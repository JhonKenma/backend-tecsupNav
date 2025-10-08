// src/ai-assistant/ai-assistant.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { IntentDetectionService } from './services/intent-detection.service';
import { OpenAIIntegrationService } from './services/openai-integration.service';
import { CommandHandlerService } from './services/command-handler.service';
import { ConversationHistoryService } from './services/conversation-history.service';
import { IntentResult, AssistantResponse } from './interfaces';

export interface CommandContext {
  currentLocation?: { lat: number; lng: number };
  conversationId?: string;
  useAI?: boolean;
}

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name);

  constructor(
    private intentDetection: IntentDetectionService,
    private openaiIntegration: OpenAIIntegrationService,
    private commandHandler: CommandHandlerService,
    private conversationHistory: ConversationHistoryService,
  ) {}

  /**
   * Procesar comando de texto o voz (método principal)
   */
  async processCommand(
    userId: string,
    query: string,
    context?: CommandContext
  ): Promise<AssistantResponse> {
    try {
      this.logger.log(`Processing command for user ${userId}: "${query}"`);

      // 1. Normalizar query
      const normalizedQuery = this.intentDetection.normalizeQuery(query);

      // 2. Detectar intención
      const intent = await this.detectIntent(userId, normalizedQuery, context);

      // 3. Manejar según intención
      const response = await this.handleIntent(userId, intent, context);

      // 4. Guardar en historial
      this.conversationHistory.saveInteraction( // ✅ corregido
        userId,
        query,
        response.message,
        intent.intent
      );

      return response;

    } catch (error) {
      this.logger.error(`Error processing command: ${error.message}`);
      return this.createErrorResponse(query, error.message);
    }
  }

  /**
   * Detectar intención (con IA si está disponible)
   */
  private async detectIntent(
    userId: string,
    query: string,
    context?: CommandContext
  ): Promise<IntentResult> {
    
    // Primero intentar con reglas (rápido)
    const ruleBasedIntent = this.intentDetection.detectWithRules(query);

    // Si la confianza es alta, usar ese resultado
    if (ruleBasedIntent.confidence > 0.8) {
      return ruleBasedIntent;
    }

    // Si OpenAI está disponible y el usuario quiere usarlo
    if (context?.useAI !== false && this.openaiIntegration.isAvailable()) {
      try {
        const aiIntent = await this.openaiIntegration.detectIntent(query, context);
        
        // Si IA tiene mayor confianza, usar ese resultado
        if (aiIntent.confidence > ruleBasedIntent.confidence) {
          return aiIntent;
        }
      } catch (error) {
        this.logger.warn(`AI detection failed, using rules: ${error.message}`);
      }
    }

    return ruleBasedIntent;
  }

  /**
   * Manejar intención detectada
   */
  private async handleIntent(
    userId: string,
    intent: IntentResult,
    context?: CommandContext
  ): Promise<AssistantResponse> {
    
    switch (intent.intent) {
      case 'navigate':
        return await this.commandHandler.handleNavigate(userId, intent, context);
      
      case 'search':
        return await this.commandHandler.handleSearch(userId, intent, context);
      
      case 'information':
        return await this.commandHandler.handleInformation(userId, intent, context);
      
      case 'greeting':
        return this.commandHandler.handleGreeting();
      
      case 'help':
        return this.commandHandler.handleHelp();
      
      case 'unknown':
      default:
        return this.commandHandler.handleUnknown(intent);
    }
  }

  /**
   * Obtener historial de conversación
   */
  getConversationHistory(userId: string, limit?: number) {
    return this.conversationHistory.getHistory(userId, limit); // ✅ corregido
  }

  /**
   * Limpiar historial
   */
  clearConversationHistory(userId: string) {
    this.conversationHistory.clearHistory(userId);
  }

  /**
   * Obtener estadísticas del usuario
   */
  getUserStats(userId: string) {
    return this.conversationHistory.getUserStats(userId); // ✅ corregido
  }

  /**
   * Obtener estadísticas globales (admin)
   */
  getGlobalStats() {
    return this.conversationHistory.getGlobalStats(); // ✅ corregido
  }

  /**
   * Verificar si OpenAI está disponible
   */
  isAIAvailable(): boolean {
    return this.openaiIntegration.isAvailable();
  }

  /**
   * Crear respuesta de error
   */
  private createErrorResponse(query: string, error: string): AssistantResponse {
    return {
      message: 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.',
      intent: {
        intent: 'unknown',
        confidence: 0,
        entities: {},
        originalQuery: query,
        interpretation: `Error: ${error}`,
      },
      action: 'none',
      suggestions: [
        'Intenta decir: "Llévame a la biblioteca"',
        'O pregunta: "¿Dónde está la cafetería?"',
      ],
    };
  }
}
