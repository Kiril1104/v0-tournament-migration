"use client";

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { TournamentImportFileV1 } from '@/types/tournament';
import { ScheduleImportVisualPreview } from '@/components/tournament/schedule-import-visual-preview';

type ValidateFn = (data: TournamentImportFileV1) => {
  valid: boolean;
  issues: string[];
  summary: string;
  normalized: TournamentImportFileV1;
};

interface ScheduleAiExtractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAgeCategory: string;
  validateImportTournament: ValidateFn;
  importTournament: (data: TournamentImportFileV1, opts: { replaceExisting: boolean }) => Promise<void>;
}

export function ScheduleAiExtractDialog({
  open,
  onOpenChange,
  defaultAgeCategory,
  validateImportTournament,
  importTournament,
}: ScheduleAiExtractDialogProps) {
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [rawText, setRawText] = useState('');
  const [ageCategoryHint, setAgeCategoryHint] = useState('');
  /** Робоча копія після AI / редагування таблиці */
  const [draft, setDraft] = useState<TournamentImportFileV1 | null>(null);
  const [jsonOverride, setJsonOverride] = useState('');
  const [extractBusy, setExtractBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ summary: string; issues: string[] } | null>(null);
  const [importReady, setImportReady] = useState<TournamentImportFileV1 | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const applyDraft = useCallback(
    (next: TournamentImportFileV1) => {
      setDraft(next);
      setJsonOverride(JSON.stringify(next, null, 2));
      try {
        const v = validateImportTournament(next);
        setPreview({ summary: v.summary, issues: v.issues });
        setImportReady(v.valid ? v.normalized : null);
        setError(v.valid ? null : v.issues[0] ?? 'Перевірка не пройдена.');
      } catch (e) {
        setPreview(null);
        setImportReady(null);
        setError(e instanceof Error ? e.message : 'Некоректна структура даних.');
      }
    },
    [validateImportTournament],
  );

  useEffect(() => {
    if (open) {
      setAgeCategoryHint((prev) => (prev ? prev : defaultAgeCategory));
    }
  }, [open, defaultAgeCategory]);

  const resetClosing = () => {
    setRawText('');
    setAttachedFile(null);
    setFileInputKey((k) => k + 1);
    setDraft(null);
    setJsonOverride('');
    setPreview(null);
    setImportReady(null);
    setError(null);
  };

  const startOverPreview = () => {
    setAttachedFile(null);
    setFileInputKey((k) => k + 1);
    setDraft(null);
    setJsonOverride('');
    setPreview(null);
    setImportReady(null);
    setError(null);
  };

  const runExtract = async () => {
    setError(null);
    setPreview(null);
    setImportReady(null);
    setDraft(null);
    const t = rawText.trim();
    if (!attachedFile && !t) {
      setError('Вставте текст розкладу або прикріпіть файл (PDF, Excel, Word тощо).');
      return;
    }
    setExtractBusy(true);
    try {
      const age = ageCategoryHint.trim() || defaultAgeCategory;
      const res = attachedFile
        ? await fetch('/api/tournament/extract-schedule', {
            method: 'POST',
            body: (() => {
              const fd = new FormData();
              fd.append('file', attachedFile);
              fd.append('ageCategory', age);
              return fd;
            })(),
          })
        : await fetch('/api/tournament/extract-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawText: t, ageCategory: age }),
          });
      const json = (await res.json()) as { data?: unknown; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      const data = json.data as TournamentImportFileV1;
      if (!data || typeof data !== 'object') {
        throw new Error('Немає даних у відповіді.');
      }
      applyDraft(data as TournamentImportFileV1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося витягнути розклад.');
    } finally {
      setExtractBusy(false);
    }
  };

  const applyJsonFromTextarea = () => {
    try {
      const data = JSON.parse(jsonOverride) as TournamentImportFileV1;
      applyDraft(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Невалідний JSON.');
    }
  };

  const runImport = async () => {
    if (!importReady) {
      setError('Спочатку виправте помилки перевірки або відредагуйте таблицю.');
      return;
    }
    setImportBusy(true);
    setError(null);
    try {
      await importTournament(importReady, { replaceExisting });
      startTransition(() => {
        onOpenChange(false);
        resetClosing();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Імпорт не вдався.');
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetClosing();
        onOpenChange(v);
      }}
    >
      <DialogContent className="bg-card border-border max-h-[92vh] flex flex-col w-[min(100vw-1.5rem,56rem)]">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-cyan-400" />
            AI: розклад з тексту або файлу
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-left">
            Вставте текст розкладу або прикріпіть файл (txt, csv, xlsx, xls, pdf, docx) — після витягування з’явиться таблиця
            (групи, команди, матчі, плей-офф). Якщо обрано файл, для AI використовується він (не змішується з полем тексту).
            Потрібен <span className="font-mono">GEMINI_API_KEY</span> на сервері.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto min-h-0 flex-1 pr-1">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Замінити наявні дані для цієї вікової категорії в Firestore
          </label>

          {!draft && (
            <div className="grid gap-2">
              <label className="text-xs text-muted-foreground">Підказка для категорії (до витягування)</label>
              <Input
                value={ageCategoryHint}
                onChange={(e) => setAgeCategoryHint(e.target.value)}
                placeholder="наприклад 2014 — якщо в тексті немає назви категорії"
                className="bg-secondary border-border"
              />
            </div>
          )}

          {!draft && (
            <>
              <div className="grid gap-2">
                <label className="text-xs text-muted-foreground">Файл розкладу (необов’язково)</label>
                <Input
                  key={fileInputKey}
                  type="file"
                  accept=".txt,.csv,.md,.json,.html,.htm,.xlsx,.xls,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel"
                  className="bg-secondary border-border cursor-pointer file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
                  disabled={extractBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setAttachedFile(f);
                  }}
                />
                {attachedFile && (
                  <p className="text-xs text-cyan-200/90">
                    Обрано: {attachedFile.name} — буде надіслано на сервер для витягування тексту, далі AI.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-xs text-muted-foreground">
                  Текст розкладу {attachedFile ? '(ігнорується, поки обрано файл)' : ''}
                </label>
                <Textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Або вставте сюди таблицю з документа, листа, месенджера…"
                  rows={6}
                  className="font-mono text-sm bg-secondary border-border resize-y min-h-[120px]"
                  disabled={extractBusy || !!attachedFile}
                />
              </div>

              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full font-semibold"
                disabled={extractBusy}
                onClick={() => void runExtract()}
              >
                {extractBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Витягую…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 mr-2" />
                    Витягнути розклад (AI)
                  </>
                )}
              </Button>
            </>
          )}

          {draft && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <p className="text-sm text-cyan-200/90">Передогляд — перевірте та за потреби відредагуйте поля в таблиці.</p>
                <Button type="button" variant="outline" size="sm" className="shrink-0 sm:ml-auto" onClick={startOverPreview}>
                  Почати спочатку
                </Button>
              </div>

              <div className="grid gap-2">
                <label className="text-xs text-muted-foreground">ID вікової категорії (імпорт у Firestore)</label>
                <Input
                  value={draft.ageCategory}
                  onChange={(e) => applyDraft({ ...draft, ageCategory: e.target.value.trim() })}
                  className="bg-secondary border-border max-w-xs"
                />
              </div>

              <ScheduleImportVisualPreview data={draft} onChange={applyDraft} />

              <details className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Додатково: редагувати як JSON
                </summary>
                <p className="text-xs text-muted-foreground mt-2 mb-2">
                  Для зміни назв команд або структури груп відредагуйте JSON і натисніть «Застосувати JSON».
                </p>
                <Textarea
                  value={jsonOverride}
                  onChange={(e) => setJsonOverride(e.target.value)}
                  rows={10}
                  className="font-mono text-[11px] leading-relaxed bg-background border-border mb-2"
                  spellCheck={false}
                />
                <Button type="button" variant="secondary" size="sm" onClick={applyJsonFromTextarea}>
                  Застосувати JSON
                </Button>
              </details>
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-100 space-y-2">
              <p>Перевірка: {preview.summary}</p>
              {preview.issues.length > 0 && (
                <ul className="list-disc pl-5 text-amber-200 text-xs space-y-0.5">
                  {preview.issues.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={() => onOpenChange(false)} disabled={importBusy}>
            Закрити
          </Button>
          <Button
            type="button"
            className="h-10 w-full bg-cyan-500 font-bold text-[#0a1628] hover:bg-cyan-400 sm:min-w-[11rem] sm:w-auto"
            disabled={importBusy || !importReady || extractBusy}
            onClick={() => void runImport()}
          >
            {importBusy ? 'Імпорт…' : 'Імпортувати в базу'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
