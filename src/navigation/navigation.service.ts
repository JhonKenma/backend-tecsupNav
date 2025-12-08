// src/navigation/navigation.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { GoogleMapsService, Coordinates } from '../google-maps/google-maps.service';
import { PlacesCacheService } from './services/places-cache.service';
import { CustomRoutesService } from '../custom-routes/custom-routes.service';

export interface NavigationRequest {
  currentLocation: Coordinates;
  destinationId?: string;
  destinationName?: string;
  preferences?: {
    mode?: 'walking' | 'driving';
    accessible?: boolean;
    fastest?: boolean;
  };
}

export interface SearchRequest {
  query: string;
  currentLocation?: Coordinates;
  maxResults?: number;
  radius?: number;
}

export interface PlaceWithDistance {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  descripcion?: string | null;
  edificio?: string | null;
  piso?: number | null;
  tipo: {
    nombre: string;
    color: string | null;
    icono?: string | null;
  };
  distancia: number;
  tiempoEstimadoCaminando: number;
}

export interface NavigationResponse {
  route: {
    puntos: Coordinates[];
    distancia: number;
    tiempoEstimado: number;
    dificultad?: string;
    accesible: boolean;
  };
  destination: {
    id: string;
    nombre: string;
    latitud: number;
    longitud: number;
    tipo: string;
    edificio?: string;
    piso?: number;
  };
  instructions: string[];
  alternatives?: any[];
}

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  constructor(
    private googleMapsService: GoogleMapsService,
    private placesCache: PlacesCacheService,
    private customRoutesService: CustomRoutesService,
  ) {}

  /**
   * Obtener todos los lugares
   */
  async getAllPlaces(): Promise<any[]> {
    return await this.placesCache.getAll();
  }

  /**
   * Validar GPS
   */
  async validateGPSLocation(location: Coordinates): Promise<{ valid: boolean; message: string }> {
    if (!location.lat || !location.lng) {
      return {
        valid: false,
        message: 'GPS no activado. Por favor, activa la ubicación en tu dispositivo.',
      };
    }

    try {
      const isValid = await this.googleMapsService.validateCampusCoordinates(location);
      return {
        valid: isValid,
        message: isValid 
          ? 'Ubicación GPS válida dentro del campus.' 
          : 'Tu ubicación está fuera del campus de Tecsup. Asegúrate de estar dentro de las instalaciones.',
      };
    } catch {
      return { valid: true, message: 'Ubicación GPS válida dentro del campus.' };
    }
  }

  /**
   * Buscar lugares
   */
  async searchPlaces(request: SearchRequest): Promise<PlaceWithDistance[]> {
    const { query, currentLocation, maxResults = 10, radius = 1000 } = request;

    try {
      const places = await this.placesCache.search(query || '');
      let result = places.map(place => this.addDistance(place, currentLocation));

      if (currentLocation) {
        result = result
          .filter(p => p.distancia <= radius)
          .sort((a, b) => a.distancia - b.distancia);
      }

      return result.slice(0, maxResults);
    } catch (error) {
      this.logger.error('Error en searchPlaces:', error.message);
      return [];
    }
  }

  /**
   * 🔥 Crear ruta COMPLETA (con rutas personalizadas e instrucciones detalladas)
   */
  async createRouteFromCurrentLocation(request: NavigationRequest): Promise<NavigationResponse> {
    const { currentLocation, destinationId, destinationName, preferences = {} } = request;

    // // Validar GPS
    // const gpsValidation = await this.validateGPSLocation(currentLocation);
    // if (!gpsValidation.valid) {
    //   throw new BadRequestException(gpsValidation.message);
    // }

    // Encontrar destino desde caché
    let destination;
    if (destinationId) {
      destination = await this.placesCache.findById(destinationId);
    } else if (destinationName) {
      destination = await this.findByName(destinationName);
    }

    if (!destination) {
      throw new NotFoundException('Destino no encontrado');
    }

    // 🔥 Buscar si existe una ruta personalizada desde un lugar cercano
    const nearbyPlace = await this.findNearestPlace(currentLocation);
    let customRoute: any = null;

    if (nearbyPlace && nearbyPlace.distancia < 50) {
      try {
        customRoute = await this.customRoutesService.findFastestRoute(
          nearbyPlace.id,
          destination.id
        );
      } catch (error) {
        this.logger.debug('No custom route found, using Google Maps');
        customRoute = null;
      }
    }

    let routeInfo;
    let instructions: string[] = [];

    // 🔥 Si hay ruta personalizada, usarla
    if (customRoute && !customRoute.isReversed) {
      routeInfo = {
        puntos: [
          currentLocation,
          ...(Array.isArray(customRoute.puntos) ? customRoute.puntos as Coordinates[] : []),
        ],
        distancia: customRoute.distancia || 0,
        tiempoEstimado: customRoute.tiempoEstimado || 0,
        dificultad: customRoute.dificultad,
        accesible: customRoute.accesible || false,
      };

      instructions = this.generateCustomInstructions(customRoute, nearbyPlace, destination);
    } else {
      // Calcular ruta con Google Maps
      try {
        const googleRoute = await this.googleMapsService.calculateRoute({
          origen: currentLocation,
          destino: { lat: destination.latitud, lng: destination.longitud },
          modo: preferences.mode || 'walking',
          optimizar: true,
        });

        routeInfo = {
          puntos: googleRoute.puntos,
          distancia: googleRoute.distancia,
          tiempoEstimado: googleRoute.tiempoEstimado,
          accesible: preferences.accessible || false,
        };

        instructions = this.generateGoogleInstructions(googleRoute, destination);
      } catch (error) {
        // 🔥 Fallback: ruta directa con instrucciones detalladas
        const directDistance = this.googleMapsService.calculateDirectDistance(
          currentLocation,
          { lat: destination.latitud, lng: destination.longitud }
        );

        routeInfo = {
          puntos: [
            currentLocation,
            { lat: destination.latitud, lng: destination.longitud },
          ],
          distancia: directDistance,
          tiempoEstimado: Math.ceil((directDistance / 1000) * 12),
          accesible: false,
        };

        instructions = [
          'Dirígete hacia el norte desde tu ubicación actual',
          `Camina aproximadamente ${Math.round(directDistance)}m hacia ${destination.nombre}`,
          `Llegarás a ${destination.nombre} en aproximadamente ${Math.ceil(directDistance / 83.33)} minutos`,
        ];
      }
    }

    this.logger.log(`Navigation created: ${routeInfo.distancia}m to ${destination.nombre}`);

    return {
      route: routeInfo,
      destination: {
        id: destination.id,
        nombre: destination.nombre,
        latitud: destination.latitud,
        longitud: destination.longitud,
        tipo: destination.tipo?.nombre || 'Lugar',
        edificio: destination.edificio,
        piso: destination.piso,
      },
      instructions,
    };
  }

  /**
   * Buscar lugares cercanos
   */
  async findNearbyPlaces(location: Coordinates, radius: number = 50): Promise<PlaceWithDistance[]> {
    const allPlaces = await this.placesCache.getAll();
    
    return allPlaces
      .map(place => this.addDistance(place, location))
      .filter(p => p.distancia <= radius)
      .sort((a, b) => a.distancia - b.distancia);
  }

  /**
   * Actualización de navegación
   */
  async getNavigationUpdate(currentLocation: Coordinates, destinationId: string) {
    const destination = await this.placesCache.findById(destinationId);
    if (!destination) throw new NotFoundException('Destino no encontrado');

    const distanciaRestante = this.googleMapsService.calculateDirectDistance(
      currentLocation,
      { lat: destination.latitud, lng: destination.longitud }
    );

    const tiempoRestante = Math.ceil(distanciaRestante / 83.33);

    return {
      distanciaRestante: Math.round(distanciaRestante),
      tiempoRestante,
      llegada: distanciaRestante < 10,
      mensaje: distanciaRestante < 10 
        ? `¡Has llegado a ${destination.nombre}!`
        : `Te faltan ${Math.round(distanciaRestante)}m para llegar a ${destination.nombre}`,
    };
  }

  // 🔥 MÉTODOS PRIVADOS

  private addDistance(place: any, location?: Coordinates): PlaceWithDistance {
    const distancia = location 
      ? this.googleMapsService.calculateDirectDistance(
          location,
          { lat: place.latitud, lng: place.longitud }
        )
      : 0;

    return {
      id: place.id,
      nombre: place.nombre,
      latitud: place.latitud,
      longitud: place.longitud,
      descripcion: place.descripcion,
      edificio: place.edificio,
      piso: place.piso,
      tipo: {
        nombre: place.tipo?.nombre || 'Sin tipo',
        color: place.tipo?.color || '#000000',
        icono: place.tipo?.icono || '',
      },
      distancia,
      tiempoEstimadoCaminando: Math.ceil(distancia / 83.33),
    };
  }

  private async findByName(name: string) {
    const places = await this.placesCache.search(name);
    return places[0] || null;
  }

  private async findNearestPlace(location: Coordinates) {
    const nearbyPlaces = await this.findNearbyPlaces(location, 100);
    return nearbyPlaces.length > 0 ? nearbyPlaces[0] : null;
  }

  /**
   * 🔥 Generar instrucciones para rutas personalizadas (COMPLETO)
   */
  private generateCustomInstructions(customRoute: any, nearbyPlace: any, destination: any): string[] {
    const instructions = [
      `Desde tu ubicación actual, dirígete hacia ${nearbyPlace?.nombre || 'el punto de inicio'}`,
    ];

    if (customRoute.notas) {
      instructions.push(`Nota importante: ${customRoute.notas}`);
    }

    if (customRoute.accesible) {
      instructions.push('Esta ruta es accesible para personas con discapacidad');
    }

    if (customRoute.dificultad) {
      const dificultadTexto = {
        facil: 'Ruta fácil de seguir',
        medio: 'Ruta de dificultad media',
        dificil: 'Ruta que requiere atención extra',
      };
      instructions.push(dificultadTexto[customRoute.dificultad] || '');
    }

    instructions.push(
      `Sigue la ruta marcada hasta llegar a ${destination.nombre}`,
      `Tiempo estimado: ${customRoute.tiempoEstimado} minutos`,
      `Distancia: ${Math.round(customRoute.distancia)}m`,
    );

    return instructions.filter(Boolean);
  }

  /**
   * 🔥 Generar instrucciones para rutas de Google Maps (COMPLETO)
   */
  private generateGoogleInstructions(googleRoute: any, destination: any): string[] {
    return [
      'Sigue la ruta calculada automáticamente',
      `Dirígete hacia ${destination.nombre}`,
      `Tiempo estimado: ${googleRoute.tiempoEstimado} minutos`,
      `Distancia: ${Math.round(googleRoute.distancia)}m`,
      'Mantén activo el GPS para navegación en tiempo real',
    ];
  }

    /**
   * 🔥 Generar instrucciones detalladas según el tipo de ruta
   */
  private generateInstructions(route: any, destination: any): string[] {
    // Si es una ruta de Google Maps con puntos
    if (route.puntos && route.puntos.length > 2) {
      return [
        'Sigue la ruta calculada automáticamente',
        `Dirígete hacia ${destination.nombre}`,
        `Tiempo estimado: ${route.tiempoEstimado} minutos`,
        `Distancia: ${Math.round(route.distancia)}m`,
        'Mantén activo el GPS para navegación en tiempo real',
      ];
    }

    // Si es una ruta directa (fallback) - generar instrucciones con dirección
    const origin = route.puntos[0];
    const dest = route.puntos[route.puntos.length - 1];
    
    // Calcular dirección cardinal
    const direction = this.calculateDirection(origin, dest);
    
    return [
      `Dirígete hacia el ${direction} desde tu ubicación actual`,
      `Camina aproximadamente ${Math.round(route.distancia)}m hacia ${destination.nombre}`,
      `Tiempo estimado: ${route.tiempoEstimado} minutos`,
      destination.edificio ? `Ubicado en ${destination.edificio}` : '',
      destination.piso ? `Piso ${destination.piso}` : '',
      `Llegarás a ${destination.nombre} en aproximadamente ${Math.ceil(route.distancia / 83.33)} minutos`,
    ].filter(Boolean);
  }

  /**
   * 🔥 NUEVO: Calcular dirección cardinal entre dos puntos
   */
  private calculateDirection(origin: Coordinates, destination: Coordinates): string {
    const latDiff = destination.lat - origin.lat;
    const lngDiff = destination.lng - origin.lng;

    // Calcular ángulo en grados
    let angle = Math.atan2(lngDiff, latDiff) * (180 / Math.PI);
    
    // Normalizar a 0-360
    if (angle < 0) angle += 360;

    // Determinar dirección cardinal
    if (angle >= 337.5 || angle < 22.5) return 'norte';
    if (angle >= 22.5 && angle < 67.5) return 'noreste';
    if (angle >= 67.5 && angle < 112.5) return 'este';
    if (angle >= 112.5 && angle < 157.5) return 'sureste';
    if (angle >= 157.5 && angle < 202.5) return 'sur';
    if (angle >= 202.5 && angle < 247.5) return 'suroeste';
    if (angle >= 247.5 && angle < 292.5) return 'oeste';
    if (angle >= 292.5 && angle < 337.5) return 'noroeste';
    
    return 'norte'; // fallback
  }
}  // ← Cierra la clase aquí
