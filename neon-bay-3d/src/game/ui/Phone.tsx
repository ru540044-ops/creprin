import { useEffect, useReducer, useState } from 'react';
import { game, toast, save, clearSave, ownedCars, Quality } from '../state/store';
import { VDEFS, DEALER, VKind } from '../vehicles/defs';
import { PROF } from '../vehicles/models';
import { vehicles, deliverNear, sellOwned, repairAll } from '../vehicles/sim';
import { GARAGE } from '../world/cityGen';
import { audio, sfx } from '../audio';

const GARAGE_CAP = GARAGE.slots.length;
type App = 'home' | 'motors' | 'garage' | 'settings';

/** Side view drawn from the same profile the 3D model is extruded from. */
export function CarSVG({ kind, color }: { kind: VKind; color: string }) {
  const d = VDEFS[kind], P = PROF[kind], wb = d.wheelbase / 2, r = d.wheelR;
  const pts = (a: number[][]) => a.map((p) => `${p[0].toFixed(2)},${(-p[1]).toFixed(2)}`).join(' ');
  const wheel = (x: number) => <g key={x}><circle cx={x} cy={-r} r={r} fill="#111" /><circle cx={x} cy={-r} r={r * 0.6} fill="#c9ccd3" /></g>;
  let body;
  if (P) body = <><polygon points={pts(P.glass)} fill="#5a6f8f" /><polygon points={pts(P.lower)} fill={color} /></>;
  else if (kind === 'truck') body = <><rect x={-3.6} y={-3.25} width={5.15} height={2.6} fill="#f1efe9" /><rect x={1.65} y={-2.9} width={1.9} height={2.3} fill={color} /><rect x={2.6} y={-2.75} width={0.9} height={0.75} fill="#18202d" /><rect x={-3.6} y={-0.78} width={7.2} height={0.35} fill="#222" /></>;
  else body = <><polygon points="-0.6,-0.95 0.45,-0.85 0.75,-0.6 0.3,-0.45 -0.55,-0.5" fill={color} /><rect x={0.5} y={-1.08} width={0.08} height={0.6} fill="#c9ccd3" transform="rotate(-18 0.54 -0.8)" /><rect x={-0.55} y={-1.02} width={0.55} height={0.1} fill="#222" /></>;
  const half = kind === 'truck' ? 3.9 : kind === 'bike' ? 1.25 : 2.6, top = kind === 'truck' ? 3.4 : kind === 'bike' ? 1.3 : 1.95;
  return <svg viewBox={`${-half} ${-top} ${half * 2} ${top + 0.05}`} className="carsvg" aria-hidden="true">{body}{kind === 'truck' ? [d.len / 2 - 1.0, -d.len / 2 + 1.3, -d.len / 2 + 2.3].map(wheel) : [wb, -wb].map(wheel)}</svg>;
}

/** Two-tap confirm (window.confirm is blocked inside sandboxed frames). */
function ConfirmBtn({ label, ask, onOk, disabled, cls }: { label: string; ask: string; onOk: () => void; disabled?: boolean; cls?: string }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 3000); return () => clearTimeout(t); }, [arm]);
  return <button type="button" className={(cls || '') + (arm ? ' armed' : '')} disabled={disabled} onClick={() => { if (arm) { setArm(false); onOk(); } else setArm(true); }}>{arm ? ask : label}</button>;
}

const bar = (v: number) => <i className="sbar"><b style={{ width: Math.round(Math.min(1, v) * 100) + '%' }} /></i>;

function Motors({ buy }: { buy: (k: VKind, c: string) => void }) {
  const [col, setCol] = useState<Record<string, string>>({});
  const full = ownedCars.length >= GARAGE_CAP;
  return (
    <div className="appBody">
      <p className="appNote">購入した車はセーフハウス近くの<b>ガレージ</b>に届きます（{ownedCars.length}/{GARAGE_CAP}台）</p>
      {DEALER.map((k) => {
        const d = VDEFS[k], c = col[k] || d.colors[0], can = game.money >= d.price && !full;
        return (
          <div className="carCard" key={k}>
            <CarSVG kind={k} color={c} />
            <div className="carHead"><b>{d.name}</b><span>${d.price.toLocaleString('en-US')}</span></div>
            <p className="blurb">{d.blurb}</p>
            <div className="stats">
              <span>最高速 {Math.round(d.top * 3.6)} km/h</span>{bar(d.top / 90)}
              <span>加速</span>{bar(d.accel / 11)}
              <span>ハンドリング</span>{bar((d.grip * d.steer) / 0.8)}
              <span>耐久</span>{bar(d.hp / 220)}
            </div>
            <div className="swatches">{d.colors.map((cc) => <button type="button" key={cc} aria-label={'色 ' + cc} className={cc === c ? 'on' : ''} style={{ background: cc }} onClick={() => setCol({ ...col, [k]: cc })} />)}</div>
            <button type="button" className="buy" disabled={!can} onClick={() => buy(k, c)}>{full ? 'ガレージが満車' : game.money < d.price ? '資金不足' : '購入する'}</button>
          </div>
        );
      })}
    </div>
  );
}

function Garage({ refresh, close }: { refresh: () => void; close: () => void }) {
  const damaged = vehicles.some((v) => v.owned >= 0 && v.hp < v.def.hp);
  const status = (i: number) => {
    const v = vehicles.find((q) => q.owned === i);
    if (!v) return 'ガレージ保管中';
    if (v.id === game.inCar) return '運転中';
    if (v.dead) return '大破';
    return v.touched ? '街に駐車中' : 'ガレージ';
  };
  const call = (i: number) => {
    if (game.where !== 'out') { toast('外に出てから呼んでください'); return; }
    const p = game.player; if (deliverNear(i, p.x, p.z, p.yaw)) { sfx('ui'); toast(VDEFS[ownedCars[i].kind].name + 'を近くに届けた'); close(); } else toast('近くに空きスペースがない');
  };
  return (
    <div className="appBody">
      <div className="gHead">
        <span>{ownedCars.length}/{GARAGE_CAP}台</span>
        <button type="button" onClick={() => { game.waypoint = { x: GARAGE.x, z: GARAGE.z }; save(); toast('ガレージを目的地に設定'); close(); }}>ガレージへ案内</button>
        <button type="button" disabled={!damaged || game.money < 250} onClick={() => { game.money -= 250; repairAll(); sfx('buy'); toast('全車を修理した（$250）'); save(); refresh(); }}>全車修理 $250</button>
      </div>
      {ownedCars.length === 0 && <p className="appNote">まだ車がありません。Bay Motors で購入できます。</p>}
      {ownedCars.map((o, i) => {
        const v = vehicles.find((q) => q.owned === i), st = status(i), d = VDEFS[o.kind];
        return (
          <div className="gRow" key={i + o.kind + o.color}>
            <CarSVG kind={o.kind} color={o.color} />
            <div className="gInfo"><b>{d.name}</b><span>{st}{v && !v.dead ? ` · 状態 ${Math.round((v.hp / d.hp) * 100)}%` : ''}</span></div>
            <div className="gBtns">
              <button type="button" disabled={st === '運転中'} onClick={() => call(i)}>呼ぶ</button>
              <button type="button" disabled={!v || st === '運転中'} onClick={() => { if (!v) return; game.waypoint = { x: v.x, z: v.z }; save(); toast('車の位置を目的地に設定'); close(); }}>場所</button>
              <ConfirmBtn label="売る" ask={'$' + Math.round(d.price * 0.5).toLocaleString('en-US') + 'で売却'} disabled={st === '運転中'} onOk={() => { const g = sellOwned(i); game.money += g; sfx('buy'); toast('売却 +$' + g.toLocaleString('en-US')); save(); refresh(); }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Settings({ quality, setQuality, refresh }: { quality: Quality; setQuality: (q: Quality) => void; refresh: () => void }) {
  return (
    <div className="appBody">
      <div className="setRow"><span>画質</span><div className="seg">{(['low', 'medium', 'high'] as Quality[]).map((q) => <button type="button" key={q} className={q === quality ? 'on' : ''} onClick={() => setQuality(q)}>{{ low: '低', medium: '中', high: '高' }[q]}</button>)}</div></div>
      <div className="setRow"><span>サウンド</span><div className="seg"><button type="button" className={!audio.muted ? 'on' : ''} onClick={() => { audio.muted = false; save(); refresh(); }}>オン</button><button type="button" className={audio.muted ? 'on' : ''} onClick={() => { audio.muted = true; save(); refresh(); }}>オフ</button></div></div>
      <div className="setRow"><span>セーブ</span><button type="button" className="plain" onClick={() => { save(); toast('保存しました'); }}>今すぐ保存</button></div>
      <div className="setRow"><span>データ</span><ConfirmBtn cls="plain danger" label="最初からやり直す" ask="もう一度タップで消去" onOk={() => { clearSave(); location.reload(); }} /></div>
      <p className="appNote">画質「低」は影をオフにして最も軽くなります。iPhoneで重いときは「低」にしてください。</p>
    </div>
  );
}

export default function Phone({ onClose, openMap, quality, setQuality }: { onClose: () => void; openMap: () => void; quality: Quality; setQuality: (q: Quality) => void }) {
  const [app, setApp] = useState<App>('home');
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { const id = setInterval(refresh, 500); return () => clearInterval(id); }, []);
  const hh = Math.floor(game.hour), mm = Math.floor((game.hour - hh) * 60);
  const open = (a: App) => { sfx('ui'); setApp(a); };
  const buy = (k: VKind, c: string) => {
    const d = VDEFS[k]; if (game.money < d.price || ownedCars.length >= GARAGE_CAP) return;
    game.money -= d.price; ownedCars.push({ kind: k, color: c }); game.waypoint = { x: GARAGE.x, z: GARAGE.z };
    sfx('buy'); toast(d.name + 'を購入！ガレージに納車しました（目的地に設定）', 3.2); save(); refresh();
  };
  const title = { home: '', motors: 'Bay Motors', garage: 'ガレージ', settings: '設定' }[app];
  return (
    <div className="overlay phoneWrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="phone" role="dialog" aria-label="スマートフォン">
        <div className="pStatus"><span>{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}</span><span>${game.money.toLocaleString('en-US')}</span></div>
        {app === 'home' ? (
          <div className="homeGrid">
            <button type="button" className="appIc" onClick={() => open('motors')}><i style={{ background: 'linear-gradient(135deg,#ff3f93,#ff9a3a)' }}>🏎</i>Bay Motors</button>
            <button type="button" className="appIc" onClick={() => open('garage')}><i style={{ background: 'linear-gradient(135deg,#3dffb0,#1c8f7a)' }}>🅿</i>ガレージ</button>
            <button type="button" className="appIc" onClick={() => { sfx('ui'); onClose(); openMap(); }}><i style={{ background: 'linear-gradient(135deg,#2be4ff,#2b6bff)' }}>🗺</i>マップ</button>
            <button type="button" className="appIc" onClick={() => open('settings')}><i style={{ background: 'linear-gradient(135deg,#8a8aa8,#3c3c55)' }}>⚙</i>設定</button>
          </div>
        ) : (
          <>
            <div className="appTop"><button type="button" onClick={() => open('home')} aria-label="戻る">‹ 戻る</button><b>{title}</b><span /></div>
            {app === 'motors' && <Motors buy={buy} />}
            {app === 'garage' && <Garage refresh={refresh} close={onClose} />}
            {app === 'settings' && <Settings quality={quality} setQuality={setQuality} refresh={refresh} />}
          </>
        )}
        <button type="button" className="pHome" onClick={onClose} aria-label="スマホを閉じる">閉じる</button>
      </div>
    </div>
  );
}
