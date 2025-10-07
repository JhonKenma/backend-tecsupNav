// src/app.controller.ts
import { Controller, Get, Req } from '@nestjs/common';
import { AppService } from './app.service';
import { Request } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): object {
    return {
      success: true,
      message: 'Tecsup Navigation API funcionando correctamente',
      version: '1.0.0',
      endpoints: {
        auth: '/auth',
        users: '/users',
        documentation: '/api/docs',
      },
    };
  }

  @Get('health')
  getHealth(): object {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  } 

  @Get('network-info')
  getNetworkInfo(@Req() req: Request): object {
    const host = req.get('host');
    const protocol = req.protocol;
    
    return {
      success: true,
      baseUrl: `${protocol}://${host}/api`,
      host: host,
      protocol: protocol,
      note: 'Usa esta URL base en tu app móvil para conectarte desde otros dispositivos',
    };
  }
}