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
    private placesCache: PlacesCacheService, // 🔥 CAMBIO: Usar PlacesCacheService
    private customRoutesService: CustomRoutesService,
  ) {}

  /**
   * Obtener todos los lugares
   */
  async getAllPlaces(): Promise<any[]> {
    return await this.placesCache.getAll(); // 🔥 Usar caché
  }

  /**
   * Buscar lugares (SIMPLIFICADO)
   */
  async searchPlaces(request: SearchRequest): Promise<PlaceWithDistance[]> {
    const { query, currentLocation, maxResults = 10, radius = 1000 } = request;

    try {
      // 🔥 Buscar desde caché en lugar de BD
      const places = await this.placesCache.search(query || '');
      
      // Calcular distancias
      let result = places.map(place => this.addDistance(place, currentLocation));

      // Filtrar por radio
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
   * Validar GPS
   */
  async validateGPSLocation(location: Coordinates): Promise<{ valid: boolean; message: string }> {
    if (!location.lat || !location.lng) {
      return {
        valid: false,
        message: 'GPS no activado. Por favor, activa la ubicación.',
      };
    }

    try {
      const isValid = await this.googleMapsService.validateCampusCoordinates(location);
      return {
        valid: isValid,
        message: isValid ? 'Ubicación GPS válida.' : 'Fuera del campus.',
      };
    } catch {
      return { valid: true, message: 'GPS aceptado.' };
    }
  }

  /**
   * Crear ruta (SIMPLIFICADO)
   */
  async createRouteFromCurrentLocation(request: NavigationRequest): Promise<NavigationResponse> {
    const { currentLocation, destinationId, destinationName, preferences = {} } = request;

    // Validar GPS
    const gpsValidation = await this.validateGPSLocation(currentLocation);
    if (!gpsValidation.valid) {
      throw new BadRequestException(gpsValidation.message);
    }

    // 🔥 Encontrar destino desde caché
    const destination = destinationId
      ? await this.placesCache.findById(destinationId)
      : await this.findByName(destinationName!);

    if (!destination) {
      throw new NotFoundException('Destino no encontrado');
    }

    // Calcular ruta
    const route = await this.calculateRoute(currentLocation, destination, preferences);
    
    return {
      route,
      destination: this.formatDestination(destination),
      instructions: this.generateInstructions(route, destination),
    };
  }

  /**
   * Buscar lugares cercanos (SIMPLIFICADO)
   */
  async findNearbyPlaces(location: Coordinates, radius: number = 50): Promise<PlaceWithDistance[]> {
    const allPlaces = await this.placesCache.getAll(); // 🔥 Usar caché
    
    return allPlaces
      .map(place => this.addDistance(place, location))
      .filter(p => p.distancia <= radius)
      .sort((a, b) => a.distancia - b.distancia);
  }

  /**
   * Actualización de navegación (SIMPLIFICADO)
   */
  async getNavigationUpdate(currentLocation: Coordinates, destinationId: string) {
    const destination = await this.placesCache.findById(destinationId); // 🔥 Usar caché
    if (!destination) throw new NotFoundException('Destino no encontrado');

    const distancia = this.googleMapsService.calculateDirectDistance(
      currentLocation,
      { lat: destination.latitud, lng: destination.longitud }
    );

    return {
      distanciaRestante: Math.round(distancia),
      tiempoRestante: Math.ceil(distancia / 83.33),
      llegada: distancia < 10,
      mensaje: distancia < 10 
        ? `¡Llegaste a ${destination.nombre}!`
        : `Faltan ${Math.round(distancia)}m`,
    };
  }

  // 🔥 MÉTODOS PRIVADOS SIMPLIFICADOS

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

  private async calculateRoute(origin: Coordinates, destination: any, prefs: any) {
    try {
      const googleRoute = await this.googleMapsService.calculateRoute({
        origen: origin,
        destino: { lat: destination.latitud, lng: destination.longitud },
        modo: prefs.mode || 'walking',
        optimizar: true,
      });

      return {
        puntos: googleRoute.puntos,
        distancia: googleRoute.distancia,
        tiempoEstimado: googleRoute.tiempoEstimado,
        accesible: prefs.accessible || false,
      };
    } catch {
      // Fallback directo
      const distancia = this.googleMapsService.calculateDirectDistance(
        origin,
        { lat: destination.latitud, lng: destination.longitud }
      );

      return {
        puntos: [origin, { lat: destination.latitud, lng: destination.longitud }],
        distancia,
        tiempoEstimado: Math.ceil((distancia / 1000) * 12),
        accesible: false,
      };
    }
  }

  private formatDestination(destination: any) {
    return {
      id: destination.id,
      nombre: destination.nombre,
      latitud: destination.latitud,
      longitud: destination.longitud,
      tipo: destination.tipo?.nombre || 'Lugar',
      edificio: destination.edificio,
      piso: destination.piso,
    };
  }

  private generateInstructions(route: any, destination: any): string[] {
    return [
      'Sigue la ruta calculada',
      `Dirígete a ${destination.nombre}`,
      `Tiempo: ${route.tiempoEstimado} min`,
      `Distancia: ${Math.round(route.distancia)}m`,
    ];
  }
}