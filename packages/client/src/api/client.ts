/**
 * API client — a thin typed wrapper over the server routes (ARCHITECTURE §5).
 * Cookies carry the session, so every call is `credentials: 'include'`.
 */

import type { Command, RunState, RunSummary } from '@towventure/shared/run';

export type ClassChoice = 'vanguard' | 'duelist' | 'arcanist';

export interface ApiError {
  status: number;
  error: string;
  body?: unknown;
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err: ApiError = { status: res.status, error: data.error ?? res.statusText, body: data };
    throw err;
  }
  return data as T;
}

export interface Account {
  id: string;
  name: string;
  isGuest: boolean;
}
export interface MeResponse {
  account: Account;
  season: number;
  honor: number;
  tier: string;
  activeRunFloor: number | null;
}
export interface RunResponse {
  runId: string;
  state: RunState;
  stateVersion: number;
}
export interface FightResult {
  seed: number;
  winner: 'hero' | 'enemies';
  endTick: number;
  heroHpRemaining: number;
  heroMaxHp: number;
  enemyHpRemaining: number[];
  logHash: number;
}
export interface FightResponse {
  result: FightResult;
  state: RunState;
  stateVersion: number;
  summary: RunSummary | null;
}
export interface LadderRow {
  rank: number;
  name: string;
  honor: number;
  tier: string;
  isSelf: boolean;
}
export interface LadderPage {
  season: number;
  page: number;
  pageSize: number;
  total: number;
  rows: LadderRow[];
  self: LadderRow | null;
}

export const api = {
  register: (name: string, password: string) =>
    req<{ account: Account }>('POST', '/api/auth/register', { name, password }),
  login: (name: string, password: string) =>
    req<{ account: Account }>('POST', '/api/auth/login', { name, password }),
  guest: () => req<{ account: Account }>('POST', '/api/auth/guest', {}),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout'),
  me: () => req<MeResponse>('GET', '/api/me'),

  startRun: (classId: ClassChoice, vows: string[]) =>
    req<RunResponse>('POST', '/api/run/start', { classId, vows }),
  getRun: () => req<{ run: null } | RunResponse>('GET', '/api/run'),
  command: (expectedStateVersion: number, command: Command) =>
    req<{ state: RunState; stateVersion: number }>('POST', '/api/run/command', {
      expectedStateVersion,
      command,
    }),
  fight: (expectedStateVersion: number) =>
    req<FightResponse>('POST', '/api/run/fight/start', { expectedStateVersion }),

  ladder: (page = 0) => req<LadderPage>('GET', `/api/ladders/global?page=${page}`),
};
