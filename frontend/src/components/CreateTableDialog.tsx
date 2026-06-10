import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useCreateTable, type LobbyTableInfo } from '@/hooks/useTables';
import { apiErrorMessage } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import type { GameType } from '@/types';

export function CreateTableDialog({
  open,
  onOpenChange,
  type,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  type: GameType;
  // Receives the created table so the caller can derive a valid buy-in.
  onCreated: (table: LobbyTableInfo) => void;
}) {
  const create = useCreateTable();
  const isPoker = type === 'POKER';
  const [name, setName] = useState('');
  const [minBet, setMin] = useState(isPoker ? 20 : 10);
  const [maxBet, setMax] = useState(isPoker ? 2000 : 500);
  const [maxSeats, setSeats] = useState(isPoker ? 6 : 5);

  const submit = () => {
    create.mutate(
      {
        type,
        name: name || `Table de ${type === 'POKER' ? 'Poker' : 'Blackjack'}`,
        minBet,
        maxBet,
        maxSeats,
        ...(isPoker ? { smallBlind: Math.max(1, Math.floor(minBet / 2)) } : {}),
      },
      {
        onSuccess: (t) => {
          onOpenChange(false);
          onCreated(t);
        },
        onError: (e) => toast.error('Création impossible', apiErrorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une table {isPoker ? 'Poker' : 'Blackjack'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma table" maxLength={40} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isPoker ? 'Blind / mise min' : 'Mise min'}</Label>
              <Input type="number" value={minBet} onChange={(e) => setMin(+e.target.value)} min={1} />
            </div>
            <div className="space-y-1.5">
              <Label>Mise max</Label>
              <Input type="number" value={maxBet} onChange={(e) => setMax(+e.target.value)} min={minBet} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Sièges max ({isPoker ? '2-9' : '2-6'})</Label>
            <Input
              type="number"
              value={maxSeats}
              onChange={(e) => setSeats(+e.target.value)}
              min={2}
              max={isPoker ? 9 : 6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
