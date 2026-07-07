/**
 * Client store (Zustand). Holds the session, the authoritative run state returned
 * by the server, and the pending fight to play back. The Three.js scene lives
 * outside React and reads the same data via this store (ARCHITECTURE §1 UI note).
 */

import type { Command, RunState } from '@towventure/shared/run';
import { create } from 'zustand';
import {
  api,
  type ApiError,
  type ClassChoice,
  type FightResult,
  type MeResponse,
} from './api/client.js';

export interface FightPlayback {
  result: FightResult;
  preState: RunState; // state before the fight — used to rebuild the sim spec
  postState: RunState; // state after resolution — committed when playback ends
  postVersion: number;
}

interface Store {
  me: MeResponse | null;
  run: RunState | null;
  version: number;
  view: 'gate' | 'ladder';
  playback: FightPlayback | null;
  busy: boolean;
  error: string | null;

  bootstrap: () => Promise<void>;
  guest: () => Promise<void>;
  register: (name: string, password: string) => Promise<void>;
  login: (name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  startRun: (classId?: ClassChoice, vows?: string[]) => Promise<void>;
  cmd: (command: Command) => Promise<void>;
  fight: () => Promise<void>;
  endPlayback: () => void;
  dismissRun: () => void;
  setView: (v: 'gate' | 'ladder') => void;
  clearError: () => void;
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) return (err as ApiError).error;
  return err instanceof Error ? err.message : 'something went wrong';
}

export const useStore = create<Store>((set, get) => ({
  me: null,
  run: null,
  version: 0,
  view: 'gate',
  playback: null,
  busy: false,
  error: null,

  bootstrap: async () => {
    try {
      const me = await api.me();
      set({ me });
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
    set({ me: null, run: null, version: 0, view: 'gate', playback: null });
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

  cmd: async (command) => {
    const { version } = get();
    set({ busy: true, error: null });
    try {
      const res = await api.command(version, command);
      set({ run: res.state, version: res.stateVersion });
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
    set({ busy: true, error: null });
    try {
      const res = await api.fight(version);
      // Keep `run` at the pre-fight state so the diorama can play back; commit after.
      set({
        playback: {
          result: res.result,
          preState: run,
          postState: res.state,
          postVersion: res.stateVersion,
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
    set({ run: pb.postState, version: pb.postVersion, playback: null });
    if (pb.postState.status === 'dead') void get().refreshMe();
  },

  dismissRun: () => set({ run: null, version: 0, playback: null, view: 'gate' }),
  setView: (view) => set({ view }),
  clearError: () => set({ error: null }),
}));
