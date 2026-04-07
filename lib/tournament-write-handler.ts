import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { Match, TournamentFormat, TournamentImportFileV1 } from '@/types/tournament';

const DEFAULT_CONFIG = {
  format: 'round_robin' as TournamentFormat,
  tiebreakRules: ['points', 'goalDifference', 'goalsFor'] as const,
  autoGeneratePlayoff: true,
};

/** Root-level groups/teams/matches before category-scoped paths (unknown fields). */
type LegacyRootDoc = { id: string } & Record<string, unknown>;

function defaultConfigFromFormat(format?: TournamentFormat) {
  return { ...DEFAULT_CONFIG, format: format ?? 'round_robin' };
}

async function ensureCategoryDoc(db: Firestore, categoryId: string, label?: string) {
  const ref = db.collection('categories').doc(categoryId);
  await ref.set({ label: label ?? categoryId }, { merge: true });
  await ref.collection('meta').doc('config').set(defaultConfigFromFormat(), { merge: true });
}

export async function runTournamentWriteOp(db: Firestore, op: string, payload: Record<string, unknown>): Promise<void> {
  switch (op) {
    case 'setCategoryFormat': {
      const categoryId = String(payload.categoryId ?? '');
      const format = payload.format as TournamentFormat;
      if (!categoryId) throw new Error('categoryId required');
      await ensureCategoryDoc(db, categoryId);
      await db.collection('categories').doc(categoryId).collection('meta').doc('config').set({ format }, { merge: true });
      return;
    }
    case 'addGroup': {
      const categoryId = String(payload.categoryId ?? '');
      const name = String(payload.name ?? '').trim();
      if (!categoryId || !name) throw new Error('categoryId and name required');
      await ensureCategoryDoc(db, categoryId);
      const col = db.collection('categories').doc(categoryId).collection('groups');
      const ref = col.doc();
      await ref.set({ id: ref.id, name });
      return;
    }
    case 'addTeam': {
      const categoryId = String(payload.categoryId ?? '');
      const team = payload.team as Record<string, unknown>;
      if (!categoryId || !team?.groupId || !team?.name) throw new Error('Invalid team payload');
      await ensureCategoryDoc(db, categoryId);
      const col = db.collection('categories').doc(categoryId).collection('teams');
      const ref = col.doc();
      await ref.set({
        id: ref.id,
        name: String(team.name),
        groupId: String(team.groupId),
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      });
      return;
    }
    case 'addMatch': {
      const categoryId = String(payload.categoryId ?? '');
      const match = payload.match as Record<string, unknown>;
      if (!categoryId || !match) throw new Error('Invalid match payload');
      await ensureCategoryDoc(db, categoryId);
      const col = db.collection('categories').doc(categoryId).collection('matches');
      const ref = col.doc();
      await ref.set({
        id: ref.id,
        stageType: match.stageType ?? 'group',
        ...match,
      });
      return;
    }
    case 'updateMatchScore': {
      const categoryId = String(payload.categoryId ?? '');
      const matchId = String(payload.matchId ?? '');
      const homeScore = Number(payload.homeScore);
      const awayScore = Number(payload.awayScore);
      if (!categoryId || !matchId) throw new Error('categoryId and matchId required');
      await db.collection('categories').doc(categoryId).collection('matches').doc(matchId).update({
        homeScore,
        awayScore,
        status: 'completed',
      });
      return;
    }
    case 'batchUpdateMatches': {
      const categoryId = String(payload.categoryId ?? '');
      const updates = payload.updates as Array<{
        matchId: string;
        homeTeamId: string;
        awayTeamId: string;
        homeTeamName: string;
        awayTeamName: string;
      }>;
      if (!categoryId || !Array.isArray(updates) || !updates.length) return;
      const batch = db.batch();
      for (const u of updates) {
        const ref = db.collection('categories').doc(categoryId).collection('matches').doc(u.matchId);
        batch.update(ref, {
          homeTeamId: u.homeTeamId,
          awayTeamId: u.awayTeamId,
          homeTeamName: u.homeTeamName,
          awayTeamName: u.awayTeamName,
        });
      }
      await batch.commit();
      return;
    }
    case 'addBus': {
      const bus = payload.bus as Record<string, unknown>;
      await db.collection('buses').add(bus);
      return;
    }
    case 'updateBusLink': {
      const busId = String(payload.busId ?? '');
      const liveLink = String(payload.liveLink ?? '');
      await db.collection('buses').doc(busId).update({ liveLink });
      return;
    }
    case 'addHotel': {
      const hotel = payload.hotel as Record<string, unknown>;
      await db.collection('hotels').add(hotel);
      return;
    }
    case 'deleteGroup': {
      const categoryId = String(payload.categoryId ?? '');
      const groupId = String(payload.groupId ?? '');
      if (!categoryId || !groupId) throw new Error('categoryId and groupId required');
      const cat = db.collection('categories').doc(categoryId);
      const [teamsSnap, matchesSnap] = await Promise.all([
        cat.collection('teams').where('groupId', '==', groupId).get(),
        cat.collection('matches').where('groupId', '==', groupId).get(),
      ]);
      const dels: DocumentReference[] = [
        cat.collection('groups').doc(groupId),
        ...teamsSnap.docs.map((d) => d.ref),
        ...matchesSnap.docs.map((d) => d.ref),
      ];
      for (let i = 0; i < dels.length; i += 400) {
        const batch = db.batch();
        for (const r of dels.slice(i, i + 400)) batch.delete(r);
        await batch.commit();
      }
      return;
    }
    case 'deleteTeam': {
      const categoryId = String(payload.categoryId ?? '');
      const teamId = String(payload.teamId ?? '');
      await db.collection('categories').doc(categoryId).collection('teams').doc(teamId).delete();
      return;
    }
    case 'deleteMatch': {
      const categoryId = String(payload.categoryId ?? '');
      const matchId = String(payload.matchId ?? '');
      await db.collection('categories').doc(categoryId).collection('matches').doc(matchId).delete();
      return;
    }
    case 'deleteBus': {
      await db.collection('buses').doc(String(payload.busId ?? '')).delete();
      return;
    }
    case 'deleteHotel': {
      await db.collection('hotels').doc(String(payload.hotelId ?? '')).delete();
      return;
    }
    case 'addCategory': {
      const safeId = String(payload.id ?? '').trim();
      const label = payload.label !== undefined ? String(payload.label).trim() : '';
      if (!safeId) throw new Error('Category id is required');
      const ref = db.collection('categories').doc(safeId);
      const snap = await ref.get();
      if (snap.exists) throw new Error(`Category "${safeId}" already exists.`);
      await ref.set({ label: label || safeId }, { merge: true });
      await ref.collection('meta').doc('config').set(defaultConfigFromFormat(), { merge: true });
      return;
    }
    case 'deleteCategory': {
      const safeId = String(payload.id ?? '').trim();
      if (!safeId) throw new Error('Category id is required');
      const cat = db.collection('categories').doc(safeId);
      const [groupsSnap, teamsSnap, matchesSnap, stagesSnap, metaSnap] = await Promise.all([
        cat.collection('groups').get(),
        cat.collection('teams').get(),
        cat.collection('matches').get(),
        cat.collection('stages').get(),
        cat.collection('meta').get(),
      ]);
      const refs = [...groupsSnap.docs, ...teamsSnap.docs, ...matchesSnap.docs, ...stagesSnap.docs, ...metaSnap.docs].map((d) => d.ref);
      for (let i = 0; i < refs.length; i += 400) {
        const batch = db.batch();
        for (const r of refs.slice(i, i + 400)) batch.delete(r);
        await batch.commit();
      }
      await cat.delete();
      return;
    }
    case 'updateCategoryLabel': {
      const oldId = String(payload.oldId ?? '').trim();
      const nextLabel = String(payload.nextLabel ?? '').trim();
      if (!oldId) throw new Error('oldId required');
      await db.collection('categories').doc(oldId).set({ label: nextLabel || oldId }, { merge: true });
      return;
    }
    case 'updateCategoryMove': {
      const oldId = String(payload.oldId ?? '').trim();
      const newId = String(payload.newId ?? '').trim();
      const nextLabel = String(payload.nextLabel ?? '').trim() || newId;
      if (!oldId || !newId) throw new Error('oldId and newId required');
      const newRef = db.collection('categories').doc(newId);
      if ((await newRef.get()).exists) throw new Error(`Category "${newId}" already exists.`);
      const oldRef = db.collection('categories').doc(oldId);
      const [groupsSnap, teamsSnap, matchesSnap, stagesSnap, metaSnap] = await Promise.all([
        oldRef.collection('groups').get(),
        oldRef.collection('teams').get(),
        oldRef.collection('matches').get(),
        oldRef.collection('stages').get(),
        oldRef.collection('meta').get(),
      ]);
      const setOps: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [
        { ref: newRef, data: { label: nextLabel } },
      ];
      for (const d of groupsSnap.docs) setOps.push({ ref: newRef.collection('groups').doc(d.id), data: d.data() });
      for (const d of teamsSnap.docs) setOps.push({ ref: newRef.collection('teams').doc(d.id), data: d.data() });
      for (const d of matchesSnap.docs) setOps.push({ ref: newRef.collection('matches').doc(d.id), data: d.data() });
      for (const d of stagesSnap.docs) setOps.push({ ref: newRef.collection('stages').doc(d.id), data: d.data() });
      for (const d of metaSnap.docs) setOps.push({ ref: newRef.collection('meta').doc(d.id), data: d.data() });
      for (let i = 0; i < setOps.length; i += 400) {
        const batch = db.batch();
        for (const o of setOps.slice(i, i + 400)) batch.set(o.ref, o.data, { merge: true });
        await batch.commit();
      }
      await runTournamentWriteOp(db, 'deleteCategory', { id: oldId });
      return;
    }
    case 'generatePlayoffTemplate': {
      const categoryId = String(payload.categoryId ?? '');
      const template = payload.template as 'round_robin' | 'groups_semifinals' | 'groups_quarterfinals';
      const clearPlayoff = Boolean(payload.clearPlayoff);
      if (!categoryId) throw new Error('categoryId required');
      await ensureCategoryDoc(db, categoryId);
      const cat = db.collection('categories').doc(categoryId);
      if (clearPlayoff) {
        const existing = await cat.collection('matches').get();
        const toDel = existing.docs.filter((d) => {
          const data = d.data() as Match;
          return data.stageType === 'playoff' || data.stageType === 'placement';
        });
        for (let i = 0; i < toDel.length; i += 400) {
          const b = db.batch();
          for (const d of toDel.slice(i, i + 400)) b.delete(d.ref);
          await b.commit();
        }
      }
      if (template === 'groups_semifinals') {
        const b = db.batch();
        const stageRef = cat.collection('stages').doc('playoff-main');
        b.set(stageRef, { id: 'playoff-main', name: 'Playoff', type: 'playoff', order: 2 });
        const m1 = cat.collection('matches').doc();
        const m2 = cat.collection('matches').doc();
        const m3 = cat.collection('matches').doc();
        b.set(m1, { id: m1.id, groupId: 'playoff', stageId: 'playoff-main', stageType: 'playoff', homeTeamId: '', awayTeamId: '', homeTeamName: 'TBD A#1', awayTeamName: 'TBD B#2', homeScore: null, awayScore: null, date: '', time: '', venue: 'Semifinal 1', status: 'scheduled' });
        b.set(m2, { id: m2.id, groupId: 'playoff', stageId: 'playoff-main', stageType: 'playoff', homeTeamId: '', awayTeamId: '', homeTeamName: 'TBD B#1', awayTeamName: 'TBD A#2', homeScore: null, awayScore: null, date: '', time: '', venue: 'Semifinal 2', status: 'scheduled' });
        b.set(m3, { id: m3.id, groupId: 'playoff', stageId: 'playoff-main', stageType: 'playoff', homeTeamId: '', awayTeamId: '', homeTeamName: 'Winner SF1', awayTeamName: 'Winner SF2', homeScore: null, awayScore: null, date: '', time: '', venue: 'Final', status: 'scheduled' });
        await b.commit();
      } else if (template === 'groups_quarterfinals') {
        const b = db.batch();
        const stageRef = cat.collection('stages').doc('playoff-main');
        b.set(stageRef, { id: 'playoff-main', name: 'Playoff', type: 'playoff', order: 2 });
        const labels = [['A#1', 'D#2'], ['B#1', 'C#2'], ['C#1', 'B#2'], ['D#1', 'A#2']] as const;
        for (const [home, away] of labels) {
          const m = cat.collection('matches').doc();
          b.set(m, { id: m.id, groupId: 'playoff', stageId: 'playoff-main', stageType: 'playoff', homeTeamId: '', awayTeamId: '', homeTeamName: `TBD ${home}`, awayTeamName: `TBD ${away}`, homeScore: null, awayScore: null, date: '', time: '', venue: 'Quarterfinal', status: 'scheduled' });
        }
        await b.commit();
      }
      await cat.collection('meta').doc('config').set({ format: template }, { merge: true });
      return;
    }
    case 'importTournament': {
      const replaceExisting = Boolean(payload.replaceExisting);
      const normalized = payload.normalized as TournamentImportFileV1;
      if (!normalized?.ageCategory) throw new Error('Invalid import payload');
      const targetCategory = normalized.ageCategory;
      await ensureCategoryDoc(db, targetCategory, targetCategory);
      const cat = db.collection('categories').doc(targetCategory);
      if (replaceExisting) {
        const [groupsSnap, teamsSnap, matchesSnap, stagesSnap] = await Promise.all([
          cat.collection('groups').get(),
          cat.collection('teams').get(),
          cat.collection('matches').get(),
          cat.collection('stages').get(),
        ]);
        const refs = [...groupsSnap.docs, ...teamsSnap.docs, ...matchesSnap.docs, ...stagesSnap.docs].map((d) => d.ref);
        for (let i = 0; i < refs.length; i += 400) {
          const b = db.batch();
          for (const r of refs.slice(i, i + 400)) b.delete(r);
          await b.commit();
        }
      }
      const ops: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
      for (const g of normalized.groups) ops.push({ ref: cat.collection('groups').doc(g.id), data: { id: g.id, name: g.name } });
      for (const t of normalized.teams) {
        ops.push({
          ref: cat.collection('teams').doc(t.id),
          data: { id: t.id, name: t.name, groupId: t.groupId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 },
        });
      }
      for (const m of normalized.matches) {
        ops.push({
          ref: cat.collection('matches').doc(m.id),
          data: {
            id: m.id,
            groupId: m.groupId,
            stageId: m.stageId ?? (m.stageType === 'group' ? 'group-stage' : 'playoff-main'),
            stageType: m.stageType ?? 'group',
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeTeamName: normalized.teams.find((t) => t.id === m.homeTeamId)?.name ?? '',
            awayTeamName: normalized.teams.find((t) => t.id === m.awayTeamId)?.name ?? '',
            homeScore: m.homeScore ?? null,
            awayScore: m.awayScore ?? null,
            date: m.date,
            time: m.time,
            venue: m.venue,
            status: m.status ?? 'scheduled',
          },
        });
      }
      ops.push({ ref: cat.collection('stages').doc('group-stage'), data: { id: 'group-stage', name: 'Group stage', type: 'group', order: 1 } });
      if (normalized.format !== 'round_robin') {
        ops.push({ ref: cat.collection('stages').doc('playoff-main'), data: { id: 'playoff-main', name: 'Playoff', type: 'playoff', order: 2 } });
      }
      ops.push({
        ref: cat.collection('meta').doc('config'),
        data: {
          format: normalized.format ?? 'round_robin',
          tiebreakRules: [...DEFAULT_CONFIG.tiebreakRules],
          autoGeneratePlayoff: true,
          lastImportAt: new Date().toISOString(),
          lastImportSummary: String(payload.summary ?? ''),
        },
      });
      for (let i = 0; i < ops.length; i += 400) {
        const b = db.batch();
        for (const o of ops.slice(i, i + 400)) b.set(o.ref, o.data, { merge: true });
        await b.commit();
      }
      return;
    }
    case 'migrateLegacyToCategories': {
      const deleteLegacy = Boolean(payload.deleteLegacy);
      const replaceCategories = Boolean(payload.replaceCategories);
      const [groupsSnap, teamsSnap, matchesSnap] = await Promise.all([
        db.collection('groups').get(),
        db.collection('teams').get(),
        db.collection('matches').get(),
      ]);
      const legacyGroups: LegacyRootDoc[] = groupsSnap.docs.map((d): LegacyRootDoc => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
      const legacyTeams: LegacyRootDoc[] = teamsSnap.docs.map((d): LegacyRootDoc => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
      const legacyMatches: LegacyRootDoc[] = matchesSnap.docs.map((d): LegacyRootDoc => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      }));
      const categoriesSet = new Set<string>();
      for (const g of legacyGroups) if (g.ageGroup) categoriesSet.add(String(g.ageGroup));
      for (const t of legacyTeams) if (t.ageGroup) categoriesSet.add(String(t.ageGroup));
      for (const m of legacyMatches) if (m.ageGroup) categoriesSet.add(String(m.ageGroup));
      const found = Array.from(categoriesSet.values());
      if (!found.length) return;
      for (const cat of found) {
        await ensureCategoryDoc(db, cat, cat);
        const cref = db.collection('categories').doc(cat);
        if (replaceCategories) {
          const [gSnap, tSnap, mSnap] = await Promise.all([cref.collection('groups').get(), cref.collection('teams').get(), cref.collection('matches').get()]);
          const refs = [...gSnap.docs, ...tSnap.docs, ...mSnap.docs].map((d) => d.ref);
          for (let i = 0; i < refs.length; i += 400) {
            const b = db.batch();
            for (const r of refs.slice(i, i + 400)) b.delete(r);
            await b.commit();
          }
        }
        const setOps: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];
        for (const g of legacyGroups) {
          if (String(g.ageGroup) !== cat) continue;
          setOps.push({ ref: cref.collection('groups').doc(String(g.id)), data: { id: g.id, name: g.name } });
        }
        for (const t of legacyTeams) {
          if (String(t.ageGroup) !== cat) continue;
          setOps.push({
            ref: cref.collection('teams').doc(String(t.id)),
            data: {
              id: t.id,
              name: t.name,
              groupId: t.groupId,
              played: t.played ?? 0,
              won: t.won ?? 0,
              drawn: t.drawn ?? 0,
              lost: t.lost ?? 0,
              goalsFor: t.goalsFor ?? 0,
              goalsAgainst: t.goalsAgainst ?? 0,
              points: t.points ?? 0,
            },
          });
        }
        for (const m of legacyMatches) {
          if (String(m.ageGroup) !== cat) continue;
          setOps.push({
            ref: cref.collection('matches').doc(String(m.id)),
            data: {
              id: m.id,
              groupId: m.groupId,
              homeTeamId: m.homeTeamId,
              awayTeamId: m.awayTeamId,
              homeTeamName: m.homeTeamName ?? '',
              awayTeamName: m.awayTeamName ?? '',
              homeScore: m.homeScore ?? null,
              awayScore: m.awayScore ?? null,
              date: m.date,
              time: m.time,
              venue: m.venue,
              status: m.status ?? 'scheduled',
            },
          });
        }
        for (let i = 0; i < setOps.length; i += 400) {
          const b = db.batch();
          for (const o of setOps.slice(i, i + 400)) b.set(o.ref, o.data, { merge: true });
          await b.commit();
        }
      }
      if (deleteLegacy) {
        const refs = [...legacyGroups.map((g) => db.collection('groups').doc(String(g.id))), ...legacyTeams.map((t) => db.collection('teams').doc(String(t.id))), ...legacyMatches.map((m) => db.collection('matches').doc(String(m.id)))];
        for (let i = 0; i < refs.length; i += 400) {
          const b = db.batch();
          for (const r of refs.slice(i, i + 400)) b.delete(r);
          await b.commit();
        }
      }
      return;
    }
    default:
      throw new Error(`Unknown op: ${op}`);
  }
}
