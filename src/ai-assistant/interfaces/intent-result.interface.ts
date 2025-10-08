// src/ai-assistant/interfaces/intent-result.interface.ts
export type IntentType = 'navigate' | 'search' | 'information' | 'greeting' | 'help' | 'unknown';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  entities: {
    destination?: string;
    building?: string;
    floor?: number;
    placeType?: string;
  };
  originalQuery: string;
  interpretation: string;
  suggestions?: string[];
}