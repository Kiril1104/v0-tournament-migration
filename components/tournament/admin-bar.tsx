"use client";

import { useEffect, useState, startTransition } from 'react';
import { Shield, ShieldOff, Lock, Plus, Upload, GitBranch, Sparkles } from 'lucide-react';
import { useTournament } from '@/context/tournament-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { TabId, TournamentImportFileV1 } from '@/types/tournament';
import * as XLSX from 'xlsx';
import { ScheduleAiExtractDialog } from '@/components/tournament/schedule-ai-extract-dialog';

/** Double rAF: commit React updates and paint before heavy synchronous work (XLSX, large JSON). */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Macrotask deferral: click handler returns immediately so the browser can paint before Dialog / heavy React work (avoids “blocked UI updates” warnings). */
function deferInteraction(fn: () => void): void {
  setTimeout(fn, 0);
}

interface AdminBarProps {
  activeTab: TabId;
}

export function AdminBar({ activeTab }: AdminBarProps) {
  const {
    isAdmin,
    setIsAdmin,
    setAdminWriteSecret,
    addGroup,
    importTournament,
    validateImportTournament,
    generatePlayoffTemplate,
    setCategoryFormat,
    migrateLegacyToCategories,
    categories,
    activeCategory,
    categoryConfig,
    deleteCategory,
    updateCategory,
  } = useTournament();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAiExtractDialog, setShowAiExtractDialog] = useState(false);
  const [importError, setImportError] = useState<string>('');
  const [importBusy, setImportBusy] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [importPreview, setImportPreview] = useState<{ summary: string; issues: string[] } | null>(null);
  const [parsedImport, setParsedImport] = useState<TournamentImportFileV1 | null>(null);

  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationError, setMigrationError] = useState<string>('');
  const [deleteLegacyAfterCopy, setDeleteLegacyAfterCopy] = useState(false);
  const [replaceCategoriesAfterCopy, setReplaceCategoriesAfterCopy] = useState(true);
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false);
  const [addGroupNameInput, setAddGroupNameInput] = useState('');
  const [addGroupDialogError, setAddGroupDialogError] = useState('');
  const [addGroupBarHint, setAddGroupBarHint] = useState('');

  const [showDeleteCategoryDialog, setShowDeleteCategoryDialog] = useState(false);
  const [showEditCategoryDialog, setShowEditCategoryDialog] = useState(false);

  const [deleteCategoryId, setDeleteCategoryId] = useState<string>('');
  const [deleteCategoryBusy, setDeleteCategoryBusy] = useState(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState('');

  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editCategoryNextId, setEditCategoryNextId] = useState('');
  const [editCategoryLabel, setEditCategoryLabel] = useState('');
  const [editCategoryBusy, setEditCategoryBusy] = useState(false);
  const [editCategoryError, setEditCategoryError] = useState('');
  const [formatBusy, setFormatBusy] = useState(false);
  const [playoffBusy, setPlayoffBusy] = useState(false);
  const [automationError, setAutomationError] = useState('');

  useEffect(() => {
    if (!showDeleteCategoryDialog) return;
    const exists = categories.some(c => c.id === deleteCategoryId);
    if (!exists) setDeleteCategoryId(activeCategory || categories[0]?.id || '');
  }, [categories, activeCategory, deleteCategoryId, showDeleteCategoryDialog]);

  useEffect(() => {
    if (!showEditCategoryDialog) return;
    if (!categories.length) {
      setEditCategoryId('');
      setEditCategoryNextId('');
      setEditCategoryLabel('');
      return;
    }
    const selected = categories.find(c => c.id === editCategoryId) ?? categories.find(c => c.id === activeCategory) ?? categories[0];
    setEditCategoryId(selected.id);
    setEditCategoryNextId(selected.id);
    setEditCategoryLabel(selected.label);
  }, [categories, activeCategory, editCategoryId, showEditCategoryDialog]);

  const parseExcelFile = async (file: File): Promise<TournamentImportFileV1> => {
    const buffer = await file.arrayBuffer();
    await yieldToPaint();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const groupsSheet = workbook.Sheets['Groups'];
    const teamsSheet = workbook.Sheets['Teams'];
    const matchesSheet = workbook.Sheets['Matches'];

    if (!groupsSheet || !teamsSheet || !matchesSheet) {
      throw new Error('Excel file must contain sheets: Groups, Teams, Matches.');
    }

    const groupsRows = XLSX.utils.sheet_to_json<any>(groupsSheet);
    const teamsRows = XLSX.utils.sheet_to_json<any>(teamsSheet);
    const matchesRows = XLSX.utils.sheet_to_json<any>(matchesSheet);

    if (groupsRows.length === 0) {
      throw new Error('Groups sheet is empty.');
    }

    // Support both `ageCategory` (new) and `ageGroup` (legacy) column names.
    const ageCategory =
      (groupsRows[0].ageCategory ?? groupsRows[0].ageGroup ?? '') as TournamentImportFileV1['ageCategory'];

    const groups = groupsRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
    }));

    const teams = teamsRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      groupId: String(row.groupId),
    }));

    const matches = matchesRows.map((row) => ({
      id: String(row.id),
      groupId: String(row.groupId),
      homeTeamId: String(row.homeTeamId),
      awayTeamId: String(row.awayTeamId),
      date: String(row.date),
      time: String(row.time),
      venue: String(row.venue),
      status: row.status as TournamentImportFileV1['matches'][number]['status'] | undefined,
      homeScore: row.homeScore !== undefined && row.homeScore !== null && row.homeScore !== '' ? Number(row.homeScore) : null,
      awayScore: row.awayScore !== undefined && row.awayScore !== null && row.awayScore !== '' ? Number(row.awayScore) : null,
    }));

    return {
      version: 1,
      ageCategory,
      format: 'round_robin',
      groups,
      teams,
      matches,
    };
  };

  const handleAdminToggle = () => {
    if (isAdmin) {
      deferInteraction(() => {
        startTransition(() => {
          setIsAdmin(false);
          setAdminWriteSecret(null);
        });
      });
    } else {
      deferInteraction(() => {
        startTransition(() => setShowPasswordDialog(true));
      });
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifyBusy(true);
    void (async () => {
      try {
        const res = await fetch('/api/tournament/admin-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          const secret = password.trim();
          setIsAdmin(true);
          setAdminWriteSecret(secret);
          setShowPasswordDialog(false);
          setPassword('');
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 503) {
          setError(
            data.error
              ? `Сервер: ${data.error} Додайте TOURNAMENT_ADMIN_SECRET у .env.local і перезапустіть npm run dev.`
              : 'Сервер без TOURNAMENT_ADMIN_SECRET. Додайте змінну в .env.local і перезапустіть npm run dev (на Vercel — Environment Variables + Redeploy).',
          );
          return;
        }
        setError(res.status === 401 ? 'Невірний пароль.' : data.error ?? 'Не вдалось перевірити пароль.');
      } catch {
        setError('Не вдалось з’єднатись із сервером. Переконайтесь, що npm run dev запущено.');
      } finally {
        setVerifyBusy(false);
      }
    })();
  };

  const openAddGroupDialog = () => {
    setAddGroupBarHint('');
    if (!activeCategory) {
      setAddGroupBarHint('Спочатку оберіть категорію у шапці турніру.');
      return;
    }
    setAddGroupDialogError('');
    const nextLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    setAddGroupNameInput(`Group ${nextLetter}`);
    setShowAddGroupDialog(true);
  };

  const submitAddGroupDialog = () => {
    const name = addGroupNameInput.trim();
    if (!name) {
      setAddGroupDialogError('Введіть назву групи.');
      return;
    }
    void (async () => {
      try {
        setAddGroupDialogError('');
        await addGroup(name);
        setShowAddGroupDialog(false);
        setAddGroupNameInput('');
      } catch (e) {
        setAddGroupDialogError(e instanceof Error ? e.message : 'Не вдалося додати групу.');
      }
    })();
  };

  const runImportFile = async (file: File) => {
    setImportError('');
    setImportBusy(true);
    await yieldToPaint();
    try {
      let parsed: TournamentImportFileV1;

      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        parsed = await parseExcelFile(file);
      } else {
        const text = await file.text();
        await yieldToPaint();
        parsed = JSON.parse(text) as TournamentImportFileV1;
      }

      if (!parsed || parsed.version !== 1) {
        throw new Error('Unsupported file format (expected version: 1).');
      }
      if (!parsed.ageCategory || !parsed.groups || !parsed.teams || !parsed.matches) {
        throw new Error('Invalid import file: missing required fields.');
      }
      await yieldToPaint();
      const preview = validateImportTournament(parsed);
      setImportPreview({ summary: preview.summary, issues: preview.issues });
      setParsedImport(preview.normalized);
      if (!preview.valid) {
        throw new Error(preview.issues[0] ?? 'Import validation failed.');
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setImportBusy(false);
    }
  };

  /** Defer so the file input's change handler returns immediately (avoids React "blocked UI" on heavy parse). */
  const handleImportFile = (file: File | null) => {
    if (!file) return;
    deferInteraction(() => {
      void runImportFile(file);
    });
  };

  const downloadTemplate = () => {
    const template: TournamentImportFileV1 = {
      version: 1,
      ageCategory: '',
      format: 'round_robin',
      groups: [{ id: 'group-a', name: 'Group A' }],
      teams: [
        { id: 'team-1', name: 'Team 1', groupId: 'group-a' },
        { id: 'team-2', name: 'Team 2', groupId: 'group-a' },
      ],
      matches: [
        { id: 'match-1', groupId: 'group-a', homeTeamId: 'team-1', awayTeamId: 'team-2', date: '2026-03-19', time: '10:00', venue: 'Field 1', status: 'scheduled', homeScore: null, awayScore: null },
      ],
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tournament-import-template.v1.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAdminToggle}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 border ${
            isAdmin
              ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
              : 'bg-[#0d1f35] text-gray-400 border-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/40'
          }`}
        >
          {isAdmin ? <Shield size={16} /> : <ShieldOff size={16} />}
          {isAdmin ? 'Admin Mode' : 'Viewer Mode'}
        </button>

        {activeTab === 'standings' && isAdmin && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => deferInteraction(() => startTransition(() => openAddGroupDialog()))}
              className="flex items-center gap-2 bg-cyan-500 text-[#0a1628] px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-400 transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
            >
              <Plus size={16} /> Додати групу
            </button>
            {addGroupBarHint && <p className="text-amber-300 text-xs max-w-[220px]">{addGroupBarHint}</p>}
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2 flex-1 min-w-0 justify-start sm:justify-end">
            <button
              type="button"
              onClick={() =>
                deferInteraction(() => {
                  startTransition(() => setShowMigrationDialog(true));
                })
              }
              className="flex items-center gap-2 bg-[#0d1f35] text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-500/10 transition-all duration-300"
            >
              Migrate legacy data
            </button>
            <button
              type="button"
              onClick={() =>
                deferInteraction(() => {
                  startTransition(() => setShowImportDialog(true));
                })
              }
              className="flex items-center gap-2 bg-[#0d1f35] text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-500/10 transition-all duration-300"
            >
              <Upload size={16} /> Import
            </button>
            <button
              type="button"
              onClick={() =>
                deferInteraction(() => {
                  startTransition(() => setShowAiExtractDialog(true));
                })
              }
              className="flex items-center gap-2 bg-[#0d1f35] text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-500/10 transition-all duration-300"
            >
              <Sparkles size={16} /> AI з тексту
            </button>
            <button
              type="button"
              onClick={() =>
                deferInteraction(() => {
                  startTransition(() => {
                    setDeleteCategoryError('');
                    setDeleteCategoryBusy(false);
                    setDeleteCategoryId('');
                    setShowDeleteCategoryDialog(true);
                  });
                })
              }
              className="flex items-center gap-2 bg-[#0d1f35] text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-500/10 transition-all duration-300"
            >
              Delete Category
            </button>
            <button
              type="button"
              onClick={() =>
                deferInteraction(() => {
                  startTransition(() => {
                    setEditCategoryError('');
                    setEditCategoryBusy(false);
                    setShowEditCategoryDialog(true);
                  });
                })
              }
              className="flex items-center gap-2 bg-[#0d1f35] text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-500/10 transition-all duration-300"
            >
              Edit Category
            </button>
            <button
              type="button"
              onClick={() => {
                const template =
                  categoryConfig?.format === 'groups_quarterfinals'
                    ? 'groups_quarterfinals'
                    : categoryConfig?.format === 'groups_semifinals'
                      ? 'groups_semifinals'
                      : 'round_robin';
                deferInteraction(() => {
                  startTransition(() => {
                    setPlayoffBusy(true);
                    setAutomationError('');
                  });
                  void (async () => {
                    try {
                      await generatePlayoffTemplate(template, { clearPlayoff: true });
                    } catch (e) {
                      setAutomationError(e instanceof Error ? e.message : 'Failed to generate playoff.');
                    } finally {
                      startTransition(() => setPlayoffBusy(false));
                    }
                  })();
                });
              }}
              className="flex items-center gap-2 bg-[#0d1f35] text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-500/10 transition-all duration-300"
            >
              <GitBranch size={16} /> {playoffBusy ? 'Generating...' : 'Generate Playoff'}
            </button>
          </div>
        )}
        </div>
      </div>

      <Dialog open={showAddGroupDialog} onOpenChange={setShowAddGroupDialog}>
        <DialogContent className="bg-[#0d1f35] border-cyan-500/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Нова група</DialogTitle>
            <DialogDescription className="text-gray-400">
              Назва збережеться в активній категорії: {activeCategory ? <span className="text-cyan-200 font-medium">{activeCategory}</span> : '—'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Наприклад: Група A"
              value={addGroupNameInput}
              onChange={(e) => {
                setAddGroupNameInput(e.target.value);
                setAddGroupDialogError('');
              }}
              className="bg-[#0a1628] border-cyan-500/30 text-white placeholder:text-gray-500"
            />
            {addGroupDialogError && <p className="text-red-400 text-sm">{addGroupDialogError}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddGroupDialog(false)}
                className="border-cyan-500/30 text-gray-400 hover:text-white"
              >
                Скасувати
              </Button>
              <Button
                type="button"
                onClick={submitAddGroupDialog}
                className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400"
              >
                Додати
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Import tournament (JSON)</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Upload a JSON file with groups, teams, and matches. Standings will be computed automatically from match results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={replaceExisting}
                disabled={importBusy}
                onChange={(e) => setReplaceExisting(e.target.checked)}
              />
              Replace existing data for the imported age category
            </label>
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <select
                className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground"
                value={categoryConfig?.format ?? 'round_robin'}
                disabled={formatBusy}
                onChange={(e) => {
                  const value = e.target.value as 'round_robin' | 'groups_semifinals' | 'groups_quarterfinals';
                  startTransition(() => {
                    setFormatBusy(true);
                    setAutomationError('');
                  });
                  deferInteraction(() => {
                    void (async () => {
                      try {
                        await setCategoryFormat(value);
                      } catch (err) {
                        setAutomationError(err instanceof Error ? err.message : 'Failed to update format.');
                      } finally {
                        startTransition(() => setFormatBusy(false));
                      }
                    })();
                  });
                }}
              >
                <option value="round_robin">Round-robin only</option>
                <option value="groups_semifinals">2 groups + semifinals</option>
                <option value="groups_quarterfinals">4 groups + quarterfinals</option>
              </select>
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                Download template
              </Button>
              <label className="text-sm text-muted-foreground">
                <input
                  type="file"
                  accept="application/json,.json,.xlsx,.xls"
                  disabled={importBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    handleImportFile(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {importError && <p className="text-destructive text-sm">{importError}</p>}
            {importPreview && (
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-100 space-y-2">
                <p>Preview: {importPreview.summary}</p>
                {importPreview.issues.length > 0 && (
                  <ul className="list-disc pl-5 text-red-300">
                    {importPreview.issues.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {automationError && <p className="text-destructive text-sm">{automationError}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowImportDialog(false)} disabled={importBusy}>
                Close
              </Button>
              <Button
                type="button"
                className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400"
                disabled={importBusy || !parsedImport || Boolean(importPreview?.issues.length)}
                onClick={() => {
                  if (!parsedImport) return;
                  startTransition(() => {
                    setImportBusy(true);
                    setImportError('');
                  });
                  deferInteraction(() => {
                    void (async () => {
                      try {
                        await importTournament(parsedImport, { replaceExisting });
                        startTransition(() => {
                          setShowImportDialog(false);
                          setImportPreview(null);
                          setParsedImport(null);
                        });
                      } catch (e) {
                        setImportError(e instanceof Error ? e.message : 'Import failed.');
                      } finally {
                        startTransition(() => setImportBusy(false));
                      }
                    })();
                  });
                }}
              >
                Confirm Import
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScheduleAiExtractDialog
        open={showAiExtractDialog}
        onOpenChange={setShowAiExtractDialog}
        defaultAgeCategory={activeCategory ?? ''}
        validateImportTournament={validateImportTournament}
        importTournament={importTournament}
      />

      <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Migrate legacy data</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Copy all data from legacy collections (`groups`, `teams`, `matches` with `ageGroup`) into `categories/activeCategory` structure.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={replaceCategoriesAfterCopy}
                disabled={migrationBusy}
                onChange={(e) => setReplaceCategoriesAfterCopy(e.target.checked)}
              />
              Replace data inside `categories/activeCategory` (per category found in legacy)
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={deleteLegacyAfterCopy}
                disabled={migrationBusy}
                onChange={(e) => setDeleteLegacyAfterCopy(e.target.checked)}
              />
              Delete legacy collections after copy
            </label>
            {migrationError && <p className="text-destructive text-sm">{migrationError}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowMigrationDialog(false)} disabled={migrationBusy}>
                Close
              </Button>
              <Button
                type="button"
                className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                disabled={migrationBusy}
                onClick={() => {
                  startTransition(() => {
                    setMigrationError('');
                    setMigrationBusy(true);
                  });
                  deferInteraction(() => {
                    void (async () => {
                      try {
                        await migrateLegacyToCategories({
                          deleteLegacy: deleteLegacyAfterCopy,
                          replaceCategories: replaceCategoriesAfterCopy,
                        });
                        startTransition(() => setShowMigrationDialog(false));
                      } catch (e) {
                        setMigrationError(e instanceof Error ? e.message : 'Migration failed.');
                      } finally {
                        startTransition(() => setMigrationBusy(false));
                      }
                    })();
                  });
                }}
              >
                {migrationBusy ? 'Migrating...' : 'Run migration'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteCategoryDialog} onOpenChange={setShowDeleteCategoryDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete category</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will delete `groups/teams/matches` inside selected category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories found.</p>
            ) : (
              <>
                <select
                  value={deleteCategoryId}
                  onChange={(e) => setDeleteCategoryId(e.target.value)}
                  disabled={deleteCategoryBusy}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {deleteCategoryError && <p className="text-destructive text-sm">{deleteCategoryError}</p>}
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteCategoryDialog(false)}
                disabled={deleteCategoryBusy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-500 text-white font-bold hover:bg-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                disabled={deleteCategoryBusy || categories.length === 0 || !deleteCategoryId.trim()}
                onClick={() => {
                  startTransition(() => {
                    setDeleteCategoryBusy(true);
                    setDeleteCategoryError('');
                  });
                  deferInteraction(() => {
                    void (async () => {
                      try {
                        if (!deleteCategoryId.trim()) return;
                        await deleteCategory(deleteCategoryId.trim());
                        startTransition(() => setShowDeleteCategoryDialog(false));
                      } catch (e) {
                        setDeleteCategoryError(e instanceof Error ? e.message : 'Failed to delete category.');
                      } finally {
                        startTransition(() => setDeleteCategoryBusy(false));
                      }
                    })();
                  });
                }}
              >
                {deleteCategoryBusy ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditCategoryDialog} onOpenChange={setShowEditCategoryDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit category</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You can rename label or change category id (all data will move to the new id).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories found.</p>
            ) : (
              <>
                <select
                  value={editCategoryId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setEditCategoryId(id);
                    const selected = categories.find(c => c.id === id);
                    setEditCategoryNextId(id);
                    setEditCategoryLabel(selected?.label ?? id);
                    setEditCategoryError('');
                  }}
                  disabled={editCategoryBusy}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-foreground"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <Input
                  placeholder="New category id"
                  value={editCategoryNextId}
                  onChange={(e) => {
                    setEditCategoryNextId(e.target.value);
                    setEditCategoryError('');
                  }}
                  disabled={editCategoryBusy}
                  className="bg-secondary border-border text-foreground"
                />
                <Input
                  placeholder="New label"
                  value={editCategoryLabel}
                  onChange={(e) => {
                    setEditCategoryLabel(e.target.value);
                    setEditCategoryError('');
                  }}
                  disabled={editCategoryBusy}
                  className="bg-secondary border-border text-foreground"
                />
                {editCategoryError && <p className="text-destructive text-sm">{editCategoryError}</p>}
              </>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowEditCategoryDialog(false)} disabled={editCategoryBusy}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                disabled={editCategoryBusy || categories.length === 0}
                onClick={() => {
                  startTransition(() => {
                    setEditCategoryBusy(true);
                    setEditCategoryError('');
                  });
                  deferInteraction(() => {
                    void (async () => {
                      try {
                        await updateCategory(editCategoryId, {
                          id: editCategoryNextId.trim(),
                          label: editCategoryLabel.trim() || undefined,
                        });
                        startTransition(() => setShowEditCategoryDialog(false));
                      } catch (e) {
                        setEditCategoryError(e instanceof Error ? e.message : 'Failed to edit category.');
                      } finally {
                        startTransition(() => setEditCategoryBusy(false));
                      }
                    })();
                  });
                }}
              >
                {editCategoryBusy ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Lock className="w-5 h-5 text-primary" />
              Режим адміна
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Введіть той самий пароль, що й у <span className="font-mono text-xs">TOURNAMENT_ADMIN_SECRET</span> у{' '}
              <span className="font-mono text-xs">.env.local</span> (сервер перевіряє через API — дублювати в{' '}
              <span className="font-mono text-xs">NEXT_PUBLIC_*</span> не потрібно).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Пароль адміна"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              disabled={verifyBusy}
              className="bg-secondary border-border text-foreground"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false);
                  setPassword('');
                  setError('');
                }}
                disabled={verifyBusy}
              >
                Скасувати
              </Button>
              <Button type="submit" className="neon-glow" disabled={verifyBusy || !password.trim()}>
                {verifyBusy ? 'Перевірка…' : 'Увійти'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
