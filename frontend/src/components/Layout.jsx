import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  RefreshCw, 
  FileText, 
  Zap,
  ShieldCheck,
  ExternalLink,
  Search,
  UserCheck,
  ShieldAlert,
  Globe,
  Radio
} from 'lucide-react';
import { Toaster } from 'sonner';
import CommandPalette from './CommandPalette';
import LampToggle from './LampToggle';
import LivePipelineRail from './LivePipelineRail';
import { reviewAPI, pollingAPI } from '../api/client';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pollingStatus, setPollingStatus] = useState(null);

  const fetchCount = async () => {
    try {
      const res = await reviewAPI.getCount();
      setPendingCount(res.data.count || 0);
    } catch {
      // ignore
    }
  };

  const fetchPolling = async () => {
    try {
      const res = await pollingAPI.getStatus();
      setPollingStatus(res.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCount();
    fetchPolling();

    const handleQueueChanged = (e) => {
      if (e?.detail && typeof e.detail.delta === 'number') {
        setPendingCount(prev => Math.max(0, prev + e.detail.delta));
      } else if (e?.detail && typeof e.detail.count === 'number') {
        setPendingCount(e.detail.count);
      } else {
        fetchCount();
      }
    };

    window.addEventListener('review-queue-changed', handleQueueChanged);
    const interval = setInterval(() => {
      fetchCount();
      fetchPolling();
    }, 6000);

    return () => {
      window.removeEventListener('review-queue-changed', handleQueueChanged);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchCount();
    fetchPolling();
  }, [location.pathname]);

  const navItems = [
    { to: '/', label: 'Overview', icon: <LayoutDashboard size={15} /> },
    { to: '/events', label: 'Incidents', icon: <AlertTriangle size={15} /> },
    { 
      to: '/reviews', 
      label: 'Pending Approvals', 
      icon: <UserCheck size={15} />,
      badge: pendingCount > 0 ? pendingCount : null
    },
    { to: '/recovery', label: 'Recovery Policy', icon: <RefreshCw size={15} /> },
    { to: '/audit', label: 'Audit Trail', icon: <FileText size={15} /> },
    { to: '/terminal', label: 'Live Checkout & Sandbox', icon: <Zap size={15} /> },
  ];

  const getPollingTimeAgo = () => {
    if (!pollingStatus?.last_polled_at) return 'active';
    const elapsed = Math.floor((Date.now() - new Date(pollingStatus.last_polled_at).getTime()) / 1000);
    if (elapsed < 5) return 'just now';
    if (elapsed < 60) return `${elapsed}s ago`;
    return `${Math.floor(elapsed / 60)}m ago`;
  };

  // Determine active stage on the pipeline rail based on route
  const getActivePipelineStage = () => {
    if (location.pathname.startsWith('/reviews')) return 4;
    if (location.pathname.startsWith('/recovery')) return 3;
    if (location.pathname.startsWith('/events')) return 2;
    if (location.pathname.startsWith('/audit')) return 6;
    if (location.pathname.startsWith('/terminal')) return 5;
    return 3;
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--ink-primary)] overflow-hidden font-sans selection:bg-[var(--accent-brand)]/20 selection:text-[var(--ink-primary)]">
      <Toaster 
        position="top-right" 
        richColors 
        theme="light" 
        toastOptions={{
          style: {
            background: 'var(--surface-card)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--ink-primary)',
            borderRadius: '6px',
            boxShadow: 'var(--shadow-card-hover)',
            fontFamily: 'var(--font-body)'
          }
        }}
      />

      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />

      {/* Clean Precision Sidebar */}
      <aside className="w-60 bg-[var(--surface-card)] border-r border-[var(--border-subtle)] flex flex-col shrink-0 z-20 shadow-sm">
        {/* Brand Header */}
        <div className="h-14 flex items-center px-5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-[var(--accent-brand)] flex items-center justify-center text-white shadow-sm">
              <ShieldCheck size={16} strokeWidth={2.5} />
            </div>
            <div>
              <span className="font-heading font-bold text-xs tracking-tight text-[var(--ink-primary)] block leading-tight">
                Razorpay Retain
              </span>
              <span className="text-[10px] font-mono text-[var(--ink-muted)] flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] mr-1.5 inline-block" />
                Live Gateway Ops
              </span>
            </div>
          </div>
        </div>

        {/* Quick Search */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="w-full px-2.5 py-1.5 rounded-md bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)] text-xs flex items-center justify-between transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--accent-brand)]"
          >
            <div className="flex items-center space-x-2">
              <Search size={13} className="text-[var(--ink-tertiary)]" />
              <span className="text-[11px] font-medium">Search commands...</span>
            </div>
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--ink-muted)] font-mono text-[9px]">⌘K</kbd>
          </button>
        </div>
        
        {/* Nav Links with High Contrast Solid 3px Blue Bar */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`relative flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
                  isActive 
                    ? 'bg-[var(--accent-brand-subtle)] text-[var(--ink-primary)] font-semibold border-l-[3px] border-[var(--accent-brand)]' 
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-hover)] border-l-[3px] border-transparent font-medium'
                }`}
              >
                <div className="flex items-center">
                  <span className={`mr-2.5 ${isActive ? 'text-[var(--accent-brand)]' : 'text-[var(--ink-tertiary)]'}`}>
                    {item.icon}
                  </span>
                  <span className="tracking-tight">{item.label}</span>
                </div>

                {item.badge !== null && item.badge !== undefined && (
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)]" />
                    <span className="font-mono text-[10px] font-bold text-[var(--status-warning)]">
                      {item.badge}
                    </span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Live Test API Badge & Dual Ingestion Footer */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2 text-[11px]">
          <div className="flex items-center justify-between text-[var(--ink-muted)]">
            <span className="text-[var(--ink-primary)] flex items-center font-mono text-[10px] font-semibold">
              <Globe size={11} className="mr-1 text-[var(--accent-brand)]" />
              rzp_test v1.4
            </span>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--accent-brand)] flex items-center transition-colors text-[10px] font-mono text-[var(--ink-muted)]"
            >
              <span>Swagger</span>
              <ExternalLink size={9} className="ml-1" />
            </a>
          </div>
          
          {/* Dual Ingestion Path Status */}
          <div className="p-2 rounded bg-[var(--surface-card-subtle)] border border-[var(--border-subtle)] text-[10px] text-[var(--ink-muted)] space-y-1 font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center text-[var(--ink-primary)] font-sans font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] mr-1.5 inline-block" />
                Webhook: active
              </span>
            </div>
            <div className="flex items-center justify-between text-[var(--ink-muted)]">
              <span>Safety Net:</span>
              <span className="text-[var(--accent-brand)] tabular-nums">{getPollingTimeAgo()}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
        {/* Sleek Top Header */}
        <header className="h-14 px-8 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5 text-[var(--ink-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)] inline-block" />
              <span className="font-medium text-[var(--ink-primary)]">Dual-Path Gateway Ingestion</span>
            </div>

            {pendingCount > 0 && (
              <span 
                onClick={() => navigate('/reviews')}
                className="cursor-pointer text-[var(--status-warning)] flex items-center font-medium bg-[var(--status-warning-subtle)] px-2 py-0.5 rounded border border-[var(--status-warning)]/20 hover:underline"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] mr-1.5" />
                {pendingCount} requires human approval
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <LampToggle />
            <button
              onClick={() => navigate('/terminal')}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-brand)] hover:bg-[var(--accent-brand-hover)] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Zap size={13} />
              <span>Live Checkout Terminal</span>
            </button>
          </div>
        </header>

        {/* Full-Width Horizontal Signature Live Pipeline Rail */}
        <LivePipelineRail 
          activeStage={getActivePipelineStage()} 
          pendingCount={pendingCount} 
        />

        {/* Content Outlet */}
        <main className="flex-1 overflow-y-auto p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
