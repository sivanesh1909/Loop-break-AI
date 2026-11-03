import axios from 'axios';
import type {
  Session, Attempt, DiagnoseResponse, DashboardStats,
  HealthStatus, SessionCreate, DemoScenario, DiagnosticQuestion
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — surface clean errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

// ─── Health ──────────────────────────────────────────────────────────────────
export const getHealth = (): Promise<HealthStatus> =>
  api.get('/api/health').then(r => r.data);

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const getDashboardStats = (): Promise<DashboardStats> =>
  api.get('/api/dashboard/stats').then(r => r.data);

// ─── Sessions ────────────────────────────────────────────────────────────────
export const listSessions = (status?: string): Promise<Session[]> =>
  api.get('/api/sessions', { params: { status } }).then(r => r.data);

export const createSession = (data: SessionCreate): Promise<Session> =>
  api.post('/api/sessions', data).then(r => r.data);

export const getSession = (id: string): Promise<Session> =>
  api.get(`/api/sessions/${id}`).then(r => r.data);

export const updateSession = (id: string, data: Partial<Session>): Promise<Session> =>
  api.patch(`/api/sessions/${id}`, data).then(r => r.data);

export const deleteSession = (id: string): Promise<void> =>
  api.delete(`/api/sessions/${id}`).then(r => r.data);

// ─── Diagnose ─────────────────────────────────────────────────────────────────
export const diagnoseSession = (
  id: string,
  opts: { force_demo?: boolean } = {}
): Promise<DiagnoseResponse> =>
  api.post(`/api/sessions/${id}/diagnose`, opts).then(r => r.data);

// ─── Attempts ────────────────────────────────────────────────────────────────
export const createAttempt = (sessionId: string, data: {
  action_title: string;
  action_details?: string[];
  reasoning?: string;
  expected_outcome?: string;
  evidence?: string[];
  next_if_failed?: string;
  risk_level?: string;
  effort?: string;
  confidence?: number;
  requires_confirmation?: boolean;
}): Promise<Attempt> =>
  api.post(`/api/sessions/${sessionId}/attempts`, data).then(r => r.data);

export const submitFeedback = (
  sessionId: string,
  attemptId: string,
  data: { feedback: string; actual_result?: string }
): Promise<Attempt> =>
  api.post(`/api/sessions/${sessionId}/attempts/${attemptId}/feedback`, data).then(r => r.data);

export const getAttemptHistory = (sessionId: string): Promise<Attempt[]> =>
  api.get(`/api/sessions/${sessionId}/history`).then(r => r.data);

// ─── Questions ───────────────────────────────────────────────────────────────
export const getQuestions = (sessionId: string): Promise<DiagnosticQuestion[]> =>
  api.get(`/api/sessions/${sessionId}/questions`).then(r => r.data);

export const answerQuestion = (
  sessionId: string,
  questionId: string,
  answer: string
): Promise<{ id: string; answered: boolean }> =>
  api.post(`/api/sessions/${sessionId}/questions`, { answer }, {
    params: { question_id: questionId }
  }).then(r => r.data);

// ─── Report ──────────────────────────────────────────────────────────────────
export const getSessionReport = (sessionId: string): Promise<object> =>
  api.get(`/api/sessions/${sessionId}/report`).then(r => r.data);

export const downloadReportPDF = async (sessionId: string): Promise<void> => {
  const resp = await api.get(`/api/sessions/${sessionId}/report`, {
    params: { format: 'pdf' },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `loopbreak-report-${sessionId.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Files ───────────────────────────────────────────────────────────────────
export const uploadFile = (sessionId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/api/files/upload', form, {
    params: { session_id: sessionId },
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

// ─── Demo ─────────────────────────────────────────────────────────────────────
export const getDemoScenarios = (): Promise<{ scenarios: DemoScenario[] }> =>
  api.get('/api/demo/scenarios').then(r => r.data);

export const loadDemoScenario = (key: string): Promise<{
  session_id: string; title: string; category: string; mode: string;
}> =>
  api.post('/api/demo/load', null, { params: { scenario_key: key } }).then(r => r.data);

export const resetDemoData = (): Promise<{ deleted_sessions: number }> =>
  api.post('/api/demo/reset').then(r => r.data);

