import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  PlusCircle, TrendingUp, CheckCircle, AlertCircle,
  Clock, Activity, ChevronRight, Sparkles, Layers
} from 'lucide-react';
import { getDashboardStats } from '../services/api';
import type { DashboardStats, Session } from '../types';
import { formatRelativeDate, CATEGORY_COLORS, STATUS_COLORS, CATEGORY_LABELS } from '../utils';

const CHART_COLORS = ['#6366f1', '#818cf8', '#4f46e5', '#a5b4fc', '#312e81', '#c7d2fe'];

function StatCard({ label, value, icon: Icon, color, delay }: {
  label: string; value: number | string; icon: React.ElementType; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 350, damping: 25 }}
      whileHover={{ y: -2 }}
      className="stat-card group"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${color}`}>
        <Icon size={19} />
      </div>
      <div className="text-3xl font-extrabold text-white mt-2 tracking-tight">{value}</div>
      <div className="text-xs text-slate-400 font-medium">{label}</div>
    </motion.div>
  );
}

function SessionRow({ session, onClick, index }: { session: Session; onClick: () => void; index: number }) {
  const catColor = CATEGORY_COLORS[session.category as keyof typeof CATEGORY_COLORS] || CATEGORY_COLORS.other;
  const statusColor = STATUS_COLORS[session.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.active;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 350, damping: 25 }}
      onClick={onClick}
      className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-surface-200/60 border border-transparent hover:border-white/5 cursor-pointer transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-100 group-hover:text-brand-300 transition-colors truncate">
          {session.title}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          {formatRelativeDate(session.created_at)}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`badge border ${catColor}`}>
          {CATEGORY_LABELS[session.category as keyof typeof CATEGORY_LABELS] || session.category}
        </span>
        <span className={`badge border ${statusColor}`}>
          {session.status}
        </span>
        <div className="p-1.5 text-slate-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all">
          <ChevronRight size={15} />
        </div>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('Could not load dashboard. Is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Loading analytics...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-slate-400 text-center max-w-md text-sm">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary text-sm">Retry</button>
      </div>
    );
  }

  const chartData = stats
    ? Object.entries(stats.category_distribution).map(([name, count]) => ({
        name: CATEGORY_LABELS[name as keyof typeof CATEGORY_LABELS] || name,
        count,
      }))
    : [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Troubleshooting Overview</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Empirical diagnostics & resolution metrics</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/new')}
          className="btn-primary text-sm shadow-md"
        >
          <PlusCircle size={15} /> New Session
        </motion.button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          label="Total Sessions" value={stats?.total_sessions ?? 0}
          icon={Activity} color="bg-brand-600/20 text-brand-400" delay={0.05}
        />
        <StatCard
          label="Resolved Cases" value={stats?.resolved_sessions ?? 0}
          icon={CheckCircle} color="bg-emerald-500/20 text-emerald-400" delay={0.1}
        />
        <StatCard
          label="Active Inquiries" value={stats?.active_sessions ?? 0}
          icon={Clock} color="bg-blue-500/20 text-blue-400" delay={0.15}
        />
        <StatCard
          label="Attempts Recorded" value={stats?.total_attempts ?? 0}
          icon={TrendingUp} color="bg-purple-500/20 text-purple-400" delay={0.2}
        />
      </div>

      {/* Center Layout: Chart + Summary */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Category Distribution Chart */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="section-title mb-5 flex items-center justify-between">
            <span>Failure Distribution by Category</span>
            <span className="text-xs text-slate-500 font-normal">Active & Resolved</span>
          </h2>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-slate-500 text-xs gap-2">
              <Layers size={24} className="opacity-40" />
              <span>No session data recorded yet.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e2130', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                  labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Resolution Efficiency */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title">Resolution Efficiency</h2>
          <div className="space-y-3">
            {[
              { label: 'Overall Success Rate', value: `${stats?.success_rate ?? 0}%` },
              { label: 'Avg Steps to Resolution', value: stats?.avg_attempts_to_resolve?.toFixed(1) ?? '0' },
              { label: 'Failed Paths Avoided', value: stats?.failed_attempts ?? 0 },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 text-sm">
                <span className="text-slate-400">{item.label}</span>
                <span className="text-white font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Recent Troubleshooting Sessions</h2>
          <button
            onClick={() => navigate('/sessions')}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors flex items-center gap-1"
          >
            <span>View full history</span>
            <ChevronRight size={13} />
          </button>
        </div>

        {!stats?.recent_sessions?.length ? (
          <div className="text-center py-12 text-slate-500 space-y-3">
            <Activity size={32} className="mx-auto opacity-30 animate-pulse" />
            <p className="text-xs">No troubleshooting sessions on record.</p>
            <button onClick={() => navigate('/new')} className="btn-primary text-xs mx-auto">
              <PlusCircle size={14} /> Start Your First Session
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {stats.recent_sessions.map((s, idx) => (
              <SessionRow
                key={s.id}
                session={s}
                index={idx}
                onClick={() => s.status === 'resolved'
                  ? navigate(`/result/${s.id}`)
                  : navigate(`/diagnose/${s.id}`)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
