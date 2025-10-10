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
   * Cargar contexto de lugares desde la BD
   */
  private async loadPlacesContext() {
    try {
         const places = await this.navigationService.getAllPlaces();

      // Agrupar por tipo
      const grouped = places.reduce((acc, place) => {
        const tipo = place.tipo?.nombre || 'Otros';
        if (!acc[tipo]) acc[tipo] = [];
        acc[tipo].push(place);
        return acc;
      }, {});

      // Construir contexto legible
      let context = '=== INFORMACIÓN DEL CAMPUS TECSUP LIMA ===\n\n';

      for (const [tipo, lugares] of Object.entries(grouped)) {
        context += `${tipo.toUpperCase()}S DISPONIBLES:\n`;
        (lugares as any[]).forEach(lugar => {
          context += `- ${lugar.nombre}`;
          if (lugar.edificio) context += ` (ubicado en ${lugar.edificio}`;
          if (lugar.piso) context += `, piso ${lugar.piso}`;
          if (lugar.edificio) context += ')';
          if (lugar.descripcion) context += ` - ${lugar.descripcion}`;
          context += `\n`;
        });
        context += '\n';
      }

      // Agregar información adicional
      const edificios = [...new Set(places.filter(p => p.edificio).map(p => p.edificio))];
      if (edificios.length > 0) {
        context += 'PABELLONES/EDIFICIOS:\n';
        edificios.forEach(e => context += `- ${e}\n`);
        context += '\n';
      }

      this.placesContext = context;
      this.lastContextUpdate = new Date();
      
      this.logger.log(`✅ Loaded ${places.length} places into AI context`);
    } catch (error) {
      this.logger.error(`Error loading places context: ${error.message}`);
      this.placesContext = 'No se pudo cargar información del campus.';
    }
  }

  /**
   * Refrescar contexto si es necesario
   */
  private async refreshContextIfNeeded() {
    const fiveMinutes = 5 * 60 * 1000;
    if (!this.lastContextUpdate || 
        Date.now() - this.lastContextUpdate.getTime() > fiveMinutes) {
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
   * MÉTODO PRINCIPAL: Obtener respuesta conversacional
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
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7, // Más natural
        max_tokens: 800,
      });

      const aiResponse = completion.choices[0].message.content || '';

      // Analizar la respuesta para extraer intención y acción sugerida
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

TU CONOCIMIENTO:
${this.placesContext}

TUS CAPACIDADES:
✅ Ayudar a navegar a cualquier lugar del campus
✅ Buscar aulas, laboratorios, oficinas y servicios
✅ Dar información detallada sobre ubicaciones
✅ Responder preguntas sobre el campus
✅ Sugerir rutas y lugares cercanos

CÓMO RESPONDES:
- Si te preguntan por un lugar específico que existe, proporciona información útil y ofrece ayuda para llegar
- Si te preguntan por algo que NO existe, sugiere alternativas similares
- Si la pregunta es vaga, pide más detalles de forma amigable
- Siempre intenta ser útil y proactivo
- Adapta tu respuesta al contexto de la conversación

IMPORTANTE:
- No inventes lugares que no están en la lista
- Si mencionan "laboratorio", "aula", etc., usa los nombres exactos de la lista
- Sé específico con las ubicaciones (pabellón, piso)
- Ofrece ayuda adicional al final de cada respuesta`,
    });

    // Historial de conversación (últimos 5 mensajes)
    const recentHistory = history.slice(-5);
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

    // Detectar intención basada en el query y la respuesta
    if (/(llévame|ir a|cómo llego|navegar|quiero ir)/i.test(lowerQuery)) {
      // Extraer nombre del lugar mencionado en la respuesta
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