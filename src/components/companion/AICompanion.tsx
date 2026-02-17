/**
 * AICompanion — Real AI assistant that uses the configured API keys.
 * Supports 10+ cloud providers + local Ollama/LM Studio.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Trash2, Bot, User } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/schema";
import {
  callChat,
  getProviderMeta,
  getActiveModel,
  DEFAULT_SETTINGS,
  type AISettings,
} from "../../services/ai";
import { useLanguage } from "../../context/LanguageContext";
import { buildMemoryPrompt } from "../../services/aiMemory";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

const SYSTEM_PROMPT = `You are DocIA Assistant, an intelligent document management AI. You help users with:
- Document analysis and extraction
- Template creation and editing
- Understanding document formats (PDF, DOCX, images)
- Data organization and classification
- General document-related questions
Be concise, helpful, and professional. Respond in the same language the user writes in.`;

export function AICompanion() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryCtx, setMemoryCtx] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useLanguage();

  const preferences = useLiveQuery(() => db.preferences.toArray());

  const getAISettings = useCallback((): AISettings => {
    if (!preferences) return DEFAULT_SETTINGS;
    const aiPref = preferences.find((p) => p.key === "ai_settings");
    if (aiPref && typeof aiPref.value === "object") {
      return aiPref.value as unknown as AISettings;
    }
    return DEFAULT_SETTINGS;
  }, [preferences]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when open & load memory context
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
      // Load memory context once per open
      if (!memoryCtx) {
        buildMemoryPrompt().then(setMemoryCtx);
      }
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((o) => !o);
    if (!hasInteracted) setHasInteracted(true);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const settings = getAISettings();
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const apiMessages = [
        { role: "system", content: SYSTEM_PROMPT + memoryCtx },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: userMessage.content },
      ];

      const response = await callChat(apiMessages, settings);

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || "Failed to get a response. Check your settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const settings = getAISettings();
  const providerLabel = settings.mode === "local"
    ? `Local (${settings.local.model})`
    : `${getProviderMeta(settings.provider).name} · ${getActiveModel(settings, 'chat')}`;

  return (
    <div className="fixed bottom-7 right-7 z-50 flex flex-col items-end gap-4">
      {/* ── Chat Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="w-[380px] h-[520px] overflow-hidden rounded-2xl border border-stone-200/70 bg-white flex flex-col"
            style={{ boxShadow: "0 8px 32px rgba(42, 37, 32, 0.10), 0 1px 3px rgba(42, 37, 32, 0.05)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-100 bg-cream-50 px-4 py-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl overflow-hidden">
                  <img src="/docia-icon.jpg" alt="DocIA" className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-[13px] font-semibold text-stone-700">{t('companion.title')}</span>
                  <p className="text-[9px] text-stone-400 font-medium uppercase tracking-wider">
                    {providerLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                  title={t('companion.clearChat')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                  aria-label={t('companion.close')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden mb-4 shadow-sm">
                    <img src="/docia-icon.jpg" alt="DocIA" className="w-full h-full object-cover" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-stone-700 mb-1">
                    {t('companion.greeting')}
                  </h3>
                  <p className="text-[12px] text-stone-400 max-w-[240px] leading-relaxed">
                    {t('companion.greetingDesc')}
                  </p>
                  <div className="mt-4 space-y-2 w-full">
                    {(t('companion.suggestions') as unknown as string[]).map((suggestion: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(suggestion.replace(/^[^\s]+ /, ""));
                        }}
                        className="w-full text-left text-[11px] px-3 py-2 rounded-lg border border-stone-200/60 bg-stone-50/50 text-stone-500 hover:bg-tan-50 hover:border-tan-200 hover:text-tan-700 transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tan-100 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-tan-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${msg.role === "user"
                      ? "bg-coffee-600 text-white rounded-br-md"
                      : "bg-stone-100 text-stone-700 rounded-bl-md"
                      }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coffee-100 mt-0.5">
                      <User className="h-3.5 w-3.5 text-coffee-600" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tan-100 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-tan-600" />
                  </div>
                  <div className="bg-stone-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                        className="w-2 h-2 rounded-full bg-stone-400"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                        className="w-2 h-2 rounded-full bg-stone-400"
                      />
                      <motion.div
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                        className="w-2 h-2 rounded-full bg-stone-400"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-rose-50 border border-rose-200/60 rounded-xl px-3 py-2 text-[11px] text-rose-600"
                >
                  ⚠️ {error}
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-stone-100 bg-cream-50/60 px-3 py-3 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('companion.placeholder')}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-stone-200/70 bg-white px-3 py-2.5 text-[12.5px] text-stone-700 outline-none placeholder:text-stone-400 focus:border-tan-300 focus:ring-2 focus:ring-tan-200/40 transition-all"
                  style={{ maxHeight: "80px" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coffee-600 text-white transition-all hover:bg-coffee-700 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Companion Button ── */}
      <motion.button
        onClick={handleToggle}
        whileTap={{ scale: 0.9 }}
        className="group relative flex h-14 w-14 items-center justify-center"
        aria-label="Toggle AI Assistant"
      >
        {/* Breathing ring 1 */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ background: "rgba(184, 146, 92, 0.12)" }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Breathing ring 2 */}
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ background: "rgba(184, 146, 92, 0.08)" }}
          animate={{ scale: [1, 1.32, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        />

        {/* Main orb */}
        <motion.div
          animate={isOpen ? { y: 0 } : { y: [0, -4, 0] }}
          transition={isOpen ? { duration: 0.2 } : { duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden bg-gradient-to-br from-tan-400 via-tan-500 to-coffee-600 transition-shadow group-hover:shadow-xl"
          style={{ boxShadow: "0 4px 16px rgba(184, 146, 92, 0.30)" }}
        >
          <img src="/docia-icon.jpg" alt="DocIA" className="w-full h-full object-cover" />
        </motion.div>

        {/* First-time notification dot */}
        {!hasInteracted && (
          <motion.div
            className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-sage-400 ring-2 ring-white"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.button>
    </div>
  );
}
