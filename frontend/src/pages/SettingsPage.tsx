import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon, Shield, Database, Sparkles,
  RefreshCw, CheckCircle2, AlertTriangle, Download, Trash2, Key
} from 'lucide-react';
import { getHealth, resetDemoData } from '../services/api';
import type { HealthStatus } from '../types';

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleClearDemo = async () => {
    if (!window.confirm('Delete all demo sessions? Real user sessions will be preserved.')) return;
    setClearing(true);
    try {
      const res = await resetDemoData();
      setMessage({ type: 'success', text: `Demo data cleared (${res.deleted_sessions} sessions removed).` });
    } catch (e: unknown) {
      setMessage({ type: 'error', text: 'Failed to clear demo data.' });
    } finally {
      setClearing(false);
    }
  };

  const handleExportData = () => {
    const data = {
      export_date: new Date().toISOString(),
      platform: 'LoopBreak AI',
      client_storage: localStorage.getItem('loopbreak_preferences') || '{}',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loopbreak-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <SettingsIcon size={24} className="text-brand-400" />
          Settings & Diagnostics
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Inspect AI engine status, manage demo data, and review runtime settings
        </p>
      </div>

      {message && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-red-500/10 border-red-500/20 text-red-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
        </motion.div>
      )}

      {/* AI Provider Status Card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center text-brand-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">AI Engine Configuration</h2>
              <p className="text-xs text-slate-400">Gemini API status & execution mode</p>
            </div>
          </div>
          <button
            onClick={fetchHealth}
            className="btn-ghost p-2 text-slate-400 hover:text-white"
            title="Refresh status"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-surface-100 border border-white/5">
            <span className="text-xs text-slate-500 block">Current Mode</span>
            <span className="text-sm font-semibold text-slate-200 capitalize">
              {health?.ai_mode || 'Checking...'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-surface-100 border border-white/5">
            <span className="text-xs text-slate-500 block">Gemini API Connection</span>
            <span className={`text-sm font-semibold flex items-center gap-1.5 ${
              health?.ai_enabled ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {health?.ai_enabled ? (
                <>
                  <CheckCircle2 size={14} /> Connected (Free-Tier)
                </>
              ) : (
                <>
                  <AlertTriangle size={14} /> Local Demo Mode (No Key Needed)
                </>
              )}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-surface-100/60 border border-white/5 text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Key size={14} className="text-brand-400" />
            Configuring Your Free Gemini API Key:
          </div>
          <p>
            To enable live Gemini reasoning, set <code className="text-brand-300">GEMINI_API_KEY</code> in <code className="text-brand-300">backend/.env</code> and restart the backend server.
          </p>
          <p className="text-slate-500">
            Keys are never exposed to the frontend browser application for security.
          </p>
        </div>
      </div>

      {/* Database & Storage */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Data Management</h2>
            <p className="text-xs text-slate-400">SQLite persistent database & exports</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button onClick={handleExportData} className="btn-secondary text-sm flex-1 justify-center">
            <Download size={15} /> Export Configuration & Logs
          </button>
          <button
            onClick={handleClearDemo}
            disabled={clearing}
            className="btn-secondary text-sm border-red-500/20 text-red-300 hover:bg-red-500/10 flex-1 justify-center"
          >
            <Trash2 size={15} /> {clearing ? 'Clearing...' : 'Clear Demo Sessions'}
          </button>
        </div>
      </div>

      {/* Security & Architecture */}
      <div className="card p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">System Architecture & Safety</h2>
            <p className="text-xs text-slate-400">Semantic Failure Memory + Safety Guardrails</p>
          </div>
        </div>

        <div className="text-xs text-slate-400 leading-relaxed space-y-2 pt-1">
          <p>
            • <strong>Failure Memory Engine:</strong> Uses syntactic, synonym, and semantic similarity to prevent looping repetitive failed suggestions.
          </p>
          <p>
            • <strong>Safety Verification:</strong> High-risk operations (electrical, medical, chemical, destructive commands) trigger hard safety stops with professional escalation warnings.
          </p>
          <p>
            • <strong>Hypothesis Guardrail:</strong> AI explicitly labels root causes as hypotheses until evidence verifies them.
          </p>
        </div>
      </div>
    </div>
  );
}

