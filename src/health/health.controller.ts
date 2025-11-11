// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AIAssistantService } from '../ai-assistant/ai-assistant.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private aiAssistant: AIAssistantService,
  ) {}

  @Get()
  async check() {
    const checks = {
      database: 'unknown',
      ai: 'unknown',
      timestamp: new Date().toISOString(),
    };

    // Check database
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'healthy';
    } catch (error) {
      checks.database = 'unhealthy';
    }

    // Check AI
    checks.ai = this.aiAssistant.isAIAvailable() ? 'healthy' : 'degraded';

    return {
      status: checks.database === 'healthy' ? 'ok' : 'degraded',
      checks,
    };
  }
}