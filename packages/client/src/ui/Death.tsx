import { biomeForFloor, getClass } from '@towventure/shared/content';
import { killerName, makeSummary } from '@towventure/shared/run';
import { downloadCard } from '../engine/shareCard.js';
import { paletteForBiome } from '../engine/palettes.js';
import { useStore } from '../store.js';

const hexOf = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function Death() {
  const run = useStore((s) => s.run)!;
  const me = useStore((s) => s.me);
  const busy = useStore((s) => s.busy);
  const startRun = useStore((s) => s.startRun);
  const dismissRun = useStore((s) => s.dismissRun);
  const setView = useStore((s) => s.setView);

  const s = makeSummary(run);
  const killer = killerName(run) ?? 'the Tower';
  const echoFloor = run.deathInfo?.floor ?? run.floor;

  const shareCard = (): void => {
    downloadCard(
      {
        kind: 'death',
        name: me?.account.name ?? 'A climber',
        className: getClass(run.classId).name,
        floor: echoFloor,
        bestFloor: s.bestFloor,
        fightsWon: s.fightsWon,
        damageDealt: s.damageDealt,
        honor: s.climbHonor,
        tier: s.tier,
        killer,
        accent: hexOf(paletteForBiome(biomeForFloor(echoFloor).id).accent),
      },
      `towventure-floor-${echoFloor}.png`,
    );
  };

  return (
    <div className="death center card">
      <div className="kind muted" style={{ letterSpacing: '0.14em' }}>
        HERE YOU FELL
      </div>
      <h2 style={{ margin: '6px 0' }}>
        {killer} put you down on Floor {echoFloor}.
      </h2>
      <div className="muted">
        Your Echo now stands on Floor {echoFloor}. Make them regret finding it.
      </div>

      <div className="tally">
        <span className="k">Deepest floor</span>
        <span className="v">{s.bestFloor}</span>
        <span className="k">Fights won</span>
        <span className="v">{s.fightsWon}</span>
        <span className="k">Damage dealt</span>
        <span className="v">{s.damageDealt}</span>
        <span className="k">Gold at death</span>
        <span className="v gold">{s.gold}</span>
        <span className="k">Honor earned</span>
        <span className="v">{s.climbHonor}</span>
        <span className="k">Standing</span>
        <span className="v">{s.tier}</span>
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="primary" disabled={busy} onClick={() => void startRun()}>
          Take the Vow again
        </button>
        <button className="ghost" onClick={shareCard} title="Download a PNG to share">
          ⤓ Share card
        </button>
        <button className="ghost" onClick={() => setView('ladder')}>
          The Ladder
        </button>
        <button className="ghost" onClick={dismissRun}>
          The Gate
        </button>
      </div>
    </div>
  );
}
