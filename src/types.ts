// ─── Core Types for AI Orchestrator ───

export type StrategyType = "council" | "debate" | "brainstorm" | "evaluate" | "spec-review" | "custom";

export type ProviderType = "openai" | "anthropic" | "openrouter" | "ollama" | "groq" | "google" | "deepseek";

export interface ProviderConfig {
  type: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AdvisorPersona {
  id: string;
  name: string;
  emoji: string;
  description: string;
  stance: "critical" | "creative" | "analytical" | "practical" | "neutral";
  focusAreas: string[];
  questionPatterns: string[];
  systemPrompt: string;
}

export interface CouncilConfig {
  name: string;
  description: string;
  advisors: AdvisorPersona[];
  chairmanPrompt?: string;
  anonymousReview: boolean;
  minWords: number;
  maxWords: number;
}

export interface CouncilAdvisorSpec {
  id: string;
  provider?: string;
  model?: string;
}

export interface OrchestrationRequest {
  question: string;
  strategy: StrategyType;
  providers: ProviderConfig[];
  council?: CouncilConfig;
  options?: string[];
  criteria?: EvaluationCriterion[];
  context?: string;
  fastMode?: boolean;
}

export interface AdvisorResponse {
  advisorId: string;
  advisorName: string;
  content: string;
  model: string;
  provider: ProviderType;
  latencyMs: number;
}

export interface PeerReviewResult {
  reviewerId: string;
  strongestArg: string; // which anonymous label (A, B, C...)
  weakestArg: string;
  blindSpot: string;
  reasoning: string;
}

export interface OrchestrationResult {
  strategy: StrategyType;
  question: string;
  responses: AdvisorResponse[];
  peerReviews?: PeerReviewResult[];
  synthesis: SynthesisResult;
  metadata: {
    totalLatencyMs: number;
    totalTokens: number;
    providersUsed: ProviderType[];
    anonymousLabels: Record<string, string>; // advisorId -> label
  };
}

export interface SynthesisResult {
  consensusAreas: string[];
  conflictAreas: string[];
  blindSpots: string[];
  recommendation: string;
  firstAction: string;
  chairmanNotes: string;
}

export interface DebateConfig {
  topic: string;
  positionA: { name: string; argument: string; persona: AdvisorPersona };
  positionB: { name: string; argument: string; persona: AdvisorPersona };
  rounds: number;
}

export interface DebateResult {
  topic: string;
  rounds: DebateRound[];
  winner: string;
  reasoning: string;
}

export interface DebateRound {
  roundNumber: number;
  positionA: string;
  positionB: string;
  rebuttalA?: string;
  rebuttalB?: string;
}

export interface BrainstormConfig {
  topic: string;
  personas: AdvisorPersona[];
  constraints: string[];
  targetCount: number;
}

export interface BrainstormResult {
  ideas: BrainstormIdea[];
  clusters: IdeaCluster[];
  topPick: BrainstormIdea;
}

export interface BrainstormIdea {
  id: string;
  content: string;
  source: string;
  score: number;
  novelty: number;
  feasibility: number;
}

export interface IdeaCluster {
  label: string;
  ideaIds: string[];
}

export interface EvaluationCriterion {
  name: string;
  weight: number; // 0-1
  description: string;
  type: "scalar" | "boolean" | "text";
}

export interface EvaluationResult {
  options: OptionScore[];
  winner: string;
  analysis: string;
}

export interface OptionScore {
  name: string;
  totalScore: number;
  criteriaScores: Record<string, number>;
  pros: string[];
  cons: string[];
}

export interface SpecReviewConfig {
  spec: string;
  personas: AdvisorPersona[];
  focusAreas: string[];
}

export interface SpecReviewResult {
  spec: string;
  personaReviews: AdvisorResponse[];
  riskMatrix: RiskItem[];
  complianceGaps: string[];
  overallScore: number; // 0-10
}

export interface RiskItem {
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  mitigation: string;
}

// ─── Provider API Types ───

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: false;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
