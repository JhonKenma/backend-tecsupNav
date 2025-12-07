// src/google-maps/google-maps.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, DirectionsRequest, TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteInfo {
  distancia: number; // en metros
  tiempoEstimado: number; // en minutos
  puntos: Coordinates[]; // puntos de la ruta
}

export interface CalculateRouteParams {
  origen: Coordinates;
  destino: Coordinates;
  modo?: 'walking' | 'driving';
  optimizar?: boolean;
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly client: Client;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }
    this.apiKey = apiKey;

    this.client = new Client({});
    this.logger.log('Google Maps Service initialized');
  }

  /**
   * Calcular ruta entre dos puntos usando Google Directions API
   */
  async calculateRoute(params: CalculateRouteParams): Promise<RouteInfo> {
    const { origen, destino, modo = 'walking', optimizar = true } = params;

    try {
      // Falta modificar esto para que funcione con paradas intermedias🎆🎆
      const waypoints = optimizar ? ["optimize:true"] : [];
      const request: DirectionsRequest = {
        params: {
          origin: `${origen.lat},${origen.lng}`,
          destination: `${destino.lat},${destino.lng}`,
          mode: modo === 'walking' ? TravelMode.walking : TravelMode.driving,
          units: UnitSystem.metric,
          ...(waypoints.length > 0 ? { waypoints } : {}),
          key: this.apiKey,
        },
      };

      this.logger.debug(`Calculating route from ${origen.lat},${origen.lng} to ${destino.lat},${destino.lng}`);

      const response = await this.client.directions(request);

      if (!response.data.routes || response.data.routes.length === 0) {
        throw new Error('No se encontraron rutas disponibles');
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      // Extraer puntos de la ruta (polyline decodificado)
      const puntos: Coordinates[] = [];
      
      route.legs.forEach(leg => {
        leg.steps.forEach(step => {
          puntos.push({
            lat: step.start_location.lat,
            lng: step.start_location.lng,
          });
        });
        
        puntos.push({
          lat: leg.end_location.lat,
          lng: leg.end_location.lng,
        });
      });

      const routeInfo: RouteInfo = {
        distancia: leg.distance.value,
        tiempoEstimado: Math.ceil(leg.duration.value / 60),
        puntos: puntos,
      };

      this.logger.log(`Route calculated: ${routeInfo.distancia}m, ${routeInfo.tiempoEstimado}min`);
      
      return routeInfo;

    } catch (error) {
      this.logger.error('Error calculating route:', error);
      throw new Error(`Error al calcular la ruta: ${error.message}`);
    }
  }

  /**
   * Validar si unas coordenadas están dentro del campus de Tecsup
   */
  async validateCampusCoordinates(coords: Coordinates): Promise<boolean> {
    // Coordenadas aproximadas del campus Tecsup Lima
    // Estos valores deberían ser ajustados según las coordenadas reales
    const campusBounds = {
      north: -12.042723,   // Límite norte
      south: -12.045955,   // Límite sur
      east:  -76.952193,   // Límite este
      west:  -76.953192,   // Límite oeste
    };


    const isWithinBounds = 
      coords.lat <= campusBounds.north &&
      coords.lat >= campusBounds.south &&
      coords.lng <= campusBounds.east &&
      coords.lng >= campusBounds.west;

    if (!isWithinBounds) {
      this.logger.warn(`Coordinates ${coords.lat},${coords.lng} are outside campus bounds`);
    }

    return isWithinBounds;
  }

  /**
   * Calcular distancia directa entre dos puntos (fórmula de Haversine)
   */
  calculateDirectDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = coord1.lat * Math.PI/180;
    const φ2 = coord2.lat * Math.PI/180;
    const Δφ = (coord2.lat - coord1.lat) * Math.PI/180;
    const Δλ = (coord2.lng - coord1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
  }

  /**
   * Obtener información de un lugar por coordenadas (reverse geocoding)
   */
  async getPlaceInfo(coords: Coordinates): Promise<any> {
    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: `${coords.lat},${coords.lng}`,
          key: this.apiKey,
        },
      });

      return response.data.results[0] || null;
    } catch (error) {
      this.logger.error('Error getting place info:', error);
      return null;
    }
  }
}
