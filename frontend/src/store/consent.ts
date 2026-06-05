import { create } from 'zustand';

const KEY = 'veloria_cookie_consent';

export interface CookieConsent {
  necessary: true;
  analytics: boolean;
  decided: boolean;
}

interface ConsentStore extends CookieConsent {
  save: (analytics: boolean) => void;
  acceptAll: () => void;
  refuseOptional: () => void;
  hydrate: () => void;
}

function read(): CookieConsent {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CookieConsent>;
      return { necessary: true, analytics: !!parsed.analytics, decided: !!parsed.decided };
    }
  } catch {
    /* ignore */
  }
  return { necessary: true, analytics: false, decided: false };
}

function persist(c: CookieConsent) {
  localStorage.setItem(KEY, JSON.stringify(c));
}

export const useConsentStore = create<ConsentStore>((set) => ({
  necessary: true,
  analytics: false,
  decided: false,
  save: (analytics) => {
    const next: CookieConsent = { necessary: true, analytics, decided: true };
    persist(next);
    set(next);
  },
  acceptAll: () => {
    const next: CookieConsent = { necessary: true, analytics: true, decided: true };
    persist(next);
    set(next);
  },
  refuseOptional: () => {
    const next: CookieConsent = { necessary: true, analytics: false, decided: true };
    persist(next);
    set(next);
  },
  hydrate: () => set(read()),
}));
