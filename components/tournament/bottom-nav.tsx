"use client";

import { Calendar, Trophy, Bus, Hotel } from 'lucide-react';
import type { TabId } from '@/types/tournament';

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: typeof Calendar }[] = [
  { id: 'standings', label: 'Standings', icon: Trophy },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'buses', label: 'Buses', icon: Bus },
  { id: 'hotels', label: 'Hotels', icon: Hotel },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#0a1628]/95 backdrop-blur-lg border-t border-cyan-500/30 z-50">
      <div className="max-w-lg mx-auto flex justify-around py-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all duration-300 ${
              active === id
                ? 'text-cyan-400'
                : 'text-gray-400 hover:text-cyan-300'
            }`}
          >
            <Icon className={`w-5 h-5 transition-all ${active === id ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : ''}`} />
            <span className={`text-xs font-medium ${active === id ? 'drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]' : ''}`}>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
