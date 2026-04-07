"use client";

import { useState } from 'react';
import { Bus, Plus, MapPin, Clock, Trash2, ExternalLink, Link2 } from 'lucide-react';
import { useTournament } from '@/context/tournament-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function BusCard({ bus }: { bus: { id: string; name: string; departureTime: string; departureLocation: string; destination: string; notes: string; liveLink: string } }) {
  const { isAdmin, deleteBus, updateBusLink } = useTournament();
  const [editingLink, setEditingLink] = useState(false);
  const [newLink, setNewLink] = useState(bus.liveLink);

  const handleSaveLink = () => {
    updateBusLink(bus.id, newLink);
    setEditingLink(false);
  };

  return (
    <div className="bg-[#0d1f35]/80 border border-cyan-500/20 rounded-2xl p-5 transition-all duration-300 hover:border-cyan-500/40">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
            <Bus className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">{bus.name}</h3>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => deleteBus(bus.id)}
            className="text-gray-500 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-4 h-4 text-cyan-500/70" />
          <span>Departure: <span className="text-white font-medium">{bus.departureTime}</span></span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <MapPin className="w-4 h-4 text-cyan-500/70" />
          <span>From: <span className="text-gray-300">{bus.departureLocation}</span></span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <MapPin className="w-4 h-4 text-green-400" />
          <span>To: <span className="text-green-400 font-medium">{bus.destination}</span></span>
        </div>
        {bus.notes && (
          <p className="text-gray-500 mt-2 text-xs bg-[#0a1628] p-3 rounded-lg border border-cyan-500/10">{bus.notes}</p>
        )}
      </div>

      {/* Live Tracking Section */}
      <div className="mt-4 pt-4 border-t border-cyan-500/20">
        {isAdmin ? (
          <div className="space-y-2">
            <label className="text-xs text-gray-400 flex items-center gap-1">
              <Link2 className="w-3 h-3 text-cyan-500/70" /> Live Tracking Link
            </label>
            {editingLink ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Paste tracking URL..."
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  className="bg-[#0a1628] border-cyan-500/30 text-white text-sm"
                />
                <Button size="sm" onClick={handleSaveLink} className="bg-cyan-500 text-[#0a1628] font-bold hover:bg-cyan-400">Save</Button>
                <Button size="sm" variant="outline" onClick={() => { setEditingLink(false); setNewLink(bus.liveLink); }} className="border-cyan-500/30 text-gray-400">Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={bus.liveLink || 'No link set'}
                  className="bg-[#0a1628]/50 border-cyan-500/20 text-sm text-gray-500"
                />
                <Button size="sm" variant="outline" onClick={() => setEditingLink(true)} className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">Edit</Button>
              </div>
            )}
          </div>
        ) : bus.liveLink ? (
          <a
            href={bus.liveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-4 bg-cyan-500 text-[#0a1628] rounded-xl font-bold text-lg transition-all duration-300 hover:bg-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.5)]"
          >
            <MapPin className="w-6 h-6" />
            Track Bus Live
            <ExternalLink className="w-5 h-5" />
          </a>
        ) : (
          <div className="text-center py-3 text-gray-500 text-sm">
            Live tracking not available
          </div>
        )}
      </div>
    </div>
  );
}

export function BusesSection() {
  const { buses, isAdmin, addBus } = useTournament();
  const [showAddBus, setShowAddBus] = useState(false);
  const [newBus, setNewBus] = useState({
    name: '',
    departureTime: '',
    departureLocation: '',
    destination: '',
    notes: '',
    liveLink: '',
  });

  const handleAddBus = () => {
    if (!newBus.name.trim()) return;
    addBus(newBus);
    setNewBus({ name: '', departureTime: '', departureLocation: '', destination: '', notes: '', liveLink: '' });
    setShowAddBus(false);
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddBus(true)} className="neon-glow">
            <Plus className="w-4 h-4 mr-2" /> Add Bus
          </Button>
        </div>
      )}

      {buses.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Bus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No bus information yet.</p>
          {isAdmin && <p className="text-xs text-muted-foreground mt-1">Add bus schedules for teams.</p>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {buses.map(bus => (
            <BusCard key={bus.id} bus={bus} />
          ))}
        </div>
      )}

      <Dialog open={showAddBus} onOpenChange={setShowAddBus}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Bus</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Bus name (e.g., Team Bus 1)"
              value={newBus.name}
              onChange={(e) => setNewBus({ ...newBus, name: e.target.value })}
              className="bg-secondary border-border"
            />
            <Input
              type="time"
              placeholder="Departure time"
              value={newBus.departureTime}
              onChange={(e) => setNewBus({ ...newBus, departureTime: e.target.value })}
              className="bg-secondary border-border"
            />
            <Input
              placeholder="Departure location"
              value={newBus.departureLocation}
              onChange={(e) => setNewBus({ ...newBus, departureLocation: e.target.value })}
              className="bg-secondary border-border"
            />
            <Input
              placeholder="Destination"
              value={newBus.destination}
              onChange={(e) => setNewBus({ ...newBus, destination: e.target.value })}
              className="bg-secondary border-border"
            />
            <Input
              placeholder="Live tracking link (optional)"
              value={newBus.liveLink}
              onChange={(e) => setNewBus({ ...newBus, liveLink: e.target.value })}
              className="bg-secondary border-border"
            />
            <Textarea
              placeholder="Notes (optional)"
              value={newBus.notes}
              onChange={(e) => setNewBus({ ...newBus, notes: e.target.value })}
              className="bg-secondary border-border"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddBus(false)}>Cancel</Button>
              <Button onClick={handleAddBus} className="neon-glow">Add Bus</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
