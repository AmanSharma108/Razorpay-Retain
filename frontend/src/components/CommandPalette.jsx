import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, LayoutDashboard, AlertTriangle, RefreshCw, 
  FileText, Zap, Sparkles, X, ArrowRight, CornerDownLeft
} from 'lucide-react';
import { pollingAPI } from '../api/client';
import { toast } from 'sonner';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(false);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'nav-dashboard',
      title: 'Go to Overview Dashboard',
      category: 'Navigation',
      icon: <LayoutDashboard size={16} className="text-[#5FA8E8]" />,
      run: () => { navigate('/'); onClose(); }
    },
    {
      id: 'nav-events',
      title: 'View Revenue Events & Incidents',
      category: 'Navigation',
      icon: <AlertTriangle size={16} className="text-[#F5A623]" />,
      run: () => { navigate('/events'); onClose(); }
    },
    {
      id: 'nav-recovery',
      title: 'Explore Thompson Sampling & Policies',
      category: 'Navigation',
      icon: <RefreshCw size={16} className="text-[#4ADE80]" />,
      run: () => { navigate('/recovery'); onClose(); }
    },
    {
      id: 'nav-audit',
      title: 'Inspect Cryptographic Audit Trail',
      category: 'Navigation',
      icon: <FileText size={16} className="text-[#5FA8E8]" />,
      run: () => { navigate('/audit'); onClose(); }
    },
    {
      id: 'nav-terminal',
      title: 'Open Live Gateway & Real Checkout Sandbox',
      category: 'Navigation',
      icon: <Zap size={16} className="text-[#E8B84A]" />,
      run: () => { navigate('/terminal'); onClose(); }
    },
    {
      id: 'action-sync',
      title: 'Sync Live Gateway Polling Safety Net',
      category: 'Quick Action',
      icon: <RefreshCw size={16} className="text-[#4ADE80]" />,
      run: async () => {
        onClose();
        try {
          const res = await pollingAPI.triggerPoll();
          toast.success(`Gateway Synced: ${res.data.new_events} new incidents found`);
          window.dispatchEvent(new CustomEvent('review-queue-changed', {}));
        } catch {
          toast.error('Sync failed');
        }
      }
    },
    {
      id: 'action-payment-link',
      title: 'Create Live Razorpay Payment Link',
      category: 'Quick Action',
      icon: <Sparkles size={16} className="text-[#5FA8E8]" />,
      run: () => {
        navigate('/terminal');
        onClose();
      }
    }
  ];

  const filteredActions = actions.filter(a => 
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex items-start justify-center pt-24 px-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#0B0D12]/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-xl bg-[#151821] border border-[#2A2E3A] rounded-lg shadow-2xl overflow-hidden z-10"
        >
          {/* Search Header */}
          <div className="p-4 border-b border-[#2A2E3A] flex items-center space-x-3 bg-[#1C1F29]">
            <Search size={18} className="text-[#5C5E6B]" />
            <input
              type="text"
              autoFocus
              placeholder="Type a command or jump to page (e.g. 'simulate', 'events')..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[#F2F1EC] placeholder-[#5C5E6B] focus:outline-none font-medium"
            />
            <button
              onClick={onClose}
              className="p-1 rounded text-[#5C5E6B] hover:text-[#F2F1EC]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Action List */}
          <div className="max-h-80 overflow-y-auto p-2 space-y-1">
            {filteredActions.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5C5E6B] font-mono">
                No matching commands found for "{query}"
              </div>
            ) : (
              filteredActions.map((action) => (
                <button
                  key={action.id}
                  onClick={action.run}
                  className="w-full p-2.5 rounded-md hover:bg-[#1C1F29] text-left flex items-center justify-between group transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 rounded-md bg-[#151821] border border-[#2A2E3A]">
                      {action.icon}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#F2F1EC] group-hover:text-[#5FA8E8]">
                        {action.title}
                      </div>
                      <div className="text-[10px] font-mono text-[#8B8D97]">
                        {action.category}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 text-[#5C5E6B] group-hover:text-[#5FA8E8] transition-colors">
                    <span className="text-[10px] font-mono font-bold">Run</span>
                    <CornerDownLeft size={12} />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-[#1C1F29] border-t border-[#2A2E3A] flex items-center justify-between text-[11px] font-mono text-[#5C5E6B]">
            <span>Navigation: <kbd className="px-1.5 py-0.5 rounded bg-[#151821] text-[#8B8D97]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-[#151821] text-[#8B8D97]">↓</kbd></span>
            <span>Close: <kbd className="px-1.5 py-0.5 rounded bg-[#151821] text-[#8B8D97]">ESC</kbd></span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
