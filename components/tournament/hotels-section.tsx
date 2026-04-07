"use client";

import { useState } from 'react';
import { Hotel, Plus, MapPin, Phone, Clock, Trash2 } from 'lucide-react';
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

function HotelCard({ hotel }: { hotel: { id: string; name: string; address: string; phone: string; checkIn: string; checkOut: string; notes: string } }) {
  const { isAdmin, deleteHotel } = useTournament();

  return (
    <div className="bg-card border border-border rounded-2xl p-5 transition-all hover:border-primary/30">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Hotel className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{hotel.name}</h3>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => deleteHotel(hotel.id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="text-foreground">{hotel.address}</span>
        </div>
        {hotel.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4" />
            <a href={`tel:${hotel.phone}`} className="text-primary hover:underline">{hotel.phone}</a>
          </div>
        )}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Check-in: <span className="text-accent font-medium">{hotel.checkIn}</span></span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Check-out: <span className="text-foreground">{hotel.checkOut}</span></span>
          </div>
        </div>
        {hotel.notes && (
          <p className="text-muted-foreground mt-2 text-xs bg-secondary/50 p-2 rounded-lg">{hotel.notes}</p>
        )}
      </div>
    </div>
  );
}

export function HotelsSection() {
  const { hotels, isAdmin, addHotel } = useTournament();
  const [showAddHotel, setShowAddHotel] = useState(false);
  const [newHotel, setNewHotel] = useState({
    name: '',
    address: '',
    phone: '',
    checkIn: '',
    checkOut: '',
    notes: '',
  });

  const handleAddHotel = () => {
    if (!newHotel.name.trim()) return;
    addHotel(newHotel);
    setNewHotel({ name: '', address: '', phone: '', checkIn: '', checkOut: '', notes: '' });
    setShowAddHotel(false);
  };

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setShowAddHotel(true)} className="neon-glow">
            <Plus className="w-4 h-4 mr-2" /> Add Hotel
          </Button>
        </div>
      )}

      {hotels.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Hotel className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hotel information yet.</p>
          {isAdmin && <p className="text-xs text-muted-foreground mt-1">Add hotel details for teams.</p>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {hotels.map(hotel => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      )}

      <Dialog open={showAddHotel} onOpenChange={setShowAddHotel}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Hotel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Hotel name"
              value={newHotel.name}
              onChange={(e) => setNewHotel({ ...newHotel, name: e.target.value })}
              className="bg-secondary border-border"
            />
            <Input
              placeholder="Address"
              value={newHotel.address}
              onChange={(e) => setNewHotel({ ...newHotel, address: e.target.value })}
              className="bg-secondary border-border"
            />
            <Input
              placeholder="Phone number"
              value={newHotel.phone}
              onChange={(e) => setNewHotel({ ...newHotel, phone: e.target.value })}
              className="bg-secondary border-border"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Check-in</label>
                <Input
                  type="time"
                  value={newHotel.checkIn}
                  onChange={(e) => setNewHotel({ ...newHotel, checkIn: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Check-out</label>
                <Input
                  type="time"
                  value={newHotel.checkOut}
                  onChange={(e) => setNewHotel({ ...newHotel, checkOut: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>
            </div>
            <Textarea
              placeholder="Notes (optional)"
              value={newHotel.notes}
              onChange={(e) => setNewHotel({ ...newHotel, notes: e.target.value })}
              className="bg-secondary border-border"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddHotel(false)}>Cancel</Button>
              <Button onClick={handleAddHotel} className="neon-glow">Add Hotel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
