// TypeScript types for LoopBreak AI

export type SessionStatus = 'active' | 'resolved' | 'escalated' | 'draft' | 'abandoned';
export type ProblemCategory = 'software' | 'hardware' | 'network' | 'mobile' | 'deployment' | 'education' | 'other';
export type FeedbackType = 'worked' | 'failed' | 'partial' | 'skipped';
export type RiskLevel = 'low' | 'medium' | 'high';
export type EffortLevel = 'easy' | 'medium' | 'hard';

export interface Session {
  id: string;
  title: string;
  description: string;
  category: ProblemCategory;
  device?: string;
  operating_system?: string;
  error_message?: string;
  status: SessionStatus;
  ai_understanding?: string;
  symptoms?: string;
  possible_causes?: string;
  final_solution?: string;
  final_cause?: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  attempt_count: number;
  failed_count: number;
}

export interface Attempt {
  id: string;
  session_id: string;
  attempt_number: number;
  action_title: string;
  action_details?: string; // JSON string of string[]
  reasoning?: string;
  expected_outcome?: string;
  evidence?: string; // JSON string of string[]
  next_if_failed?: string;
  risk_level: RiskLevel;
  effort: EffortLevel;
  confidence: number;
  requires_confirmation: boolean;
  user_feedback?: FeedbackType;
  actual_result?: string;
  created_at: string;
  feedback_at?: string;
}

export interface DiagnosticQuestion {
  id: string;
  session_id: string;
  question: string;
  question_type: 'text' | 'yes_no' | 'multiple_choice';
  options?: string;
  user_answer?: string;
  created_at: string;
  answered_at?: string;
}

export interface RootCause {
  id?: string;
  cause: string;
  supporting_evidence?: string;
  contradicting_evidence?: string;
  confidence: number;
  status: 'hypothesis' | 'probable' | 'confirmed' | 'ruled_out';
  verification_method?: string;
  created_at?: string;
}

export interface Recommendation {
  action_title: string;
  instructions: string[];
  reason: string;
  evidence?: string[];
  expected_outcome?: string;
  risk_level: RiskLevel;
  effort: EffortLevel;
  confidence: number;
  requires_confirmation?: boolean;
  next_if_failed?: string;
  needs_expert?: boolean;
}

export interface RejectedAction {
  rejected_title: string;
  matched_with: string;
  similarity_score: number;
  reason: string;
}

export interface TreeNode {
  id: string;
  type: 'root' | 'attempt' | 'hypothesis' | 'active_probe';
  label: string;
  status: 'investigating' | 'ruled_out' | 'confirmed' | 'explored' | 'hypothesis' | 'probable' | 'active';
  confidence?: number;
  risk?: string;
  feedback?: string;
  result?: string;
  reasoning?: string;
}

export interface TreeEdge {
  from: string;
  to: string;
  status: string;
}

export interface HypothesisTree {
  nodes: TreeNode[];
  edges: TreeEdge[];
}

export interface DiagnoseResponse {
  session_id: string;
  ai_mode: 'ai' | 'demo';
  understanding?: string;
  questions: Array<{ question: string; question_type: string }>;
  recommendation?: Recommendation;
  root_causes: RootCause[];
  rejected_actions?: RejectedAction[];
  hypothesis_tree?: HypothesisTree;
  safety_flag?: boolean;
  safety_message?: string;
}

export interface DashboardStats {
  total_sessions: number;
  active_sessions: number;
  resolved_sessions: number;
  total_attempts: number;
  failed_attempts: number;
  success_rate: number;
  avg_attempts_to_resolve: number;
  category_distribution: Record<string, number>;
  recent_sessions: Session[];
}

export interface HealthStatus {
  status: string;
  ai_mode: string;
  ai_enabled: boolean;
  version: string;
}

export interface SessionCreate {
  title: string;
  description: string;
  category: ProblemCategory;
  device?: string;
  operating_system?: string;
  error_message?: string;
  previous_attempts_text?: string;
  is_demo?: boolean;
}

export interface DemoScenario {
  key: string;
  title: string;
  category: string;
}

