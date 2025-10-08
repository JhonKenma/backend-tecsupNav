// src/ai-assistant/interfaces/assistant-response.interface.ts
import { IntentResult } from './intent-result.interface';

export type AssistantAction = 'navigate' | 'search' | 'show_info' | 'none';

export interface AssistantResponse {
  message: string;
  intent: IntentResult;
  action?: AssistantAction;
  data?: any;
  requiresConfirmation?: boolean;
  options?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  suggestions?: string[];
}

// Re-exportar todo para facilitar los imports
export * from './intent-result.interface';