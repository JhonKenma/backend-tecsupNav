// src/ai-assistant/ai-assistant.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AIAssistantService } from './ai-assistant.service';
import { AIAssistantController } from './ai-assistant.controller';
import { AIAssistantGateway } from './ai-assistant.gateway';
import { IntentDetectionService } from './services/intent-detection.service';
import { OpenAIIntegrationService } from './services/openai-integration.service';
import { ConversationalAIService } from './services/conversational-ai.service'; // ✅ NUEVO
import { CommandHandlerService } from './services/command-handler.service';
import { ConversationHistoryService } from './services/conversation-history.service';
import { NavigationModule } from '../navigation/navigation.module';

@Module({
  imports: [
    NavigationModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AIAssistantController],
  providers: [
    AIAssistantService,
    AIAssistantGateway,
    IntentDetectionService,
    OpenAIIntegrationService,
    ConversationalAIService, // ✅ AÑADIDO
    CommandHandlerService,
    ConversationHistoryService,
  ],
  exports: [AIAssistantService, AIAssistantGateway],
})
export class AIAssistantModule {}
