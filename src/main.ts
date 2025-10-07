// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({ 
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:19006',
      'http://localhost:8081',
      'exp://localhost:19000',
      'exp://192.168.18.171:19000',
      process.env.WEB_URL,
      process.env.MOBILE_URL,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuración de Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Tecsup Navigation API')
    .setDescription('API REST para el sistema de navegación interior de Tecsup')
    .setVersion('1.0')
    .addTag('auth', 'Endpoints de autenticación')
    .addTag('maps', 'Gestión de mapas')
    .addTag('locations', 'Gestión de ubicaciones')
    .addTag('routes', 'Cálculo de rutas')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Configurar Swagger UI
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Tecsup Navigation API',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .scheme-container { margin: 20px 0 }
    `,
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Tecsup Navigation API running on: http://localhost:${port}/api`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  console.log(`📱 Health check: http://localhost:${port}/api/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${port}/api/auth`);
  console.log(`📶 Network accessible: http://192.168.18.171:${port}/api`);
}

bootstrap();