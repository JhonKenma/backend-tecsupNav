// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  
  // ✅ CORS configurado para producción
  app.enableCors({ 
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:19006',
      'http://localhost:8081',
      'exp://localhost:19000',
      'exp://192.168.18.171:19000',
      // ✅ Agregar tus dominios de producción
      'https://josephhuayra.online',
      'https://www.josephhuayra.online',
      'https://api.josephhuayra.online',
      'https://backend-tecsupnav-fxg2.onrender.com',
      'https://frontend-tecnav-admin.onrender.com',
      'https://tecsupnav.online',
      'https://www.tecsupnav.online',
      configService.get('WEB_URL'),
      configService.get('MOBILE_URL'),
    ].filter(url => url), // Filtrar undefined/null
    credentials: true,
    methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE', 'OPTIONS'],
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

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Tecsup Navigation API',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .scheme-container { margin: 20px 0 }
    `,
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
  });

  const port = configService.get<number>('PORT', 3000);

  // ✅ IMPORTANTE: 0.0.0.0 para que Render pueda acceder
  await app.listen(port, '0.0.0.0');
  
  const nodeEnv = configService.get('NODE_ENV', 'development');
  console.log(`🚀 Tecsup Navigation API running on port ${port}`);
  console.log(`🌍 Environment: ${nodeEnv}`);
  console.log(`📚 API Documentation: /api/docs`);
  console.log(`📱 Health check: /api/health`);

  // ✅ SINGLETON: Cierre controlado en señales de sistema
  process.on('SIGINT', async () => {
    console.log('📥 Received SIGINT, closing Prisma connection...');
    await PrismaService.closeConnection();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('📥 Received SIGTERM, closing Prisma connection...');
    await PrismaService.closeConnection();
    process.exit(0);
  });

  // ✅ SINGLETON: Manejo de errores no capturados
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    await PrismaService.closeConnection();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    await PrismaService.closeConnection();
    process.exit(1);
  });
}

bootstrap();