// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  
  // ✅ SINGLETON: Instancia única estática
  private static instance: PrismaService | null = null;
  private static isConnected: boolean = false;
  private static connectionPromise: Promise<void> | null = null;

  constructor() {
    // ✅ SINGLETON: Evitar múltiples instancias
    if (PrismaService.instance) {
      return PrismaService.instance;
    }

    super({
      log: ['error', 'warn'],
      errorFormat: 'minimal',
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // ✅ SINGLETON: Asignar instancia única
    PrismaService.instance = this;
  }

  // ✅ SINGLETON: Método factory para obtener instancia única
  static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  // ✅ CIERRE CONTROLADO: Método para cierre seguro
  static async closeConnection(): Promise<void> {
    if (PrismaService.instance && PrismaService.isConnected) {
      try {
        await PrismaService.instance.$disconnect();
        PrismaService.isConnected = false;
        PrismaService.connectionPromise = null;
        console.log('🔌 Prisma connection closed via Singleton');
      } catch (error) {
        console.error('Error closing Prisma connection:', error);
      }
    }
  }

  async onModuleInit() {
    // ✅ SINGLETON: Evitar múltiples conexiones
    if (PrismaService.isConnected) {
      this.logger.log('✅ Database already connected (Singleton)');
      return;
    }

    // ✅ SINGLETON: Una sola promesa de conexión
    if (PrismaService.connectionPromise) {
      await PrismaService.connectionPromise;
      return;
    }

    PrismaService.connectionPromise = this.initializeConnection();
    await PrismaService.connectionPromise;
  }

  private async initializeConnection(): Promise<void> {
    try {
      await this.$connect();
      PrismaService.isConnected = true;
      this.logger.log('✅ Database connected successfully (Singleton)');
      
      // ✅ Health check con timeout corto
      await Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 3000)
        ),
      ]);
      
      this.logger.log('✅ Database health check passed');
    } catch (error) {
      PrismaService.isConnected = false;
      PrismaService.connectionPromise = null;
      this.logger.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await PrismaService.closeConnection();
    this.logger.log('🔌 Database disconnected gracefully (Singleton)');
  }

  // ✅ MEJORADO: Retry más agresivo
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2, // Reducir retries
    delay: number = 500,    // Delay más corto
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (this.isConnectionError(error) && attempt < maxRetries) {
          this.logger.warn(`Connection attempt ${attempt} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // Backoff menos agresivo
          continue;
        }
        
        this.logger.error(`Operation failed after ${attempt} attempts:`, error.message);
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  // ✅ NUEVO: Detectar errores de conexión específicos de Supabase
  private isConnectionError(error: any): boolean {
    const connectionErrors = [
      'ECONNRESET',
      'ENOTFOUND', 
      'ECONNREFUSED',
      'ETIMEDOUT',
      'Connection terminated unexpectedly',
      'Too many connections', // ✅ Específico de PostgreSQL
      'connection is not available',
      'connection pool timeout',
    ];
    
    return connectionErrors.some(errType => 
      error.message?.toLowerCase().includes(errType.toLowerCase()) || 
      error.code === errType
    );
  }

  // ✅ NUEVO: Monitoreo de conexiones activas
  async getConnectionInfo() {
    try {
      const result = await this.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) filter (where state = 'active') as active_connections,
          count(*) filter (where state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      ` as any[];
      
      return result[0];
    } catch (error) {
      this.logger.warn('Could not get connection info:', error.message);
      return null;
    }
  }

  // ✅ SINGLETON: Estado de conexión
  static isConnectionActive(): boolean {
    return PrismaService.isConnected;
  }

  // ✅ SINGLETON: Información de instancia
  static getInstanceInfo(): { hasInstance: boolean; isConnected: boolean } {
    return {
      hasInstance: PrismaService.instance !== null,
      isConnected: PrismaService.isConnected
    };
  }
}