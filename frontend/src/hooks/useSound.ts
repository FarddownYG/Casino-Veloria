import { useCallback } from 'react';
import { useAuthStore } from '@/store/auth';

export type SoundName = 'win' | 'loss' | 'chip' | 'spin' | 'notify' | 'deal';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx = audioCtx ?? new Ctor();
  return audioCtx;
}

/**
 * Lightweight oscillator-based SFX so the app ships without binary assets.
 * Each sound is a tiny synthesized tone; safe to call even if WebAudio is
 * unavailable (it simply no-ops).
 */
function synth(name: SoundName) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(vol, now + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };

  master.gain.setValueAtTime(0.5, now);

  switch (name) {
    case 'win':
      tone(523, 0, 0.18, 'triangle');
      tone(659, 0.12, 0.18, 'triangle');
      tone(784, 0.24, 0.3, 'triangle');
      break;
    case 'loss':
      tone(220, 0, 0.25, 'sawtooth', 0.12);
      tone(160, 0.12, 0.3, 'sawtooth', 0.1);
      break;
    case 'chip':
      tone(880, 0, 0.06, 'square', 0.08);
      break;
    case 'spin':
      tone(440, 0, 0.5, 'sine', 0.06);
      break;
    case 'notify':
      tone(660, 0, 0.1, 'sine');
      tone(880, 0.08, 0.12, 'sine');
      break;
    case 'deal':
      tone(330, 0, 0.05, 'square', 0.06);
      break;
  }
}

export function useSound() {
  const soundEnabled = useAuthStore((s) => s.user?.soundEnabled ?? false);

  const play = useCallback(
    (name: SoundName) => {
      // Mute by default unless the user has explicitly enabled sound.
      if (!soundEnabled) return;
      try {
        synth(name);
      } catch {
        /* WebAudio unavailable — silently ignore */
      }
    },
    [soundEnabled],
  );

  return { play, soundEnabled };
}
