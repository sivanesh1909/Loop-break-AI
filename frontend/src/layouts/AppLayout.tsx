import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar, TopBar } from './Sidebar';
import { getHealth } from '../services/api';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiMode, setAiMode] = useState('demo');

  useEffect(() => {
    getHealth()
      .then(h => setAiMode(h.ai_enabled ? 'ai' : 'demo'))
      .catch(() => setAiMode('demo'));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0d13] text-slate-100 relative">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={window.innerWidth < 1024}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-auto relative">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          aiMode={aiMode}
        />

        <main className="flex-1 p-5 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
