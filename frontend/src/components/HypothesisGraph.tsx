import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitFork, CheckCircle, XCircle, Clock, AlertCircle,
  HelpCircle, Sparkles, ChevronRight, Info
} from 'lucide-react';
import type { HypothesisTree, TreeNode } from '../types';

interface HypothesisGraphProps {
  tree?: HypothesisTree;
  title?: string;
}

export function HypothesisGraph({ tree, title }: HypothesisGraphProps) {
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  if (!tree || !tree.nodes || tree.nodes.length === 0) {
    return null;
  }

  const rootNode = tree.nodes.find(n => n.type === 'root') || tree.nodes[0];
  const attemptNodes = tree.nodes.filter(n => n.type === 'attempt');
  const hypothesisNodes = tree.nodes.filter(n => n.type === 'hypothesis');
  const activeProbeNode = tree.nodes.find(n => n.type === 'active_probe');

  const getNodeIcon = (node: TreeNode) => {
    switch (node.status) {
      case 'ruled_out':
        return <XCircle size={15} className="text-red-400" />;
      case 'confirmed':
        return <CheckCircle size={15} className="text-emerald-400" />;
      case 'active':
        return <Sparkles size={15} className="text-brand-400 animate-pulse" />;
      case 'probable':
        return <AlertCircle size={15} className="text-amber-400" />;
      default:
        return <HelpCircle size={15} className="text-slate-400" />;
    }
  };

  const getNodeBadgeClass = (node: TreeNode) => {
    switch (node.status) {
      case 'ruled_out':
        return 'bg-red-500/10 border-red-500/30 text-red-300 line-through opacity-75 hover:opacity-100';
      case 'confirmed':
        return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold ring-1 ring-emerald-500/30';
      case 'active':
        return 'bg-brand-600/20 border-brand-500/50 text-brand-200 ring-2 ring-brand-500/30 shadow-lg shadow-brand-500/10 font-medium';
      case 'probable':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-medium';
      default:
        return 'bg-surface-100 border-white/10 text-slate-300 hover:border-white/20';
    }
  };

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600/20 text-brand-400 flex items-center justify-center">
            <GitFork size={17} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {title || 'Hypothesis & Elimination Decision Tree'}
            </h3>
            <p className="text-[11px] text-slate-400">
              Visual map of eliminated failure paths vs. active candidate hypotheses
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" /> Ruled Out
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" /> Active Probe
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Confirmed
          </span>
        </div>
      </div>

      {/* Visual Tree Canvas */}
      <div className="relative p-5 rounded-xl bg-surface-100/50 border border-white/5 overflow-x-auto">
        <div className="min-w-[550px] flex flex-col gap-6">
          {/* Root Problem Node */}
          <div className="flex items-center justify-center">
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedNode(rootNode)}
              className="px-4 py-2.5 rounded-xl bg-surface-200 border border-brand-500/30 text-white font-semibold text-xs sm:text-sm shadow-md cursor-pointer flex items-center gap-2 text-center"
            >
              <div className="w-2 h-2 rounded-full bg-brand-400" />
              <span>Problem: {rootNode.label}</span>
            </motion.div>
          </div>

          {/* Animated Connector Stem with Signal Pulse */}
          <div className="relative w-px h-7 bg-white/10 mx-auto overflow-hidden">
            <motion.div
              className="w-full h-3.5 bg-gradient-to-b from-transparent via-brand-400 to-transparent"
              animate={{ y: [-14, 28] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* Branches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            {/* Left Branch: Explored Attempts / Ruled Out Paths */}
            <div className="space-y-2.5 p-3.5 rounded-lg bg-surface-200/40 border border-white/5">
              <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Evaluated Failure Paths</span>
                <span className="text-slate-500 text-[10px]">
                  {attemptNodes.filter(n => n.status === 'ruled_out').length} Eliminated
                </span>
              </div>

              {attemptNodes.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-2">
                  No previous attempts recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {attemptNodes.map(node => (
                    <motion.div
                      key={node.id}
                      whileHover={{ x: 2 }}
                      onClick={() => setSelectedNode(node)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 transition-all ${getNodeBadgeClass(node)}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {getNodeIcon(node)}
                        <span className="truncate">{node.label}</span>
                      </div>
                      <ChevronRight size={13} className="text-slate-500 flex-shrink-0" />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Branch: Candidate Hypotheses & Active Next Action */}
            <div className="space-y-2.5 p-3.5 rounded-lg bg-surface-200/40 border border-white/5">
              <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
                <span>Active Hypotheses & Probe</span>
                <span className="text-brand-400 text-[10px]">Current Decision</span>
              </div>

              {/* Current Active Probe */}
              {activeProbeNode && (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  onClick={() => setSelectedNode(activeProbeNode)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 ${getNodeBadgeClass(activeProbeNode)}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {getNodeIcon(activeProbeNode)}
                    <span className="truncate font-semibold">{activeProbeNode.label}</span>
                  </div>
                  <ChevronRight size={13} className="text-brand-300 flex-shrink-0" />
                </motion.div>
              )}

              {/* Other Hypotheses */}
              <div className="space-y-2 pt-1">
                {hypothesisNodes.map(node => (
                  <motion.div
                    key={node.id}
                    whileHover={{ x: 2 }}
                    onClick={() => setSelectedNode(node)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 transition-all ${getNodeBadgeClass(node)}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getNodeIcon(node)}
                      <span className="truncate">{node.label}</span>
                    </div>
                    {node.confidence && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {Math.round(node.confidence * 100)}%
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Node Inspector Drawer */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="p-4 rounded-xl bg-surface-200 border border-white/10 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Info size={14} className="text-brand-400" />
                <span>Node Details: {selectedNode.label}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-500 block">Type:</span>
                <span className="text-slate-300 font-medium capitalize">{selectedNode.type}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Status:</span>
                <span className="text-slate-300 font-medium capitalize">{selectedNode.status}</span>
              </div>
              {selectedNode.feedback && (
                <div>
                  <span className="text-slate-500 block">User Outcome:</span>
                  <span className="text-slate-300 font-medium capitalize">{selectedNode.feedback}</span>
                </div>
              )}
              {selectedNode.confidence && (
                <div>
                  <span className="text-slate-500 block">Confidence:</span>
                  <span className="text-slate-300 font-medium">{Math.round(selectedNode.confidence * 100)}%</span>
                </div>
              )}
            </div>

            {selectedNode.reasoning && (
              <div className="pt-2 border-t border-white/5 text-slate-300 leading-relaxed">
                <span className="text-slate-500 block mb-0.5">Diagnostic Reasoning:</span>
                {selectedNode.reasoning}
              </div>
            )}
            {selectedNode.result && (
              <div className="pt-1 text-slate-400 italic">
                <span className="text-slate-500 block not-italic mb-0.5">Observed Empirical Result:</span>
                "{selectedNode.result}"
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

