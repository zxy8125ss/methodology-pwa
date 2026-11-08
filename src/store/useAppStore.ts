import { create } from 'zustand';
import { subscribeOnline, isOnline } from '../lib/offline';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  theme: ThemeMode;
  online: boolean;
  /** 是否已触发过 PWA 安装提示 */
  installPromptAvailable: boolean;
  /** 全局 toast 消息 */
  toast: { id: number; message: string; kind: 'info' | 'success' | 'error' } | null;

  setTheme: (theme: ThemeMode) => void;
  setOnline: (online: boolean) => void;
  setInstallAvailable: (available: boolean) => void;
  showToast: (message: string, kind?: 'info' | 'success' | 'error') => void;
  clearToast: () => void;
}

const THEME_KEY = 'methodology-theme';

function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', dark);
}

let toastSeq = 0;

export const useAppStore = create<AppState>((set) => ({
  theme: readTheme(),
  online: isOnline(),
  installPromptAvailable: false,
  toast: null,

  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    applyTheme(theme);
    set({ theme });
  },

  setOnline: (online) => set({ online }),
  setInstallAvailable: (installPromptAvailable) => set({ installPromptAvailable }),

  showToast: (message, kind = 'info') => {
    const id = ++toastSeq;
    set({ toast: { id, message, kind } });
    setTimeout(() => {
      set((state) => (state.toast?.id === id ? { toast: null } : state));
    }, 4000);
  },

  clearToast: () => set({ toast: null }),
}));

export function initTheme(): void {
  applyTheme(useAppStore.getState().theme);
}

export function initOnlineWatch(): () => void {
  return subscribeOnline((online) => useAppStore.getState().setOnline(online));
}
