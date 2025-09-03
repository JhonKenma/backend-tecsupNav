// src/navigation/navigation.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { NavigationService } from './navigation.service';
import {
  SearchPlacesDto,
  CreateNavigationDto,
  ValidateGPSDto,
  NavigationUpdateDto,
} from './dto/navigation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MobileOnlyGuard } from '../common/guards/platform.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('navigation')
//@UseGuards(JwtAuthGuard, MobileOnlyGuard) // Solo estudiantes desde móvil
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  // 1. VALIDAR GPS
  @Post('validate-gps')
  async validateGPS(@Body(ValidationPipe) validateGpsDto: ValidateGPSDto) {
    try {
      const validation = await this.navigationService.validateGPSLocation({
        lat: validateGpsDto.lat,
        lng: validateGpsDto.lng,
      });

      return {
        success: validation.valid,
        message: validation.message,
        data: {
          valid: validation.valid,
          withinCampus: validation.valid,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }
  }

  // 2. BUSCAR LUGARES POR TEXTO
  @Get('search')
  async searchPlaces(@Query() searchDto: SearchPlacesDto, @CurrentUser() user) {
    try {
      const currentLocation =
        searchDto.currentLat && searchDto.currentLng
          ? { lat: searchDto.currentLat, lng: searchDto.currentLng }
          : undefined;

      const places = await this.navigationService.searchPlaces({
        query: searchDto.query,
        currentLocation,
        maxResults: searchDto.maxResults,
        radius: searchDto.radius,
      });

      return {
        success: true,
        message: `Se encontraron ${places.length} lugares`,
        data: places,
        query: searchDto.query,
        total: places.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // 3. CREAR NAVEGACIÓN DESDE UBICACIÓN ACTUAL 
  @Post('create-route') 
  async createNavigation(
    @Body(ValidationPipe) createNavigationDto: CreateNavigationDto,
    @CurrentUser() user,
  ) {
    try {
      const navigation =
        await this.navigationService.createRouteFromCurrentLocation({
          currentLocation: {
            lat: createNavigationDto.currentLat,
            lng: createNavigationDto.currentLng,
          },
          destinationId: createNavigationDto.destinationId,
          preferences: {
            mode: createNavigationDto.mode,
            accessible: createNavigationDto.accessible,
            fastest: createNavigationDto.fastest,
          },
        });

      return {
        success: true,
        message: `Ruta creada hacia ${navigation.destination.nombre}`,
        data: navigation,
        userId: user.id, //quitar esto si solo quieres probar ya que tienes que estar logueado para que funcione
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // 4. BUSCAR LUGARES CERCANOS
  @Get('nearby')
  async findNearbyPlaces(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radius') radius: number = 100,
  ) {
    try {
      if (!lat || !lng) {
        return {
          success: false,
          message: 'Se requieren las coordenadas lat y lng',
          statusCode: HttpStatus.BAD_REQUEST,
        };
      }

      const nearbyPlaces = await this.navigationService.findNearbyPlaces(
        { lat: Number(lat), lng: Number(lng) },
        Number(radius),
      );

      return {
        success: true,
        message: `Se encontraron ${nearbyPlaces.length} lugares cercanos`,
        data: nearbyPlaces,
        location: { lat: Number(lat), lng: Number(lng) },
        radius: Number(radius),
        total: nearbyPlaces.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 5. ACTUALIZACIÓN DURANTE LA NAVEGACIÓN
  @Post('update')
  async getNavigationUpdate(
    @Body(ValidationPipe) updateDto: NavigationUpdateDto,
    @CurrentUser() user,
  ) {
    try {
      const update = await this.navigationService.getNavigationUpdate(
        {
          lat: updateDto.currentLat,
          lng: updateDto.currentLng,
        },
        updateDto.destinationId,
      );

      return {
        success: true,
        data: update,
        userId: user.id,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.NOT_FOUND,
      };
    }
  }

  // 6. BÚSQUEDA RÁPIDA
  @Get('quick-search')
  async quickSearch(
    @Query('q') query: string,
    @Query('lat') lat?: number,
    @Query('lng') lng?: number,
  ) {
    try {
      if (!query || query.trim().length < 2) {
        return {
          success: false,
          message: 'La búsqueda debe tener al menos 2 caracteres',
          statusCode: HttpStatus.BAD_REQUEST,
        };
      }

      const currentLocation =
        lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined;

      const places = await this.navigationService.searchPlaces({
        query: query.trim(),
        currentLocation,
        maxResults: 5,
        radius: 500,
      });

      return {
        success: true,
        data: places,
        query: query.trim(),
        total: places.length,
        quickSearch: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // 7. OBTENER LUGARES POPULARES
  @Get('popular')
  async getPopularPlaces(@CurrentUser() user) {
    try {
      const popularTypes = [
        'Aula',
        'Laboratorio',
        'Biblioteca',
        'Cafetería',
        'Oficina',
      ];

      const popularPlaces = await Promise.all(
        popularTypes.map(async (tipo) => {
          const places = await this.navigationService.searchPlaces({
            query: tipo,
            maxResults: 3,
          });
          return {
            tipo,
            places: places.slice(0, 3),
          };
        }),
      );

      return {
        success: true,
        message: 'Lugares populares obtenidos',
        data: popularPlaces.filter(
          (category) => category.places.length > 0,
        ),
        userId: user.id,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 8. SUGERENCIAS DE BÚSQUEDA
  @Get('suggestions')
  async getSearchSuggestions(@Query('q') query: string) {
    try {
      if (!query || query.trim().length < 1) {
        return {
          success: true,
          data: [
            'Biblioteca',
            'Cafetería',
            'Laboratorio',
            'Aula',
            'Oficina',
            'Pabellón A',
            'Pabellón B',
            'Entrada Principal',
          ],
          default: true,
        };
      }

      const places = await this.navigationService.searchPlaces({
        query: query.trim(),
        maxResults: 8,
      });

      const suggestions = places.map((place) => ({
        text: place.nombre,
        id: place.id,
        type: place.tipo.nombre,
        building: place.edificio,
      }));

      return {
        success: true,
        data: suggestions,
        query: query.trim(),
        total: suggestions.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 9. ESTADO DE NAVEGACIÓN EN TIEMPO REAL (ADMIN)
  @Get('realtime/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getRealtimeStats() {
    try {
      const { NavigationStateService } = await import('./navigation-state.service');

      return {
        success: true,
        message: 'Estadísticas en tiempo real obtenidas',
        data: {
          activeSessions: 0,
          totalSessions: 0,
          completedToday: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // 10. OBTENER TOKEN PARA WEBSOCKET
  @Get('websocket-token')
  async getWebSocketToken(@CurrentUser() user) {
    try {
      return {
        success: true,
        data: {
          token: 'use_current_jwt_token',
          namespace: '/navigation',
          endpoint: `ws://localhost:3000/navigation`,
          userId: user.id,
          instructions: [
            'Conectar a: ws://localhost:3000/navigation',
            'Enviar token en auth: { token: "tu_jwt_token" }',
            'Escuchar eventos: connected, navigation_update, navigation_completed',
            'Enviar eventos: start_navigation, location_update, pause_navigation',
          ],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
