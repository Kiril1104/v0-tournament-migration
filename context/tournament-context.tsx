"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { collection, doc, onSnapshot, query, orderBy, enableNetwork } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  logEnableNetworkError,
  logFirebaseEnvOnClientMount,
  logFirestoreSnapshotError,
} from '@/lib/firebase-debug-log';
import {
  CLIENT_FIREBASE_ENV_HINT_UA,
  FIRESTORE_EXTRA_HINT_WHEN_ENV_OK_UA,
  getClientFirebaseEnvFlags,
  getMissingClientFirebaseEnvKeys,
  isClientFirebaseEnvReady,
  type ClientFirebaseEnvKey,
} from '@/lib/firebase-client-env';
import { tournamentWriteOp } from '@/lib/tournament-write-client';
import type {
  Team,
  Match,
  Group,
  Bus,
  Hotel,
  AgeCategory,
  TournamentImportFileV1,
  CategoryConfig,
  TournamentFormat,
  TiebreakRule,
  Stage,
} from '@/types/tournament';

type ImportPreview = {
  valid: boolean;
  issues: string[];
  summary: string;
  normalized: TournamentImportFileV1;
};

interface TournamentContextType {
  activeCategory: AgeCategory;
  categories: Array<{ id: AgeCategory; label: string }>;
  groups: Group[];
  teams: Team[];
  matches: Match[];
  buses: Bus[];
  hotels: Hotel[];
  stages: Stage[];
  categoryConfig: CategoryConfig | null;
  isAdmin: boolean;
  /** Same value sent as `x-admin-secret` for server writes; set when admin unlocks. */
  adminWriteSecret: string | null;
  loading: boolean;
  firestoreError: string | null;
  /** Що з NEXT_PUBLIC_FIREBASE_* потрапило в клієнтську збірку (без значень). */
  firebaseClientEnv: {
    ready: boolean;
    flags: Record<ClientFirebaseEnvKey, boolean>;
    missingKeys: ClientFirebaseEnvKey[];
  };

  setActiveCategory: (category: AgeCategory) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setAdminWriteSecret: (secret: string | null) => void;
  setCategoryFormat: (format: TournamentFormat) => Promise<void>;
  addGroup: (name: string) => Promise<void>;
  addTeam: (team: Omit<Team, 'id' | 'played' | 'won' | 'drawn' | 'lost' | 'goalsFor' | 'goalsAgainst' | 'points'>) => Promise<void>;
  addMatch: (match: Omit<Match, 'id'>) => Promise<void>;
  updateMatchScore: (matchId: string, homeScore: number, awayScore: number) => Promise<void>;
  addBus: (bus: Omit<Bus, 'id'>) => Promise<void>;
  updateBusLink: (busId: string, liveLink: string) => Promise<void>;
  addHotel: (hotel: Omit<Hotel, 'id'>) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  deleteTeam: (teamId: string) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  deleteBus: (busId: string) => Promise<void>;
  deleteHotel: (hotelId: string) => Promise<void>;
  validateImportTournament: (data: TournamentImportFileV1) => ImportPreview;
  importTournament: (data: TournamentImportFileV1, opts?: { replaceExisting?: boolean }) => Promise<void>;
  rebuildCategory: () => Promise<void>;
  generatePlayoffTemplate: (template: 'round_robin' | 'groups_semifinals' | 'groups_quarterfinals', opts?: { clearPlayoff?: boolean }) => Promise<void>;
  migrateLegacyToCategories: (opts?: { deleteLegacy?: boolean; replaceCategories?: boolean }) => Promise<void>;
  addCategory: (id: AgeCategory, label?: string) => Promise<void>;
  deleteCategory: (id: AgeCategory) => Promise<void>;
  updateCategory: (currentId: AgeCategory, next: { id: AgeCategory; label?: string }) => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | null>(null);

const DEFAULT_CONFIG: CategoryConfig = {
  format: 'round_robin',
  tiebreakRules: ['points', 'goalDifference', 'goalsFor'],
  autoGeneratePlayoff: true,
};

function computeTeamsFromMatches(baseTeams: Team[], matches: Match[], tiebreakRules: TiebreakRule[]): Team[] {
  const byId = new Map<string, Team>();
  for (const t of baseTeams) {
    byId.set(t.id, { ...t, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
  }

  for (const m of matches) {
    if (m.stageType === 'playoff' || m.stageType === 'placement') continue;
    const hs = m.homeScore;
    const as = m.awayScore;
    if (hs === null || as === null || m.status !== 'completed') continue;
    const home = byId.get(m.homeTeamId);
    const away = byId.get(m.awayTeamId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += hs;
    home.goalsAgainst += as;
    away.goalsFor += as;
    away.goalsAgainst += hs;
    if (hs > as) {
      home.won += 1;
      away.lost += 1;
      home.points += 3;
    } else if (hs < as) {
      away.won += 1;
      home.lost += 1;
      away.points += 3;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const compareByRule = (a: Team, b: Team, rule: TiebreakRule): number => {
    if (rule === 'points') return b.points - a.points;
    if (rule === 'goalDifference') return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst);
    if (rule === 'goalsFor') return b.goalsFor - a.goalsFor;
    return 0;
  };

  return Array.from(byId.values()).sort((a, b) => {
    for (const rule of tiebreakRules) {
      const diff = compareByRule(a, b, rule);
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
}

function defaultConfigFromFormat(format?: TournamentFormat): CategoryConfig {
  return { ...DEFAULT_CONFIG, format: format ?? 'round_robin' };
}

function formatListenError(label: string, message: string): string {
  if (!isClientFirebaseEnvReady()) return CLIENT_FIREBASE_ENV_HINT_UA;
  return `${label}: ${message}${FIRESTORE_EXTRA_HINT_WHEN_ENV_OK_UA}`;
}

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<AgeCategory>('');
  /** Avoid overwriting activeCategory from localStorage before we've read it (first paint race). */
  const storageHydratedRef = useRef(false);
  const [categories, setCategories] = useState<Array<{ id: AgeCategory; label: string }>>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminWriteSecret, setAdminWriteSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rawTeams, setRawTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [categoryConfig, setCategoryConfig] = useState<CategoryConfig | null>(null);

  const teams = useMemo(
    () => computeTeamsFromMatches(rawTeams, matches, categoryConfig?.tiebreakRules ?? DEFAULT_CONFIG.tiebreakRules),
    [rawTeams, matches, categoryConfig],
  );

  const firebaseClientEnv = useMemo(
    () => ({
      ready: isClientFirebaseEnvReady(),
      flags: getClientFirebaseEnvFlags(),
      missingKeys: getMissingClientFirebaseEnvKeys(),
    }),
    [],
  );

  const ensureActiveCategory = useCallback(() => {
    if (!activeCategory) throw new Error('Select a category first.');
    return activeCategory;
  }, [activeCategory]);

  const validateImportTournament = useCallback((data: TournamentImportFileV1): ImportPreview => {
    const issues: string[] = [];
    const normalized: TournamentImportFileV1 = {
      ...data,
      ageCategory: String(data.ageCategory ?? '').trim(),
      format: data.format ?? 'round_robin',
      groups: data.groups.map((g) => ({ id: String(g.id).trim(), name: String(g.name).trim() })),
      teams: data.teams.map((t) => ({ id: String(t.id).trim(), name: String(t.name).trim(), groupId: String(t.groupId).trim() })),
      matches: data.matches.map((m) => ({
        id: String(m.id).trim(),
        groupId: String(m.groupId).trim(),
        homeTeamId: String(m.homeTeamId).trim(),
        awayTeamId: String(m.awayTeamId).trim(),
        date: String(m.date).trim(),
        time: String(m.time).trim(),
        venue: String(m.venue).trim(),
        stageId: m.stageId ? String(m.stageId) : undefined,
        stageType: m.stageType ?? 'group',
        status: m.status ?? 'scheduled',
        homeScore: m.homeScore ?? null,
        awayScore: m.awayScore ?? null,
      })),
    };
    if (!normalized.ageCategory) issues.push('Missing ageCategory.');
    if (!normalized.groups.length) issues.push('No groups provided.');
    if (!normalized.teams.length) issues.push('No teams provided.');
    if (!normalized.matches.length) issues.push('No matches provided.');

    const groupIds = new Set(normalized.groups.map((g) => g.id));
    const teamIds = new Set(normalized.teams.map((t) => t.id));
    if (groupIds.size !== normalized.groups.length) issues.push('Duplicate group ids.');
    if (teamIds.size !== normalized.teams.length) issues.push('Duplicate team ids.');

    for (const t of normalized.teams) {
      if (!groupIds.has(t.groupId)) issues.push(`Team "${t.name}" references unknown group "${t.groupId}".`);
    }
    for (const m of normalized.matches) {
      if (!teamIds.has(m.homeTeamId) || !teamIds.has(m.awayTeamId)) issues.push(`Match "${m.id}" has unknown teams.`);
      if (m.homeTeamId === m.awayTeamId) issues.push(`Match "${m.id}" has identical teams.`);
      if (m.status === 'completed' && (m.homeScore === null || m.awayScore === null)) issues.push(`Match "${m.id}" completed without score.`);
    }

    const summary = `${normalized.groups.length} groups, ${normalized.teams.length} teams, ${normalized.matches.length} matches`;
    return { valid: issues.length === 0, issues, summary, normalized };
  }, []);

  useEffect(() => {
    logFirebaseEnvOnClientMount();
  }, []);

  useEffect(() => {
    if (!isClientFirebaseEnvReady()) return;
    void enableNetwork(db()).catch((err) => logEnableNetworkError(err));
  }, []);

  useEffect(() => {
    if (!isClientFirebaseEnvReady()) {
      setFirestoreError(CLIENT_FIREBASE_ENV_HINT_UA);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('activeCategory');
      if (saved) setActiveCategory(saved);
    } finally {
      // Defer so the "sync activeCategory to categories list" effect does not run in the same
      // commit with activeCategory still "" (would pick categories[0] and overwrite localStorage).
      queueMicrotask(() => {
        storageHydratedRef.current = true;
      });
    }
  }, []);

  useEffect(() => {
    if (activeCategory) window.localStorage.setItem('activeCategory', activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!isClientFirebaseEnvReady()) return;

    const unsubscribers: Array<() => void> = [];
    unsubscribers.push(onSnapshot(query(collection(db(), 'categories')), (snapshot) => {
      setFirestoreError(null);
      const next = snapshot.docs
        .map((d) => {
          const data = d.data() as { label?: string };
          return { id: d.id as AgeCategory, label: data?.label ? String(data.label) : String(d.id) };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
      setCategories(next);
    }, (error) => {
      logFirestoreSnapshotError('collection/categories', error);
      setFirestoreError(formatListenError('Помилка читання категорій', (error as Error).message));
    }));
    unsubscribers.push(onSnapshot(query(collection(db(), 'buses')), (snapshot) => {
      setBuses(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Bus)));
    }, (error) => {
      logFirestoreSnapshotError('collection/buses', error);
      setFirestoreError(formatListenError('Помилка читання автобусів', (error as Error).message));
    }));
    unsubscribers.push(onSnapshot(query(collection(db(), 'hotels')), (snapshot) => {
      setHotels(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Hotel)));
    }, (error) => {
      logFirestoreSnapshotError('collection/hotels', error);
      setFirestoreError(formatListenError('Помилка читання готелів', (error as Error).message));
    }));
    return () => unsubscribers.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!storageHydratedRef.current) return;
    if (!categories.length) return;
    if (!activeCategory || !categories.some((c) => c.id === activeCategory)) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    if (!isClientFirebaseEnvReady()) {
      setGroups([]);
      setRawTeams([]);
      setMatches([]);
      setStages([]);
      setCategoryConfig(null);
      setLoading(false);
      return () => {};
    }

    const unsubscribers: Array<() => void> = [];
    setLoading(true);
    if (!activeCategory) {
      setGroups([]);
      setRawTeams([]);
      setMatches([]);
      setStages([]);
      setCategoryConfig(null);
      setLoading(false);
      return () => {};
    }

    const timeoutId = window.setTimeout(() => setLoading(false), 10000);
    const finishLoading = () => {
      window.clearTimeout(timeoutId);
      setLoading(false);
    };

    unsubscribers.push(onSnapshot(query(collection(db(), 'categories', activeCategory, 'groups'), orderBy('name')), (snapshot) => {
      setGroups(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Group)));
      finishLoading();
    }, (error) => {
      logFirestoreSnapshotError(`categories/${activeCategory}/groups`, error);
      setFirestoreError(formatListenError('Помилка читання груп', (error as Error).message));
      finishLoading();
    }));
    unsubscribers.push(onSnapshot(query(collection(db(), 'categories', activeCategory, 'teams')), (snapshot) => {
      setRawTeams(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Team)));
    }, (error) => {
      logFirestoreSnapshotError(`categories/${activeCategory}/teams`, error);
      setFirestoreError(formatListenError('Помилка читання команд', (error as Error).message));
    }));
    unsubscribers.push(onSnapshot(query(collection(db(), 'categories', activeCategory, 'matches')), (snapshot) => {
      setMatches(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Match)));
    }, (error) => {
      logFirestoreSnapshotError(`categories/${activeCategory}/matches`, error);
      setFirestoreError(formatListenError('Помилка читання матчів', (error as Error).message));
    }));
    unsubscribers.push(onSnapshot(query(collection(db(), 'categories', activeCategory, 'stages'), orderBy('order')), (snapshot) => {
      setStages(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Stage)));
    }, (error) => {
      logFirestoreSnapshotError(`categories/${activeCategory}/stages`, error);
      setFirestoreError(formatListenError('Помилка читання етапів', (error as Error).message));
    }));
    unsubscribers.push(onSnapshot(doc(db(), 'categories', activeCategory, 'meta', 'config'), (snapshot) => {
      const data = snapshot.data() as CategoryConfig | undefined;
      setCategoryConfig(data ? { ...DEFAULT_CONFIG, ...data } : defaultConfigFromFormat());
    }, (error) => {
      logFirestoreSnapshotError(`categories/${activeCategory}/meta/config`, error);
      setFirestoreError(formatListenError('Помилка читання конфігурації категорії', (error as Error).message));
    }));

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribers.forEach((u) => u());
    };
  }, [activeCategory]);

  const setCategoryFormat = useCallback(async (format: TournamentFormat) => {
    const categoryId = ensureActiveCategory();
    await tournamentWriteOp('setCategoryFormat', { categoryId, format }, adminWriteSecret);
  }, [ensureActiveCategory, adminWriteSecret]);

  const addGroup = useCallback(async (name: string) => {
    const categoryId = ensureActiveCategory();
    await tournamentWriteOp('addGroup', { categoryId, name: String(name).trim() }, adminWriteSecret);
  }, [ensureActiveCategory, adminWriteSecret]);

  const addTeam = useCallback(async (team: Omit<Team, 'id' | 'played' | 'won' | 'drawn' | 'lost' | 'goalsFor' | 'goalsAgainst' | 'points'>) => {
    const categoryId = ensureActiveCategory();
    if (!groups.some((g) => g.id === team.groupId)) throw new Error('Selected group does not exist.');
    await tournamentWriteOp('addTeam', { categoryId, team: { name: team.name, groupId: team.groupId } }, adminWriteSecret);
  }, [ensureActiveCategory, adminWriteSecret, groups]);

  const addMatch = useCallback(async (match: Omit<Match, 'id'>) => {
    const categoryId = ensureActiveCategory();
    const knownTeams = new Set(rawTeams.map((t) => t.id));
    if (!knownTeams.has(match.homeTeamId) || !knownTeams.has(match.awayTeamId)) throw new Error('Match contains unknown team.');
    await tournamentWriteOp('addMatch', { categoryId, match: { ...match, stageType: match.stageType ?? 'group' } }, adminWriteSecret);
  }, [ensureActiveCategory, adminWriteSecret, rawTeams]);

  const resolveSlot = useCallback((slotLabel: string): Team | null => {
    const byGroup = new Map<string, Team[]>();
    for (const t of teams) {
      const list = byGroup.get(t.groupId) ?? [];
      list.push(t);
      byGroup.set(t.groupId, list);
    }
    const m = slotLabel.match(/^([A-Za-z0-9_-]+)#(\d+)$/);
    if (!m) return null;
    const groupId = m[1];
    const pos = Number(m[2]);
    const ranked = (byGroup.get(groupId) ?? []).sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.name.localeCompare(b.name));
    return ranked[pos - 1] ?? null;
  }, [teams]);

  const rebuildCategory = useCallback(async () => {
    const categoryId = ensureActiveCategory();
    const playoffMatches = matches.filter((m) => m.stageType === 'playoff' || m.stageType === 'placement');
    const updates: Array<{
      matchId: string;
      homeTeamId: string;
      awayTeamId: string;
      homeTeamName: string;
      awayTeamName: string;
    }> = [];
    for (const m of playoffMatches) {
      const hn = m.homeTeamName ?? '';
      const an = m.awayTeamName ?? '';
      const home = hn.startsWith('TBD') ? resolveSlot(hn.replace(/^TBD\s*/, '')) : null;
      const away = an.startsWith('TBD') ? resolveSlot(an.replace(/^TBD\s*/, '')) : null;
      if (home || away) {
        updates.push({
          matchId: m.id,
          homeTeamId: home?.id ?? m.homeTeamId,
          awayTeamId: away?.id ?? m.awayTeamId,
          homeTeamName: home?.name ?? (m.homeTeamName as string) ?? '',
          awayTeamName: away?.name ?? (m.awayTeamName as string) ?? '',
        });
      }
    }
    if (updates.length) await tournamentWriteOp('batchUpdateMatches', { categoryId, updates }, adminWriteSecret);
  }, [ensureActiveCategory, matches, resolveSlot, adminWriteSecret]);

  const updateMatchScore = useCallback(async (matchId: string, homeScore: number, awayScore: number) => {
    const categoryId = ensureActiveCategory();
    await tournamentWriteOp('updateMatchScore', { categoryId, matchId, homeScore, awayScore }, adminWriteSecret);
    await rebuildCategory();
  }, [ensureActiveCategory, adminWriteSecret, rebuildCategory]);

  const addBus = useCallback(async (bus: Omit<Bus, 'id'>) => {
    await tournamentWriteOp('addBus', { bus: { ...bus } }, adminWriteSecret);
  }, [adminWriteSecret]);
  const updateBusLink = useCallback(async (busId: string, liveLink: string) => {
    await tournamentWriteOp('updateBusLink', { busId, liveLink }, adminWriteSecret);
  }, [adminWriteSecret]);
  const addHotel = useCallback(async (hotel: Omit<Hotel, 'id'>) => {
    await tournamentWriteOp('addHotel', { hotel: { ...hotel } }, adminWriteSecret);
  }, [adminWriteSecret]);

  const addCategory = useCallback(async (id: AgeCategory, label?: string) => {
    const safeId = String(id ?? '').trim();
    if (!safeId) throw new Error('Category id is required.');
    if (safeId.includes('/')) throw new Error('ID категорії не може містити символ "/".');
    const trimmedLabel = label !== undefined ? String(label).trim() : '';
    await tournamentWriteOp(
      'addCategory',
      { id: safeId, label: trimmedLabel !== '' ? trimmedLabel : undefined },
      adminWriteSecret,
    );
    const displayLabel = trimmedLabel !== '' ? trimmedLabel : safeId;
    setCategories((prev) => {
      if (prev.some((c) => c.id === safeId)) {
        return prev.map((c) => (c.id === safeId ? { ...c, label: displayLabel } : c));
      }
      return [...prev, { id: safeId as AgeCategory, label: displayLabel }].sort((a, b) =>
        a.label.localeCompare(b.label),
      );
    });
    setActiveCategory(safeId);
  }, [adminWriteSecret]);

  const deleteCategory = useCallback(async (id: AgeCategory) => {
    const safeId = String(id ?? '').trim();
    if (!safeId) throw new Error('Category id is required.');
    await tournamentWriteOp('deleteCategory', { id: safeId }, adminWriteSecret);
  }, [adminWriteSecret]);

  const updateCategory = useCallback(async (currentId: AgeCategory, next: { id: AgeCategory; label?: string }) => {
    const oldId = String(currentId ?? '').trim();
    const newId = String(next.id ?? '').trim();
    if (!oldId || !newId) throw new Error('Category id is required.');
    const nextLabel = String(next.label ?? newId).trim() || newId;
    if (oldId === newId) {
      await tournamentWriteOp('updateCategoryLabel', { oldId, nextLabel }, adminWriteSecret);
      return;
    }
    await tournamentWriteOp('updateCategoryMove', { oldId, newId, nextLabel }, adminWriteSecret);
    if (activeCategory === oldId) setActiveCategory(newId);
  }, [activeCategory, adminWriteSecret]);

  const deleteGroup = useCallback(async (groupId: string) => {
    const categoryId = ensureActiveCategory();
    await tournamentWriteOp('deleteGroup', { categoryId, groupId }, adminWriteSecret);
  }, [ensureActiveCategory, adminWriteSecret]);
  const deleteTeam = useCallback(async (teamId: string) => {
    const categoryId = ensureActiveCategory();
    await tournamentWriteOp('deleteTeam', { categoryId, teamId }, adminWriteSecret);
  }, [ensureActiveCategory, adminWriteSecret]);
  const deleteMatch = useCallback(async (matchId: string) => {
    const categoryId = ensureActiveCategory();
    await tournamentWriteOp('deleteMatch', { categoryId, matchId }, adminWriteSecret);
  }, [ensureActiveCategory, adminWriteSecret]);
  const deleteBus = useCallback(async (busId: string) => {
    await tournamentWriteOp('deleteBus', { busId }, adminWriteSecret);
  }, [adminWriteSecret]);
  const deleteHotel = useCallback(async (hotelId: string) => {
    await tournamentWriteOp('deleteHotel', { hotelId }, adminWriteSecret);
  }, [adminWriteSecret]);

  const generatePlayoffTemplate = useCallback(async (template: 'round_robin' | 'groups_semifinals' | 'groups_quarterfinals', opts?: { clearPlayoff?: boolean }) => {
    const categoryId = ensureActiveCategory();
    await tournamentWriteOp(
      'generatePlayoffTemplate',
      { categoryId, template, clearPlayoff: Boolean(opts?.clearPlayoff) },
      adminWriteSecret,
    );
  }, [ensureActiveCategory, adminWriteSecret]);

  const migrateLegacyToCategories = useCallback(async (opts?: { deleteLegacy?: boolean; replaceCategories?: boolean }) => {
    await tournamentWriteOp(
      'migrateLegacyToCategories',
      { deleteLegacy: Boolean(opts?.deleteLegacy), replaceCategories: Boolean(opts?.replaceCategories) },
      adminWriteSecret,
    );
  }, [adminWriteSecret]);

  const importTournament = useCallback(async (data: TournamentImportFileV1, opts?: { replaceExisting?: boolean }) => {
    const replaceExisting = Boolean(opts?.replaceExisting);
    const preview = validateImportTournament(data);
    if (!preview.valid) throw new Error(preview.issues[0] ?? 'Import payload is invalid.');
    const normalized = preview.normalized;
    const targetCategory = normalized.ageCategory;
    await tournamentWriteOp(
      'importTournament',
      { replaceExisting, normalized, summary: preview.summary },
      adminWriteSecret,
    );
    setActiveCategory(targetCategory);
  }, [adminWriteSecret, validateImportTournament]);

  return (
    <TournamentContext.Provider value={{
      activeCategory,
      categories,
      groups,
      teams,
      matches,
      buses,
      hotels,
      stages,
      categoryConfig,
      isAdmin,
      adminWriteSecret,
      loading,
      firestoreError,
      firebaseClientEnv,
      setActiveCategory,
      setIsAdmin,
      setAdminWriteSecret,
      setCategoryFormat,
      addGroup,
      addTeam,
      addMatch,
      updateMatchScore,
      addBus,
      updateBusLink,
      addHotel,
      deleteGroup,
      deleteTeam,
      deleteMatch,
      deleteBus,
      deleteHotel,
      validateImportTournament,
      importTournament,
      rebuildCategory,
      generatePlayoffTemplate,
      migrateLegacyToCategories,
      addCategory,
      deleteCategory,
      updateCategory,
    }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used within TournamentProvider');
  return context;
}
