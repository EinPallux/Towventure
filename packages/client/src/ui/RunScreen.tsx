import { findEvent } from '@towventure/shared/content';
import { activeTorments, tormentLevel } from '@towventure/shared/run';
import { useStore } from '../store.js';
import { HeroPanel } from './HeroPanel.js';
import { Onboarding } from './Onboarding.js';
import { describeItem } from './itemText.js';

/** Past floor 100, the Torment banner names the escalation the tower has stacked on. */
function TormentBanner() {
  const floor = useStore((s) => s.run?.floor ?? 0);
  const level = tormentLevel(floor);
  if (level <= 0) return null;
  const cards = activeTorments(floor);
  return (
    <div className="card col" style={{ margin: '12px 12px 0', gap: 4, borderColor: '#7a3a4a' }}>
      <div className="row spread">
        <div className="title" style={{ fontSize: 15 }}>
          ✷ Torment {level}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          the Crown loops · the tower does not
        </div>
      </div>
      {cards.map((c) => (
        <div key={c.id} className="muted" style={{ fontSize: 12 }}>
          <strong>{c.name}</strong> — {c.blurb}
        </div>
      ))}
    </div>
  );
}

function Doors() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const cmd = useStore((s) => s.cmd);
  return (
    <div className="doors">
      {(run.doors ?? []).map((door, i) => (
        <div
          key={i}
          className={`card door ${door.kind}`}
          onClick={() => !busy && void cmd({ type: 'chooseDoor', doorIndex: i })}
        >
          <div className="kind">{door.kind === 'echo' ? 'echo' : door.kind}</div>
          <div className="title" style={{ fontSize: 18 }}>
            {door.kind === 'boss'
              ? '☗ '
              : door.kind === 'elite'
                ? '✦ '
                : door.kind === 'event'
                  ? '❖ '
                  : door.kind === 'echo'
                    ? '❂ '
                    : ''}
            {door.preview}
          </div>
          {door.kind === 'echo' && door.echo && (
            <div className="muted" style={{ fontSize: 12, fontStyle: 'italic' }}>
              {door.echo.classId} · fell{' '}
              {door.echo.ageDays === 0 ? 'today' : `${door.echo.ageDays}d ago`}
              {door.echo.bonusPct > 0 ? ` · +${door.echo.bonusPct}% fury` : ''}
            </div>
          )}
          <div className="muted grow" />
          <div className="muted">Floor {run.floor}</div>
        </div>
      ))}
    </div>
  );
}

function GraveCopy() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const cmd = useStore((s) => s.cmd);
  const reward = useStore((s) => s.lastEchoReward);
  const opts = run.pendingGraveCopy ?? [];
  return (
    <div className="card col" style={{ margin: 12 }}>
      <div className="row spread">
        <div className="title">❂ Grave-Copy</div>
        <div className="muted">
          {reward
            ? `the Echo falls · +${reward.bounty} Honor · ◈${reward.marks}`
            : 'the Echo falls'}
        </div>
      </div>
      <div className="muted" style={{ fontStyle: 'italic' }}>
        Take one piece of the fallen build — a ★1 copy. The dead lose nothing.
      </div>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        {opts.map((itemId, i) => {
          const info = describeItem(itemId, 1);
          return (
            <button
              key={i}
              className="ghost"
              style={{ textAlign: 'left' }}
              disabled={busy}
              onClick={() => void cmd({ type: 'chooseGraveCopy', index: i })}
            >
              <span className={`r-${info.rarity} item-name`}>{info.name}</span>{' '}
              <span className="muted">— {info.lines[0] ?? info.flavor}</span>
            </button>
          );
        })}
        <button
          className="small ghost"
          disabled={busy}
          onClick={() => void cmd({ type: 'proceed' })}
          title="Claim nothing and climb on"
        >
          Leave them all ↑
        </button>
      </div>
    </div>
  );
}

function Reward() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const cmd = useStore((s) => s.cmd);
  const loot = run.pendingItem ? describeItem(run.pendingItem, 1) : null;
  if (run.pendingGraveCopy) return <GraveCopy />;
  return (
    <div className="card col" style={{ margin: 12 }}>
      <div className="row spread">
        <div className="title">Spoils</div>
        <div className="gold">+{run.lastGold} gold</div>
      </div>
      {loot ? (
        <div className="col">
          <div>
            A drop: <span className={`r-${loot.rarity} item-name`}>{loot.name}</span>
          </div>
          <div className="muted">{loot.lines.join(' · ') || loot.flavor}</div>
          <div className="row">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void cmd({ type: 'takeLoot', take: true })}
            >
              Take it
            </button>
            <button
              className="ghost"
              disabled={busy}
              onClick={() => void cmd({ type: 'takeLoot', take: false })}
            >
              Leave it
            </button>
          </div>
        </div>
      ) : (
        <div className="row">
          <div className="muted grow">Tend your gear, then climb.</div>
          <button className="primary" disabled={busy} onClick={() => void cmd({ type: 'proceed' })}>
            Onward ↑
          </button>
        </div>
      )}
    </div>
  );
}

function Shop() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const cmd = useStore((s) => s.cmd);
  const shop = run.shop;
  if (!shop) return null;
  return (
    <div className="card col" style={{ margin: 12 }}>
      <div className="row spread">
        <div className="title">The Wandering Merchant</div>
        <div className="gold">{run.gold} gold</div>
      </div>
      <div className="backpack">
        {shop.slots.map((slot, i) => {
          const info = describeItem(slot.refId, slot.star);
          const label =
            slot.kind === 'requestedCopy'
              ? 'Requested Copy'
              : slot.kind === 'material'
                ? 'Material'
                : slot.kind === 'consumable'
                  ? 'Consumable'
                  : 'Item';
          return (
            <div key={i} className="bp-item">
              <div className="row spread">
                <span className={`r-${info.rarity} item-name`}>{info.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {label}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {info.lines[0] ?? info.flavor}
              </div>
              <div className="item-actions">
                <button
                  className="small"
                  disabled={busy || slot.sold || run.gold < slot.price}
                  onClick={() => void cmd({ type: 'buy', slotIndex: i })}
                >
                  {slot.sold ? 'Sold' : `Buy · ${slot.price}g`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="row">
        <button
          className="ghost"
          disabled={busy || run.gold < shop.rerollPrice}
          onClick={() => void cmd({ type: 'reroll' })}
        >
          Reroll · {shop.rerollPrice}g
        </button>
        <div className="grow" />
        <button className="primary" disabled={busy} onClick={() => void cmd({ type: 'leaveShop' })}>
          Leave ↑
        </button>
      </div>
    </div>
  );
}

function Event() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const cmd = useStore((s) => s.cmd);
  const ev = run.pendingEvent ? findEvent(run.pendingEvent) : null;
  if (!ev) return null;
  return (
    <div className="card col" style={{ margin: 12 }}>
      <div className="row spread">
        <div className="title">{ev.name}</div>
        <div className="muted">Floor {run.floor}</div>
      </div>
      <div className="muted" style={{ fontStyle: 'italic' }}>
        {ev.flavor}
      </div>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        {ev.options.map((opt, i) => (
          <button
            key={i}
            className={i === 0 ? 'primary' : 'ghost'}
            style={{ textAlign: 'left' }}
            disabled={busy}
            onClick={() => void cmd({ type: 'resolveEvent', optionIndex: i })}
          >
            <strong>{opt.label}</strong> <span className="muted">— {opt.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RunScreen() {
  const phase = useStore((s) => s.run?.phase);
  return (
    <div className="col grow" style={{ overflow: 'auto' }}>
      <Onboarding />
      <TormentBanner />
      {phase === 'doors' && <Doors />}
      {phase === 'reward' && <Reward />}
      {phase === 'shop' && <Shop />}
      {phase === 'event' && <Event />}
      <HeroPanel />
    </div>
  );
}
