import { useReducer } from 'react';
import { game } from '../state/store';
import { VDEFS } from '../vehicles/defs';
import * as AD from '../admin';

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
      <p className="appNote">タップで目の前に出現（歩きならそのまま乗る）</p>
      <div className="adRow">{AD.ADMIN_KINDS.map((k) => <button type="button" key={k} onClick={run(() => AD.spawnVehicle(k, true), true)}>{VDEFS[k].name}</button>)}</div>
      <div className="adRow"><button type="button" onClick={run(AD.fillGarage)}>全車種をガレージへ</button></div>

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

      <h4 className="adH">開発</h4>
      <div className="adGrid">{T('debug', 'デバッグ表示', '座標・人数・車数・FPS')}</div>
    </div>
  );
}
