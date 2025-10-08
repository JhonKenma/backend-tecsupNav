// src/ai-assistant/services/openai-integration.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAI } from 'openai';
import { IntentResult } from '../interfaces/intent-result.interface';

@Injectable()
export class OpenAIIntegrationService {
  private readonly logger = new Logger(OpenAIIntegrationService.name);
  private openai: OpenAI | null = null;
  private isConfigured = false;

  constructor(private configService: ConfigService) {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (!apiKey || apiKey === 'tu_openai_api_key_aqui') {
      this.logger.warn('OPENAI_API_KEY not configured. AI features will use rule-based detection only.');
      this.isConfigured = false;
      return;
    }

    try {
      this.openai = new OpenAI({ apiKey });
      this.isConfigured = true;
      this.logger.log('OpenAI integration initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize OpenAI: ${error.message}`);
      this.isConfigured = false;
    }
  }

  /**
   * Verificar si OpenAI está configurado
   */
  isAvailable(): boolean {
    return this.isConfigured && this.openai !== null;
  }

  /**
   * Detectar intención usando OpenAI
   */
  async detectIntent(query: string, context?: any): Promise<IntentResult> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI is not available');
    }

    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(query, context);

    try {
      const completion = await this.openai!.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 500,
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error('OpenAI response content is null');
      }
      const result = JSON.parse(content);

      return {
        intent: result.intent,
        confidence: result.confidence,
        entities: result.entities || {},
        originalQuery: query,
        interpretation: result.interpretation,
      };

    } catch (error) {
      this.logger.error(`OpenAI API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Construir prompt del sistema
   */
  private buildSystemPrompt(): string {
    return `Eres un asistente de navegación para el campus de Tecsup Lima.
Tu trabajo es interpretar comandos de navegación y búsqueda de lugares dentro del campus.

TIPOS DE LUGARES DISPONIBLES:
- Aulas: Identificadas por código (ej: A101, B201, C305)
- Laboratorios: Lab de Redes, Lab de Electrónica, Lab de Mecánica, etc.
- Oficinas: Coordinación Académica, Registro, Administración
- Servicios: Biblioteca, Cafetería, Baños
- Edificios: Pabellón A, B, C
- Espacios: Auditorio, Entrada Principal

INTENCIONES QUE DEBES DETECTAR:
1. "navigate": Usuario quiere ir a un lugar específico
   - Ejemplos: "llévame a", "ir a", "cómo llego a", "quiero ir"
   
2. "search": Usuario quiere buscar o explorar opciones
   - Ejemplos: "buscar", "mostrar", "qué laboratorios hay"
   
3. "information": Usuario solicita información sobre un lugar
   - Ejemplos: "qué es", "información sobre", "cuéntame de"
   
4. "greeting": Saludo simple
   - Ejemplos: "hola", "hey", "buenos días"
   
5. "help": Pide ayuda o instrucciones
   - Ejemplos: "ayuda", "qué puedes hacer", "comandos"
   
6. "unknown": No se puede determinar la intención

FORMATO DE RESPUESTA (JSON):
{
  "intent": "navigate|search|information|greeting|help|unknown",
  "confidence": 0.0-1.0,
  "entities": {
    "destination": "nombre exacto del lugar",
    "building": "pabellón si se menciona (A, B, C)",
    "floor": número si se menciona,
    "placeType": "tipo (aula, laboratorio, oficina, etc.)"
  },
  "interpretation": "breve explicación de lo que entendiste"
}

REGLAS IMPORTANTES:
- Sé flexible con variaciones de nombres (lab = laboratorio)
- Detecta sinónimos (comedor = cafetería)
- Si hay ambigüedad, marca confidence bajo
- Extrae todas las entidades posibles del comando`;
  }

  /**
   * Construir prompt del usuario
   */
  private buildUserPrompt(query: string, context?: any): string {
    let prompt = `Analiza este comando: "${query}"`;
    
    if (context?.currentLocation) {
      prompt += `\nUbicación actual del usuario: lat ${context.currentLocation.lat}, lng ${context.currentLocation.lng}`;
    }
    
    return prompt;
  }

  /**
   * Obtener respuesta conversacional de OpenAI
   */
  async getChatResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    systemContext?: string
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI is not available');
    }

    try {
      if (!this.openai) {
        throw new Error('OpenAI is not initialized');
      }
      // Filter out any messages that are not valid roles for OpenAI
      const validMessages = messages.filter(
        (msg) => ['system', 'user', 'assistant'].includes(msg.role)
      );
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemContext || 'Eres un asistente útil.' },
          ...validMessages,
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const content = completion.choices[0].message.content;
      if (content === null) {
        throw new Error('OpenAI chat response content is null');
      }
      return content;

    } catch (error) {
      this.logger.error(`OpenAI chat error: ${error.message}`);
      throw error;
    }
  }
}