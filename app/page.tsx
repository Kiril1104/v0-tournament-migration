"use client";

import { useState } from 'react';
import { TournamentProvider, useTournament } from '@/context/tournament-context';
import { TournamentHeader } from '@/components/tournament/tournament-header';
import { AdminBar } from '@/components/tournament/admin-bar';
import { BottomNav } from '@/components/tournament/bottom-nav';
import { StandingsSection } from '@/components/tournament/standings-section';
import { ScheduleSection } from '@/components/tournament/schedule-section';
import { BusesSection } from '@/components/tournament/buses-section';
import { HotelsSection } from '@/components/tournament/hotels-section';
import type { TabId } from '@/types/tournament';
import { TournamentAssistant } from '@/components/assistant/tournament-assistant';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Loading tournament...</p>
      </div>
    </div>
  );
}

function FirebaseEnvDiagnostics() {
  const { firebaseClientEnv, firestoreError } = useTournament();
  const show = !firebaseClientEnv.ready || Boolean(firestoreError);
  if (!show) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-xs text-amber-100 space-y-2">
      <p className="font-semibold text-amber-200">Діагностика Firebase (що є у цій збірці)</p>
      <p className="text-amber-100/90">
        Усі шість змінних мають бути «так». Якщо «ні» — додайте в Vercel і зробіть Redeploy (Preview + Production).
      </p>
      <ul className="font-mono text-[11px] space-y-0.5">
        {(Object.entries(firebaseClientEnv.flags) as [string, boolean][]).map(([key, ok]) => (
          <li key={key}>
            {ok ? '✓' : '✗'} {key}
          </li>
        ))}
      </ul>
      {firebaseClientEnv.missingKeys.length > 0 && (
        <p className="text-amber-200/95">
          Не вистачає: {firebaseClientEnv.missingKeys.join(', ')}
        </p>
      )}
    </div>
  );
}

function TournamentApp() {
  const [activeTab, setActiveTab] = useState<TabId>('standings');
  const { loading, firestoreError, activeCategory } = useTournament();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-[#070d18] text-white p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto">
        <TournamentHeader />
        <FirebaseEnvDiagnostics />
        {firestoreError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 whitespace-pre-wrap">
            {firestoreError}
          </div>
        )}
        {!activeCategory && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            No active category selected. Create or select a category to start working with schedules and standings.
          </div>
        )}

        {/* Admin bar */}
        <AdminBar activeTab={activeTab} />

        {/* Content */}
        {activeTab === 'standings' && <StandingsSection />}
        {activeTab === 'schedule' && <ScheduleSection />}
        {activeTab === 'buses' && <BusesSection />}
        {activeTab === 'hotels' && <HotelsSection />}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
      <TournamentAssistant activeTab={activeTab} />
    </div>
  );
}

export default function Page() {
  return (
    <TournamentProvider>
      <TournamentApp />
    </TournamentProvider>
  );
}
