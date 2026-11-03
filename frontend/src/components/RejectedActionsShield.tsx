import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ChevronDown, ChevronUp, AlertCircle, Sparkles } from 'lucide-react';
import type { RejectedAction } from '../types';

interface RejectedActionsShieldProps {
  rejectedActions?: RejectedAction[];
}

export function RejectedActionsShield({ rejectedActions }: RejectedActionsShieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!rejectedActions || rejectedActions.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100/60 border border-white/5 text-xs text-slate-400">
        <Sparkles size={13} className="text-emerald-400" />
        <span>Loop Prevention Active: 0 duplicate suggestions detected</span>
      </div>
    );
  }

  return (
    <div className="card border-amber-500/30 bg-amber-500/5 overflow-hidden transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3.5 text-left text-xs sm:text-sm font-medium hover:bg-amber-500/10 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={14} />
          </div>
          <div>
            <span className="text-amber-200 font-semibold">
              Loop Interceptor Blocked {rejectedActions.length} Repetitive Action{rejectedActions.length > 1 ? 's' : ''}
            </span>
            <span className="text-slate-400 text-xs block sm:inline sm:ml-2">
              (AI attempted to suggest what previously failed)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-amber-300 text-xs">
          <span>{isOpen ? 'Hide Details' : 'Inspect'}</span>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-amber-500/20 p-4 space-y-3 bg-surface-100/50"
          >
            {rejectedActions.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-surface-50 border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    Blocked: "{item.rejected_title}"
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                    Match: {Math.round(item.similarity_score * 100)}%
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="text-slate-500">Matched previous failure:</span>
                  <span className="text-slate-300 font-medium">"{item.matched_with}"</span>
                </div>
                <p className="text-xs text-amber-300/80 italic pt-0.5">
                  Reason: {item.reason}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

