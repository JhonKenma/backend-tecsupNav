// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Configuración global
    ConfigModule,
    
    // Rate limiting (nueva sintaxis)
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 1000, // 1 segundo
      limit: 3, // 3 requests por segundo
    }, {
      name: 'medium',
      ttl: 10000, // 10 segundos
      limit: 20, // 20 requests por 10 segundos
    }, {
      name: 'long',
      ttl: 60000, // 1 minuto
      limit: 100, // 100 requests por minuto
    }]),
    
    // Base de datos
    PrismaModule,
    
    // Módulos de la aplicación
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Rate limiting global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}