"use client";

import { useCallback, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles } from 'lucide-react';
import { useTournament } from '@/context/tournament-context';
import type { TabId } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

export function TournamentAssistant({ activeTab }: { activeTab: TabId }) {
  const { activeCategory, categories } = useTournament();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => {
    const tabUa: Record<TabId, string> = {
      standings: 'Таблиця / заліки',
      schedule: 'Розклад матчів',
      buses: 'Автобуси',
      hotels: 'Готелі',
    };
    const parts: string[] = [];
    if (activeCategory) parts.push(`Активна категорія (вік): ${activeCategory}`);
    if (categories.length) {
      parts.push(`Список категорій: ${categories.map((c) => `${c.label} (${c.id})`).join(', ')}`);
    }
    parts.push(`Відкрита вкладка: ${tabUa[activeTab]}`);
    return parts.join('. ');
  }, [activeCategory, categories, activeTab]);

  const scrollDown = useCallback(() => {
    queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError(null);
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setBusy(true);
    scrollDown();

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          context,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Помилка ${res.status}`);
      }
      if (!data.reply) throw new Error('Немає відповіді');
      setMessages((m) => [...m, { role: 'assistant', content: data.reply! }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося отримати відповідь');
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
      scrollDown();
    }
  }, [busy, context, input, messages, scrollDown]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed z-[60] flex items-center gap-2 rounded-full border border-cyan-500/40 bg-[#0d1f35] px-4 py-3 text-sm font-semibold text-cyan-300 shadow-lg shadow-cyan-500/10',
          'hover:bg-cyan-500/10 hover:border-cyan-400/60 transition-all duration-300',
          'bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:right-8',
        )}
        aria-label="Відкрити асистента"
      >
        <Sparkles className="size-5 text-cyan-400 shrink-0" />
        <span className="hidden sm:inline">Асистент</span>
        <MessageCircle className="size-4 opacity-80 sm:hidden" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md border-cyan-500/20 bg-[#0a1628] text-white flex flex-col p-0 gap-0 [&>button]:text-gray-300 [&>button]:hover:text-white"
        >
          <SheetHeader className="border-b border-cyan-500/20 px-4 py-3 pr-12 space-y-0">
            <SheetTitle className="flex items-center gap-2 text-cyan-100 text-base">
              <Sparkles className="size-5 text-cyan-400" />
              Асистент турніру
            </SheetTitle>
            <p className="text-xs text-gray-400 font-normal text-left mt-1">
              Питання про розклад, групи, адмінку — українською. Потрібен ключ Gemini (GEMINI_API_KEY) на сервері.
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400">
                Наприклад: «Як додати групу?», «Що робить імпорт JSON?», «Як працює таблиця?»
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'ml-6 bg-cyan-500/15 text-cyan-50 border border-cyan-500/25'
                    : 'mr-4 bg-[#132038] text-gray-100 border border-white/10',
                )}
              >
                {m.content}
              </div>
            ))}
            {busy && (
              <div className="mr-4 rounded-xl px-3 py-2 text-sm text-gray-400 border border-white/10 bg-[#132038]">
                Думаю…
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-cyan-500/20 p-3 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ваше питання…"
              rows={3}
              disabled={busy}
              className="w-full resize-none rounded-lg border border-cyan-500/25 bg-[#0d1f35] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            <Button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
              className="w-full bg-cyan-500 text-[#0a1628] font-semibold hover:bg-cyan-400"
            >
              <Send className="size-4 mr-2" />
              Надіслати
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
