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
  private prisma: any;

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

// src/ai-assistant/ai-assistant.service.ts

/**
 * Procesar con IA conversacional (MODO INTELIGENTE)
 */
private async processWithConversationalAI(
  userId: string,
  query: string,
  context?: CommandContext,
): Promise<AssistantResponse> {
  try {
    // 🔥 Obtener historial reciente (aumentado de 5 a 10 para mejor contexto)
    const history = this.conversationHistory.getHistory(userId, 10);

    // Obtener respuesta de la IA conversacional
    const aiResult = await this.conversationalAI.getConversationalResponse(
      query,
      history,
      context,
    );

    // 🔥 Detectar si el usuario está confirmando una acción del mensaje anterior
    const lastMessage = history.length > 0 ? history[history.length - 1] : null;
    const isConfirmingNavigation = 
      lastMessage && 
      /(si necesitas ayuda|solo dime|puedo ayudarte a llegar)/i.test(lastMessage.response) &&
      /(sí|si|claro|por favor|necesito|ayuda)/i.test(query.toLowerCase());

    // 🔥 Si está confirmando navegación, extraer lugar del mensaje anterior
    let destination: string | undefined = undefined;
    if (isConfirmingNavigation && lastMessage) {
      destination = await this.extractPlaceFromMessage(lastMessage.response);
    }

    // Si no encontró destino por confirmación, usar detección normal
    if (!destination) {
      // 🔥 Detectar intención con reglas para extraer entidades
      const ruleIntent = this.intentDetection.detectWithRules(query);
      destination = ruleIntent.entities?.destination || aiResult.data?.destination;
    }

    // 🔥 Determinar la intención final
    const ruleIntent = this.intentDetection.detectWithRules(query);
    const finalIntent = isConfirmingNavigation 
      ? 'navigate' 
      : (aiResult.confidence > ruleIntent.confidence ? aiResult.intent : ruleIntent.intent);

    // 🔥 EJECUTAR ACCIÓN SEGÚN INTENCIÓN
    let actionData: any = null;
    let finalMessage = aiResult.message;
    let finalAction = aiResult.suggestedAction || 'none';

    // 🔥 Si encontró lugar por confirmación, forzar navegación INMEDIATAMENTE
    if (isConfirmingNavigation && destination) {
      const places = await this.commandHandler['navigationService'].searchPlaces({
        query: destination,
        currentLocation: context?.currentLocation,
        maxResults: 1,
      });

      if (places.length > 0) {
        const place = places[0];
        const distanceInfo = place.distancia > 0 
          ? `Está a ${Math.round(place.distancia)}m de tu ubicación (${place.tiempoEstimadoCaminando} min caminando).`
          : '';

        // Guardar interacción ANTES de retornar
        this.conversationHistory.saveInteraction(
          userId,
          query,
          `Perfecto, te llevaré a ${place.nombre}. ${distanceInfo}`,
          'navigate',
        );

        return {
          message: `Perfecto, te llevaré a ${place.nombre}. ${distanceInfo}`,
          intent: {
            intent: 'navigate' as any,
            confidence: 0.95,
            entities: { destination: place.nombre },
            originalQuery: query,
            interpretation: 'Confirmación de navegación',
          },
          action: 'navigate',
          data: {
            placeId: place.id,
            place: place,
          },
        };
      }
    }

    // Si es navegación (no confirmación), SIEMPRE buscar el lugar
    if (finalIntent === 'navigate' && destination) {
      const places = await this.commandHandler['navigationService'].searchPlaces({
        query: destination,
        currentLocation: context?.currentLocation,
        maxResults: 5,
      });

      if (places.length === 1) {
        // ✅ UN SOLO RESULTADO: Navegar directamente
        const place = places[0];
        const distanceInfo = place.distancia > 0 
          ? `Está a ${Math.round(place.distancia)}m de tu ubicación (${place.tiempoEstimadoCaminando} min caminando).`
          : '';

        actionData = {
          placeId: place.id,
          place: place,
        };

        finalMessage = `Perfecto, te llevaré a ${place.nombre}. ${distanceInfo}`;
        finalAction = 'navigate';

      } else if (places.length > 1) {
        // 🔀 MÚLTIPLES RESULTADOS: Pedir confirmación
        actionData = { places };
        finalMessage = `Encontré ${places.length} lugares con "${destination}". ¿A cuál quieres ir?`;
        finalAction = 'none';

        // Guardar interacción
        this.conversationHistory.saveInteraction(
          userId,
          query,
          finalMessage,
          finalIntent,
        );

        return {
          message: finalMessage,
          intent: {
            intent: 'navigate' as any,
            confidence: aiResult.confidence,
            entities: { destination },
            originalQuery: query,
            interpretation: `IA conversacional: navigate (múltiples opciones)`,
          },
          action: finalAction as any,
          data: actionData,
          requiresConfirmation: true,
          options: places.map(place => ({
            id: place.id,
            label: place.nombre,
            description: this.buildPlaceDescription(place),
          })),
        };

      } else {
        // ❌ NO SE ENCONTRÓ: Usar mensaje de la IA
        finalAction = 'none';
      }
    }

    // Si es búsqueda, ejecutar búsqueda
    if (finalIntent === 'search' && destination) {
      const places = await this.commandHandler['navigationService'].searchPlaces({
        query: destination,
        currentLocation: context?.currentLocation,
        maxResults: 10,
      });

      if (places.length > 0) {
        actionData = { places };
        finalMessage = `Encontré ${places.length} lugares relacionados con "${destination}":`;
        finalAction = 'search';
      }
    }

    // Crear respuesta final
    const response: AssistantResponse = {
      message: finalMessage,
      intent: {
        intent: finalIntent as any,
        confidence: aiResult.confidence,
        entities: { destination, ...ruleIntent.entities },
        originalQuery: query,
        interpretation: `IA conversacional: ${finalIntent}`,
      },
      action: finalAction as any,
      data: actionData,
    };

    // Guardar interacción en historial
    this.conversationHistory.saveInteraction(
      userId,
      query,
      finalMessage,
      finalIntent,
    );

    return response;

  } catch (error) {
    this.logger.error(`Conversational AI error: ${error.message}`);
    // Fallback a reglas
    return await this.processWithRules(userId, query, context);
  }
}

/**
 * 🔥 NUEVO: Extraer lugar mencionado en un mensaje
 */
private async extractPlaceFromMessage(message: string): Promise<string | undefined> {
  try {
    const places = await this.commandHandler['navigationService'].searchPlaces({
      query: '',
      maxResults: 1000,
    });

    // Buscar si algún lugar es mencionado en el mensaje
    for (const place of places) {
      if (message.includes(place.nombre)) {
        return place.nombre;
      }
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Construir descripción de lugar (método auxiliar)
 */
private buildPlaceDescription(place: any): string {
  const parts: string[] = [];
  
  if (place.edificio) parts.push(place.edificio);
  if (place.piso) parts.push(`Piso ${place.piso}`);
  if (place.distancia > 0) {
    parts.push(`${Math.round(place.distancia)}m, ${place.tiempoEstimadoCaminando} min`);
  }
  
  return parts.join(' - ');
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
      case 'greeting':
        const user = await this.prisma.user.findUnique({ 
          where: { id: userId },
          select: { nombre: true } 
        });
        return this.commandHandler.handleGreeting(user?.nombre);
        
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