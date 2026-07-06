import { useStore } from '../store.js';
import { HeroPanel } from './HeroPanel.js';
import { describeItem } from './itemText.js';

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
          <div className="kind">{door.kind}</div>
          <div className="title" style={{ fontSize: 18 }}>
            {door.kind === 'boss' ? '☗ ' : door.kind === 'elite' ? '✦ ' : ''}
            {door.preview}
          </div>
          <div className="muted grow" />
          <div className="muted">Floor {run.floor}</div>
        </div>
      ))}
    </div>
  );
}

function Reward() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const cmd = useStore((s) => s.cmd);
  const loot = run.pendingItem ? describeItem(run.pendingItem, 1) : null;
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

export function RunScreen() {
  const phase = useStore((s) => s.run?.phase);
  return (
    <div className="col grow" style={{ overflow: 'auto' }}>
      {phase === 'doors' && <Doors />}
      {phase === 'reward' && <Reward />}
      {phase === 'shop' && <Shop />}
      <HeroPanel />
    </div>
  );
}
