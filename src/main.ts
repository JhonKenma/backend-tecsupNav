// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configurar CORS para permitir requests desde móvil y web
  app.enableCors({
    origin: [
      'http://localhost:3000', // Web development
      'http://localhost:3001',
      'http://localhost:19006', // Expo web
      'http://localhost:8081', // Expo development server
      'exp://localhost:19000', // Expo app
      'exp://192.168.18.171:19000', // Expo app en red local (ajustar IP)
      process.env.WEB_URL, // Web production
      process.env.MOBILE_URL, // Mobile production
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remover propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Lanzar error si hay propiedades extra
      transform: true, // Transformar automáticamente los tipos
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0'); // Escuchar en todas las interfaces
  console.log(`🚀 Tecsup Navigation API running on: http://localhost:${port}/api`);
  console.log(`📱 Health check: http://localhost:${port}/api/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth`);
  console.log(`📶 Network accessible: http://192.168.18.171:${port}/api`);
}

bootstrap();