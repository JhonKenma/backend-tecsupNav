// src/navigation/services/places-cache.service.ts
import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PlacesCacheService implements OnModuleInit {
  private readonly logger = new Logger(PlacesCacheService.name);
  private placesCache: any[] = [];
  private lastUpdate: Date | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async onModuleInit() {
    await this.loadCache();
  }

  /**
   * Obtener todos los lugares (con caché triple)
   */
  async getAll(): Promise<any[]> {
    try {
      // 1. Redis caché
      const cached = await this.cacheManager.get<any[]>('all_places');
      if (cached) return cached;

      // 2. Memoria caché
      if (this.isCacheValid()) return this.placesCache;

      // 3. Base de datos
      return await this.loadCache();
    } catch (error) {
      this.logger.error('Error en getAll:', error.message);
      return this.placesCache.length > 0 ? this.placesCache : [];
    }
  }

  /**
   * Buscar lugares (filtrado en memoria)
   */
  async search(query: string): Promise<any[]> {
    const allPlaces = await this.getAll();
    if (!query) return allPlaces;

    const lowerQuery = query.toLowerCase();
    return allPlaces.filter(place => 
      place.nombre?.toLowerCase().includes(lowerQuery) ||
      place.descripcion?.toLowerCase().includes(lowerQuery) ||
      place.edificio?.toLowerCase().includes(lowerQuery) ||
      place.tipo?.nombre?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Buscar por ID
   */
  async findById(id: string): Promise<any | null> {
    const allPlaces = await this.getAll();
    return allPlaces.find(p => p.id === id) || null;
  }

  /**
   * Invalidar caché
   */
  async invalidate() {
    await this.cacheManager.del('all_places');
    await this.loadCache();
    this.logger.log('✅ Caché invalidado');
  }

  // Private methods
  private async loadCache(): Promise<any[]> {
    try {
      const places = await this.prisma.executeWithRetry(async () => {
        return await this.prisma.place.findMany({
          include: { tipo: true },
          orderBy: [
            { edificio: 'asc' },
            { piso: 'asc' },
            { nombre: 'asc' },
          ],
        });
      });

      this.placesCache = places;
      this.lastUpdate = new Date();
      await this.cacheManager.set('all_places', places, this.CACHE_TTL);
      
      this.logger.log(`✅ ${places.length} lugares cargados`);
      return places;
    } catch (error) {
      this.logger.error('Error cargando caché:', error.message);
      return this.placesCache;
    }
  }

  private isCacheValid(): boolean {
    return this.placesCache.length > 0 && 
           this.lastUpdate !== null &&
           Date.now() - this.lastUpdate.getTime() < this.CACHE_TTL;
  }
}