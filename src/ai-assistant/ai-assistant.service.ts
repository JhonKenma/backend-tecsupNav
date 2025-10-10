// src/ai-assistant/ai-assistant.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { IntentDetectionService } from './services/intent-detection.service';
import { OpenAIIntegrationService } from './services/openai-integration.service';
import { ConversationalAIService } from './services/conversational-ai.service'; // 👈 NUEVO
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
    private conversationalAI: ConversationalAIService, // 👈 agregado
    private commandHandler: CommandHandlerService,
    private conversationHistory: ConversationHistoryService,
  ) {}

  /**
   * Procesar comando con IA conversacional REAL
   */
  async processCommand(
    userId: string,
    query: string,
    context?: CommandContext,
  ): Promise<AssistantResponse> {
    try {
      this.logger.log(`Processing command for user ${userId}: "${query}"`);

      // Si la IA conversacional está disponible, usarla
      if (context?.useAI !== false && this.conversationalAI.isAvailable()) {
        return await this.processWithConversationalAI(userId, query, context);
      }

      // Fallback: usar detección de reglas
      return await this.processWithRules(userId, query, context);

    } catch (error) {
      this.logger.error(`Error processing command: ${error.message}`);
      return this.createErrorResponse(query, error.message);
    }
  }

  /**
   * Procesar con IA conversacional (MODO INTELIGENTE)
   */
  private async processWithConversationalAI(
    userId: string,
    query: string,
    context?: CommandContext,
  ): Promise<AssistantResponse> {
    try {
      // Obtener historial reciente
      const history = this.conversationHistory.getHistory(userId, 5);

      // Obtener respuesta de la IA conversacional
      const aiResult = await this.conversationalAI.getConversationalResponse(
        query,
        history,
        context,
      );

      // Ejecutar acción sugerida si aplica
      let actionData: { placeId: string; place: any; places: any[] } | null = null;
      if (aiResult.suggestedAction === 'navigate' && aiResult.data?.destination) {
        const places = await this.commandHandler['navigationService'].searchPlaces({
          query: aiResult.data.destination,
          currentLocation: context?.currentLocation,
          maxResults: 5,
        });

        if (places.length > 0) {
          actionData = {
            placeId: places[0].id,
            place: places[0],
            places: places,
          };
        }
      }

      // Crear respuesta
      const response: AssistantResponse = {
        message: aiResult.message,
        intent: {
          intent: aiResult.intent as any,
          confidence: aiResult.confidence,
          entities: aiResult.data || {},
          originalQuery: query,
          interpretation: `IA conversacional: ${aiResult.intent}`,
        },
        action: aiResult.suggestedAction === 'info' ? 'show_info' : (aiResult.suggestedAction || 'none'),
        data: actionData,
      };

      // Guardar interacción en historial
      this.conversationHistory.saveInteraction(
        userId,
        query,
        aiResult.message,
        aiResult.intent,
      );

      return response;

    } catch (error) {
      this.logger.error(`Conversational AI error: ${error.message}`);
      // Fallback a reglas
      return await this.processWithRules(userId, query, context);
    }
  }

  /**
   * Procesar con reglas (modo básico)
   */
  private async processWithRules(
    userId: string,
    query: string,
    context?: CommandContext,
  ): Promise<AssistantResponse> {
    const normalizedQuery = this.intentDetection.normalizeQuery(query);
    const intent = await this.detectIntent(userId, normalizedQuery, context);
    const response = await this.handleIntent(userId, intent, context);

    this.conversationHistory.saveInteraction(
      userId,
      query,
      response.message,
      intent.intent,
    );

    return response;
  }

  /**
   * Detectar intención (con IA o reglas)
   */
  private async detectIntent(
    userId: string,
    query: string,
    context?: CommandContext,
  ): Promise<IntentResult> {
    const ruleBasedIntent = this.intentDetection.detectWithRules(query);

    if (ruleBasedIntent.confidence > 0.8) {
      return ruleBasedIntent;
    }

    if (context?.useAI !== false && this.openaiIntegration.isAvailable()) {
      try {
        const aiIntent = await this.openaiIntegration.detectIntent(query, context);
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
    context?: CommandContext,
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

      default:
        return this.commandHandler.handleUnknown(intent);
    }
  }

  /**
   * Obtener historial de conversación
   */
  getConversationHistory(userId: string, limit?: number) {
    return this.conversationHistory.getHistory(userId, limit);
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
    return this.conversationHistory.getUserStats(userId);
  }

  /**
   * Obtener estadísticas globales (admin)
   */
  getGlobalStats() {
    return this.conversationHistory.getGlobalStats();
  }

  /**
   * Verificar si IA conversacional está disponible
   */
  isAIAvailable(): boolean {
    return this.conversationalAI.isAvailable();
  }

  /**
   * Crear respuesta de error
   */
  private createErrorResponse(query: string, error: string): AssistantResponse {
    return {
      message:
        'Lo siento, ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.',
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
