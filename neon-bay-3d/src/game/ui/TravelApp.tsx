import { travelTo, TRAVEL_KEY } from './travel';
import { useEffect, useState } from 'react';
import { game, toast, save } from '../state/store';
import { playerCar } from '../vehicles/sim';
import { law, trial } from '../crime/crime';
import { race } from '../crime/race';
import { mission } from '../crime/story';
import { REGION, REGIONS, REGION_ORDER, RegionId, route } from '../world/region';
import { STATION, AIRPORT, SHIN } from '../world/cityGen';
import { sfx } from '../audio';

export { TRAVEL_KEY };

/** Simplified outline of Japan in a 100 x 100 box (x east, y south): Hokkaido, Honshu, Shikoku, Kyushu, Okinawa. */
const ISLANDS = [
  '80,5 86,3 93,5 97,9 94,12 88,13 83,12 79,9',
  '29,60 34,57 40,55 46,52 50,50 55,47 60,44 63,40 66,36 70,30 73,24 76,19 80,16 84,17 85,22 83,28 81,34 78,40 76,44 74,47 72,49 69,50 66,51 63,54 60,56 57,59 54,60 51,59 48,58 45,59 41,60 37,61 33,63 30,63',
  '44,62 52,61 56,63 53,66 47,66 43,65',
  '24,63 30,62 32,66 33,72 30,78 26,79 23,74 22,68',
  '8,90 11,88.5 12.5,92.5 9.5,95',
];

/** Why the player cannot leave right now ('' = free to go). */
function blocker(): string {
  if (game.where !== 'out') return '建物の外に出てから出発できます';
  if (playerCar()) return '乗り物を降りてから出発できます（車はガレージに届きます）';
  if (game.wanted > 0) return '手配中は駅や空港に近づけない（手配を消してから）';
  if (law.over) return 'いまは出発できません';
  if (mission.id >= 0) return 'ミッション中は移動できません';
  if (trial.id || race.id) return 'レース中は移動できません';
  return '';
}

export default function TravelApp({ close }: { close: () => void }) {
  const others = REGION_ORDER.filter((id) => id !== REGION.id);
  const [sel, setSel] = useState<RegionId>(others[0]);
  const [arm, setArm] = useState(false), [going, setGoing] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 3000); return () => clearTimeout(t); }, [arm]);
  const R = route(REGION.id, sel), D = REGIONS[sel], why = blocker(), poor = game.money < R.fare;
  const depart = () => {
    if (why || poor || going) return;
    if (!arm) { setArm(true); sfx('ui'); return; }
    setGoing(true); setArm(false);
    travelTo(sel, R.mode, R.fare, R.hours, `${R.icon} ${R.label}で${D.name}へ出発（${R.hours}時間）`);
  };
  const ST = STATION;
  const P = (id: RegionId) => [REGIONS[id].map[0] * 100, REGIONS[id].map[1] * 100] as const;
  return (
    <div className="appBody">
      <div className="jpMap">
        <svg viewBox="0 0 100 100" role="img" aria-label="日本地図">
          <rect x="0" y="0" width="100" height="100" fill="#0e3550" />
          {ISLANDS.map((p, i) => <polygon key={i} points={p} fill="#3d6b47" stroke="#a9d8b0" strokeWidth="0.4" />)}
          <line x1={P(REGION.id)[0]} y1={P(REGION.id)[1]} x2={P(sel)[0]} y2={P(sel)[1]} stroke="#ffd23a" strokeWidth="0.7" strokeDasharray="1.6 1.2" />
          {REGION_ORDER.map((id) => { const [x, y] = P(id), here = id === REGION.id, on = id === sel; return (
            <g key={id} onClick={() => { if (!here) { setSel(id); setArm(false); sfx('ui'); } }} style={{ cursor: here ? 'default' : 'pointer' }}>
              <circle cx={x} cy={y} r={here ? 2.6 : on ? 2.3 : 1.8} fill={here ? '#2be4ff' : on ? '#ffd23a' : '#ffffff'} stroke="#000" strokeWidth="0.4" />
              <text x={x + (id === 'naha' ? 4 : 3)} y={y + 1.2} fontSize="4.2" fontWeight="800" fill="#fff" stroke="#000" strokeWidth="0.25" paintOrder="stroke">{REGIONS[id].name}{here ? '（現在地）' : ''}</text>
            </g>
          ); })}
        </svg>
      </div>
      <div className="jobBtns travelPick">{others.map((id) => <button type="button" key={id} className={id === sel ? 'on' : ''} onClick={() => { setSel(id); setArm(false); sfx('ui'); }}>{REGIONS[id].name}</button>)}</div>
      <div className="jobCard">
        <b>{R.icon} {D.name}（{D.en}）</b>
        <p>{D.intro}</p>
        <p>{REGION.name} → {D.name}：{R.label}・約{R.hours}時間（ゲーム内の時計が進みます）<br />到着：{R.mode === 'train' ? (D.station || D.names.airport) : D.names.airport}</p>
        <span className="pay">運賃 ${R.fare.toLocaleString('en-US')}</span>
        {why ? <p className="gmsg">{why}</p> : poor ? <p className="gmsg">お金が足りません</p> : null}
        <div className="jobBtns"><button type="button" className={arm ? 'armed' : ''} disabled={!!why || poor || going} onClick={depart}>{going ? '移動中…' : arm ? `もう一度タップで出発（$${R.fare.toLocaleString('en-US')}）` : `${R.label}で出発`}</button></div>
      </div>
      <p className="appNote">{REGION.shinkansen && '駅の「新幹線のりば」から新幹線を自分で運転して行くこともできます（運賃なし）。'}お金・車・武器・服・実績は持っていけます。ストーリーと仕事はどの街でも続きができます。持ち家（不動産）は東京にあります。ギフトボックスは街ごとに別です。</p>
      <div className="jobBtns">
        {SHIN.has && <button type="button" onClick={() => { game.waypoint = { x: SHIN.gate.x, z: SHIN.gate.z }; save(); toast('新幹線のりかえ口を目的地に設定（改札→ホーム→運転席）', 2.4); close(); }}>新幹線のりばへ案内</button>}
        {ST && <button type="button" onClick={() => { game.waypoint = { x: ST.x, z: ST.z - 3 }; save(); toast(ST.label + 'を目的地に設定'); close(); }}>{ST.label}へ案内</button>}
        <button type="button" onClick={() => { game.waypoint = { x: AIRPORT.x0 + 390, z: 168 }; save(); toast(REGION.names.airport + 'を目的地に設定'); close(); }}>{REGION.names.airport}へ案内</button>
      </div>
    </div>
  );
}

/** Shown instead of the title screen right after a trip: the destination, then a tap to carry on (the tap also unlocks sound). */
export function ArrivalScreen({ ready, onGo }: { ready: boolean; onGo: () => void }) {
  let info: { from: RegionId; to: RegionId; mode: string } | null = null;
  try { info = JSON.parse(localStorage.getItem(TRAVEL_KEY) || 'null'); } catch { /* ignore */ }
  const from = info && info.from in REGIONS ? REGIONS[info.from].name : '';
  return (
    <div className="overlay arrive">
      <div className="arriveCard">
        <span className="arIcon">{info?.mode === 'plane' ? '✈️' : '🚄'}</span>
        <p className="arFrom">{from ? `${from}から` : ''}</p>
        <h2>{REGION.name}<small>{REGION.en}</small></h2>
        <p className="arIntro">{REGION.intro}</p>
        {!ready && <div className="loading"><span>街を読み込み中…</span><i><b /></i></div>}
        <button type="button" className="mbtn primary" disabled={!ready} onClick={() => { try { localStorage.removeItem(TRAVEL_KEY); } catch { /* ignore */ } onGo(); }}>{ready ? '到着！ タップして続ける' : '到着まで少々お待ちください'}<span>▶</span></button>
      </div>
    </div>
  );
}

/** The Shinkansen app: where the station is, what leaves from it, directions or a taxi to the entrance, how to ride. */
export function ShinApp({ close }: { close: () => void }) {
  const p = game.where !== 'out' ? game.outsidePos : game.player, d = Math.hypot(SHIN.gate.x - p.x, SHIN.gate.z - p.z), why = blocker(), FARE = 30;
  const stName = REGION.station || REGION.names.downtown + '駅';
  const guide = () => { game.waypoint = { x: SHIN.gate.x, z: SHIN.gate.z }; save(); sfx('ui'); toast('🚄 新幹線のりかえ口を目的地に設定（マップの青い🚄マーク）', 2.6); close(); };
  const taxiGo = () => {
    if (why || game.money < FARE) return;
    game.money -= FARE; const P = game.player; P.x = SHIN.gate.x - 7; P.z = SHIN.gate.z + 1.5; P.y = 0.15; P.vy = 0; P.yaw = Math.PI / 2; game.cam.yaw = -Math.PI / 2; game.fadeT = 1.1; game.waypoint = null;
    save(); sfx('door'); toast(`🚕 ${stName}の新幹線のりかえ口に着いた（$${FARE}）。正面の入口から改札へ`, 3); close();
  };
  return (
    <div className="appBody">
      <div className="jobCard">
        <b>🚄 {stName} 新幹線のりば</b>
        <p>ここから約 {d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}（マップの青い🚄マーク・ミニマップの縁に方向が出ます）</p>
        {SHIN.platforms.map((P) => <p key={P.num}>{P.num}番線：{P.to ? `のぞみ ${REGIONS[P.to].name}行き（運転席に乗れます・運賃なし・約${route(REGION.id, P.to).hours}時間）` : '到着ホーム'}</p>)}
        <div className="jobBtns"><button type="button" onClick={guide}>のりばへ案内</button><button type="button" disabled={!!why || game.money < FARE} onClick={taxiGo}>タクシーで駅前へ（${FARE}）</button></div>
        {why ? <p className="gmsg">タクシー：{why}</p> : game.money < FARE ? <p className="gmsg">お金が足りません</p> : null}
      </div>
      <p className="appNote">乗り方：入口 → 改札 → 階段で{SHIN.platforms.filter((q) => q.to).map((q) => q.num + '番線').join('・')}ホームへ → ホーム北端の先頭車で「運転席に乗る」 → W で発車・S でブレーキ。ATCの制限速度を守って北の山のトンネルへ。トンネルを抜けると次の街に着き、終点の駅で停止位置に止めるとボーナス。</p>
    </div>
  );
}
