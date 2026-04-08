"use client";

import type { TournamentImportFileV1 } from '@/types/tournament';
import { Input } from '@/components/ui/input';

function patchMatchList(
  data: TournamentImportFileV1,
  index: number,
  patch: Partial<TournamentImportFileV1["matches"][number]>,
): TournamentImportFileV1 {
  const matches = data.matches.map((m, i) => (i === index ? { ...m, ...patch } : m));
  return { ...data, matches };
}

export function ScheduleImportVisualPreview({
  data,
  onChange,
}: {
  data: TournamentImportFileV1;
  onChange: (next: TournamentImportFileV1) => void;
}) {
  const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g.name]));
  const teamById = Object.fromEntries(data.teams.map((t) => [t.id, t]));

  const groupStageMatches = data.matches.filter((m) => m.stageType !== "playoff" && m.groupId !== "playoff");
  const playoffMatches = data.matches.filter((m) => m.stageType === "playoff" || m.groupId === "playoff");

  const indexInAll = (m: TournamentImportFileV1["matches"][number]) => data.matches.findIndex((x) => x.id === m.id);

  const renderMatchRow = (m: TournamentImportFileV1["matches"][number]) => {
    const idx = indexInAll(m);
    if (idx < 0) return null;
    const home = teamById[m.homeTeamId]?.name ?? m.homeTeamId;
    const away = teamById[m.awayTeamId]?.name ?? m.awayTeamId;
    const isPo = m.stageType === "playoff" || m.groupId === "playoff";
    return (
      <tr key={m.id} className="border-b border-cyan-500/15 text-sm">
        <td className="py-2 pr-2 align-top">
          <Input
            className="h-8 text-xs bg-[#0a1628] border-cyan-500/25 text-cyan-50 w-[7.5rem]"
            value={m.date}
            onChange={(e) => onChange(patchMatchList(data, idx, { date: e.target.value.trim() }))}
          />
        </td>
        <td className="py-2 pr-2 align-top">
          <Input
            className="h-8 text-xs bg-[#0a1628] border-cyan-500/25 text-cyan-50 w-[4.5rem]"
            value={m.time}
            onChange={(e) => onChange(patchMatchList(data, idx, { time: e.target.value.trim() }))}
          />
        </td>
        <td className="py-2 pr-2 align-top">
          <Input
            className="h-8 text-xs bg-[#0a1628] border-cyan-500/25 text-cyan-50 min-w-[6rem]"
            value={m.venue}
            onChange={(e) => onChange(patchMatchList(data, idx, { venue: e.target.value }))}
          />
        </td>
        <td className="py-2 pr-2 text-cyan-100/95 max-w-[140px]" title={home}>
          <span className="line-clamp-2">{home}</span>
        </td>
        <td className="py-2 pr-2 text-cyan-100/95 max-w-[140px]" title={away}>
          <span className="line-clamp-2">{away}</span>
        </td>
        <td className="py-2 pr-2 align-top">
          <span className="text-[10px] uppercase tracking-wide text-cyan-400/80 whitespace-nowrap">
            {isPo ? "плей-офф" : groupById[m.groupId] ?? m.groupId}
          </span>
        </td>
        <td className="py-2 align-top">
          <div className="flex gap-1 items-center">
            <Input
              type="number"
              className="h-8 w-11 text-xs bg-[#0a1628] border-cyan-500/25 text-cyan-50"
              value={m.homeScore ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChange(
                  patchMatchList(data, idx, {
                    homeScore: v === "" ? null : Number(v),
                  }),
                );
              }}
            />
            <span className="text-cyan-500/50">:</span>
            <Input
              type="number"
              className="h-8 w-11 text-xs bg-[#0a1628] border-cyan-500/25 text-cyan-50"
              value={m.awayScore ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChange(
                  patchMatchList(data, idx, {
                    awayScore: v === "" ? null : Number(v),
                  }),
                );
              }}
            />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 text-left">
      <div className="rounded-xl border border-cyan-500/25 bg-[#0d1f35]/60 p-4 space-y-2">
        <p className="text-xs text-cyan-300/80 uppercase tracking-wider">Категорія та формат</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-cyan-50">
          <span>
            <span className="text-cyan-400/70">Вік: </span>
            <span className="font-semibold">{data.ageCategory || "—"}</span>
          </span>
          <span>
            <span className="text-cyan-400/70">Формат: </span>
            {data.format ?? "round_robin"}
          </span>
          <span>
            <span className="text-cyan-400/70">Груп: </span>
            {data.groups.length}
          </span>
          <span>
            <span className="text-cyan-400/70">Команд: </span>
            {data.teams.length}
          </span>
          <span>
            <span className="text-cyan-400/70">Матчів: </span>
            {data.matches.length}
          </span>
        </div>
      </div>

      <div>
        <p className="text-xs text-cyan-300/80 uppercase tracking-wider mb-2">Групи та команди</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.groups.map((g) => (
            <div key={g.id} className="rounded-lg border border-cyan-500/20 bg-[#0a1628]/80 p-3">
              <p className="font-semibold text-cyan-200 text-sm mb-2">{g.name}</p>
              <ul className="text-xs text-gray-300 space-y-1">
                {data.teams
                  .filter((t) => t.groupId === g.id)
                  .map((t) => (
                    <li key={t.id}>
                      <span className="text-cyan-500/60">{t.id}</span> {t.name}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {groupStageMatches.length > 0 && (
        <div>
          <p className="text-xs text-cyan-300/80 uppercase tracking-wider mb-2">Груповий етап</p>
          <div className="overflow-x-auto rounded-lg border border-cyan-500/20">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left text-[10px] uppercase text-cyan-400/70 border-b border-cyan-500/20">
                  <th className="py-2 pr-2 pl-3">Дата</th>
                  <th className="py-2 pr-2">Час</th>
                  <th className="py-2 pr-2">Місце</th>
                  <th className="py-2 pr-2">Господарі</th>
                  <th className="py-2 pr-2">Гості</th>
                  <th className="py-2 pr-2">Група</th>
                  <th className="py-2 pr-3">Рахунок</th>
                </tr>
              </thead>
              <tbody>{groupStageMatches.map((m) => renderMatchRow(m))}</tbody>
            </table>
          </div>
        </div>
      )}

      {playoffMatches.length > 0 && (
        <div>
          <p className="text-xs text-amber-300/90 uppercase tracking-wider mb-2">Плей-офф</p>
          <div className="overflow-x-auto rounded-lg border border-amber-500/25">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="text-left text-[10px] uppercase text-amber-400/80 border-b border-amber-500/20">
                  <th className="py-2 pr-2 pl-3">Дата</th>
                  <th className="py-2 pr-2">Час</th>
                  <th className="py-2 pr-2">Місце</th>
                  <th className="py-2 pr-2">Господарі</th>
                  <th className="py-2 pr-2">Гості</th>
                  <th className="py-2 pr-2">Етап</th>
                  <th className="py-2 pr-3">Рахунок</th>
                </tr>
              </thead>
              <tbody>{playoffMatches.map((m) => renderMatchRow(m))}</tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        Дату, час, поле та рахунок можна змінити в таблиці. Назви команд беруться зі списку команд; якщо потрібно змінити склад
        команд — скористайтесь розділом JSON нижче або повторіть витяг з уточненим текстом.
      </p>
    </div>
  );
}
