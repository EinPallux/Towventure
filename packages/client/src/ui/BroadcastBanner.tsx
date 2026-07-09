/**
 * The live broadcast banner (OPERATIONS §6) — every signed-in client polls the public
 * `GET /api/broadcast` and shows the operator's message ("Season ends in 24h") until it
 * is cleared or expires. No auth, no state in the store; a self-contained poller.
 */

import { useEffect, useState } from 'react';
import { api, type PublicBroadcast } from '../api/client.js';

export function BroadcastBanner() {
  const [banner, setBanner] = useState<PublicBroadcast | null>(null);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      api
        .broadcast()
        .then((r) => {
          if (alive) setBanner(r.broadcast);
        })
        .catch(() => {
          /* offline / not signed in — just show nothing */
        });
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!banner) return null;
  return (
    <div className="broadcast-banner" role="status">
      📣 {banner.message}
    </div>
  );
}
