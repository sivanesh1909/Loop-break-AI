import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Brain, Layers, Terminal } from 'lucide-react';
import { AnimatedLogo } from '../components/AnimatedLogo';

const HOW_IT_WORKS = [
  { step: '01', title: 'Submit Context & Output', desc: 'Provide your error message, OS, and environment. No vague chatbots.' },
  { step: '02', title: 'Failure Domain Bisection', desc: 'LoopBreak cuts the problem space in half with at most 2 targeted questions.' },
  { step: '03', title: 'Prescriptive Single Action', desc: 'Receive exactly one decisive action with copy-paste commands, not a 10-item checklist.' },
  { step: '04', title: 'Semantic Failure Memory', desc: 'If an action fails, its entire hypothesis is invalidated. Repeats are strictly rejected.' },
  { step: '05', title: 'Verified Post-Mortem', desc: 'When resolved, download a professional post-mortem PDF report for your team.' },
];

const FEATURES = [
  { icon: Brain, title: 'Semantic Failure Memory', desc: 'Calculates synonym and vector similarity to intercept repeated or circular suggestions before you ever see them.' },
  { icon: Layers, title: 'Visual Hypothesis Tree', desc: 'Interactive decision graph visually illustrates disproven branches and active candidate probes.' },
  { icon: Terminal, title: 'Command-Level Precision', desc: 'Generates exact copy-paste terminal commands for your specific OS instead of generic advice.' },
  { icon: Shield, title: 'Evidence Guardrail', desc: 'Strictly distinguishes between hypotheses and confirmed causes. Never claims certainty without empirical proof.' },
];

const CATEGORIES = ['Software & Packages', 'Network & DNS', 'Port & Process Locks', 'Docker & Kubernetes', 'Deployment & CI/CD', 'OS & Hardware'];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0b0d13] text-slate-100 overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 lg:px-12 py-4 border-b border-white/10 bg-[#10141f] sticky top-0 z-50">
        <AnimatedLogo size={32} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sessions')}
            className="text-slate-300 hover:text-white text-sm font-medium transition-colors px-3 py-1.5"
          >
            History
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary text-sm py-2 px-4 shadow-md"
          >
            Open Dashboard
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 lg:py-28 text-center max-w-4xl mx-auto space-y-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 text-xs font-semibold shadow-sm">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span>AI That Learns From What Didn't Work</span>
        </div>

        {/* Heading */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
          Stop Repeating<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-indigo-400 to-purple-300">
            What Doesn't Work.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          LoopBreak AI tracks every failed attempt, calculates semantic similarity to block loops,
          and formulates the next-best action from evidence.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <button
            onClick={() => navigate('/new')}
            className="btn-primary text-base py-3.5 px-8 shadow-xl shadow-indigo-600/30 font-semibold"
          >
            Start Troubleshooting <ArrowRight size={18} />
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-secondary text-base py-3.5 px-8 font-semibold"
          >
            View Analytics
          </button>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-1">The Scientific Loop</div>
          <h2 className="text-3xl font-bold text-white tracking-tight">How LoopBreak AI Resolves Problems</h2>
        </div>

        <div className="space-y-3.5">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.step}
              className="card p-5 sm:p-6 flex items-start gap-4 hover:border-indigo-400/40 transition-all"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-mono text-sm font-bold shadow-sm">
                {item.step}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white mb-0.5">{item.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key Features */}
      <section className="px-6 py-16 bg-[#0f131d] border-y border-white/10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Engineered For Real Technical Faults</h2>
            <p className="text-sm text-slate-300">Not a generic chatbot. A persistent analytical state machine.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card p-5 space-y-2.5 hover:border-indigo-400/40 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/25 text-indigo-400 flex items-center justify-center">
                  <f.icon size={20} />
                </div>
                <h3 className="text-base font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Domains */}
      <section className="px-6 py-16 max-w-4xl mx-auto text-center">
        <h2 className="text-2xl font-bold text-white mb-6">Supported Failure Domains</h2>
        <div className="flex flex-wrap justify-center gap-2.5">
          {CATEGORIES.map(cat => (
            <span
              key={cat}
              className="px-4 py-2 rounded-xl bg-[#141824] border border-white/10 text-slate-200 text-xs sm:text-sm font-semibold hover:border-indigo-400/40 transition-colors"
            >
              {cat}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-slate-400 text-xs bg-[#090b10]">
        <p>LoopBreak AI — <em>AI That Learns From What Didn't Work.</em></p>
      </footer>
    </div>
  );
}
