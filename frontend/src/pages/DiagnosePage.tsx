import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, MinusCircle, SkipForward,
  Loader, ChevronDown, ChevronUp, AlertTriangle, Brain,
  Shield, BarChart2, RefreshCw, ArrowRight, MessageSquare
} from 'lucide-react';
import {
  getSession, diagnoseSession, createAttempt,
  submitFeedback, getAttemptHistory, getQuestions, answerQuestion
} from '../services/api';
import type {
  Session, Attempt, DiagnoseResponse, Recommendation,
  DiagnosticQuestion, RootCause
} from '../types';
import { parseSafe, RISK_COLORS, CATEGORY_LABELS, confidenceColor, formatDate } from '../utils';
import { RejectedActionsShield } from '../components/RejectedActionsShield';
import { HypothesisGraph } from '../components/HypothesisGraph';

type FeedbackOption = { label: string; value: string; icon: React.ElementType; color: string };

const FEEDBACK_OPTIONS: FeedbackOption[] = [
  { label: 'It Worked!', value: 'worked', icon: CheckCircle, color: 'bg-emerald-600/20 border-emerald-600/30 text-emerald-300 hover:bg-emerald-600/30' },
  { label: 'Didn\'t Work', value: 'failed', icon: XCircle, color: 'bg-red-600/20 border-red-600/30 text-red-300 hover:bg-red-600/30' },
  { label: 'Partially', value: 'partial', icon: MinusCircle, color: 'bg-amber-600/20 border-amber-600/30 text-amber-300 hover:bg-amber-600/30' },
  { label: 'Can\'t Perform', value: 'skipped', icon: SkipForward, color: 'bg-slate-600/20 border-slate-600/30 text-slate-300 hover:bg-slate-600/30' },
];

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          className={`h-full rounded-full ${value >= 0.8 ? 'bg-emerald-500' : value >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`}
        />
      </div>
      <span className={`text-xs font-medium ${confidenceColor(value)}`}>{Math.round(value * 100)}%</span>
    </div>
  );
}

function RecommendationCard({
  rec, onFeedback, loading
}: {
  rec: Recommendation;
  onFeedback: (feedback: string, result: string) => Promise<void>;
  loading: boolean;
}) {
  const [selectedFeedback, setSelectedFeedback] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFeedbackSelect = (f: string) => {
    setSelectedFeedback(f);
    setShowResult(true);
  };

  const handleSubmit = async () => {
    if (!selectedFeedback) return;
    setSubmitting(true);
    try {
      await onFeedback(selectedFeedback, result);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      className="card border-beam border border-brand-500/30 overflow-hidden shadow-2xl shadow-brand-500/5"
    >
      <div className="p-5 border-b border-white/5 bg-gradient-to-r from-brand-600/10 via-transparent to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-brand-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
              <Brain size={13} /> Recommended Diagnostic Action
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">{rec.action_title}</h3>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={`text-xs font-medium ${RISK_COLORS[rec.risk_level]}`}>
              {rec.risk_level.toUpperCase()} RISK
            </span>
            <span className="text-xs text-slate-500">{rec.effort} effort</span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Reasoning */}
        <div>
          <div className="text-xs text-slate-500 font-medium mb-1.5">WHY THIS ACTION</div>
          <p className="text-slate-300 text-sm leading-relaxed">{rec.reason}</p>
        </div>

        {/* Instructions */}
        {rec.instructions?.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 font-medium mb-2">STEPS</div>
            <ol className="space-y-2">
              {rec.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-600/20 text-brand-400 text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span className="text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Evidence */}
        {rec.evidence && rec.evidence.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 font-medium mb-1.5">SUPPORTING EVIDENCE</div>
            <ul className="space-y-1">
              {rec.evidence.map((ev, i) => (
                <li key={i} className="text-slate-400 text-sm flex items-start gap-2">
                  <span className="text-brand-500 mt-0.5 flex-shrink-0">→</span>
                  {ev}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expected outcome */}
        {rec.expected_outcome && (
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <div className="text-xs text-emerald-500 font-medium mb-1">EXPECTED OUTCOME</div>
            <p className="text-sm text-emerald-300/80">{rec.expected_outcome}</p>
          </div>
        )}

        {/* Confidence */}
        <div>
          <div className="text-xs text-slate-500 font-medium mb-1.5">CONFIDENCE</div>
          <ConfidenceBar value={rec.confidence} />
        </div>

        {rec.needs_expert && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Shield size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-amber-300 text-sm">This issue may require professional assistance.</p>
          </div>
        )}

        {/* Feedback */}
        <div className="border-t border-white/5 pt-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Did this action resolve your problem?</div>
          <div className="grid grid-cols-2 gap-2.5">
            {FEEDBACK_OPTIONS.map(opt => (
              <motion.button
                key={opt.value}
                whileHover={{ y: -1.5, scale: 1.01 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleFeedbackSelect(opt.value)}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-semibold text-xs sm:text-sm transition-all shadow-sm ${opt.color} ${
                  selectedFeedback === opt.value ? 'ring-2 ring-offset-2 ring-offset-surface-50 ring-current' : ''
                }`}
              >
                <opt.icon size={16} />
                {opt.label}
              </motion.button>
            ))}
          </div>

          <AnimatePresence>
            {showResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 space-y-3"
              >
                <textarea
                  className="input text-sm min-h-[72px]"
                  placeholder="Describe what happened (optional but helpful)..."
                  value={result}
                  onChange={e => setResult(e.target.value)}
                />
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedFeedback}
                  className="btn-primary w-full justify-center"
                >
                  {submitting ? <><Loader size={15} className="animate-spin" /> Submitting...</> : <>Submit Feedback <ArrowRight size={15} /></>}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

export default function DiagnosePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [diagResult, setDiagResult] = useState<DiagnoseResponse | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagLoading, setDiagLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [s, h, q] = await Promise.all([
        getSession(sessionId),
        getAttemptHistory(sessionId),
        getQuestions(sessionId),
      ]);
      setSession(s);
      setAttempts(h);
      setQuestions(q);
      if (s.status === 'resolved') {
        navigate(`/result/${sessionId}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, navigate]);

  const runDiagnose = useCallback(async () => {
    if (!sessionId) return;
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const result = await diagnoseSession(sessionId, { force_demo: false });
      setDiagResult(result);
      // If there's a recommendation, create an attempt record
      if (result.recommendation) {
        const rec = result.recommendation;
        const attempt = await createAttempt(sessionId, {
          action_title: rec.action_title,
          action_details: rec.instructions,
          reasoning: rec.reason,
          expected_outcome: rec.expected_outcome,
          evidence: rec.evidence,
          next_if_failed: rec.next_if_failed,
          risk_level: rec.risk_level,
          effort: rec.effort,
          confidence: rec.confidence,
          requires_confirmation: rec.requires_confirmation ?? false,
        });
        setCurrentAttempt(attempt);
      }
      // Refresh data
      const [h, q] = await Promise.all([
        getAttemptHistory(sessionId),
        getQuestions(sessionId),
      ]);
      setAttempts(h);
      setQuestions(q);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Diagnosis failed. Please try again.');
    } finally {
      setDiagLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadData().then(() => {
      // Auto-diagnose on first load if session is active
    });
  }, [loadData]);

  useEffect(() => {
    if (session && !diagResult && !diagLoading && !loading) {
      runDiagnose();
    }
  }, [session, diagResult, diagLoading, loading, runDiagnose]);

  const handleAnswerQuestion = async (qId: string, answer: string) => {
    if (!sessionId) return;
    await answerQuestion(sessionId, qId, answer);
    setAnswers(prev => ({ ...prev, [qId]: answer }));
    const updated = await getQuestions(sessionId);
    setQuestions(updated);
  };

  const handleFeedback = async (feedback: string, result: string) => {
    if (!sessionId || !currentAttempt) return;
    await submitFeedback(sessionId, currentAttempt.id, { feedback, actual_result: result });
    if (feedback === 'worked') {
      navigate(`/result/${sessionId}`);
      return;
    }
    // Get next recommendation
    await runDiagnose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Loading session...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <AlertTriangle size={40} className="mx-auto text-red-400 mb-4" />
        <p className="text-slate-300 mb-4">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">Back to Dashboard</button>
      </div>
    );
  }

  if (!session) return null;

  const pendingQuestions = questions.filter(q => !q.user_answer);
  const answeredQuestions = questions.filter(q => q.user_answer);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/dashboard')} className="btn-ghost p-2 mt-0.5">
          <ArrowRight size={18} className="rotate-180" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge bg-brand-600/20 text-brand-300 border border-brand-600/30">
              {CATEGORY_LABELS[session.category as keyof typeof CATEGORY_LABELS] || session.category}
            </span>
            {diagResult && (
              <span className={`badge border ${diagResult.ai_mode === 'ai' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                {diagResult.ai_mode === 'ai' ? '🤖 AI Mode' : '🧩 Demo Mode'}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white">{session.title}</h1>
          <p className="text-slate-400 text-sm mt-0.5">Session #{session.id.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-sm">Attempt {attempts.length}</span>
          <button
            onClick={runDiagnose}
            disabled={diagLoading}
            className="btn-ghost p-2"
            title="Get new recommendation"
          >
            <RefreshCw size={16} className={diagLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Safety warning */}
      {diagResult?.safety_flag && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
        >
          <Shield size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-red-300 font-semibold mb-1">Safety Notice</div>
            <p className="text-red-300/80 text-sm">{diagResult.safety_message}</p>
          </div>
        </motion.div>
      )}

      {/* AI Understanding */}
      {(diagResult?.understanding || session.ai_understanding) && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-brand-400" />
            <span className="text-sm font-medium text-slate-300">AI Understanding</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            {diagResult?.understanding || session.ai_understanding}
          </p>
        </div>
      )}

      {/* Diagnostic Questions */}
      <AnimatePresence>
        {pendingQuestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-400" />
              <span className="text-sm font-medium text-slate-300">Diagnostic Questions</span>
            </div>
            {pendingQuestions.map(q => (
              <DiagnosticQA
                key={q.id}
                question={q}
                onAnswer={(ans) => handleAnswerQuestion(q.id, ans)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {diagLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="card p-8 flex flex-col items-center gap-5 border border-brand-500/20 relative overflow-hidden"
          >
            {/* Shimmer Wave Backdrop */}
            <div className="absolute inset-0 shimmer-wave pointer-events-none" />

            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
                <Brain size={24} className="animate-pulse" />
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-brand-500/20 blur-md pointer-events-none animate-pulse-glow" />
            </div>

            <div className="text-center relative z-10 space-y-1">
              <div className="text-white font-bold text-sm tracking-tight">Formulating Differential Diagnosis...</div>
              <div className="text-slate-400 text-xs">
                {attempts.length > 0
                  ? `Analyzing ${attempts.length} failed attempt${attempts.length > 1 ? 's' : ''} to invalidate disproven hypotheses`
                  : 'Classifying failure domain and synthesizing the first decisive probe'
                }
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loop Interceptor Transparency Shield */}
      {!diagLoading && diagResult && (
        <RejectedActionsShield rejectedActions={diagResult.rejected_actions} />
      )}

      {/* Current Recommendation */}
      {!diagLoading && diagResult?.recommendation && currentAttempt && !currentAttempt.user_feedback && (
        <RecommendationCard
          rec={diagResult.recommendation}
          onFeedback={handleFeedback}
          loading={false}
        />
      )}

      {/* Interactive Hypothesis Decision Graph */}
      {!diagLoading && diagResult?.hypothesis_tree && (
        <HypothesisGraph tree={diagResult.hypothesis_tree} />
      )}

      {/* No recommendation */}
      {!diagLoading && diagResult && !diagResult.recommendation && !diagResult.safety_flag && (
        <div className="card p-8 text-center">
          <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
          <h3 className="text-white font-semibold mb-2">Further Information Needed</h3>
          <p className="text-slate-400 text-sm">Please answer the diagnostic questions above to get a recommendation.</p>
        </div>
      )}

      {/* Root Causes */}
      {diagResult?.root_causes && diagResult.root_causes.length > 0 && (
        <RootCauseSection causes={diagResult.root_causes} />
      )}

      {/* Attempt History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors mb-3"
        >
          {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          Attempt History ({attempts.length})
        </button>
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              {attempts.length === 0 ? (
                <p className="text-slate-500 text-sm">No previous attempts recorded.</p>
              ) : (
                attempts.map(a => (
                  <AttemptHistoryItem key={a.id} attempt={a} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DiagnosticQA({ question, onAnswer }: { question: DiagnosticQuestion; onAnswer: (ans: string) => void }) {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSubmitted(true);
    await onAnswer(input.trim());
  };

  return (
    <div className="p-4 rounded-lg bg-surface-100 border border-white/5">
      <p className="text-slate-300 text-sm mb-3">{question.question}</p>
      <div className="flex gap-2">
        <input
          className="input text-sm flex-1"
          placeholder="Your answer..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          disabled={submitted}
        />
        <button
          onClick={handleSubmit}
          disabled={submitted || !input.trim()}
          className="btn-primary text-sm px-4"
        >
          {submitted ? <CheckCircle size={15} /> : 'Answer'}
        </button>
      </div>
    </div>
  );
}

function AttemptHistoryItem({ attempt }: { attempt: Attempt }) {
  const [expanded, setExpanded] = useState(false);
  const feedbackColors: Record<string, string> = {
    worked: 'text-emerald-400', failed: 'text-red-400',
    partial: 'text-amber-400', skipped: 'text-slate-400'
  };
  const FeedbackIcon = attempt.user_feedback === 'worked' ? CheckCircle
    : attempt.user_feedback === 'failed' ? XCircle
    : attempt.user_feedback === 'partial' ? MinusCircle
    : SkipForward;

  return (
    <div className="card">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-slate-300">
          {attempt.attempt_number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-200 truncate">{attempt.action_title}</div>
          <div className="text-xs text-slate-500">{formatDate(attempt.created_at)}</div>
        </div>
        {attempt.user_feedback && (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${feedbackColors[attempt.user_feedback]}`}>
            <FeedbackIcon size={14} />
            {attempt.user_feedback.toUpperCase()}
          </div>
        )}
        {expanded ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 px-4 pb-4 pt-3 space-y-3"
          >
            {attempt.reasoning && (
              <div>
                <div className="text-xs text-slate-500 mb-1">REASONING</div>
                <p className="text-slate-400 text-sm">{attempt.reasoning}</p>
              </div>
            )}
            {attempt.actual_result && (
              <div>
                <div className="text-xs text-slate-500 mb-1">RESULT</div>
                <p className="text-slate-400 text-sm">{attempt.actual_result}</p>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>Confidence: {Math.round(attempt.confidence * 100)}%</span>
              <span>Risk: {attempt.risk_level}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RootCauseSection({ causes }: { causes: RootCause[] }) {
  const statusColors: Record<string, string> = {
    hypothesis: 'text-slate-400 bg-slate-500/20',
    probable: 'text-amber-400 bg-amber-500/20',
    confirmed: 'text-emerald-400 bg-emerald-500/20',
    ruled_out: 'text-red-400 bg-red-500/20',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={16} className="text-brand-400" />
        <span className="text-sm font-medium text-slate-300">Possible Root Causes</span>
        <span className="text-xs text-slate-500">(AI hypotheses, not confirmed facts)</span>
      </div>
      <div className="space-y-3">
        {causes.map((rc, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-slate-300 text-sm font-medium">{rc.cause}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColors[rc.status] || statusColors.hypothesis}`}>
                  {rc.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-surface-300 rounded-full">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${rc.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{Math.round(rc.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

