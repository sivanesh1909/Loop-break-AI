import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, PlusCircle, History, Settings, Zap,
  ChevronRight, X, Menu, Activity
} from 'lucide-react';
import { cn } from '../utils';
import { AnimatedLogo } from '../components/AnimatedLogo';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/new', label: 'New Session', icon: PlusCircle },
  { to: '/sessions', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

function SidebarContent({ onClose, isMobile }: { onClose: () => void; isMobile: boolean }) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full bg-surface-50 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5">
        <NavLink to="/" onClick={isMobile ? onClose : undefined} className="focus:outline-none">
          <AnimatedLogo size={34} />
        </NavLink>
        {isMobile && (
          <button onClick={onClose} className="btn-ghost p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3.5 space-y-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));

          return (
            <NavLink
              key={to}
              to={to}
              onClick={isMobile ? onClose : undefined}
              className={({ isActive }) => cn(
                'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-200/50'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute inset-0 bg-brand-600/20 border border-brand-500/30 rounded-xl"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <Icon
                size={18}
                className={cn(
                  'relative z-10 transition-transform duration-200 group-hover:scale-110',
                  isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              <span className="relative z-10">{label}</span>
              {isActive && (
                <ChevronRight size={14} className="relative z-10 ml-auto text-brand-400" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Quick Launch Card */}
      <div className="p-3.5 border-t border-white/5">
        <NavLink to="/new" onClick={isMobile ? onClose : undefined}>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-brand-600/15 to-indigo-600/10 border border-brand-500/20 cursor-pointer hover:border-brand-500/40 transition-all shadow-sm"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-600/20 flex items-center justify-center text-brand-400 flex-shrink-0">
              <Zap size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Start Diagnostics</div>
              <div className="text-[10px] text-slate-400">Adaptive troubleshooting</div>
            </div>
          </motion.div>
        </NavLink>
      </div>
    </div>
  );
}

export function Sidebar({ isOpen, onClose, isMobile }: SidebarProps) {
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
              onClick={onClose}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed left-0 top-0 h-full w-72 bg-surface-50 border-r border-white/5 z-50 shadow-2xl"
            >
              <SidebarContent onClose={onClose} isMobile={true} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-surface-50 border-r border-white/5 sticky top-0 shadow-lg z-30">
      <SidebarContent onClose={onClose} isMobile={false} />
    </aside>
  );
}

export function TopBar({
  onMenuClick,
  aiMode,
}: {
  onMenuClick: () => void;
  aiMode: string;
}) {
  return (
    <header className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-surface/70 backdrop-blur-md sticky top-0 z-20">
      <button
        onClick={onMenuClick}
        className="lg:hidden btn-ghost p-1.5 text-slate-300"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-3 ml-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shadow-sm',
            aiMode.startsWith('ai')
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          <span className="capitalize">{aiMode.startsWith('ai') ? 'AI Active' : 'Adaptive Fallback'}</span>
        </motion.div>
      </div>
    </header>
  );
}
