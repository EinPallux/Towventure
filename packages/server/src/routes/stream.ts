/**
 * Live toast stream (GDD §10, WS-in-spirit) — Server-Sent Events over plain HTTP, no
 * extra dependency. The browser's EventSource sends the session cookie same-origin;
 * we subscribe the account on the in-process bus and write each event as an SSE frame.
 * Durable notifications are the inbox/feed rows — this is only the live nudge.
 */

import type { FastifyInstance } from 'fastify';
import { subscribe } from '../services/bus.js';
import { requireAccount, type AppContext } from './helpers.js';

const HEARTBEAT_MS = 25_000;

export function streamRoutes(ctx: AppContext) {
  void ctx;
  return async (fastify: FastifyInstance): Promise<void> => {
    fastify.get('/stream', async (req, reply) => {
      const account = requireAccount(req, reply);
      if (!account) return;

      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(`event: ready\ndata: {}\n\n`);

      const unsubscribe = subscribe(account.id, (event) => {
        res.write(`event: toast\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => res.write(`: keep-alive\n\n`), HEARTBEAT_MS);

      req.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        res.end();
      });
    });
  };
}
