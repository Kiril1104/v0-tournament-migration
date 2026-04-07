"use client";

import { useState } from 'react';
import { Calendar, MapPin, Clock, Plus, Trash2 } from 'lucide-react';
import { useTournament } from '@/context/tournament-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Match } from '@/types/tournament';

function ScoreEditor({ match, onClose }: { match: Match; onClose: () => void }) {
  const { updateMatchScore } = useTournament();
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() || '0');
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() || '0');

  const handleSave = () => {
    updateMatchScore(match.id, parseInt(homeScore) || 0, parseInt(awayScore) || 0);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1f35] border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-cyan-400">Edit Match Score</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4 justify-center">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">{match.homeTeamName}</p>
              <Input
                type="number"
                min="0"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                className="w-20 text-center text-2xl font-bold bg-[#0a1628] border-cyan-500/30 text-white"
              />
            </div>
            <span className="text-2xl text-cyan-400">:</span>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">{match.awayTeamName}</p>
              <Input
                type="number"
                min="0"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                className="w-20 text-center text-2xl font-bold bg-[#0a1628] border-cyan-500/30 text-white"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} className="border-cyan-500/30 text-gray-400 hover:text-white">Cancel</Button>
            <Button onClick={handleSave} className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]">Save Score</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatchCard({ match }: { match: Match }) {
  const { isAdmin, deleteMatch } = useTournament();
  const [editing, setEditing] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <>
      <div
        className={`bg-[#0d1f35]/80 border border-cyan-500/20 rounded-xl p-4 transition-all duration-300 ${
          isAdmin ? 'cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]' : ''
        }`}
        onClick={() => isAdmin && setEditing(true)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3 h-3 text-cyan-500/70" />
            <span>{formatDate(match.date)}</span>
            <Clock className="w-3 h-3 ml-2 text-cyan-500/70" />
            <span>{match.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              match.status === 'completed' ? 'bg-green-500/20 text-green-400' :
              match.status === 'live' ? 'bg-red-500/20 text-red-400 animate-pulse' :
              'bg-cyan-500/10 text-cyan-400/70'
            }`}>
              {match.status}
            </span>
            {match.stageType && match.stageType !== 'group' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-purple-500/20 text-purple-300">
                {match.stageType}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMatch(match.id);
                }}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1 text-right">
            <p className="font-semibold text-white truncate">{match.homeTeamName}</p>
          </div>
          <div className="px-4 py-2 mx-3 bg-[#0a1628] border border-cyan-500/30 rounded-lg min-w-[90px] text-center">
            <span className="text-xl font-bold text-cyan-400">
              {match.homeScore !== null ? `${match.homeScore} : ${match.awayScore}` : 'vs'}
            </span>
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-white truncate">{match.awayTeamName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500 mt-3 justify-center">
          <MapPin className="w-3 h-3 text-cyan-500/50" />
          <span>{match.venue}</span>
        </div>
      </div>

      {editing && <ScoreEditor match={match} onClose={() => setEditing(false)} />}
    </>
  );
}

export function ScheduleSection() {
  const { matches, groups, teams, isAdmin, addMatch } = useTournament();
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [newMatch, setNewMatch] = useState({
    groupId: '',
    homeTeamId: '',
    awayTeamId: '',
    date: '',
    time: '',
    venue: '',
  });

  // Group matches by date
  const matchesByDate = matches.reduce((acc, match) => {
    if (!acc[match.date]) acc[match.date] = [];
    acc[match.date].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const sortedDates = Object.keys(matchesByDate).sort();

  const handleAddMatch = () => {
    const homeTeam = teams.find(t => t.id === newMatch.homeTeamId);
    const awayTeam = teams.find(t => t.id === newMatch.awayTeamId);
    if (!homeTeam || !awayTeam) return;

    addMatch({
      ...newMatch,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
    });
    setShowAddMatch(false);
    setNewMatch({ groupId: '', homeTeamId: '', awayTeamId: '', date: '', time: '', venue: '' });
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddMatch(true)} className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <Plus className="w-4 h-4 mr-2" /> Add Match
          </Button>
        </div>
      )}

      {sortedDates.length === 0 ? (
        <div className="text-center py-16 bg-[#0d1f35]/80 border border-cyan-500/30 rounded-2xl">
          <Calendar className="w-14 h-14 text-cyan-500/50 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No matches scheduled yet.</p>
          {isAdmin && <p className="text-sm text-gray-500 mt-2">Add matches to see them here.</p>}
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date} className="space-y-3">
            <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
              {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <div className="grid gap-3">
              {matchesByDate[date]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map(match => (
                  <MatchCard key={match.id} match={match} />
                ))}
            </div>
          </div>
        ))
      )}

      <Dialog open={showAddMatch} onOpenChange={setShowAddMatch}>
        <DialogContent className="bg-[#0d1f35] border-cyan-500/30">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Add Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              value={newMatch.groupId}
              onChange={(e) => setNewMatch({ ...newMatch, groupId: e.target.value })}
              className="w-full px-3 py-2 bg-[#0a1628] border border-cyan-500/30 rounded-lg text-white"
            >
              <option value="">Select Group</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <select
              value={newMatch.homeTeamId}
              onChange={(e) => setNewMatch({ ...newMatch, homeTeamId: e.target.value })}
              className="w-full px-3 py-2 bg-[#0a1628] border border-cyan-500/30 rounded-lg text-white"
            >
              <option value="">Home Team</option>
              {teams.filter(t => t.groupId === newMatch.groupId).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              value={newMatch.awayTeamId}
              onChange={(e) => setNewMatch({ ...newMatch, awayTeamId: e.target.value })}
              className="w-full px-3 py-2 bg-[#0a1628] border border-cyan-500/30 rounded-lg text-white"
            >
              <option value="">Away Team</option>
              {teams.filter(t => t.groupId === newMatch.groupId && t.id !== newMatch.homeTeamId).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="date"
                value={newMatch.date}
                onChange={(e) => setNewMatch({ ...newMatch, date: e.target.value })}
                className="bg-[#0a1628] border-cyan-500/30 text-white"
              />
              <Input
                type="time"
                value={newMatch.time}
                onChange={(e) => setNewMatch({ ...newMatch, time: e.target.value })}
                className="bg-[#0a1628] border-cyan-500/30 text-white"
              />
            </div>
            <Input
              placeholder="Venue"
              value={newMatch.venue}
              onChange={(e) => setNewMatch({ ...newMatch, venue: e.target.value })}
              className="bg-[#0a1628] border-cyan-500/30 text-white placeholder:text-gray-500"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddMatch(false)} className="border-cyan-500/30 text-gray-400 hover:text-white">Cancel</Button>
              <Button onClick={handleAddMatch} className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]">Add Match</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
