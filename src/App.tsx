import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Heart, 
  MessageSquare, 
  Share2, 
  MoreHorizontal, 
  ChevronDown,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Confession {
  id: string;
  text: string;
  author_color: string;
  author_initial: string;
  timestamp: string;
  echoes: number;
  whispers: number;
}

const COLORS = [
  'bg-purple-500', 'bg-blue-500', 'bg-pink-500', 
  'bg-emerald-500', 'bg-amber-500', 'bg-indigo-500',
  'bg-rose-500', 'bg-cyan-500'
];

export default function App() {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial fetch
    fetch('/api/confessions')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setConfessions(data);
        } else {
          console.error('Expected array of confessions, got:', data);
          setConfessions([]);
        }
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setConfessions([]);
      });

    // WebSocket setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    
    ws.onmessage = (event) => {
      const { type, payload } = JSON.parse(event.data);
      if (type === 'NEW_CONFESSION') {
        setConfessions(prev => {
          // Prevent duplicates if we already added it optimistically
          if (prev.some(c => c.id === payload.id)) return prev;
          return [payload, ...prev];
        });
      } else if (type === 'UPDATE_ECHOES') {
        setConfessions(prev => prev.map(c => 
          c.id === payload.id ? { ...c, echoes: payload.echoes } : c
        ));
      }
    };

    setSocket(ws);
    return () => ws.close();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setInputText(''); // Clear immediately for responsiveness

    try {
      const res = await fetch('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!res.ok) {
        // If failed, we might want to restore the text, but for "The Void" 
        // maybe it just disappears (or we show an error)
        console.error('Failed to release into the void');
      }
    } catch (err) {
      console.error('Failed to release into the void:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEcho = async (id: string) => {
    // Optimistic update
    setConfessions(prev => prev.map(c => 
      c.id === id ? { ...c, echoes: c.echoes + 1 } : c
    ));

    try {
      const res = await fetch(`/api/confessions/${id}/echo`, { method: 'POST' });
      if (!res.ok) {
        // Rollback on error
        setConfessions(prev => prev.map(c => 
          c.id === id ? { ...c, echoes: Math.max(0, c.echoes - 1) } : c
        ));
      }
    } catch (err) {
      console.error('Failed to echo:', err);
      // Rollback on error
      setConfessions(prev => prev.map(c => 
        c.id === id ? { ...c, echoes: Math.max(0, c.echoes - 1) } : c
      ));
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] selection:bg-purple-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-bottom border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg void-gradient flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight font-display">The Void</span>
          </div>
          <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            Sort: New <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto pt-24 pb-20 px-6">
        {/* Input Section */}
        <section className="mb-12">
          <form onSubmit={handleSubmit} className="relative group">
            <div className="glass rounded-2xl p-1 transition-all duration-500 group-focus-within:void-glow">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value.slice(0, 500))}
                placeholder="Speak into the void. Your secret is safe here..."
                className="w-full h-40 bg-transparent border-none focus:ring-0 resize-none p-6 text-lg text-white/90 placeholder:text-white/20"
              />
              <div className="flex items-center justify-between p-4 border-t border-white/5">
                <span className={cn(
                  "text-xs font-mono transition-colors",
                  inputText.length >= 450 ? "text-rose-500" : "text-white/30"
                )}>
                  {inputText.length} / 500
                </span>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                  </div>
                  <button
                    type="submit"
                    disabled={!inputText.trim() || isSubmitting}
                    className="px-6 py-2.5 rounded-xl void-gradient text-sm font-semibold text-white shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? 'Releasing...' : 'Release into the Void'}
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>

        {/* Feed Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-white/90">Recent Confessions</h2>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-500">Live</span>
            </div>
          </div>

          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {confessions.map((confession) => (
                <motion.div
                  key={confession.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                  className="glass rounded-2xl p-6 group hover:bg-white/[0.07] transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold", confession.author_color)}>
                        {confession.author_initial}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/90">Anonymous</div>
                        <div className="text-xs text-white/40">
                          {formatDistanceToNow(new Date(confession.timestamp))} ago
                        </div>
                      </div>
                    </div>
                    <button className="p-2 text-white/20 hover:text-white transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-white/80 leading-relaxed mb-6 whitespace-pre-wrap">
                    {confession.text}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={() => handleEcho(confession.id)}
                        className="flex items-center gap-2 text-white/40 hover:text-rose-500 transition-colors group/btn"
                      >
                        <Heart className={cn("w-4 h-4 group-hover/btn:fill-rose-500", confession.echoes > 0 && "text-rose-500 fill-rose-500")} />
                        <span className="text-xs font-medium">{confession.echoes} Echoes</span>
                      </button>
                      <button className="flex items-center gap-2 text-white/40 hover:text-purple-500 transition-colors">
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-xs font-medium">{confession.whispers} Whispers</span>
                      </button>
                    </div>
                    <button className="p-2 text-white/20 hover:text-white transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {confessions.length > 0 && (
            <button className="w-full mt-12 py-4 text-sm text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2">
              Load more from the void <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
