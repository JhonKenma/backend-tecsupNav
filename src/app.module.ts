// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { GoogleMapsModule } from './google-maps/google-maps.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PlaceTypesModule } from './place-types/place-types.module';
import { PlacesModule } from './places/places.module';
import { CustomRoutesModule } from './custom-routes/custom-routes.module';
import { NavigationModule } from './navigation/navigation.module';
import { AIAssistantModule } from './ai-assistant/ai-assistant.module';
import { StorageModule } from './storage/storage.module'; // ✅ AÑADIR ESTA LÍNEA
import { CacheModule } from './common/cache/cache.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // ✅ Configuración global
    ConfigModule,
    CacheModule, 

    // ✅ Rate limiting (con estrategias múltiples)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 20,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 100,
      },
    ]),

    // ✅ Base de datos y servicios globales
    PrismaModule,
    GoogleMapsModule,
    StorageModule, // ✅ AÑADIR AQUÍ

    // ✅ Módulos de autenticación y usuarios
    AuthModule,
    UsersModule,

    // ✅ Módulos de mapas y navegación
    PlaceTypesModule,
    PlacesModule,
    CustomRoutesModule,
    NavigationModule,

    // ✅ Módulo del Asistente de IA
    AIAssistantModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}