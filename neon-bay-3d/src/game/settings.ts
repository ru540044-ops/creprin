import type { Quality } from './state/store';

/** Player preferences, kept apart from the save game so "start over" never resets them. */
export type QualityMode = 'auto' | Quality;
export const settings = {
  quality: 'auto' as QualityMode,
  master: 0.9, music: 0.7, sfx: 0.9, // 0..1
  sens: 1, // camera sensitivity multiplier (0.4..2)
  invertY: false,
  showFps: false,
  tutorialDone: false,
};
const KEY = 'neonbay3d.settings.v1';
export function loadSettings(hadSave: boolean) {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && typeof s === 'object') {
      if (['auto', 'low', 'medium', 'high'].includes(s.quality)) settings.quality = s.quality;
      for (const k of ['master', 'music', 'sfx'] as const) if (typeof s[k] === 'number') settings[k] = Math.max(0, Math.min(1, s[k]));
      if (typeof s.sens === 'number') settings.sens = Math.max(0.4, Math.min(2, s.sens));
      settings.invertY = !!s.invertY; settings.showFps = !!s.showFps; settings.tutorialDone = !!s.tutorialDone;
      return;
    }
  } catch { /* storage unavailable */ }
  settings.tutorialDone = hadSave; // players from before the tutorial existed do not get it forced on them
}
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ } }
/** Starting quality for 'auto': phones start at medium (the auto-tuner can drop to low), desktops at high. */
export const autoQuality = (touch: boolean): Quality => (touch ? 'medium' : 'high');
