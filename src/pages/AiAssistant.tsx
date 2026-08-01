import React, { useState, useEffect, useRef } from 'react';
import { askDepartmentAi, getGeminiApiKey, setGeminiApiKey } from '../gemini';
import { useAuth } from '../AuthContext';
import { DEPARTMENTS } from '../constants';
import { Bot, Send, Sparkles, User, Key, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  departmentId?: string;
}

export default function AiAssistant() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: `Hello ${profile?.displayName || 'Citizen'}! 👋 I am **CIVIX AI Assistant** (powered by Google Gemini API).\n\nYou can ask me any public queries regarding city departments:\n• 🚦 Traffic & Road repairs (Transport)\n• 💧 Water supply & Leaks (Water Works)\n• ⚡ Streetlights & Power cuts (Electricity)\n• 🧹 Garbage & Sanitation (Municipal)\n• 🎓 Schools & Grants (Education)\n• 🏥 Hospitals & Clinics (Health)\n\nHow can I assist you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySavedNotice, setKeySavedNotice] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKeyInput(getGeminiApiKey());
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSaveKey = () => {
    setGeminiApiKey(apiKeyInput);
    setKeySavedNotice(true);
    setTimeout(() => {
      setKeySavedNotice(false);
      setShowKeyInput(false);
    }, 1500);
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const deptName = selectedDept !== 'all' ? DEPARTMENTS.find(d => d.id === selectedDept)?.name : 'All Departments';
      const aiReply = await askDepartmentAi(query, deptName);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        departmentId: selectedDept !== 'all' ? selectedDept : undefined
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("Gemini AI Error:", err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `### CIVIX AI Assistant\n\nI am currently using the CIVIX Smart Fallback system. You can ask any question regarding city departments, garbage, water leaks, streetlights, or public roads.\n\n*If you wish to use live Google Gemini AI, click **Key Settings** above to enter your free API Key.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    "delay in garbage collection",
    "How do I report a heavy water leakage in my street?",
    "heavy traffic jam on main road signal",
    "What department handles broken street lights?"
  ];

  return (
    <div className="space-y-6 pb-20 font-sans max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <motion.div 
            animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="w-16 h-16 bg-gradient-to-tr from-cyan-400 to-emerald-400 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-500/30 border border-white/20 shrink-0"
          >
            <Bot className="text-slate-950 w-9 h-9" />
          </motion.div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-1">
              <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" /> Live Google Gemini AI REST API
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              CIVIX AI Citizen Assistant
            </h1>
            <p className="text-xs text-zinc-300">Ask public queries about municipal, traffic, water, power, health & school services.</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 relative z-10">
          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="px-3.5 py-1.5 bg-slate-950/80 hover:bg-slate-800 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/40 flex items-center gap-1.5 transition-all shadow"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" /> API Key Settings
          </button>
        </div>
      </div>

      {/* API Key Configuration Drawer */}
      <AnimatePresence>
        {showKeyInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-900 border border-amber-500/40 p-5 rounded-2xl space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between text-xs font-bold text-amber-300 uppercase tracking-wider">
              <span className="flex items-center gap-2"><Key className="w-4 h-4" /> Google Gemini API Key Setup</span>
              <span className="text-[10px] text-zinc-400 font-mono">https://aistudio.google.dev/</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder="Paste your Gemini API key (AIzaSy...)"
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <button
                onClick={handleSaveKey}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                {keySavedNotice ? <Check className="w-4 h-4" /> : 'Save API Key'}
              </button>
            </div>
            {keySavedNotice && (
              <p className="text-[11px] text-emerald-400 font-bold">✓ Gemini API Key saved! Live AI calls enabled.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Conversation Box */}
      <div className="bg-slate-900/90 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl space-y-6 backdrop-blur-xl flex flex-col min-h-[500px]">
        
        {/* Messages Stream */}
        <div className="flex-1 space-y-4 overflow-y-auto max-h-[520px] custom-scrollbar pr-2">
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 shrink-0 font-bold shadow-md mt-1">
                  <Bot className="w-5 h-5" />
                </div>
              )}

              <div className={`max-w-[82%] space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap shadow-xl ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-none'
                    : 'bg-slate-950 border border-white/10 text-zinc-100 rounded-tl-none font-sans'
                }`}>
                  {msg.text}
                </div>
                <div className={`text-[10px] text-zinc-500 font-mono px-2 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0 font-bold shadow-md mt-1">
                  <User className="w-5 h-5" />
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-slate-950 border border-white/10 px-4 py-3 rounded-2xl text-xs text-cyan-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Calling Google Gemini 2.0 REST API...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Sample Queries */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Suggested Questions:
          </div>
          <div className="flex flex-wrap gap-2">
            {sampleQueries.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="text-xs bg-slate-950 hover:bg-slate-800 text-zinc-300 hover:text-white px-3.5 py-1.5 rounded-full border border-white/10 transition-all text-left truncate max-w-xs"
              >
                💡 {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="relative flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask real Gemini AI any question..."
            className="w-full pl-5 pr-14 py-4 bg-slate-950 border border-zinc-800 rounded-2xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-tr from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-bold rounded-xl flex items-center justify-center shadow-lg disabled:opacity-50 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
