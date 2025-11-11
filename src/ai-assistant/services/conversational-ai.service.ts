// src/ai-assistant/services/conversational-ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { NavigationService } from '../../navigation/navigation.service';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class ConversationalAIService {
  private readonly logger = new Logger(ConversationalAIService.name);
  private openai: OpenAI | null = null;
  private isConfigured = false;
  private placesContext: string = '';
  private lastContextUpdate: Date | null = null;

  constructor(
    private configService: ConfigService,
    private navigationService: NavigationService,
  ) {
    this.initializeOpenAI();
    this.loadPlacesContext();
  }

  private initializeOpenAI() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey || apiKey === 'tu_openai_api_key_aqui') {
      this.logger.warn('OpenAI not configured. AI features disabled.');
      this.isConfigured = false;
      return;
    }

    try {
      this.openai = new OpenAI({ apiKey });
      this.isConfigured = true;
      this.logger.log('✅ Conversational AI initialized with OpenAI');
    } catch (error) {
      this.logger.error(`Failed to initialize OpenAI: ${error.message}`);
      this.isConfigured = false;
    }
  }

  /**
   * 🔥 Cargar contexto con timeout y retry
   */
  private async loadPlacesContext() {
    try {
      // Timeout de 5 segundos
      const places = await Promise.race([
        this.navigationService.getAllPlaces(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        ),
      ]) as any[];

      // Agrupar por tipo
      const grouped = places.reduce((acc, place) => {
        const tipo = place.tipo?.nombre || 'Otros';
        if (!acc[tipo]) acc[tipo] = [];
        acc[tipo].push(place);
        return acc;
      }, {});

      // Construir contexto legible (limitado)
      let context = '=== LUGARES DEL CAMPUS TECSUP ===\n\n';

      for (const [tipo, lugares] of Object.entries(grouped)) {
        context += `${tipo.toUpperCase()}S:\n`;
        // 🔥 Limitar a 20 lugares por tipo para no sobrecargar
        (lugares as any[]).slice(0, 20).forEach(lugar => {
          context += `- ${lugar.nombre}`;
          if (lugar.edificio) context += ` (${lugar.edificio}`;
          if (lugar.piso) context += `, piso ${lugar.piso}`;
          if (lugar.edificio) context += ')';
          context += `\n`;
        });
        context += '\n';
      }

      // Agregar información adicional
      const edificios = [...new Set(places.filter(p => p.edificio).map(p => p.edificio))];
      if (edificios.length > 0) {
        context += 'PABELLONES:\n';
        edificios.forEach(e => context += `- ${e}\n`);
        context += '\n';
      }

      this.placesContext = context;
      this.lastContextUpdate = new Date();
      
      this.logger.log(`✅ Contexto cargado: ${places.length} lugares`);
    } catch (error) {
      this.logger.error(`Error loading context: ${error.message}`);
      // 🔥 Usar contexto vacío como fallback
      this.placesContext = 'Información del campus temporalmente no disponible.';
    }
  }

  /**
   * 🔥 Refrescar contexto solo si es necesario (10 minutos)
   */
  private async refreshContextIfNeeded() {
    const tenMinutes = 10 * 60 * 1000; // Aumentado de 5 a 10 minutos
    if (!this.lastContextUpdate || 
        Date.now() - this.lastContextUpdate.getTime() > tenMinutes) {
      await this.loadPlacesContext();
    }
  }

  /**
   * Verificar disponibilidad
   */
  isAvailable(): boolean {
    return this.isConfigured && this.openai !== null;
  }

  /**
   * 🔥 MÉTODO PRINCIPAL: Respuesta conversacional con timeout
   */
  async getConversationalResponse(
    userQuery: string,
    conversationHistory: Array<{query: string; response: string}> = [],
    context?: any,
  ): Promise<{
    message: string;
    intent: string;
    confidence: number;
    suggestedAction?: 'navigate' | 'search' | 'info' | 'none';
    data?: any;
  }> {
    if (!this.isAvailable()) {
      throw new Error('Conversational AI is not available');
    }

    await this.refreshContextIfNeeded();

    const messages = this.buildConversation(userQuery, conversationHistory, context);

    try {
      // 🔥 Timeout de 10 segundos para OpenAI
      const completion = await Promise.race([
        this.openai!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 500, // 🔥 Reducido de 800
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI timeout')), 10000)
        ),
      ]) as any;

      const aiResponse = completion.choices[0].message.content || '';

      // Analizar la respuesta
      const analysis = await this.analyzeResponse(userQuery, aiResponse);

      return {
        message: aiResponse,
        intent: analysis.intent,
        confidence: analysis.confidence,
        suggestedAction: analysis.action,
        data: analysis.data,
      };

    } catch (error) {
      this.logger.error(`Conversation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Construir la conversación completa
   */
  private buildConversation(
    userQuery: string,
    history: Array<{query: string; response: string}>,
    context?: any,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Sistema: Personalidad y conocimiento
    messages.push({
      role: 'system',
      content: `Eres un asistente virtual amigable y servicial del campus Tecsup Lima. Tu nombre es "Tecsup Assistant".

TU PERSONALIDAD:
- Eres amable, conversacional y natural
- Hablas en español peruano de forma cercana
- Usas emojis ocasionalmente para ser más amigable 
- No eres robótico, eres como un amigo que conoce bien el campus
- Puedes hacer pequeñas bromas o comentarios amigables
- Si no sabes algo, lo admites con honestidad
- 🔥 IMPORTANTE: SIEMPRE recuerdas el contexto de la conversación anterior

TU CONOCIMIENTO:
${this.placesContext}

TUS CAPACIDADES:
✅ Ayudar a navegar a cualquier lugar del campus
✅ Buscar aulas, laboratorios, oficinas y servicios
✅ Dar información detallada sobre ubicaciones
✅ Responder preguntas sobre el campus
✅ Sugerir rutas y lugares cercanos
✅ 🔥 MANTENER contexto de conversaciones previas

CÓMO MANEJAS EL CONTEXTO:
- Si el usuario dice "sí necesito ayuda" o similar, revisa el mensaje anterior
- Si mencionaste lugares en el mensaje anterior, úsalos en tu respuesta
- Mantén coherencia con lo que dijiste antes
- Si el usuario se refiere a "eso", "ahí", "allí", usa el contexto previo

IMPORTANTE AL DAR DIRECCIONES:
- Cuando el usuario CONFIRME que quiere ayuda para llegar, responde: "Perfecto, te llevaré a [LUGAR EXACTO]. Iniciando navegación..."
- NO des instrucciones manuales, el sistema iniciará la navegación automática
- Sé específico con el lugar exacto (ejemplo: "SS.HH. Segundo Piso - Pabellón 4")`,
    });

    // 🔥 Historial de conversación (últimos 10 mensajes)
    const recentHistory = history.slice(-10);
    recentHistory.forEach(entry => {
      messages.push(
        { role: 'user', content: entry.query },
        { role: 'assistant', content: entry.response },
      );
    });

    // Contexto adicional (ubicación actual)
    let userMessage = userQuery;
    if (context?.currentLocation) {
      userMessage += `\n\n[Contexto: El usuario está actualmente en lat: ${context.currentLocation.lat}, lng: ${context.currentLocation.lng}]`;
    }

    // Mensaje actual del usuario
    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

  /**
   * Analizar respuesta de la IA para extraer intención
   */
  private async analyzeResponse(
    userQuery: string,
    aiResponse: string,
  ): Promise<{
    intent: string;
    confidence: number;
    action?: 'navigate' | 'search' | 'info' | 'none';
    data?: any;
  }> {
    const lowerQuery = userQuery.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();

    // 🔥 Detectar confirmación de ayuda
    if (/(sí|si|claro|por favor|necesito|ayuda|llévame|quiero ir)/i.test(lowerQuery) &&
        /iniciar|navegación|llevar|guiar/i.test(lowerResponse)) {
      return {
        intent: 'navigate',
        confidence: 0.95,
        action: 'navigate',
      };
    }

    // Detectar intención basada en el query
    if (/(llévame|ir a|cómo llego|navegar|quiero ir)/i.test(lowerQuery)) {
      const placeMatch = await this.extractPlaceFromResponse(aiResponse);
      return {
        intent: 'navigate',
        confidence: 0.9,
        action: 'navigate',
        data: placeMatch ? { destination: placeMatch } : undefined,
      };
    }

    if (/(buscar|mostrar|listar|qué.*hay|cuántos)/i.test(lowerQuery)) {
      return {
        intent: 'search',
        confidence: 0.85,
        action: 'search',
      };
    }

    if (/(qué es|información|cuéntame|dime sobre)/i.test(lowerQuery)) {
      return {
        intent: 'information',
        confidence: 0.8,
        action: 'info',
      };
    }

    if (/(hola|hey|buenos|buenas)/i.test(lowerQuery)) {
      return {
        intent: 'greeting',
        confidence: 0.95,
        action: 'none',
      };
    }

    if (/(ayuda|help|qué puedes)/i.test(lowerQuery)) {
      return {
        intent: 'help',
        confidence: 0.9,
        action: 'none',
      };
    }

    return {
      intent: 'conversation',
      confidence: 0.7,
      action: 'none',
    };
  }

  /**
   * Extraer nombre de lugar de la respuesta
   */
  private async extractPlaceFromResponse(response: string): Promise<string | null> {
    try {
      const places = await this.navigationService.searchPlaces({
        query: '',
        maxResults: 1000,
      });

      // Buscar si algún lugar es mencionado en la respuesta
      for (const place of places) {
        if (response.includes(place.nombre)) {
          return place.nombre;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Forzar recarga del contexto
   */
  async forceContextReload() {
    await this.loadPlacesContext();
  }
}