// src/ai-assistant/services/command-handler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { NavigationService } from '../../navigation/navigation.service';
import { IntentResult } from '../interfaces/intent-result.interface';
import { AssistantResponse } from '../interfaces/assistant-response.interface';

@Injectable()
export class CommandHandlerService {
  private readonly logger = new Logger(CommandHandlerService.name);

  constructor(private navigationService: NavigationService) {}

  /**
   * Manejar comando de navegación
   */
  async handleNavigate(
    userId: string,
    intent: IntentResult,
    context?: any
  ): Promise<AssistantResponse> {
    const destination = intent.entities.destination;
    
    if (!destination) {
      return {
        message: '¿A dónde quieres ir? Por favor, dime el lugar específico.',
        intent,
        action: 'none',
      };
    }

    try {
      // Buscar lugares que coincidan
      const places = await this.navigationService.searchPlaces({
        query: destination,
        currentLocation: context?.currentLocation,
        maxResults: 5,
      });

      if (places.length === 0) {
        return this.handleNoResults(destination, intent);
      }

      if (places.length === 1) {
        return this.handleSingleResult(places[0], intent);
      }

      return this.handleMultipleResults(places, destination, intent);

    } catch (error) {
      this.logger.error(`Error handling navigate: ${error.message}`);
      return this.handleError(intent, error.message);
    }
  }

  /**
   * Manejar comando de búsqueda
   */
  async handleSearch(
    userId: string,
    intent: IntentResult,
    context?: any
  ): Promise<AssistantResponse> {
    const searchTerm = intent.entities.destination || intent.entities.placeType;
    
    if (!searchTerm) {
      return {
        message: '¿Qué tipo de lugar estás buscando? Por ejemplo: aulas, laboratorios, cafetería...',
        intent,
        action: 'none',
      };
    }

    try {
      const places = await this.navigationService.searchPlaces({
        query: searchTerm,
        currentLocation: context?.currentLocation,
        maxResults: 10,
      });

      if (places.length === 0) {
        return {
          message: `No encontré lugares relacionados con "${searchTerm}".`,
          intent,
          action: 'none',
          suggestions: ['Intenta buscar: aulas, laboratorios,Pabellones, cafetería, biblioteca'],
        };
      }

      return {
        message: `Encontré ${places.length} lugares relacionados con "${searchTerm}":`,
        intent,
        action: 'search',
        data: { places },
        options: places.slice(0, 5).map(place => ({
          id: place.id,
          label: place.nombre,
          description: this.buildPlaceDescription(place),
        })),
      };

    } catch (error) {
      this.logger.error(`Error handling search: ${error.message}`);
      return this.handleError(intent, error.message);
    }
  }

  /**
   * Manejar solicitud de información
   */
  async handleInformation(
    userId: string,
    intent: IntentResult,
    context?: any
  ): Promise<AssistantResponse> {
    const subject = intent.entities.destination;
    
    if (!subject) {
      return {
        message: '¿Sobre qué lugar necesitas información?',
        intent,
        action: 'none',
      };
    }

    try {
      const places = await this.navigationService.searchPlaces({
        query: subject,
        maxResults: 1,
      });

      if (places.length === 0) {
        return {
          message: `No encontré información sobre "${subject}".`,
          intent,
          action: 'none',
        };
      }

      const place = places[0];
      const message = this.buildPlaceInfo(place);

      return {
        message,
        intent,
        action: 'show_info',
        data: { place },
      };

    } catch (error) {
      this.logger.error(`Error handling information: ${error.message}`);
      return this.handleError(intent, error.message);
    }
  }

/**
 * Manejar saludo
 */
handleGreeting(userName?: string): AssistantResponse {
  const greetings = [
    `¡Hola${userName ? ' ' + userName : ''}! 🎓 Soy tu asistente de navegación del campus Tecsup. ¿A dónde quieres ir?`,
    `¡Hey${userName ? ' ' + userName : ''}! 👋 ¿En qué puedo ayudarte? Puedo llevarte a cualquier lugar del campus.`,
    `¡Hola${userName ? ' ' + userName : ''}! 😊 Dime a dónde necesitas ir y te guiaré. Conozco todas las aulas, laboratorios y servicios.`,
  ];

  return {
    message: greetings[Math.floor(Math.random() * greetings.length)],
    intent: { 
      intent: 'greeting', 
      confidence: 1, 
      entities: {}, 
      originalQuery: '', 
      interpretation: 'Saludo' 
    },
    action: 'none',
    suggestions: [
      'Llévame al laboratorio 802',
      'Buscar aulas en pabellón 4',
      '¿Dónde está el aula 400?',
      'Quiero ir al polideportivo',
    ],
  };
}

/**
 * Manejar solicitud de ayuda
 */
handleHelp(): AssistantResponse {
  return {
    message: `Puedo ayudarte a navegar por el campus de Tecsup. Aquí hay algunos ejemplos:

📍 **Para navegar:**
- "Llévame al laboratorio 802"
- "Cómo llego al aula 400"
- "Quiero ir al polideportivo"

🔍 **Para buscar:**
- "Buscar aulas en pabellón 4"
- "Mostrar laboratorios"
- "¿Qué oficinas hay?"

ℹ️ **Para información:**
- "¿Qué es el aula 1102?"
- "Información sobre el polideportivo"

🏢 **Lugares disponibles:**
- Aulas: 400, 1102, 4B-01, 4B-02, 4B-03
- Labs: 802, 1007, 812, 410, 411, 412, 418
- Servicios: Baños, Polideportivo, Oficina TI

¿En qué puedo ayudarte?`,
    intent: { 
      intent: 'help', 
      confidence: 1, 
      entities: {}, 
      originalQuery: '', 
      interpretation: 'Ayuda' 
    },
    action: 'none',
  };
}

  /**
   * Manejar comando desconocido
   */
  handleUnknown(intent: IntentResult): AssistantResponse {
    return {
      message: `No te he entendido. Intenta decir:
• "Llévame al laboratorio"
• "Buscar aulas"
• "¿Dónde está la cafetería?"

O di "ayuda" para ver más ejemplos.`,
      intent,
      action: 'none',
      suggestions: intent.suggestions || [
        'Llévame a la biblioteca',
        'Buscar laboratorios',
        'Ayuda',
      ],
    };
  }

  // Métodos auxiliares privados

  private handleNoResults(destination: string, intent: IntentResult): AssistantResponse {
    return {
      message: `No encontré ningún lugar llamado "${destination}". ¿Podrías ser más específico?`,
      intent,
      action: 'none',
      suggestions: [
        'Intenta con: "Laboratorio de redes"',
        'O pregunta: "¿Qué laboratorios hay?"',
      ],
    };
  }

  private handleSingleResult(place: any, intent: IntentResult): AssistantResponse {
    const distanceInfo = place.distancia > 0 
      ? `Está a ${Math.round(place.distancia)}m de tu ubicación (${place.tiempoEstimadoCaminando} min caminando).`
      : '';

    return {
      message: `Perfecto, te llevaré a ${place.nombre}. ${distanceInfo}`,
      intent,
      action: 'navigate',
      data: { 
        places: [place],  // ✅ CAMBIO: Siempre array
       },
    };
  }

  private handleMultipleResults(places: any[], destination: string, intent: IntentResult): AssistantResponse {
    return {
      message: `Encontré ${places.length} lugares con "${destination}". ¿A cuál quieres ir?`,
      intent,
      action: 'none',
      requiresConfirmation: true,
      options: places.map(place => ({
        id: place.id,
        label: place.nombre,
        description: this.buildPlaceDescription(place),
      })),
      data: { 
        places: places,  // ✅ CAMBIO: Siempre array
       },
    };
  }

  private buildPlaceDescription(place: any): string {
    const parts: string[] = [];
    
    if (place.edificio) parts.push(place.edificio);
    if (place.piso) parts.push(`Piso ${place.piso}`);
    if (place.distancia > 0) {
      parts.push(`${Math.round(place.distancia)}m, ${place.tiempoEstimadoCaminando} min`);
    }
    
    return parts.join(' - ');
  }

  private buildPlaceInfo(place: any): string {
    const parts = [`${place.nombre} es ${place.tipo.nombre.startsWith('A') ? 'un' : 'una'} ${place.tipo.nombre}`];
    
    if (place.descripcion) parts.push(place.descripcion);
    if (place.edificio) parts.push(`Está ubicado en ${place.edificio}`);
    if (place.piso) parts.push(`piso ${place.piso}`);
    
    return parts.join('. ') + '.';
  }

  private handleError(intent: IntentResult, error: string): AssistantResponse {
    return {
      message: 'Lo siento, ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.',
      intent,
      action: 'none',
    };
  }
}