// Shared types for the research automation pipeline

export interface QueueItem {
  id: string;
  topic: string;
  description: string;
  tags: string[];
  priority: number;
  status: "queued" | "running" | "completed" | "failed" | "review";
  added: string; // ISO 8601
  started?: string;
  completed?: string;
  attempts: number;
  maxAttempts: number;
  model: "sonnet" | "opus" | "haiku";
  outputFile?: string; // Path to generated research file
  error?: string;
}

export interface Queue {
  items: QueueItem[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  outputFile?: string;
}

export interface WorkerResult {
  success: boolean;
  item: QueueItem;
  validation: ValidationResult;
  durationMs: number;
  logFile: string;
}

export interface AllowedToolsConfig {
  tools: string[];
  changelog: string[];
}
