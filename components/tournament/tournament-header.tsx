"use client";

import { useState, useEffect, startTransition } from 'react';
import { Trophy, Star, Plus } from 'lucide-react';
import { useTournament } from '@/context/tournament-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { AgeCategory } from '@/types/tournament';

function deferInteraction(fn: () => void): void {
  setTimeout(fn, 0);
}

export function TournamentHeader() {
  const { activeCategory, setActiveCategory, categories, categoryConfig, isAdmin, addCategory } = useTournament();
  const availableCategories = categories;

  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [categoryError, setCategoryError] = useState('');

  useEffect(() => {
    if (!isAdmin) setShowAddCategoryDialog(false);
  }, [isAdmin]);

  return (
    <div className="mb-8">
      {/* Logo and Title */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <Trophy className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
          </div>
          <Star className="w-4 h-4 text-yellow-400 absolute -top-1 -right-1 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
            FUTURESTARS CUPS
          </h1>
          <p className="text-cyan-300/60 text-xs tracking-[0.3em] uppercase mt-1">
            Youth Soccer Tournament
          </p>
        </div>
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <Trophy className="w-7 h-7 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
          </div>
          <Star className="w-4 h-4 text-yellow-400 absolute -top-1 -left-1 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
        </div>
      </div>

      {/* Пункт 1: перемикання та додавання вікових категорій */}
      <div className="flex flex-col items-center gap-3 mt-6">
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-4xl">
          <span className="text-sm text-cyan-300/70 font-medium shrink-0">Вікова категорія:</span>
          {availableCategories.length ? (
            <div className="flex flex-wrap gap-2 bg-[#0d1f35]/80 p-1.5 rounded-xl border border-cyan-500/30 flex-1 min-w-0 justify-center">
              {availableCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeCategory === c.id
                      ? 'bg-cyan-500 text-[#0a1628] shadow-[0_0_15px_rgba(34,211,238,0.45)]'
                      : 'text-gray-300 hover:text-cyan-300 hover:bg-cyan-500/10'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-400">Ще немає категорій — додайте першу (потрібен режим адміна).</span>
          )}
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              title="Додати категорію в Firestore"
              className="shrink-0 border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
              onClick={() =>
                deferInteraction(() => {
                  startTransition(() => {
                    setCategoryError('');
                    setCategoryBusy(false);
                    setCategoryId('');
                    setCategoryLabel('');
                    setShowAddCategoryDialog(true);
                  });
                })
              }
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Додати категорію
            </Button>
          )}
        </div>
        {availableCategories.length > 1 && (
          <div className="w-full max-w-xs">
            <label className="sr-only" htmlFor="category-select">
              Швидкий вибір категорії
            </label>
            <select
              id="category-select"
              value={activeCategory && availableCategories.some((c) => c.id === activeCategory) ? activeCategory : ''}
              onChange={(e) => {
                const v = e.target.value as AgeCategory;
                if (v) setActiveCategory(v);
              }}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[#0d1f35] border border-cyan-500/30 text-cyan-100"
            >
              <option value="" disabled>
                Обрати зі списку…
              </option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {activeCategory && categoryConfig?.lastImportSummary ? (
        <div className="mt-3 text-center text-xs text-cyan-200/60">
          Останній імпорт: {categoryConfig.lastImportSummary}
        </div>
      ) : null}

      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Нова вікова категорія</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Створюється документ <code className="text-xs">categories/ID</code> у Firestore; після збереження категорія з’явиться у перемикачі.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="ID категорії (наприклад, 2014)"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setCategoryError('');
              }}
              disabled={categoryBusy}
              className="bg-secondary border-border text-foreground"
            />
            <Input
              placeholder="Назва для відображення (необов’язково)"
              value={categoryLabel}
              onChange={(e) => {
                setCategoryLabel(e.target.value);
                setCategoryError('');
              }}
              disabled={categoryBusy}
              className="bg-secondary border-border text-foreground"
            />
            {categoryError && <p className="text-destructive text-sm">{categoryError}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddCategoryDialog(false)}
                disabled={categoryBusy}
              >
                Скасувати
              </Button>
              <Button
                type="button"
                className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                disabled={categoryBusy}
                onClick={() => {
                  startTransition(() => {
                    setCategoryBusy(true);
                    setCategoryError('');
                  });
                  deferInteraction(() => {
                    void (async () => {
                      try {
                        if (!categoryId.trim()) {
                          throw new Error('Вкажіть ID категорії.');
                        }
                        await addCategory(categoryId.trim(), categoryLabel.trim() || undefined);
                        startTransition(() => setShowAddCategoryDialog(false));
                      } catch (e) {
                        setCategoryError(e instanceof Error ? e.message : 'Не вдалося створити категорію.');
                      } finally {
                        startTransition(() => setCategoryBusy(false));
                      }
                    })();
                  });
                }}
              >
                {categoryBusy ? 'Збереження…' : 'Створити'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
