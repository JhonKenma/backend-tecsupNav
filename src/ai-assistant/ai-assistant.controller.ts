// src/ai-assistant/ai-assistant.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { AIAssistantService } from './ai-assistant.service';
import { ProcessCommandDto } from './dto/process-command.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@Controller('ai-assistant')
@UseGuards(JwtAuthGuard)
export class AIAssistantController {
  constructor(private readonly aiAssistantService: AIAssistantService) {}

  /**
   * RF-402: Interpretar comando de voz o texto
   */
  @Post('process')
  async processCommand(
    @Body(ValidationPipe) dto: ProcessCommandDto,
    @CurrentUser() user,
  ) {
    try {
      const context = {
        currentLocation: dto.currentLat && dto.currentLng 
          ? { lat: dto.currentLat, lng: dto.currentLng }
          : undefined,
        conversationId: dto.conversationId,
        useAI: dto.useAI,
      };

      const response = await this.aiAssistantService.processCommand(
        user.id,
        dto.query,
        context
      );

      return {
        success: true,
        data: response,
        userId: user.id,
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }
  }

  /**
   * Obtener historial de conversación
   */
  @Get('history')
  async getHistory(
    @CurrentUser() user,
    @Query('limit') limit?: number,
  ) {
    try {
      const history = this.aiAssistantService.getConversationHistory(
        user.id,
        limit ? Number(limit) : undefined
      );

      return {
        success: true,
        data: history,
        total: history.length,
        userId: user.id,
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Limpiar historial de conversación
   */
  @Delete('history')
  async clearHistory(@CurrentUser() user) {
    try {
      this.aiAssistantService.clearConversationHistory(user.id);

      return {
        success: true,
        message: 'Historial de conversación limpiado',
        userId: user.id,
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Obtener estadísticas del usuario
   */
  @Get('stats')
  async getUserStats(@CurrentUser() user) {
    try {
      const stats = this.aiAssistantService.getUserStats(user.id);

      return {
        success: true,
        data: stats,
        userId: user.id,
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Verificar disponibilidad de IA
   */
  @Get('ai-status')
  async getAIStatus() {
    try {
      const isAvailable = this.aiAssistantService.isAIAvailable();

      return {
        success: true,
        data: {
          aiAvailable: isAvailable,
          mode: isAvailable ? 'AI + Rules' : 'Rules Only',
          message: isAvailable 
            ? 'Asistente con IA activo (OpenAI)'
            : 'Asistente funcionando con reglas básicas',
        },
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Estadísticas globales (solo admin)
   */
  @Get('global-stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getGlobalStats() {
    try {
      const stats = this.aiAssistantService.getGlobalStats();

      return {
        success: true,
        data: stats,
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}