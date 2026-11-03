import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedLogoProps {
  size?: number;
  showText?: boolean;
}

export function AnimatedLogo({ size = 36, showText = true }: AnimatedLogoProps) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Ambient Back Glow */}
        <div
          className="absolute inset-0 rounded-full bg-brand-500/20 blur-md pointer-events-none animate-pulse-glow"
        />

        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10"
        >
          {/* Outer Broken Loop Track */}
          <circle
            cx="18"
            cy="18"
            r="12"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Animated Active Tracer Orbit */}
          <motion.circle
            cx="18"
            cy="18"
            r="12"
            stroke="#6366f1"
            strokeWidth="2.5"
            strokeDasharray="24 16"
            strokeLinecap="round"
            animate={{ rotate: 360 }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ transformOrigin: "18px 18px" }}
          />

          {/* Forward Vector Breakthrough Arrow */}
          <motion.path
            d="M20 9 L27 18 L20 18"
            fill="none"
            stroke="#818cf8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: 0.8, x: 0 }}
            animate={{ opacity: [0.7, 1, 0.7], x: [0, 1.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Pulsing Core Node */}
          <motion.circle
            cx="18"
            cy="18"
            r="3"
            fill="#818cf8"
            animate={{ scale: [1, 1.25, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </div>

      {showText && (
        <div>
          <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            <span>LoopBreak</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-brand-500/20 text-brand-300 font-mono border border-brand-500/30">
              AI
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-medium tracking-tight">
            Adaptive Troubleshooting
          </div>
        </div>
      )}
    </div>
  );
}

