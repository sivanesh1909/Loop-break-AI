import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, Download, Copy, ArrowRight, Home,
  PlusCircle, Clock, Target, TrendingDown, Lightbulb
} from 'lucide-react';
import { getSession, getAttemptHistory, getSessionReport, downloadReportPDF } from '../services/api';
import type { Session, Attempt } from '../types';
import { formatDate, parseSafe } from '../utils';
import { HypothesisGraph } from '../components/HypothesisGraph';
import type { HypothesisTree } from '../types';

export default function ResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      getSession(sessionId),
      getAttemptHistory(sessionId),
      getSessionReport(sessionId),
    ]).then(([s, h, r]) => {
      setSession(s);
      setAttempts(h);
      setReport(r);
    }).finally(() => setLoading(false));
  }, [sessionId]);

  const handleCopy = async () => {
    const text = session?.final_solution || 'No solution recorded';
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!sessionId) return;
    setDownloading(true);
    try {
      await downloadReportPDF(sessionId);
    } catch {
      alert('PDF download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Loading result...
        </div>
      </div>
    );
  }

  if (!session) return null;

  const failedAttempts = attempts.filter(a => a.user_feedback === 'failed');
  const workedAttempt = attempts.find(a => a.user_feedback === 'worked');

  return (
    <div className="max-w-3xl space-y-6">
      {/* Success Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card border-emerald-500/20 border p-7 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-5"
        >
          <CheckCircle size={32} className="text-emerald-400" />
        </motion.div>
        <h1 className="text-3xl font-bold text-white mb-2">Problem Resolved! 🎉</h1>
        <p className="text-slate-400 mb-2">{session.title}</p>
        <p className="text-xs text-slate-500">Session #{session.id.slice(0, 8)}</p>
      </motion.div>

      {/* Solution */}
      {session.final_solution && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">FINAL SOLUTION</h2>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{session.final_solution}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Attempts', value: attempts.length, icon: TrendingDown, color: 'text-brand-400' },
          { label: 'Failed Attempts', value: failedAttempts.length, icon: TrendingDown, color: 'text-red-400' },
          {
            label: 'Resolved',
            value: session.resolved_at ? new Date(session.resolved_at + 'Z').toLocaleDateString() : 'Today',
            icon: Clock, color: 'text-emerald-400'
          },
        ].map(item => (
          <div key={item.label} className="stat-card text-center items-center">
            <item.icon size={20} className={item.color} />
            <div className="text-2xl font-bold text-white">{item.value}</div>
            <div className="text-xs text-slate-400">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Final cause */}
      {session.final_cause && (
        <div className="card p-5">
          <div className="text-xs text-slate-500 font-medium mb-2">ROOT CAUSE</div>
          <p className="text-slate-300 text-sm">{session.final_cause}</p>
          <p className="text-xs text-slate-500 mt-2">Note: Root cause analysis is based on evidence from the troubleshooting session, not independently verified.</p>
        </div>
      )}

      {/* Final Decision & Elimination Tree */}
      <HypothesisGraph
        title="Verified Resolution & Elimination Tree"
        tree={{
          nodes: [
            {
              id: 'root',
              type: 'root',
              label: session.title,
              status: 'confirmed',
            },
            ...attempts.map(a => ({
              id: a.id,
              type: 'attempt' as const,
              label: `#${a.attempt_number}: ${a.action_title}`,
              status: a.user_feedback === 'worked' ? ('confirmed' as const) : ('ruled_out' as const),
              feedback: a.user_feedback,
              result: a.actual_result,
              reasoning: a.reasoning,
            })),
            ...(report?.root_causes || []).map((rc: any, idx: number) => ({
              id: `rc_${idx}`,
              type: 'hypothesis' as const,
              label: rc.cause,
              status: rc.status || 'hypothesis',
              confidence: rc.confidence,
            }))
          ],
          edges: attempts.map(a => ({
            from: 'root',
            to: a.id,
            status: a.user_feedback === 'worked' ? 'confirmed' : 'ruled_out',
          }))
        }}
      />

      {/* Attempt Timeline */}
      <div className="card p-6">
        <h2 className="section-title mb-5">Troubleshooting Timeline</h2>
        <div className="space-y-4">
          {attempts.map((a, i) => {
            const isLast = i === attempts.length - 1;
            const feedbackIcon = a.user_feedback === 'worked' ? '✓' : a.user_feedback === 'failed' ? '✗' : '~';
            const feedbackColor = a.user_feedback === 'worked' ? 'text-emerald-400 bg-emerald-500/20' :
              a.user_feedback === 'failed' ? 'text-red-400 bg-red-500/20' : 'text-amber-400 bg-amber-500/20';

            return (
              <div key={a.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${feedbackColor}`}>
                    {feedbackIcon}
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-surface-300 mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-sm font-medium text-slate-200">#{a.attempt_number} — {a.action_title}</div>
                  {a.reasoning && <p className="text-xs text-slate-500 mt-1">{a.reasoning}</p>}
                  {a.actual_result && <p className="text-xs text-slate-400 mt-1 italic">"{a.actual_result}"</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={handleDownload} disabled={downloading} className="btn-secondary justify-center">
          <Download size={16} />
          {downloading ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
        <button onClick={handleCopy} className="btn-secondary justify-center">
          <Copy size={16} />
          {copied ? 'Copied!' : 'Copy Solution'}
        </button>
        <button onClick={() => navigate('/new')} className="btn-primary justify-center">
          <PlusCircle size={16} /> Start New Session
        </button>
        <button onClick={() => navigate('/dashboard')} className="btn-ghost justify-center border border-white/5">
          <Home size={16} /> Return to Dashboard
        </button>
      </div>
    </div>
  );
}

