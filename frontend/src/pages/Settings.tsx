import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Volume2, Mail, Trash2, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth';
import { toast } from '@/components/ui/toast';
import { apiErrorMessage } from '@/lib/api';

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateSettings = useMutation({
    mutationFn: (patch: { soundEnabled?: boolean; marketingConsent?: boolean }) =>
      api.patch('/users/me/settings', patch),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/users/me'),
    onSuccess: () => {
      toast.success('Compte supprimé');
      logout();
      navigate('/');
    },
    onError: (e) => toast.error('Erreur', apiErrorMessage(e)),
  });

  const setSound = (v: boolean) => {
    patchUser({ soundEnabled: v });
    updateSettings.mutate({ soundEnabled: v });
  };
  const setMarketing = (v: boolean) => {
    patchUser({ marketingConsent: v });
    updateSettings.mutate({ marketingConsent: v });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      <div className="card-surface divide-y divide-white/5">
        <SettingRow icon={Volume2} title="Effets sonores" desc="Sons de gains, jetons et notifications.">
          <Switch checked={user?.soundEnabled ?? false} onCheckedChange={setSound} />
        </SettingRow>
        <SettingRow icon={Mail} title="Communications" desc="Recevoir des messages marketing (optionnel).">
          <Switch checked={user?.marketingConsent ?? false} onCheckedChange={setMarketing} />
        </SettingRow>
      </div>

      <div className="card-surface p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-gold" />
          <h3 className="font-semibold">Confidentialité (RGPD)</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Nous ne collectons que le strict nécessaire : email, pseudo et empreinte du mot de passe.
          Consultez notre{' '}
          <a href="/privacy" className="text-gold hover:underline">
            politique de confidentialité
          </a>
          .
        </p>
        <Button variant="destructive" className="mt-4" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> Supprimer mon compte
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer définitivement votre compte ?</DialogTitle>
            <DialogDescription>
              Vos données personnelles seront anonymisées (droit à l'effacement). Cette action est
              irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending}>
              Oui, supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Volume2;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
