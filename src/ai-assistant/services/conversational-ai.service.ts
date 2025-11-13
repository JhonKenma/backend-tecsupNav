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
  // 🔥 CAMBIO: Contexto mínimo por defecto
  private placesContext: string = `=== CAMPUS TECSUP LIMA ===
Lugares principales: Aulas, Laboratorios, Oficinas, Baños, Polideportivo.
Pregunta por lugares específicos para más información.`;
  private lastContextUpdate: Date | null = null;
  private isLoadingContext = false; // 🔥 NUEVO: Flag para evitar cargas múltiples

  constructor(
    private configService: ConfigService,
    private navigationService: NavigationService,
  ) {
    this.initializeOpenAI();
    // 🔥 CAMBIO: Cargar contexto de forma asíncrona (no bloquea)
    this.loadPlacesContext().catch(err => {
      this.logger.warn('Initial context load failed, using minimal context');
    });
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
   * 🔥 Cargar contexto con timeout largo y sin bloquear
   */
  private async loadPlacesContext() {
    if (this.isLoadingContext) {
      this.logger.debug('Context already loading, skipping...');
      return;
    }

    this.isLoadingContext = true;

    try {
      // 🔥 CAMBIO: Timeout de 15 segundos (antes 5s)
      const places = await Promise.race([
        this.navigationService.getAllPlaces(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 15s')), 15000)
        ),
      ]) as any[];

      if (!places || places.length === 0) {
        throw new Error('No places loaded');
      }

      // Agrupar por tipo
      const grouped = places.reduce((acc, place) => {
        const tipo = place.tipo?.nombre || 'Otros';
        if (!acc[tipo]) acc[tipo] = [];
        acc[tipo].push(place);
        return acc;
      }, {});

      // Construir contexto (más compacto)
      let context = '=== CAMPUS TECSUP LIMA ===\n\n';

      for (const [tipo, lugares] of Object.entries(grouped)) {
        context += `${tipo.toUpperCase()}S:\n`;
        // 🔥 CAMBIO: Limitar a 15 lugares por tipo (antes 20)
        (lugares as any[]).slice(0, 15).forEach(lugar => {
          context += `- ${lugar.nombre}`;
          if (lugar.edificio) context += ` (${lugar.edificio}`;
          if (lugar.piso) context += `, piso ${lugar.piso}`;
          if (lugar.edificio) context += ')';
          context += `\n`;
        });
        context += '\n';
      }

      // Pabellones (limitado)
      const edificios = [...new Set(places.filter(p => p.edificio).map(p => p.edificio))];
      if (edificios.length > 0) {
        context += 'PABELLONES:\n';
        edificios.slice(0, 10).forEach(e => context += `- ${e}\n`);
        context += '\n';
      }

      this.placesContext = context;
      this.lastContextUpdate = new Date();
      
      this.logger.log(`✅ Contexto cargado: ${places.length} lugares`);
    } catch (error) {
      this.logger.error(`Error loading context: ${error.message}`);
      // 🔥 CAMBIO: Mantener contexto mínimo si falla
      if (!this.lastContextUpdate) {
        this.placesContext = `=== CAMPUS TECSUP LIMA ===
Lugares principales: Aulas, Laboratorios, Oficinas, Baños, Polideportivo.
Pregunta por lugares específicos para obtener más información.`;
        this.lastContextUpdate = new Date();
      }
    } finally {
      this.isLoadingContext = false;
    }
  }

  /**
   * 🔥 Refrescar contexto solo si es necesario (15 minutos)
   */
  private async refreshContextIfNeeded() {
    const fifteenMinutes = 15 * 60 * 1000; // 🔥 CAMBIO: Aumentado de 10 a 15 min
    if (!this.lastContextUpdate || 
        Date.now() - this.lastContextUpdate.getTime() > fifteenMinutes) {
      // 🔥 CAMBIO: No esperar la carga, hacerlo en background
      this.loadPlacesContext().catch(err => {
        this.logger.warn('Background context refresh failed');
      });
    }
  }

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

    // 🔥 CAMBIO: Refrescar contexto en background si es necesario
    this.refreshContextIfNeeded();

    const messages = this.buildConversation(userQuery, conversationHistory, context);

    try {
      // 🔥 Timeout de 10 segundos para OpenAI
      const completion = await Promise.race([
        this.openai!.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI timeout')), 10000)
        ),
      ]) as any;

      const aiResponse = completion.choices[0].message.content || '';
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

  private buildConversation(
    userQuery: string,
    history: Array<{query: string; response: string}>,
    context?: any,
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    messages.push({
      role: 'system',
      content: `Eres un asistente virtual amigable y servicial del campus Tecsup Lima. Tu nombre es "Tecsup Assistant".

TU PERSONALIDAD:
- Eres amable, conversacional y natural
- Hablas en español peruano de forma cercana
- Usas emojis ocasionalmente para ser más amigable 
- No eres robótico, eres como un amigo que conoce bien el campus
- Si no sabes algo, lo admites con honestidad
- IMPORTANTE: SIEMPRE recuerdas el contexto de la conversación anterior

TU CONOCIMIENTO:
${this.placesContext}

TUS CAPACIDADES:
✅ Ayudar a navegar a cualquier lugar del campus
✅ Buscar aulas, laboratorios, oficinas y servicios
✅ Dar información detallada sobre ubicaciones
✅ Responder preguntas sobre el campus
✅ Sugerir rutas y lugares cercanos
✅ MANTENER contexto de conversaciones previas

IMPORTANTE AL DAR DIRECCIONES:
- Cuando el usuario CONFIRME que quiere ayuda, responde: "Perfecto, te llevaré a [LUGAR EXACTO]. Iniciando navegación..."
- NO des instrucciones manuales, el sistema iniciará la navegación automática
- Sé específico con el lugar exacto`,
    });

    // Historial (últimos 10 mensajes)
    const recentHistory = history.slice(-10);
    recentHistory.forEach(entry => {
      messages.push(
        { role: 'user', content: entry.query },
        { role: 'assistant', content: entry.response },
      );
    });

    // Mensaje actual
    let userMessage = userQuery;
    if (context?.currentLocation) {
      userMessage += `\n\n[Usuario en: lat ${context.currentLocation.lat}, lng ${context.currentLocation.lng}]`;
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    return messages;
  }

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

    if (/(sí|si|claro|por favor|necesito|ayuda|llévame|quiero ir)/i.test(lowerQuery) &&
        /iniciar|navegación|llevar|guiar/i.test(aiResponse.toLowerCase())) {
      return { intent: 'navigate', confidence: 0.95, action: 'navigate' };
    }

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
      return { intent: 'search', confidence: 0.85, action: 'search' };
    }

    if (/(qué es|información|cuéntame|dime sobre)/i.test(lowerQuery)) {
      return { intent: 'information', confidence: 0.8, action: 'info' };
    }

    if (/(hola|hey|buenos|buenas)/i.test(lowerQuery)) {
      return { intent: 'greeting', confidence: 0.95, action: 'none' };
    }

    if (/(ayuda|help|qué puedes)/i.test(lowerQuery)) {
      return { intent: 'help', confidence: 0.9, action: 'none' };
    }

    return { intent: 'conversation', confidence: 0.7, action: 'none' };
  }

  private async extractPlaceFromResponse(response: string): Promise<string | null> {
    try {
      const places = await this.navigationService.searchPlaces({
        query: '',
        maxResults: 1000,
      });

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

  async forceContextReload() {
    await this.loadPlacesContext();
  }
}