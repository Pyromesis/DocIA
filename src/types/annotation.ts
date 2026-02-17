export type AnnotationType = 'variable' | 'anchor' | 'table';

export interface Annotation {
  id: string;
  type: AnnotationType;
  x: number; // Percentage (0-100)
  y: number; // Percentage (0-100)
  width: number; // Percentage (0-100)
  height: number; // Percentage (0-100)
  label?: string;
}

export type VisionModel = 'gpt-4o' | 'claude-3-5-sonnet' | 'llava-local';
export type AgentModel = 'deepseek-r1' | 'llama-3' | 'gpt-4-turbo';

export interface ScanConfig {
  visionModel: VisionModel;
  agentModel: AgentModel;
  templateId: string | null;
}
