import { useEffect, useState } from 'react';
import { eatFx, stopEat, Dish } from './eat';

/**
 * The eating scene: the dish on the counter, eaten bite by bite. A bowl of noodles steams, the chopsticks lift the
 * noodles ("ズズッ") and the soup goes down; a plate or a tray empties; something in the hand gets bitten; a drink tips
 * and empties. Then "ごちそうさまでした". Tap to skip.
 */
export default function EatScene() {
  const [, tick] = useState(0);
  useEffect(() => { let id = 0; const f = () => { tick((n) => n + 1); if (eatFx.on && (performance.now() - eatFx.t0) / 1000 > eatFx.dur + 0.9) stopEat(); id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); return () => cancelAnimationFrame(id); }, []);
  if (!eatFx.on || !eatFx.dish) return null;
  const t = (performance.now() - eatFx.t0) / 1000, p = Math.min(1, t / eatFx.dur), done = t > eatFx.dur;
  const D = eatFx.dish, drinkish = D.kind === 'drink' || D.kind === 'can';
  return (
    <div className="overlay eatWrap" onPointerDown={() => stopEat()} role="status" aria-label={`${eatFx.name}を${drinkish ? '飲んでいる' : '食べている'}`}>
      <div className="eatCard">
        <svg viewBox="0 0 220 170" className="eatSvg">
          <ellipse cx="110" cy="150" rx="92" ry="12" fill="rgba(0,0,0,.35)" />
          {D.kind === 'bowl' && <Bowl D={D} p={p} t={t} />}
          {D.kind === 'plate' && <Plate D={D} p={p} t={t} />}
          {D.kind === 'tray' && <Tray D={D} p={p} t={t} />}
          {D.kind === 'hand' && <Hand D={D} p={p} t={t} />}
          {D.kind === 'drink' && <Drink D={D} p={p} t={t} />}
          {D.kind === 'can' && <Can D={D} p={p} t={t} />}
        </svg>
        <b className="eatName">{eatFx.name}</b>
        <div className="eatBar"><i style={{ width: p * 100 + '%' }} /></div>
        {!done && <span className="eatSay" key={Math.floor(t / 0.9)}>{drinkish ? 'ゴクッ' : D.kind === 'bowl' ? 'ズズッ' : D.kind === 'hand' ? 'パクッ' : 'モグモグ'}</span>}
        {done && <div className="eatDone">ごちそうさまでした！{eatFx.note && <small>{eatFx.note}</small>}</div>}
      </div>
    </div>
  );
}

const Steam = ({ x, y, n = 3, k = 1 }: { x: number; y: number; n?: number; k?: number }) => (
  <g opacity={k}>{Array.from({ length: n }, (_, i) => <path key={i} className="eatSteam" style={{ animationDelay: `${i * 0.45}s` }} d={`M${x + (i - 1) * 22} ${y} q -8 -12 0 -24 q 8 -12 0 -24`} />)}</g>
);

function Topping({ kind, x, y, s = 1, i }: { kind: string; x: number; y: number; s?: number; i: number }) {
  const T = `translate(${x} ${y}) scale(${s})`;
  switch (kind) {
    case 'chashu': return <g transform={T}><ellipse rx="17" ry="7" fill="#c98a6a" /><ellipse rx="12" ry="4.6" fill="#e9b89a" /><ellipse rx="5" ry="2" fill="#f4d4c0" /></g>;
    case 'egg': return <g transform={T}><ellipse rx="12" ry="6" fill="#fbf6ea" /><ellipse cx="1" rx="6" ry="3.2" fill="#f2a12a" /></g>;
    case 'nori': return <g transform={T}><rect x="-9" y="-26" width="18" height="26" fill="#1f2a1c" transform={`rotate(${-8 + i * 6})`} /></g>;
    case 'negi': return <g transform={T}>{[[-6, 0], [4, -2], [10, 3], [-12, 4], [0, 4]].map(([a, b], k) => <circle key={k} cx={a} cy={b} r="2.6" fill="#6ac04a" stroke="#d8f0b8" strokeWidth="1" />)}</g>;
    case 'menma': return <g transform={T}>{[0, 1, 2].map((k) => <rect key={k} x={-8 + k * 5} y="-2" width="3.5" height="11" rx="1" fill="#b88a3a" transform={`rotate(${30 + k * 10})`} />)}</g>;
    case 'beni': return <g transform={T}>{[0, 1, 2, 3].map((k) => <rect key={k} x={-4 + k * 3} y={-2 + (k % 2) * 3} width="2" height="6" fill="#e2304a" />)}</g>;
    case 'naruto': return <g transform={T}><ellipse rx="9" ry="4.5" fill="#fff" /><path d="M-4 0 q 4 -3 6 0 q -2 3 -4 1" stroke="#e85a8a" strokeWidth="1.4" fill="none" /></g>;
    case 'corn': return <g transform={T}>{Array.from({ length: 8 }, (_, k) => <circle key={k} cx={(k % 4) * 4 - 6} cy={Math.floor(k / 4) * 4 - 2} r="2" fill="#f6d02a" />)}</g>;
    case 'tempura': return <g transform={T}><ellipse rx="18" ry="7" fill="#e9b24a" /><ellipse rx="14" ry="4" fill="#f4cf7a" /><path d="M14 -2 l10 -6" stroke="#e2604a" strokeWidth="3" /></g>;
    case 'daikon': return <g transform={T}><ellipse rx="11" ry="5" fill="#e8d4a0" /><ellipse rx="8" ry="3" fill="#f4e6c0" /></g>;
    case 'chikuwa': return <g transform={T}><rect x="-14" y="-4" width="28" height="8" rx="4" fill="#c8843a" /><ellipse cx="14" rx="2.5" ry="4" fill="#f4e0b0" /></g>;
    case 'kamaboko': return <g transform={T}><rect x="-9" y="-3" width="18" height="6" rx="2" fill="#f4f0ea" /><rect x="-9" y="-3" width="18" height="2" fill="#f08aa0" /></g>;
    case 'cabbage': return <g transform={T}><ellipse rx="13" ry="5" fill="#b8e08a" /></g>;
    case 'shiitake': return <g transform={T}><ellipse rx="9" ry="4" fill="#6a4424" /><ellipse ry="2" rx="5" fill="#8a6440" /></g>;
  }
  return null;
}

function Bowl({ D, p, t }: { D: Dish; p: number; t: number }) {
  const cx = 110, top = 78, level = 1 - p * 0.8, tops = D.top || [], lift = Math.max(0, Math.sin((t / 0.9) * Math.PI * 2)) * 28;
  const pos: [number, number][] = [[-40, -2], [36, 0], [-12, 6], [16, -6], [0, 2], [46, 6], [-46, 6]];
  return (
    <g>
      <path d={`M${cx - 86} ${top} Q ${cx - 80} 150 ${cx} 150 Q ${cx + 80} 150 ${cx + 86} ${top} Z`} fill="#2a1414" />
      <path d={`M${cx - 70} 136 Q ${cx} 158 ${cx + 70} 136`} stroke="#b8322a" strokeWidth="5" fill="none" />
      <ellipse cx={cx} cy={top} rx="86" ry="22" fill="#b8322a" />
      <ellipse cx={cx} cy={top + 1} rx="79" ry="18" fill="#f6f1ea" />
      <ellipse cx={cx} cy={top + 3 + (1 - level) * 6} rx={76 * (0.75 + 0.25 * level)} ry={16 * (0.75 + 0.25 * level)} fill={D.c} />
      {[0, 1, 2, 3].map((k) => <path key={k} d={`M${cx - 50 + k * 22} ${top + 6} q 10 -8 20 0 q 10 8 20 0`} stroke={D.c2} strokeWidth="3" fill="none" opacity={level} />)}
      {tops.map((k, i) => { const keep = (i + 1) / (tops.length + 1) > p * 0.95; return keep ? <Topping key={i} kind={k} x={cx + pos[i % pos.length][0]} y={top + pos[i % pos.length][1]} i={i} /> : null; })}
      <Steam x={cx} y={top - 14} k={1 - p * 0.6} />
      {/* chopsticks lifting noodles */}
      <g transform={`translate(${cx + 18} ${top - 4 - lift}) rotate(-28)`}>
        <rect x="-2" y="-92" width="4" height="96" rx="2" fill="#d8b47a" /><rect x="6" y="-92" width="4" height="96" rx="2" fill="#c89a5a" transform="rotate(6)" />
        {lift > 6 && [0, 1, 2, 3].map((k) => <path key={k} d={`M${1 + k * 2} 2 q ${-3 + k * 2} ${lift * 0.5} ${-6 + k * 3} ${lift + 4}`} stroke={D.c2} strokeWidth="2.4" fill="none" />)}
      </g>
    </g>
  );
}
function Plate({ D, p, t }: { D: Dish; p: number; t: number }) {
  const left = 1 - p, dip = Math.max(0, Math.sin((t / 0.85) * Math.PI * 2)) * 16;
  return (
    <g>
      <ellipse cx="110" cy="122" rx="92" ry="26" fill="#e9e6e0" /><ellipse cx="110" cy="120" rx="76" ry="19" fill="#f8f6f2" />
      {D.c && <ellipse cx="110" cy="118" rx={56 * (0.4 + 0.6 * left)} ry={14 * (0.4 + 0.6 * left)} fill={D.c} opacity="0.85" />}
      <text x="110" y="124" fontSize={58 * (0.35 + 0.65 * left)} textAnchor="middle" dominantBaseline="middle">{D.icon}</text>
      <Steam x={110} y={92} k={left} n={2} />
      <g transform={`translate(150 ${90 - dip}) rotate(25)`}><rect x="-2" y="-70" width="4" height="74" rx="2" fill="#d8b47a" /><rect x="5" y="-70" width="4" height="74" rx="2" fill="#c89a5a" transform="rotate(6)" /></g>
    </g>
  );
}
function Tray({ D, p }: { D: Dish; p: number; t: number }) {
  const n = 6, left = Math.ceil(n * (1 - p));
  return (
    <g>
      <path d="M24 108 L196 108 L182 136 L38 136 Z" fill="#c8a06a" /><path d="M24 108 L196 108 L192 114 L28 114 Z" fill="#e2c08a" />
      {Array.from({ length: n }, (_, k) => k < left ? <text key={k} x={52 + (k % 3) * 58} y={k < 3 ? 100 : 118} fontSize="34" textAnchor="middle">{D.icon}</text> : null)}
      <rect x="176" y="40" width="3" height="66" fill="#e8d4a0" transform="rotate(14 176 106)" />
    </g>
  );
}
function Hand({ D, p }: { D: Dish; p: number; t: number }) {
  const bites = Math.min(4, Math.floor(p * 5));
  return (
    <g>
      <text x="110" y="98" fontSize="96" textAnchor="middle" dominantBaseline="middle">{D.icon}</text>
      {Array.from({ length: bites }, (_, k) => <circle key={k} cx={150 - k * 9} cy={52 + k * 16} r={15} fill="#141226" />)}
    </g>
  );
}
function Drink({ D, p, t }: { D: Dish; p: number; t: number }) {
  const lvl = 1 - p * 0.95, tilt = -Math.max(0, Math.sin((t / 1.0) * Math.PI)) * 22 * Math.min(1, p * 3), cup = D.cup || 'glass';
  const W = cup === 'mug' ? 60 : cup === 'bottle' ? 36 : 54, H = cup === 'mug' ? 64 : cup === 'bottle' ? 96 : 84, x0 = 110 - W / 2, y0 = 140 - H;
  return (
    <g transform={`rotate(${tilt} 110 140)`}>
      {cup === 'mug' && <path d={`M${x0 + W} ${y0 + 14} q 22 0 22 18 q 0 18 -22 18`} stroke="#f2efe8" strokeWidth="8" fill="none" />}
      <rect x={x0} y={y0} width={W} height={H} rx={cup === 'bottle' ? 10 : 6} fill={cup === 'mug' || cup === 'paper' ? '#f2efe8' : 'rgba(220,240,255,.35)'} stroke="rgba(255,255,255,.7)" strokeWidth="2" />
      {cup === 'bottle' && <rect x={110 - 9} y={y0 - 18} width="18" height="20" rx="4" fill="rgba(220,240,255,.35)" stroke="rgba(255,255,255,.7)" strokeWidth="2" />}
      {(cup === 'glass' || cup === 'bottle') && <rect x={x0 + 3} y={y0 + 3 + (H - 6) * (1 - lvl)} width={W - 6} height={(H - 6) * lvl} rx="4" fill={D.c} opacity="0.92" />}
      {(cup === 'mug' || cup === 'paper') && <ellipse cx="110" cy={y0 + 8 + (1 - lvl) * (H - 18)} rx={W / 2 - 5} ry="6" fill={D.c} />}
      {D.c2 && (cup === 'glass') && lvl > 0.1 && <rect x={x0 + 3} y={y0 + (H - 6) * (1 - lvl)} width={W - 6} height="12" rx="4" fill={D.c2} />}
      {D.c2 && cup === 'mug' && <ellipse cx="110" cy={y0 + 8 + (1 - lvl) * (H - 18)} rx={W / 2 - 14} ry="3.5" fill={D.c2} />}
      {cup === 'glass' && lvl > 0.1 && [0, 1, 2].map((k) => <circle key={k} className="eatBubble" style={{ animationDelay: `${k * 0.3}s` }} cx={x0 + 12 + k * 14} cy={y0 + H - 10} r="2" fill="#fff" />)}
      {cup === 'paper' && <rect x={x0 - 3} y={y0 - 6} width={W + 6} height="9" rx="3" fill="#6a4424" />}
      {(cup === 'mug' || cup === 'paper') && <Steam x={110} y={y0 - 6} k={lvl} n={2} />}
    </g>
  );
}
function Can({ D, p, t }: { D: Dish; p: number; t: number }) {
  const tilt = -Math.max(0, Math.sin((t / 1.0) * Math.PI)) * 30 * Math.min(1, p * 3);
  return (
    <g transform={`rotate(${tilt} 110 140)`}>
      <rect x="84" y="48" width="52" height="92" rx="8" fill="#1c1c22" /><rect x="84" y="70" width="52" height="40" fill={D.c} />
      <text x="110" y="95" fontSize="22" textAnchor="middle" dominantBaseline="middle">⚡</text><rect x="88" y="44" width="44" height="8" rx="3" fill="#b8bcc4" />
    </g>
  );
}
