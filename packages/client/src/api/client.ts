/**
 * API client — a thin typed wrapper over the server routes (ARCHITECTURE §5).
 * Cookies carry the session, so every call is `credentials: 'include'`.
 */

import type {
  CodexProgress,
  Command,
  HeroBuild,
  RunState,
  RunSummary,
} from '@towventure/shared/run';

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
  /** Live-ops admin (OPERATIONS §6) — surfaces the Admin panel in the client. */
  isAdmin?: boolean;
}
export interface OwnEcho {
  floor: number;
  kills: number;
  defeats: number;
  expired: boolean;
}
export interface MeResponse {
  account: Account;
  season: number;
  honor: number;
  marks: number;
  /** Lifetime Honor — earned across all seasons, never resets (GDD §11). */
  lifetime: number;
  tier: string;
  /** 0-based Honor tier rank; gates class/Vow unlocks (GDD §7). */
  tierRank: number;
  /** The account's own Echo standing in the tower, if any (GDD §8). */
  echo: OwnEcho | null;
  activeRunFloor: number | null;
}
export interface InboxEntry {
  id: string;
  kind: string;
  body: string;
  read: boolean;
  createdAt: string;
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
  /** Present when this fight killed an Echo — the Honor bounty + Marks paid (GDD §8). */
  echoReward: { bounty: number; marks: number } | null;
}
export type LadderBoard = 'global' | 'weekly' | 'echo-kills' | 'unnumbered' | 'gauntlet';
export type LadderMetric = 'honor' | 'floor' | 'kills';
export interface LadderRow {
  rank: number;
  name: string;
  value: number;
  tier: string | null;
  isSelf: boolean;
}
export interface LadderPage {
  board: string;
  metric: LadderMetric;
  season: number;
  page: number;
  pageSize: number;
  total: number;
  rows: LadderRow[];
  self: LadderRow | null;
}

export interface Rival {
  accountId: string;
  name: string;
  class: string;
  floor: number;
  honor: number;
  band: 'below' | 'even' | 'above';
}
export interface SkirmishBoard {
  board: Rival[];
  tickets: { used: number; cap: number; remaining: number };
  keys: number;
  keysForVault: number;
  defense: { class: string; floor: number; honor: number } | null;
}
export interface DuelSide {
  name: string;
  class: string;
  floor: number;
  build: HeroBuild;
}
export interface SkirmishResult {
  seed: number;
  result: FightResult;
  attacker: DuelSide;
  defender: DuelSide;
  outcome: {
    attackerWon: boolean;
    honorDelta: number;
    keyAwarded: boolean;
    defenderReward: { honor: number; marks: number } | null;
  };
  keys: number;
}

export const api = {
  register: (name: string, password: string) =>
    req<{ account: Account }>('POST', '/api/auth/register', { name, password }),
  login: (name: string, password: string) =>
    req<{ account: Account }>('POST', '/api/auth/login', { name, password }),
  guest: () => req<{ account: Account }>('POST', '/api/auth/guest', {}),
  logout: () => req<{ ok: true }>('POST', '/api/auth/logout'),
  me: () => req<MeResponse>('GET', '/api/me'),
  codex: () => req<{ codex: CodexProgress }>('GET', '/api/me/codex'),

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

  ladder: (board: LadderBoard = 'global', page = 0) =>
    req<LadderPage>('GET', `/api/ladders/${board}?page=${page}`),
  gauntlet: () => req<GauntletInfo>('GET', '/api/gauntlet'),
  gauntletStart: () => req<RunResponse>('POST', '/api/gauntlet/start', {}),

  skirmish: () => req<SkirmishBoard>('GET', '/api/skirmish'),
  attack: (defenderId: string) =>
    req<SkirmishResult>('POST', '/api/skirmish/attack', { defenderId }),

  merchant: () => req<MerchantData>('GET', '/api/merchant'),
  buy: (itemId: string) =>
    req<{ bought: unknown; marks: number; keys: number }>('POST', '/api/merchant/buy', { itemId }),

  friends: () => req<FriendsData>('GET', '/api/friends'),
  requestFriend: (name: string) =>
    req<{ status: string }>('POST', '/api/friends/request', { name }),
  acceptFriend: (requesterId: string) =>
    req<{ ok: true }>('POST', '/api/friends/accept', { requesterId }),
  feed: () => req<{ feed: FeedItem[] }>('GET', '/api/feed'),
  inbox: () => req<{ inbox: InboxEntry[]; unread: number }>('GET', '/api/me/inbox'),
  inboxRead: () => req<{ ok: true }>('POST', '/api/me/inbox/read'),
  season: () => req<SeasonInfo>('GET', '/api/season'),

  /** Public live banner (OPERATIONS §6) — polled by every client. */
  broadcast: () => req<{ broadcast: PublicBroadcast | null }>('GET', '/api/broadcast'),

  // Live-ops admin (OPERATIONS §6). Every call is 404 unless the account is an admin
  // from an allowlisted IP — the client only ever calls these when me.account.isAdmin.
  admin: {
    lookup: (name: string) =>
      req<AdminAccountView>('GET', `/api/admin/account/${encodeURIComponent(name)}`),
    ban: (name: string, reason: string) =>
      req<{ ok: true }>('POST', '/api/admin/ban', { name, reason }),
    unban: (name: string) => req<{ ok: true }>('POST', '/api/admin/unban', { name }),
    echoTakedown: (name: string) =>
      req<{ ok: true; removed: number }>('POST', '/api/admin/echo-takedown', { name }),
    broadcastGet: () => req<{ broadcast: LiveBroadcast | null }>('GET', '/api/admin/broadcast'),
    broadcastSet: (message: string, expiresInHours?: number) =>
      req<{ ok: true }>('POST', '/api/admin/broadcast', { message, expiresInHours }),
    broadcastClear: () => req<{ ok: true }>('POST', '/api/admin/broadcast/clear'),
    contentFlags: () => req<{ flags: ContentFlag[] }>('GET', '/api/admin/content-flags'),
    setContentFlag: (itemId: string, disabled: boolean, reason?: string) =>
      req<{ ok: true }>('POST', '/api/admin/content-flags', { itemId, disabled, reason }),
  },
};

export interface PublicBroadcast {
  message: string;
  expiresAt: string | null;
}
export interface LiveBroadcast extends PublicBroadcast {
  id: string;
  createdAt: string;
}
export interface ContentFlag {
  itemId: string;
  disabled: boolean;
  reason: string | null;
  updatedAt: string;
}
export interface AdminAccountView {
  account: { id: string; name: string; isGuest: boolean; isAdmin: boolean; createdAt: string };
  ban: { id: string; reason: string; createdAt: string } | null;
  season: number;
  honor: number;
  marks: number;
  lifetime: number;
  echo: OwnEcho | null;
  recentRuns: {
    id: string;
    class: string;
    floor: number;
    status: string;
    startedAt: string;
    endedAt: string | null;
  }[];
}

export interface SeasonInfo {
  season: { number: number; startsAt: string; endsAt: string; status: string };
  honor?: number;
  lifetime?: number;
  nextPlacement?: number;
}

export interface FriendSummary {
  id: string;
  name: string;
  tier: string;
  honor: number;
}
export interface FriendsData {
  friends: FriendSummary[];
  incoming: { id: string; name: string }[];
  outgoing: { id: string; name: string }[];
}
export interface FeedItem {
  name: string;
  kind: string;
  body: string;
  at: string;
}

export interface MerchantEntry {
  id: string;
  name: string;
  kind: 'boon' | 'trail' | 'aura' | 'banner' | 'title';
  price: number;
  vault?: boolean;
  boon?: string;
  flavor: string;
  owned: boolean;
  armed: boolean;
  affordable: boolean;
}
export interface MerchantData {
  items: MerchantEntry[];
  marks: number;
  keys: number;
  keysForVault: number;
  armedBoon: string | null;
}
export interface GauntletInfo {
  day: number;
  seed: number;
  classId: string;
  className: string;
  entered: boolean;
  board: LadderPage;
}
