import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader, Upload, X, FileText, AlertTriangle,
  ChevronRight, Save, Zap
} from 'lucide-react';
import { createSession, uploadFile } from '../services/api';
import type { ProblemCategory, SessionCreate } from '../types';

const CATEGORIES: { value: ProblemCategory; label: string; icon: string }[] = [
  { value: 'software', label: 'Software', icon: '💻' },
  { value: 'hardware', label: 'Hardware', icon: '🖥️' },
  { value: 'network', label: 'Network', icon: '🌐' },
  { value: 'mobile', label: 'Mobile App', icon: '📱' },
  { value: 'deployment', label: 'Deployment', icon: '🚀' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'other', label: 'Other', icon: '🔧' },
];

const ACCEPTED_FILES = '.pdf,.txt,.png,.jpg,.jpeg,.webp';

export default function NewProblemPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<SessionCreate>({
    title: '',
    description: '',
    category: 'software',
    device: '',
    operating_system: '',
    error_message: '',
    previous_attempts_text: '',
    is_demo: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<'diagnose' | 'draft' | null>(null);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title || form.title.length < 3) errs.title = 'Title must be at least 3 characters.';
    if (!form.description || form.description.length < 10) errs.description = 'Please describe your problem in at least 10 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (mode: 'diagnose' | 'draft') => {
    if (!validate()) return;
    setSubmitting(mode);
    try {
      const payload = { ...form, status: mode === 'draft' ? 'draft' : undefined };
      const session = await createSession(payload);

      // Upload file if attached
      if (file) {
        try {
          await uploadFile(session.id, file);
        } catch (e) {
          console.warn('File upload failed:', e);
        }
      }

      if (mode === 'diagnose') {
        navigate(`/diagnose/${session.id}`);
      } else {
        navigate('/sessions');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create session.';
      setErrors({ submit: message });
    } finally {
      setSubmitting(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 10 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, file: 'File too large. Maximum 10MB.' }));
        return;
      }
      setFile(f);
      setErrors(prev => ({ ...prev, file: '' }));
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">New Troubleshooting Session</h1>
          <p className="text-slate-400 text-sm mt-1">Describe your problem for AI-powered diagnosis</p>
        </div>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6 space-y-6"
      >
        {/* Title */}
        <div>
          <label className="label">Problem Title *</label>
          <input
            className="input"
            placeholder="e.g. My Next.js app fails to deploy on Vercel"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            maxLength={500}
          />
          {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="label">Category *</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  form.category === cat.value
                    ? 'bg-brand-600/20 border-brand-600/40 text-brand-300'
                    : 'bg-surface-100 border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                }`}
              >
                <span>{cat.icon}</span>
                <span className="text-xs">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description & Structured Prompt Helpers */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Problem Description *</label>
            <div className="flex items-center gap-1.5 text-xs text-brand-400">
              <span className="text-slate-500">Insert Template:</span>
              <button
                type="button"
                onClick={() => setForm(f => ({
                  ...f,
                  description: "Goal: [What you are trying to accomplish]\nExpected: [What should have happened]\nActual Error: [What actually happened or failed]\nTrigger: [What changed right before it broke, e.g. update, new install, restart]\nCommand/Action executed: [Exact command run]"
                }))}
                className="hover:underline text-brand-300 bg-brand-600/10 px-2 py-0.5 rounded border border-brand-600/20"
              >
                Root-Cause Template
              </button>
            </div>
          </div>
          <textarea
            className="input min-h-[130px] resize-y font-sans leading-relaxed"
            placeholder="Describe what's happening, what you expected, and any relevant context..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            maxLength={5000}
          />
          <div className="text-right text-xs text-slate-600 mt-1">{form.description.length}/5000</div>
          {errors.description && <p className="text-red-400 text-xs">{errors.description}</p>}
        </div>

        {/* Device / OS */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Device / System</label>
            <input
              className="input"
              placeholder="e.g. MacBook Pro, HP EliteBook, Ubuntu Server"
              value={form.device}
              onChange={e => setForm(f => ({ ...f, device: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Operating System</label>
            <input
              className="input"
              placeholder="e.g. Windows 11, macOS 14, Ubuntu 22.04"
              value={form.operating_system}
              onChange={e => setForm(f => ({ ...f, operating_system: e.target.value }))}
            />
          </div>
        </div>

        {/* Error message */}
        <div>
          <label className="label">Error Message (if any)</label>
          <textarea
            className="input font-mono text-xs min-h-[80px]"
            placeholder="Paste the exact error message here..."
            value={form.error_message}
            onChange={e => setForm(f => ({ ...f, error_message: e.target.value }))}
            maxLength={2000}
          />
        </div>

        {/* Previous attempts */}
        <div>
          <label className="label">Previous Attempts (optional)</label>
          <textarea
            className="input min-h-[80px]"
            placeholder="Describe what you've already tried and the results..."
            value={form.previous_attempts_text}
            onChange={e => setForm(f => ({ ...f, previous_attempts_text: e.target.value }))}
            maxLength={3000}
          />
        </div>

        {/* File upload */}
        <div>
          <label className="label">Attach File (optional)</label>
          <div className="relative">
            <input
              type="file"
              accept={ACCEPTED_FILES}
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <div className={`flex items-center gap-3 p-4 border border-dashed rounded-lg transition-colors ${
              file ? 'border-brand-600/40 bg-brand-600/5' : 'border-white/10 hover:border-white/20'
            }`}>
              {file ? (
                <>
                  <FileText size={18} className="text-brand-400 flex-shrink-0" />
                  <span className="text-slate-300 text-sm flex-1 truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFile(null); }}
                    className="text-slate-500 hover:text-slate-300 z-20 relative"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <Upload size={18} className="text-slate-500 flex-shrink-0" />
                  <span className="text-slate-500 text-sm">Upload PDF, TXT, or image (max 10MB)</span>
                </>
              )}
            </div>
          </div>
          {errors.file && <p className="text-red-400 text-xs mt-1">{errors.file}</p>}
        </div>

        {/* Submit error */}
        {errors.submit && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle size={16} />
            {errors.submit}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => handleSubmit('diagnose')}
            disabled={!!submitting}
            className="btn-primary flex-1 justify-center"
          >
            {submitting === 'diagnose' ? (
              <><Loader size={16} className="animate-spin" /> Starting Diagnosis...</>
            ) : (
              <><Zap size={16} /> Start Diagnosis <ChevronRight size={16} /></>
            )}
          </button>
          <button
            onClick={() => handleSubmit('draft')}
            disabled={!!submitting}
            className="btn-secondary sm:w-auto justify-center"
          >
            {submitting === 'draft' ? (
              <Loader size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Save Draft
          </button>
          <button onClick={() => navigate(-1)} className="btn-ghost sm:w-auto justify-center">
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

