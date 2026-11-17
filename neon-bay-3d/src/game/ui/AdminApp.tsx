import { useEffect, useReducer, useState } from 'react';
import { game } from '../state/store';
import { VDEFS } from '../vehicles/defs';
import * as AD from '../admin';
import { net, sendNetGift, deleteNetGift, rewardLabel, Reward } from '../crime/gifts';

const GIFT_PRESETS: { label: string; r: Reward }[] = [
  { label: '$10,000', r: { cash: 10000 } }, { label: '$100,000', r: { cash: 100000 } }, { label: '$1,000,000', r: { cash: 1000000 } }, { label: '$5,000,000', r: { cash: 5000000 } },
  { label: '武器パック', r: { ammo: true, armor: true, grenades: 5 } },
  ...(['jet', 'yacht', 'formula', 'limo', 'speedboat', 'jetski', 'hyper'] as const).map((k) => ({ label: VDEFS[k].name, r: { vehicle: k } as Reward })),
];

/** Owner → every player gifts (stored in the page's shared db; the rules let only the owner write). */
function GiftSender() {
  const [title, setTitle] = useState('運営からのプレゼント'), [msg, setMsg] = useState(''), [pick, setPick] = useState(0), [busy, setBusy] = useState(false), [note, setNote] = useState(''), [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
  if (net.state === 'off') return <p className="appNote">ギフト配布は claude.ai で開いたときに使えます（共有データを使います）。</p>;
  const send = async () => { setBusy(true); setNote(''); const err = await sendNetGift(title, msg, GIFT_PRESETS[pick].r); setBusy(false); setNote(err || '配布しました：全プレイヤーのスマホ「ギフト」に届きます'); };
  return (
    <div className="adGift">
      <input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} aria-label="ギフトのタイトル" placeholder="タイトル" />
      <input value={msg} maxLength={120} onChange={(e) => setMsg(e.target.value)} aria-label="メッセージ" placeholder="メッセージ（任意）" />
      <div className="adRow">{GIFT_PRESETS.map((g, i) => <button type="button" key={g.label} className={pick === i ? 'sel' : ''} onClick={() => setPick(i)}>{g.label}</button>)}</div>
      <div className="adRow"><button type="button" disabled={busy || !title.trim()} onClick={send}>{busy ? '送信中…' : `「${GIFT_PRESETS[pick].label}」を全員に配る`}</button></div>
      {note && <p className="appNote">{note}</p>}
      {net.list.length > 0 && <p className="appNote">配布中（新しい順・最大30件）</p>}
      {net.list.map((g) => <div className="adRow" key={g.id}><span className="adGL">{g.title} — {rewardLabel(g.reward)}</span><button type="button" onClick={async () => { await deleteNetGift(g.id); tick(); }}>配布停止</button></div>)}
    </div>
  );
}

/** Owner-only control panel inside the phone. Every action re-checks admin status in admin.ts. */
export default function AdminApp({ close }: { close: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const a = AD.admin;
  if (!a.is) return <div className="appBody"><p className="appNote">このアプリは管理者（このゲームのオーナー）専用です。</p></div>;
  const run = (f: () => void, closeAfter = false) => () => { f(); refresh(); if (closeAfter) close(); };
  const T = (k: AD.Toggle, label: string, sub: string) => (
    <button type="button" key={k} className={'adTog' + (a[k] ? ' on' : '')} onClick={run(() => AD.toggle(k))} aria-pressed={a[k]}>
      <b>{label}</b><span>{sub}</span><i>{a[k] ? 'ON' : 'OFF'}</i>
    </button>
  );
  return (
    <div className="appBody">
      <p className="appNote adWarn">管理者モード：あなた（オーナー）だけに表示されています</p>

      <h4 className="adH">プレイヤー</h4>
      <div className="adGrid">
        {T('god', '無敵', 'ダメージ・逮捕・死亡なし')}
        {T('noWanted', '手配無効', '警察に追われない')}
        {T('infAmmo', '弾無限', '弾が減らない')}
        {T('fastRun', '高速ダッシュ', '移動速度 ×2.2')}
        {T('superJump', 'スーパージャンプ', 'ジャンプ力 ×2.6')}
      </div>
      <div className="adRow">
        <button type="button" onClick={run(AD.heal)}>全回復</button>
        <button type="button" onClick={run(AD.giveWeapons)}>全武器＋弾薬</button>
        <button type="button" onClick={run(() => AD.addMoney(10000))}>+$10,000</button>
        <button type="button" onClick={run(() => AD.addMoney(100000))}>+$100,000</button>
        <button type="button" onClick={run(() => AD.addMoney(-game.money))}>$0にする</button>
      </div>

      <h4 className="adH">手配度</h4>
      <div className="adRow">{[0, 1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={game.wanted === n ? 'sel' : ''} onClick={run(() => AD.setWanted(n))}>{n ? '★'.repeat(n) : '解除'}</button>)}</div>

      <h4 className="adH">車</h4>
      <div className="adGrid">
        {T('carGod', '車無敵', '自分の車が壊れない')}
        {T('carBoost', '車ブースト', '加速 ×1.8・最高速 ×1.45')}
      </div>
      <label className="adSlider"><span>車のスピード {a.carSpeed === 1 ? '通常' : '×' + a.carSpeed}</span>
        <input type="range" min={1} max={5} step={0.5} value={a.carSpeed} aria-label="車のスピード倍率" onChange={(e) => { AD.setCarSpeed(+e.target.value); refresh(); }} /></label>
      <div className="adRow">{[1, 2, 3, 4, 5].map((s) => <button type="button" key={s} className={a.carSpeed === s ? 'sel' : ''} onClick={run(() => AD.setCarSpeed(s))}>{s === 1 ? '通常' : `×${s}`}</button>)}</div>
      <p className="appNote">自分が運転する車・バイク・トラックの最高速と加速が倍になり、ブレーキとグリップも強くなります（船・ヘリ・戦闘機は対象外）。高速でぶつかると一撃で大破するので「車無敵」と一緒にどうぞ。</p>

      <p className="appNote">タップで目の前に出現（歩きならそのまま乗る）</p>
      <div className="adRow">{AD.ADMIN_KINDS.map((k) => <button type="button" key={k} onClick={run(() => AD.spawnVehicle(k, true), true)}>{VDEFS[k].name}</button>)}</div>
      <div className="adRow"><button type="button" onClick={run(AD.fillGarage)}>全車種をガレージへ</button></div>

      <h4 className="adH">新幹線</h4>
      <label className="adSlider"><span>新幹線のスピード {a.trainSpeed === 1 ? '通常（最高300km/h）' : `×${a.trainSpeed}（最高${Math.round(300 * a.trainSpeed)}km/h）`}</span>
        <input type="range" min={1} max={5} step={0.5} value={a.trainSpeed} aria-label="新幹線のスピード倍率" onChange={(e) => { AD.setTrainSpeed(+e.target.value); refresh(); }} /></label>
      <div className="adRow">{[1, 2, 3, 4, 5].map((s) => <button type="button" key={s} className={a.trainSpeed === s ? 'sel' : ''} onClick={run(() => AD.setTrainSpeed(s))}>{s === 1 ? '通常' : `×${s}`}</button>)}</div>
      <p className="appNote">自分が運転する新幹線の加速・ブレーキ・ATCの制限速度が倍になります（終点の手前ではATCが自動で減速させます）。</p>

      <h4 className="adH">ワープ</h4>
      <div className="adRow">
        {AD.WARPS.map((w) => <button type="button" key={w.name} onClick={run(() => AD.warp(w.at()), true)}>{w.name}</button>)}
        <button type="button" onClick={run(AD.warpWaypoint, true)}>目的地へ</button>
      </div>

      <h4 className="adH">時間</h4>
      <label className="adSlider"><span>時刻 {String(Math.floor(game.hour)).padStart(2, '0')}:{String(Math.floor((game.hour % 1) * 60)).padStart(2, '0')}</span>
        <input type="range" min={0} max={23.9} step={0.1} value={game.hour} onChange={(e) => { AD.setHour(+e.target.value); refresh(); }} /></label>
      <div className="adGrid">{T('freezeTime', '時間停止', '時刻を固定')}</div>
      <div className="adRow">{[0.25, 0.5, 1, 2].map((s) => <button type="button" key={s} className={a.timeScale === s ? 'sel' : ''} onClick={run(() => AD.setScale(s))}>{s === 1 ? '通常速度' : s < 1 ? `スロー ×${s}` : `早送り ×${s}`}</button>)}</div>

      <h4 className="adH">天気</h4>
      <div className="adRow">{(['clear', 'cloudy', 'rain', 'storm'] as const).map((k) => <button type="button" key={k} className={game.weather.kind === k ? 'sel' : ''} onClick={run(() => AD.weather(k))}>{({ clear: '☀ 晴れ', cloudy: '☁ くもり', rain: '☂ 雨', storm: '⚡ 嵐' })[k]}</button>)}</div>
      <h4 className="adH">街</h4>
      <div className="adRow">{[[0, '人も車もなし'], [1, '通常'], [2, '混雑 ×2']].map(([d, l]) => <button type="button" key={d} className={a.density === d ? 'sel' : ''} onClick={run(() => AD.setDensity(d as number))}>{l}</button>)}</div>
      <div className="adRow">
        <button type="button" onClick={run(() => AD.clearArea())}>周囲を片付ける</button>
        <button type="button" onClick={run(AD.panicAll)}>街中パニック</button>
        <button type="button" onClick={run(AD.armoredNow, true)}>現金輸送車を呼ぶ</button>
        <button type="button" onClick={run(AD.resetJobs)}>仕事をリセット</button>
      </div>

      <h4 className="adH">ギフト配布（全プレイヤー）</h4>
      <GiftSender />

      <h4 className="adH">開発</h4>
      <div className="adGrid">{T('debug', 'デバッグ表示', '座標・人数・車数・FPS')}</div>
    </div>
  );
}
