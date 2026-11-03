import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  History, Search, Filter, PlusCircle, ChevronRight,
  Trash2, RefreshCw, AlertCircle
} from 'lucide-react';
import { listSessions, deleteSession } from '../services/api';
import type { Session, ProblemCategory, SessionStatus } from '../types';
import {
  formatDate, formatRelativeDate, CATEGORY_LABELS,
  CATEGORY_COLORS, STATUS_COLORS
} from '../utils';

export default function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await listSessions();
      setSessions(data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this troubleshooting session?')) return;
    setDeletingId(id);
    try {
      await deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {
      alert('Failed to delete session');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = sessions.filter(s => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      (s.device && s.device.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = categoryFilter === 'all' || s.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <History size={24} className="text-brand-400" />
            Troubleshooting History
          </h1>
          <p className="text-slate-400 text-sm mt-1">Review, resume, or inspect all diagnostic sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchSessions} className="btn-ghost p-2 text-slate-400 hover:text-white" title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => navigate('/new')} className="btn-primary text-sm">
            <PlusCircle size={16} /> New Session
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-10 text-sm py-2"
            placeholder="Search sessions by title, description, or device..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="input text-sm py-2 w-auto bg-surface-100 cursor-pointer"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="software">Software</option>
            <option value="hardware">Hardware</option>
            <option value="network">Network</option>
            <option value="mobile">Mobile</option>
            <option value="deployment">Deployment</option>
            <option value="education">Education</option>
            <option value="other">Other</option>
          </select>
          <select
            className="input text-sm py-2 w-auto bg-surface-100 cursor-pointer"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 gap-3">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Loading sessions...
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-red-400 space-y-3">
          <AlertCircle size={32} className="mx-auto" />
          <p>{error}</p>
          <button onClick={fetchSessions} className="btn-secondary mx-auto">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-400 space-y-3">
          <History size={36} className="mx-auto text-slate-600" />
          <p className="text-base text-slate-300">No sessions match your filter.</p>
          <p className="text-sm text-slate-500">Try adjusting your search criteria or create a new session.</p>
          <button onClick={() => navigate('/new')} className="btn-primary text-sm mx-auto mt-2">
            <PlusCircle size={15} /> Start New Session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const catColor = CATEGORY_COLORS[s.category as ProblemCategory] || CATEGORY_COLORS.other;
            const statColor = STATUS_COLORS[s.status as SessionStatus] || STATUS_COLORS.active;
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(s.status === 'resolved' ? `/result/${s.id}` : `/diagnose/${s.id}`)}
                className="card p-4 hover:border-brand-600/30 transition-all cursor-pointer flex items-center justify-between gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge border ${catColor}`}>
                      {CATEGORY_LABELS[s.category as ProblemCategory] || s.category}
                    </span>
                    <span className={`badge border ${statColor}`}>
                      {s.status}
                    </span>
                    {s.is_demo && (
                      <span className="badge border bg-amber-500/10 text-amber-300 border-amber-500/20 text-[10px]">
                        DEMO
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-brand-300 transition-colors truncate">
                    {s.title}
                  </h3>
                  <p className="text-slate-400 text-xs line-clamp-1 mt-0.5">
                    {s.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                    <span>Created: {formatDate(s.created_at)}</span>
                    {s.attempt_count > 0 && (
                      <span>Attempts: {s.attempt_count} ({s.failed_count} failed)</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => handleDelete(e, s.id)}
                    disabled={deletingId === s.id}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete session"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="btn-ghost p-2 group-hover:text-brand-400">
                    <ChevronRight size={18} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

