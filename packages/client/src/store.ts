/**
 * Client store (Zustand). Holds the session, the authoritative run state returned
 * by the server, and the pending fight to play back. The Three.js scene lives
 * outside React and reads the same data via this store (ARCHITECTURE §1 UI note).
 */

import type { CodexProgress, Command, RunState } from '@towventure/shared/run';
import { create } from 'zustand';
import {
  api,
  type ApiError,
  type ClassChoice,
  type FeedItem,
  type FightResult,
  type FriendsData,
  type InboxEntry,
  type MeResponse,
  type MerchantData,
  type SkirmishBoard,
  type SkirmishResult,
} from './api/client.js';

export interface FightPlayback {
  result: FightResult;
  preState: RunState; // state before the fight — used to rebuild the sim spec
  postState: RunState; // state after resolution — committed when playback ends
  postVersion: number;
  echoReward: { bounty: number; marks: number } | null; // set when this fight killed an Echo
}

interface Store {
  me: MeResponse | null;
  run: RunState | null;
  version: number;
  view: 'gate' | 'ladder' | 'codex' | 'skirmish' | 'merchant' | 'social';
  playback: FightPlayback | null;
  accountCodex: CodexProgress | null;
  /** The bounty from the most recent Echo kill, shown on the Grave-Copy screen. */
  lastEchoReward: { bounty: number; marks: number } | null;
  skirmishBoard: SkirmishBoard | null;
  skirmishResult: SkirmishResult | null;
  merchant: MerchantData | null;
  friends: FriendsData | null;
  feedItems: FeedItem[];
  inboxItems: InboxEntry[];
  unread: number;
  /** Ephemeral live-toast bodies pushed over SSE (GDD §10). */
  toasts: { id: number; body: string }[];
  settings: Settings;
  settingsOpen: boolean;
  /** A transient Fusion/Zenith ceremony to render (ART_DIRECTION §5); cleared after it plays. */
  ceremony: { star: number; itemId: string } | null;
  busy: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  guest: () => Promise<void>;
  register: (name: string, password: string) => Promise<void>;
  login: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  startRun: (classId?: ClassChoice, vows?: string[]) => Promise<void>;
  startGauntlet: () => Promise<void>;
  cmd: (command: Command) => Promise<void>;
  fight: () => Promise<void>;
  endPlayback: () => void;
  dismissRun: () => void;
  setView: (v: 'gate' | 'ladder' | 'codex' | 'skirmish' | 'merchant' | 'social') => void;
  fetchCodex: () => Promise<void>;
  fetchSkirmish: () => Promise<void>;
  attack: (defenderId: string) => Promise<void>;
  clearSkirmishResult: () => void;
  fetchMerchant: () => Promise<void>;
  buy: (itemId: string) => Promise<void>;
  fetchSocial: () => Promise<void>;
  addFriend: (name: string) => Promise<void>;
  acceptFriend: (requesterId: string) => Promise<void>;
  markInboxRead: () => Promise<void>;
  connectStream: () => void;
  pushToast: (body: string) => void;
  dismissToast: (id: number) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  toggleSettings: (open?: boolean) => void;
  dismissCeremony: () => void;
  clearError: () => void;
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) return (err as ApiError).error;
  return err instanceof Error ? err.message : 'something went wrong';
}

/** Player settings (ART_DIRECTION §7/§9): audio volumes + accessibility. Persisted locally. */
export interface Settings {
  sfxVolume: number; // 0..1
  musicVolume: number; // 0..1
  reducedMotion: boolean;
  colorblind: 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  /** Default fight playback speed (1× or 2×). */
  fightSpeed: number;
}

const DEFAULT_SETTINGS: Settings = {
  sfxVolume: 0.7,
  musicVolume: 0.4,
  reducedMotion: false,
  colorblind: 'off',
  fightSpeed: 1,
};

const SETTINGS_KEY = 'tv_settings';

function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Mirror motion/colorblind prefs onto <html> so the CSS layer can react. */
function applySettingsToDom(s: Settings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.reducedMotion = s.reducedMotion ? 'on' : 'off';
  root.dataset.cb = s.colorblind;
}

/** The highest-★ item across a run's gear + backpack (for the Fusion Ceremony trigger). */
function topStar(state: RunState): { star: number; itemId: string } {
  let best = { star: 0, itemId: '' };
  const consider = (it: { star: number; itemId: string } | null): void => {
    if (it && it.star > best.star) best = { star: it.star, itemId: it.itemId };
  };
  for (const slot of Object.values(state.equipment)) consider(slot);
  for (const it of state.backpack) consider(it);
  return best;
}

// A single live-toast stream (SSE) per session; opened once the account is known.
let stream: EventSource | null = null;
let toastSeq = 0;

export const useStore = create<Store>((set, get) => ({
  me: null,
  run: null,
  version: 0,
  view: 'gate',
  playback: null,
  accountCodex: null,
  lastEchoReward: null,
  skirmishBoard: null,
  skirmishResult: null,
  merchant: null,
  friends: null,
  feedItems: [],
  inboxItems: [],
  unread: 0,
  toasts: [],
  settings: loadSettings(),
  settingsOpen: false,
  ceremony: null,
  busy: false,
  error: null,

  bootstrap: async () => {
    try {
      const me = await api.me();
      set({ me });
      get().connectStream(); // open the live-toast stream once authenticated
      const run = await api.getRun();
      if ('state' in run) set({ run: run.state, version: run.stateVersion });
    } catch {
      // Unauthenticated — stay on the Gate's sign-in.
      set({ me: null });
    }
  },

  guest: async () => {
    set({ busy: true, error: null });
    try {
      await api.guest();
      await get().bootstrap();
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },

  register: async (name, password) => {
    set({ busy: true, error: null });
    try {
      await api.register(name, password);
      await get().bootstrap();
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },

  login: async (name, password) => {
    set({ busy: true, error: null });
    try {
      await api.login(name, password);
      await get().bootstrap();
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },

  logout: async () => {
    await api.logout().catch(() => {});
    stream?.close();
    stream = null;
    set({ me: null, run: null, version: 0, view: 'gate', playback: null, toasts: [] });
  },

  refreshMe: async () => {
    try {
      set({ me: await api.me() });
    } catch {
      /* ignore */
    }
  },

  startRun: async (classId = 'vanguard', vows = []) => {
    set({ busy: true, error: null });
    try {
      const res = await api.startRun(classId, vows);
      set({ run: res.state, version: res.stateVersion, view: 'gate' });
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },

  startGauntlet: async () => {
    set({ busy: true, error: null });
    try {
      const res = await api.gauntletStart();
      set({ run: res.state, version: res.stateVersion, view: 'gate' });
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },

  cmd: async (command) => {
    const { version, run } = get();
    set({ busy: true, error: null });
    try {
      const res = await api.command(version, command);
      set({ run: res.state, version: res.stateVersion });
      // A successful fuse that lifts an item's ★ ceiling triggers the Fusion Ceremony
      // (a bigger set piece at ★5 — the Zenith forge). ART_DIRECTION §5.
      if (command.type === 'fuse' && run) {
        const before = topStar(run);
        const after = topStar(res.state);
        if (after.star > before.star) set({ ceremony: after });
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409 && e.body && typeof e.body === 'object' && 'state' in e.body) {
        const b = e.body as { state: RunState; stateVersion: number };
        set({ run: b.state, version: b.stateVersion, error: 'resynced — try again' });
      } else {
        set({ error: messageOf(err) });
      }
    } finally {
      set({ busy: false });
    }
  },

  fight: async () => {
    const { run, version } = get();
    if (!run) return;
    set({ busy: true, error: null, lastEchoReward: null });
    try {
      const res = await api.fight(version);
      // Keep `run` at the pre-fight state so the diorama can play back; commit after.
      set({
        playback: {
          result: res.result,
          preState: run,
          postState: res.state,
          postVersion: res.stateVersion,
          echoReward: res.echoReward,
        },
      });
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },

  endPlayback: () => {
    const pb = get().playback;
    if (!pb) return;
    set({
      run: pb.postState,
      version: pb.postVersion,
      playback: null,
      lastEchoReward: pb.echoReward,
    });
    // Death banks climb Honor; an Echo kill pays a bounty + Marks — refresh either way.
    if (pb.postState.status === 'dead' || pb.echoReward) void get().refreshMe();
  },

  dismissRun: () => set({ run: null, version: 0, playback: null, view: 'gate' }),
  setView: (view) => set({ view }),
  fetchCodex: async () => {
    try {
      const { codex } = await api.codex();
      set({ accountCodex: codex });
    } catch {
      /* stay with whatever we have */
    }
  },
  fetchSkirmish: async () => {
    try {
      set({ skirmishBoard: await api.skirmish() });
    } catch (err) {
      set({ error: messageOf(err) });
    }
  },
  attack: async (defenderId) => {
    set({ busy: true, error: null });
    try {
      const res = await api.attack(defenderId);
      set({ skirmishResult: res });
      // Honor/Marks moved for both sides; refresh the header + board.
      void get().refreshMe();
      void get().fetchSkirmish();
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },
  clearSkirmishResult: () => set({ skirmishResult: null }),
  fetchSocial: async () => {
    try {
      const [friends, feedRes, inboxRes] = await Promise.all([
        api.friends(),
        api.feed(),
        api.inbox(),
      ]);
      set({
        friends,
        feedItems: feedRes.feed,
        inboxItems: inboxRes.inbox,
        unread: inboxRes.unread,
      });
    } catch (err) {
      set({ error: messageOf(err) });
    }
  },
  addFriend: async (name) => {
    set({ busy: true, error: null });
    try {
      await api.requestFriend(name);
      await get().fetchSocial();
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },
  acceptFriend: async (requesterId) => {
    try {
      await api.acceptFriend(requesterId);
      await get().fetchSocial();
    } catch (err) {
      set({ error: messageOf(err) });
    }
  },
  markInboxRead: async () => {
    try {
      await api.inboxRead();
      set({ unread: 0, inboxItems: get().inboxItems.map((i) => ({ ...i, read: true })) });
    } catch {
      /* ignore */
    }
  },
  connectStream: () => {
    if (stream || typeof EventSource === 'undefined') return;
    try {
      stream = new EventSource('/api/stream', { withCredentials: true });
      stream.addEventListener('toast', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data) as { body: string };
          get().pushToast(data.body);
          set({ unread: get().unread + 1 });
        } catch {
          /* ignore malformed frame */
        }
      });
      stream.onerror = () => {
        /* EventSource auto-reconnects; nothing to do */
      };
    } catch {
      stream = null;
    }
  },
  pushToast: (body) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, body }] });
    setTimeout(() => get().dismissToast(id), 6000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    applySettingsToDom(settings);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* storage full / disabled — settings stay in-memory */
      }
    }
  },
  toggleSettings: (open) => set({ settingsOpen: open ?? !get().settingsOpen }),
  dismissCeremony: () => set({ ceremony: null }),
  fetchMerchant: async () => {
    try {
      set({ merchant: await api.merchant() });
    } catch (err) {
      set({ error: messageOf(err) });
    }
  },
  buy: async (itemId) => {
    set({ busy: true, error: null });
    try {
      await api.buy(itemId);
      void get().refreshMe(); // Marks changed
      await get().fetchMerchant();
    } catch (err) {
      set({ error: messageOf(err) });
    } finally {
      set({ busy: false });
    }
  },
  clearError: () => set({ error: null }),
}));

// Apply persisted accessibility prefs to <html> on load, before the first paint.
applySettingsToDom(useStore.getState().settings);
