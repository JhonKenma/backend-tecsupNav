// src/ai-assistant/services/intent-detection.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { IntentResult } from '../interfaces/intent-result.interface';

@Injectable()
export class IntentDetectionService {
  private readonly logger = new Logger(IntentDetectionService.name);

  // 👇 NUEVOS: Lugares específicos de tu campus
  private readonly knownPlaces = {
    aulas: [
      'aula 400', 'aula 1102', 'aula 4b-01', 'aula 4b-02', 'aula 4b-03',
      'aula 4b01', 'aula 4b02', 'aula 4b03', // Variaciones sin guion
    ],
    laboratorios: [
      'laboratorio 802', 'laboratorio 1007', 'laboratorio 812',
      'laboratorio 410', 'laboratorio 412', 'laboratorio 411', 'laboratorio 418',
      'lab 802', 'lab 1007', 'lab 812', 'lab 410', 'lab 412', 'lab 411', 'lab 418', // Variaciones
    ],
    oficinas: [
      'oficina soporte ti', 'soporte ti', 'oficina ti',
    ],
    servicios: [
      'baño', 'baños', 'servicios higiénicos', 'ss.hh', 'sshh',
      'baño pabellón 4', 'baño segundo piso',
    ],
    otros: [
      'polideportivo', 'poli', 'cancha',
    ],
    pabellones: [
      'pabellón 4', 'pabellón 8', 'pabellón 10', 'pabellón 11', 'pabellón 4b',
      'pabellon 4', 'pabellon 8', 'pabellon 10', 'pabellon 11', // Sin tilde
      'pab 4', 'pab 8', 'pab 10', 'pab 11', // Abreviado
    ]
  };

  /**
   * Detectar intención usando reglas (rápido, sin IA)
   */
  detectWithRules(query: string): IntentResult {
    const lowerQuery = query.toLowerCase();
    
    // 👇 MEJORADO: Detectar lugares específicos primero
    const detectedPlace = this.detectSpecificPlace(lowerQuery);
    
    // Patrones de navegación
    const navigationPatterns = [
      /llévame\s+a(?:l)?\s+(.+)/i,
      /ir\s+a(?:l)?\s+(.+)/i,
      /cómo\s+llego\s+a(?:l)?\s+(.+)/i,
      /dónde\s+está\s+(?:el|la)?\s*(.+)/i,
      /quiero\s+ir\s+a(?:l)?\s+(.+)/i,
      /navegar?\s+a(?:l)?\s+(.+)/i,
      /ruta\s+a(?:l)?\s+(.+)/i,
    ];

    // Patrones de búsqueda
    const searchPatterns = [
      /buscar\s+(.+)/i,
      /encuentra?\s+(.+)/i,
      /mostrar\s+(.+)/i,
      /listar\s+(.+)/i,
      /qué\s+(.+)\s+hay/i,
      /cuántos?\s+(.+)\s+hay/i,
    ];

    // Patrones de información
    const infoPatterns = [
      /qué\s+es\s+(.+)/i,
      /información\s+(?:sobre|de)\s+(.+)/i,
      /cuéntame\s+(?:sobre|de)\s+(.+)/i,
      /dime\s+(?:sobre|de)\s+(.+)/i,
    ];

    // Saludos
    const greetingPatterns = [
      /^(hola|hi|hey|buenos días|buenas tardes|buenas noches)$/i,
    ];

    // Ayuda
    const helpPatterns = [
      /^(ayuda|help|qué puedes hacer|comandos|opciones)$/i,
    ];

    // Verificar navegación
    for (const pattern of navigationPatterns) {
      const match = lowerQuery.match(pattern);
      if (match && match[1]) {
        const destination = match[1].trim();
        return {
          intent: 'navigate',
          confidence: detectedPlace ? 0.95 : 0.9, // Mayor confianza si detectó lugar específico
          entities: { 
            destination,
            ...this.extractPlaceDetails(destination), // 👈 Extrae detalles adicionales
          },
          originalQuery: query,
          interpretation: `Quiere navegar a: ${destination}`,
        };
      }
    }

    // Verificar búsqueda
    for (const pattern of searchPatterns) {
      const match = lowerQuery.match(pattern);
      if (match && match[1]) {
        const searchTerm = match[1].trim();
        return {
          intent: 'search',
          confidence: 0.85,
          entities: { 
            destination: searchTerm,
            placeType: this.detectPlaceType(searchTerm), // 👈 Detecta tipo de lugar
          },
          originalQuery: query,
          interpretation: `Quiere buscar: ${searchTerm}`,
        };
      }
    }

    // Verificar información
    for (const pattern of infoPatterns) {
      const match = lowerQuery.match(pattern);
      if (match && match[1]) {
        return {
          intent: 'information',
          confidence: 0.8,
          entities: { destination: match[1].trim() },
          originalQuery: query,
          interpretation: `Solicita información sobre: ${match[1].trim()}`,
        };
      }
    }

    // Verificar saludos
    if (greetingPatterns.some(p => p.test(lowerQuery))) {
      return {
        intent: 'greeting',
        confidence: 0.95,
        entities: {},
        originalQuery: query,
        interpretation: 'Saludo',
      };
    }

    // Verificar ayuda
    if (helpPatterns.some(p => p.test(lowerQuery))) {
      return {
        intent: 'help',
        confidence: 0.9,
        entities: {},
        originalQuery: query,
        interpretation: 'Solicita ayuda',
      };
    }

    // Intent desconocido
    return {
      intent: 'unknown',
      confidence: 0.3,
      entities: {},
      originalQuery: query,
      interpretation: 'No se pudo interpretar el comando',
      suggestions: this.generateContextualSuggestions(lowerQuery),
    };
  }

  // 👇 NUEVOS MÉTODOS AUXILIARES

  /**
   * Detectar si menciona un lugar específico conocido
   */
  private detectSpecificPlace(query: string): boolean {
    const allPlaces = [
      ...this.knownPlaces.aulas,
      ...this.knownPlaces.laboratorios,
      ...this.knownPlaces.oficinas,
      ...this.knownPlaces.servicios,
      ...this.knownPlaces.otros,
      ...this.knownPlaces.pabellones,
    ];

    return allPlaces.some(place => query.includes(place));
  }

  /**
   * Detectar tipo de lugar mencionado
   */
  private detectPlaceType(query: string): string | undefined {
    if (/aula|salon|clase/i.test(query)) return 'Aula';
    if (/lab|laboratorio/i.test(query)) return 'Laboratorio';
    if (/oficina/i.test(query)) return 'Oficina';
    if (/baño|ss\.?hh|servicios higiénicos/i.test(query)) return 'Baño';
    if (/poli|polideportivo|cancha/i.test(query)) return 'Polideportivo';
    if (/pabellón|pabellon/i.test(query)) return 'Pabellón';
    return undefined;
  }

  /**
   * Extraer detalles adicionales del lugar (edificio, piso, etc.)
   */
  private extractPlaceDetails(destination: string): any {
    const details: any = {};

    // Detectar pabellón
    const pabellonMatch = destination.match(/pabellón?\s*(\d+[a-z]?)/i);
    if (pabellonMatch) {
      details.building = `Pabellón ${pabellonMatch[1].toUpperCase()}`;
    }

    // Detectar piso
    const pisoMatch = destination.match(/piso\s*(\d+)/i);
    if (pisoMatch) {
      details.floor = parseInt(pisoMatch[1]);
    }

    return details;
  }

  /**
   * Generar sugerencias contextuales según lo que escribió el usuario
   */
  private generateContextualSuggestions(query: string): string[] {
    // Si menciona "aula" pero no específica
    if (query.includes('aula') && !this.detectSpecificPlace(query)) {
      return [
        'Intenta con: "Llévame al aula 400"',
        'O prueba: "Buscar aulas en pabellón 4"',
        'También: "¿Dónde está el aula 1102?"',
      ];
    }

    // Si menciona "laboratorio"
    if (/lab|laboratorio/i.test(query)) {
      return [
        'Intenta: "Llévame al laboratorio 802"',
        'O: "Buscar laboratorios"',
        'También: "¿Qué laboratorios hay en pabellón 4?"',
      ];
    }

    // Si menciona "baño"
    if (/baño|sshh|servicio/i.test(query)) {
      return [
        'Prueba: "¿Dónde está el baño más cercano?"',
        'O: "Llévame a los servicios higiénicos"',
      ];
    }

    // Sugerencias por defecto
    return [
      'Intenta decir: "Llévame al laboratorio 802"',
      'O pregunta: "¿Dónde está el aula 400?"',
      'También puedes decir: "Buscar laboratorios"',
    ];
  }

  /**
   * Normalizar query antes de procesar
   */
  normalizeQuery(query: string): string {
    return query
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[¿?¡!]/g, '')
      .toLowerCase();
  }
}