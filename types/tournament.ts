export interface Team {
  id: string;
  name: string;
  groupId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface Match {
  id: string;
  groupId: string;
  stageId?: string;
  stageType?: 'group' | 'playoff' | 'placement';
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  date: string;
  time: string;
  venue: string;
  status: 'scheduled' | 'live' | 'completed';
}

export interface Group {
  id: string;
  name: string;
}

export interface Bus {
  id: string;
  name: string;
  departureTime: string;
  departureLocation: string;
  destination: string;
  notes: string;
  liveLink: string;
}

export interface Hotel {
  id: string;
  name: string;
  address: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  notes: string;
}

export type TabId = 'schedule' | 'standings' | 'buses' | 'hotels';
export type AgeCategory = string;

export type TournamentFormat = 'round_robin' | 'groups_semifinals' | 'groups_quarterfinals';
export type TiebreakRule = 'points' | 'goalDifference' | 'goalsFor' | 'headToHead';

export interface Stage {
  id: string;
  name: string;
  type: 'group' | 'playoff' | 'placement';
  order: number;
}

export interface AdvancementRule {
  stageId: string;
  sourceGroupId: string;
  position: number;
  slotLabel: string;
}

export interface CategoryConfig {
  format: TournamentFormat;
  tiebreakRules: TiebreakRule[];
  autoGeneratePlayoff: boolean;
  lastImportAt?: string;
  lastImportSummary?: string;
}

export interface TournamentImportFileV1 {
  version: 1;
  ageCategory: AgeCategory;
  format?: TournamentFormat;
  groups: Array<{
    id: string;
    name: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
    groupId: string;
  }>;
  matches: Array<{
    id: string;
    groupId: string;
    homeTeamId: string;
    awayTeamId: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    venue: string;
    stageId?: string;
    stageType?: 'group' | 'playoff' | 'placement';
    status?: 'scheduled' | 'live' | 'completed';
    homeScore?: number | null;
    awayScore?: number | null;
  }>;
}
