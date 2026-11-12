import { useEffect, useState } from 'react';
import { line, fastForward, etaHours, nextStop, viewNames, legAt, limitAt, END_GAP } from './line';
import { REGIONS, RegionId } from '../world/region';
import { game } from '../state/store';
import { sfx } from '../audio';

/** The panel while riding between cities: line, next station, distance to go and the arrival time, speed, and the buttons. */
export default function LineHUD({ onPause }: { onPause: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 250); return () => clearInterval(id); }, []);
  if (!line.on) return null;
  const L = line, ni = nextStop(), st = L.stops[ni], g = L.legs[legAt(L.s)], left = Math.max(0, L.L - L.s), eta = etaHours();
  const arr = (game.hour + eta) % 24, hh = Math.floor(arr), mm = Math.floor((arr - hh) * 60);
  const kmh = Math.round(L.v * 3.6), lim = Math.round(limitAt(L.s) * 3.6), pct = Math.min(100, (L.s / Math.max(1, L.L - END_GAP)) * 100);
  return (
    <div className="lineHud">
      <div className="lineTop">
        <b>{g.name}　{REGIONS[L.to as RegionId]?.name}行き</b>
        <span>次は <em>{st?.name}</em>{ni === L.stops.length - 1 ? '（終点）' : '（通過）'}・あと {((st ? st.s - L.s : 0) / 1000).toFixed(1)}km</span>
        <span>終点まで {(left / 1000).toFixed(1)}km／全{(L.L / 1000).toFixed(1)}km・到着予定 {hh}:{String(mm).padStart(2, '0')}</span>
        <div className="lineBar"><i style={{ width: pct + '%' }} />{L.stops.map((q) => <u key={q.name + q.s} style={{ left: Math.min(100, (q.s / Math.max(1, L.L - END_GAP)) * 100) + '%' }} title={q.name} />)}</div>
      </div>
      <div className="lineSpd"><b>{kmh}</b><small>km/h</small><span>制限 {lim}{L.tunnel > 0.5 ? '・トンネル' : ''}</span></div>
      <div className="lineBtns">
        <button type="button" onClick={() => { fastForward(false); }}>⏩ 次の駅の手前へ</button>
        <button type="button" onClick={() => { fastForward(true); }}>⏭ 終点の手前へ</button>
        {L.mode === 'drive' && <button type="button" className={L.auto ? 'on' : ''} onClick={() => { L.auto = !L.auto; sfx('ui'); }}>{L.auto ? '🤖 自動運転 ON' : '🤖 自動運転 OFF'}</button>}
        <button type="button" onClick={() => { L.view = (L.view + 1) % 4; sfx('ui'); }}>🎥 {viewNames[L.view]}</button>
        {L.mode === 'seat' && <button type="button" onClick={onPause}>一時停止</button>}
      </div>
    </div>
  );
}
