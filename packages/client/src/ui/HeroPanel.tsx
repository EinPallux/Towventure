import { useState } from 'react';
import type { EquipSlotId, InventoryItem } from '@towventure/shared/run';
import type { ConsumableCondition } from '@towventure/shared/content';
import { useStore } from '../store.js';
import { TagMeter } from './TagMeter.js';
import {
  CONDITION_LABEL,
  CONSUMABLE_CONDITIONS,
  consumableInfo,
  describeItem,
} from './itemText.js';

const SLOTS: { key: EquipSlotId; label: string }[] = [
  { key: 'weapon1', label: 'Weapon' },
  { key: 'weapon2', label: 'Weapon' },
  { key: 'helm', label: 'Helm' },
  { key: 'armor', label: 'Armor' },
  { key: 'boots', label: 'Boots' },
  { key: 'trinket1', label: 'Trinket' },
  { key: 'trinket2', label: 'Trinket' },
  { key: 'relic', label: 'Relic' },
];

function itemTitle(inst: InventoryItem): string {
  const d = describeItem(inst.itemId, inst.star);
  return `${d.name} ★${inst.star}\n${d.lines.join('\n')}\n\n${d.flavor}`;
}

export function HeroPanel() {
  const run = useStore((s) => s.run)!;
  const busy = useStore((s) => s.busy);
  const cmd = useStore((s) => s.cmd);
  const [sel, setSel] = useState<string[]>([]);
  const [dropSlot, setDropSlot] = useState<EquipSlotId | null>(null);

  const toggleSel = (uid: string) =>
    setSel((cur) => (cur.includes(uid) ? cur.filter((u) => u !== uid) : [...cur.slice(-1), uid]));

  const fusePair = (() => {
    if (sel.length !== 2) return null;
    const a = run.backpack.find((i) => i.uid === sel[0]);
    const b = run.backpack.find((i) => i.uid === sel[1]);
    if (a && b && a.itemId === b.itemId && a.star === b.star && a.star < 5) return [a, b] as const;
    return null;
  })();

  const onDrop = (slot: EquipSlotId) => (e: React.DragEvent) => {
    e.preventDefault();
    setDropSlot(null);
    const uid = e.dataTransfer.getData('text/uid');
    if (uid) void cmd({ type: 'equip', uid, slot });
  };

  return (
    <div className="hero-screen">
      <div className="col">
        <TagMeter run={run} />
        <div className="title">Equipment</div>
        <div className="slots">
          {SLOTS.map(({ key, label }) => {
            const inst = run.equipment[key];
            return (
              <div
                key={key}
                className={`slot ${inst ? '' : 'empty'} ${dropSlot === key ? 'drop' : ''}`}
                title={inst ? itemTitle(inst) : `${label} slot`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropSlot(key);
                }}
                onDragLeave={() => setDropSlot((s) => (s === key ? null : s))}
                onDrop={onDrop(key)}
              >
                {inst ? (
                  <>
                    <div className="row spread">
                      <span
                        className={`r-${describeItem(inst.itemId, inst.star).rarity} item-name`}
                      >
                        {describeItem(inst.itemId, inst.star).name}
                      </span>
                      <span className="stars">{'★'.repeat(inst.star)}</span>
                    </div>
                    <div className="row">
                      <span className="muted" style={{ fontSize: 11 }}>
                        {label}
                      </span>
                      {key !== 'relic' && (
                        <button
                          className="small ghost"
                          disabled={busy}
                          onClick={() => void cmd({ type: 'unequip', slot: key })}
                        >
                          Unequip
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <span>{label}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="col">
        <div className="row spread">
          <div className="title">
            Backpack{' '}
            <span className="muted">
              ({run.backpack.length}/{run.backpackSize})
            </span>
          </div>
          {fusePair && (
            <button
              className="primary small"
              disabled={busy}
              onClick={() => {
                void cmd({ type: 'fuse', uid1: fusePair[0].uid, uid2: fusePair[1].uid });
                setSel([]);
              }}
            >
              Fuse → ★{fusePair[0].star + 1}
            </button>
          )}
        </div>
        <div className="backpack">
          {run.backpack.map((inst) => {
            const d = describeItem(inst.itemId, inst.star);
            const cons = consumableInfo(inst.itemId);
            return (
              <div
                key={inst.uid}
                className={`bp-item ${sel.includes(inst.uid) ? 'selected' : ''}`}
                draggable={!cons}
                title={itemTitle(inst)}
                onDragStart={(e) => e.dataTransfer.setData('text/uid', inst.uid)}
                onClick={() => !cons && toggleSel(inst.uid)}
              >
                <div className="row spread">
                  <span className={`r-${d.rarity} item-name`}>{d.name}</span>
                  <span className="stars">{cons ? '⚗' : '★'.repeat(inst.star)}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {d.lines[0] ?? d.flavor}
                </div>
                <div className="item-actions">
                  {cons ? (
                    <select
                      className="small"
                      value={inst.condition ?? cons.condition}
                      disabled={busy}
                      title="When this consumable auto-fires"
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        void cmd({
                          type: 'setConsumableCondition',
                          uid: inst.uid,
                          condition: e.target.value as ConsumableCondition,
                        });
                      }}
                    >
                      {CONSUMABLE_CONDITIONS.map((c) => (
                        <option key={c} value={c}>
                          {CONDITION_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      className="small"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void cmd({ type: 'equip', uid: inst.uid });
                      }}
                    >
                      Equip
                    </button>
                  )}
                  <button
                    className="small ghost"
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void cmd({ type: 'sell', uid: inst.uid });
                    }}
                  >
                    Sell
                  </button>
                </div>
              </div>
            );
          })}
          {run.backpack.length === 0 && <div className="muted">Empty. Loot fills it.</div>}
        </div>
      </div>
    </div>
  );
}
