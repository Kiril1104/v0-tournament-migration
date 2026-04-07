"use client";

import { useState } from 'react';
import { Pencil, Plus, Trophy, Trash2 } from 'lucide-react';
import { useTournament } from '@/context/tournament-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Group, Team } from '@/types/tournament';

function StandingsTable({ group, teams }: { group: Group; teams: Team[] }) {
  const { isAdmin, deleteTeam, deleteGroup, addTeam, renameGroup } = useTournament();
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [addTeamError, setAddTeamError] = useState('');
  const [showRenameGroup, setShowRenameGroup] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const sortedTeams = [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      setAddTeamError('');
      await addTeam({
        name: newTeamName.trim(),
        groupId: group.id,
      });
      setNewTeamName('');
      setShowAddTeam(false);
    } catch (e) {
      setAddTeamError(e instanceof Error ? e.message : 'Не вдалося додати команду.');
    }
  };

  const openRenameGroup = () => {
    setRenameValue(group.name);
    setRenameError('');
    setShowRenameGroup(true);
  };

  const handleRenameGroup = async () => {
    if (!renameValue.trim()) return;
    try {
      setRenameError('');
      await renameGroup(group.id, renameValue);
      setShowRenameGroup(false);
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Failed to rename group.');
    }
  };

  return (
    <div className="bg-[#0d1f35]/80 border border-cyan-500/30 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-cyan-500/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <Trophy className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="font-bold text-white text-lg">{group.name}</h3>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openRenameGroup} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300">
              <Pencil className="w-3 h-3 mr-1" /> Назва
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddTeam(true)} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300">
              <Plus className="w-3 h-3 mr-1" /> Team
            </Button>
            <Button size="sm" variant="outline" onClick={() => deleteGroup(group.id)} className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-cyan-300/70 uppercase tracking-wider bg-cyan-500/5">
              <th className="text-left py-3 px-4">#</th>
              <th className="text-left py-3 px-4">Team</th>
              <th className="text-center py-3 px-2">P</th>
              <th className="text-center py-3 px-2">W</th>
              <th className="text-center py-3 px-2">D</th>
              <th className="text-center py-3 px-2">L</th>
              <th className="text-center py-3 px-2">GF</th>
              <th className="text-center py-3 px-2">GA</th>
              <th className="text-center py-3 px-2">GD</th>
              <th className="text-center py-3 px-4 text-cyan-400">Pts</th>
              {isAdmin && <th className="py-3 px-2"></th>}
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team, index) => (
              <tr
                key={team.id}
                className={`border-t border-cyan-500/10 transition-colors hover:bg-cyan-500/5 ${
                  index < 2 ? 'bg-cyan-500/5' : ''
                }`}
              >
                <td className="py-3 px-4">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-500 text-yellow-900 shadow-[0_0_10px_rgba(234,179,8,0.5)]' :
                    index === 1 ? 'bg-gray-400 text-gray-900' :
                    'bg-[#1a3a5c] text-gray-400'
                  }`}>
                    {index + 1}
                  </span>
                </td>
                <td className="py-3 px-4 font-semibold text-white">{team.name}</td>
                <td className="py-3 px-2 text-center text-gray-400">{team.played}</td>
                <td className="py-3 px-2 text-center text-green-400 font-medium">{team.won}</td>
                <td className="py-3 px-2 text-center text-yellow-400">{team.drawn}</td>
                <td className="py-3 px-2 text-center text-red-400">{team.lost}</td>
                <td className="py-3 px-2 text-center text-gray-400">{team.goalsFor}</td>
                <td className="py-3 px-2 text-center text-gray-400">{team.goalsAgainst}</td>
                <td className="py-3 px-2 text-center font-medium text-gray-300">
                  {team.goalsFor - team.goalsAgainst >= 0 ? '+' : ''}{team.goalsFor - team.goalsAgainst}
                </td>
                <td className="py-3 px-4 text-center font-bold text-cyan-400 text-lg">{team.points}</td>
                {isAdmin && (
                  <td className="py-3 px-2">
                    <button
                      onClick={() => deleteTeam(team.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {teams.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 11 : 10} className="py-8 text-center text-gray-500">
                  No teams in this group yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showRenameGroup} onOpenChange={setShowRenameGroup}>
        <DialogContent className="bg-[#0d1f35] border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Назва групи</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Нова назва групи"
              value={renameValue}
              onChange={(e) => {
                setRenameValue(e.target.value);
                setRenameError('');
              }}
              className="bg-[#0a1628] border-cyan-500/30 text-white placeholder:text-gray-500"
            />
            {renameError && <p className="text-red-400 text-sm">{renameError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRenameGroup(false)} className="border-cyan-500/30 text-gray-400 hover:text-white">Скасувати</Button>
              <Button onClick={() => void handleRenameGroup()} className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]">Зберегти</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAddTeam}
        onOpenChange={(open) => {
          setShowAddTeam(open);
          if (!open) setAddTeamError('');
        }}
      >
        <DialogContent className="bg-[#0d1f35] border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Команда в «{group.name}»</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Назва команди"
              value={newTeamName}
              onChange={(e) => {
                setNewTeamName(e.target.value);
                setAddTeamError('');
              }}
              className="bg-[#0a1628] border-cyan-500/30 text-white placeholder:text-gray-500"
            />
            {addTeamError && <p className="text-red-400 text-sm">{addTeamError}</p>}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddTeam(false)} className="border-cyan-500/30 text-gray-400 hover:text-white">Скасувати</Button>
              <Button type="button" onClick={() => void handleAddTeam()} className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]">Додати</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function StandingsSection() {
  const { groups, teams, isAdmin, addGroup } = useTournament();
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [addGroupError, setAddGroupError] = useState('');

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      setAddGroupError('');
      await addGroup(newGroupName);
      setNewGroupName('');
      setShowAddGroup(false);
    } catch (e) {
      setAddGroupError(e instanceof Error ? e.message : 'Failed to add group.');
    }
  };

  return (
    <div className="space-y-6">
      {groups.length === 0 ? (
        <div className="text-center py-16 bg-[#0d1f35]/80 border border-cyan-500/30 rounded-2xl">
          <Trophy className="w-14 h-14 text-cyan-500/50 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Ще немає груп у цій категорії.</p>
          {isAdmin && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                type="button"
                onClick={() => {
                  setAddGroupError('');
                  setNewGroupName('');
                  setShowAddGroup(true);
                }}
                className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400"
              >
                Додати групу
              </Button>
              <p className="text-sm text-gray-500">Або скористайтесь кнопкою «Додати групу» в панелі адміна зверху.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6">
          {groups.map(group => (
            <StandingsTable
              key={group.id}
              group={group}
              teams={teams.filter(t => t.groupId === group.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={showAddGroup} onOpenChange={setShowAddGroup}>
        <DialogContent className="bg-[#0d1f35] border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Add Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Group name (e.g., Group A)"
              value={newGroupName}
              onChange={(e) => {
                setNewGroupName(e.target.value);
                setAddGroupError('');
              }}
              className="bg-[#0a1628] border-cyan-500/30 text-white placeholder:text-gray-500"
            />
            {addGroupError && <p className="text-red-400 text-sm">{addGroupError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddGroup(false)} className="border-cyan-500/30 text-gray-400 hover:text-white">Cancel</Button>
              <Button onClick={handleAddGroup} className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]">Add Group</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
