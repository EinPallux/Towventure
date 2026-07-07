import { useEffect, useState } from 'react';
import { useStore } from '../store.js';

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function Social() {
  const setView = useStore((s) => s.setView);
  const friends = useStore((s) => s.friends);
  const feedItems = useStore((s) => s.feedItems);
  const inboxItems = useStore((s) => s.inboxItems);
  const fetchSocial = useStore((s) => s.fetchSocial);
  const addFriend = useStore((s) => s.addFriend);
  const accept = useStore((s) => s.acceptFriend);
  const markRead = useStore((s) => s.markInboxRead);
  const busy = useStore((s) => s.busy);
  const [name, setName] = useState('');

  useEffect(() => {
    void fetchSocial();
    void markRead();
  }, [fetchSocial, markRead]);

  return (
    <div className="col grow" style={{ overflow: 'auto', padding: 12, gap: 12 }}>
      <div className="card row spread">
        <div className="title">Friends & Feed</div>
        <button className="small ghost" onClick={() => setView('gate')}>
          Back
        </button>
      </div>

      <div className="card col" style={{ gap: 8 }}>
        <div className="title" style={{ fontSize: 15 }}>
          Add a friend
        </div>
        <div className="row" style={{ gap: 6 }}>
          <input
            placeholder="climber name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name && (void addFriend(name), setName(''))}
          />
          <button
            className="primary small"
            disabled={busy || !name}
            onClick={() => {
              void addFriend(name);
              setName('');
            }}
          >
            Request
          </button>
        </div>
        {friends?.incoming.map((r) => (
          <div key={r.id} className="row spread">
            <span>{r.name} wants to be friends</span>
            <button className="small" onClick={() => void accept(r.id)}>
              Accept
            </button>
          </div>
        ))}
        {friends && friends.friends.length === 0 && friends.incoming.length === 0 && (
          <div className="muted" style={{ fontSize: 12 }}>
            No friends yet. Add a climber by name to see their feed.
          </div>
        )}
        {friends?.friends.map((f) => (
          <div key={f.id} className="row spread">
            <span>{f.name}</span>
            <span className="muted" style={{ fontSize: 12 }}>
              {f.tier} · {f.honor} Honor
            </span>
          </div>
        ))}
        {friends && friends.outgoing.length > 0 && (
          <div className="muted" style={{ fontSize: 12 }}>
            Pending: {friends.outgoing.map((o) => o.name).join(', ')}
          </div>
        )}
      </div>

      <div className="card col" style={{ gap: 6 }}>
        <div className="title" style={{ fontSize: 15 }}>
          The Feed
        </div>
        {feedItems.length === 0 && (
          <div className="muted" style={{ fontSize: 12 }}>
            Quiet for now. Climb, forge a Zenith, let your Echo hunt — it shows up here.
          </div>
        )}
        {feedItems.map((f, i) => (
          <div key={i} className="row spread">
            <span>
              <strong>{f.name}</strong> {f.body}
            </span>
            <span className="muted" style={{ fontSize: 11 }}>
              {timeAgo(f.at)}
            </span>
          </div>
        ))}
      </div>

      <div className="card col" style={{ gap: 6 }}>
        <div className="title" style={{ fontSize: 15 }}>
          Inbox
        </div>
        {inboxItems.length === 0 && (
          <div className="muted" style={{ fontSize: 12 }}>
            No notifications.
          </div>
        )}
        {inboxItems.map((n) => (
          <div key={n.id} className="row spread">
            <span>{n.body}</span>
            <span className="muted" style={{ fontSize: 11 }}>
              {timeAgo(n.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
