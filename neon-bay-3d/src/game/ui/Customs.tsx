import { useReducer, useState } from 'react';
import { game, toast, save, ownedCars } from '../state/store';
import { playerCar } from '../vehicles/sim';
import { Mods, stockMods } from '../vehicles/defs';
import { CarSVG } from './Phone';
import { sfx } from '../audio';

const PAINTS = ['#e8141c', '#ff6a00', '#ffd23a', '#9dff3a', '#00c060', '#00e1ff', '#2b6bff', '#1d2c8a', '#7a00ff', '#ff2a9a', '#ff9ad5', '#f4f4ff', '#c0c4cc', '#6b6f78', '#2b2b30', '#0b0b0d', '#8a5a2b', '#c9a24a', '#3d6b4a', '#8a1f2b', '#00837a', '#b07aff', '#ff8a8a', '#d9f2ff'];
const NEONS = ['#ff2a9a', '#2be4ff', '#9dff3a', '#ffd23a', '#ff3a2a', '#7a00ff', '#ffffff', '#2b6bff'];
const WHEELS = ['', '#141414', '#ffd23a', '#e8141c', '#2be4ff', '#f4f4ff', '#c9a24a'];
const FINISH: [Mods['finish'], string, number][] = [['gloss', 'グロス', 0], ['matte', 'マット', 1500], ['pearl', 'パール', 3000], ['chrome', 'クローム', 6000]];
const LV = (n: number) => ['ノーマル', 'Lv1', 'Lv2', 'Lv3'][n];
const ENGINE = [0, 4000, 9000, 18000], ARMOR = [0, 3000, 7000, 14000];

/** BAY CUSTOMS: paint, finish, neon underglow, wheels, tint, engine, armour, nitro, repair. Applies to the car you are in. */
export default function Customs({ onClose }: { onClose: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [hue, setHue] = useState(200);
  const v = playerCar();
  if (!v) return null;
  const m = v.mods;
  const pay = (price: number, what: string, f: () => void) => {
    if (game.money < price) { toast('資金不足', 1.2); return; }
    game.money -= price; f(); sfx('buy');
    if (v.owned >= 0 && ownedCars[v.owned]) { ownedCars[v.owned].color = v.color; ownedCars[v.owned].mods = { ...m }; }
    save(); toast(what + (price ? ` -$${price.toLocaleString('en-US')}` : ''), 1.2); refresh();
  };
  const hsl = `hsl(${hue} 85% 50%)`, toHex = (h: number) => { const c = document.createElement('canvas').getContext('2d')!; c.fillStyle = `hsl(${h} 85% 50%)`; return c.fillStyle as string; };
  return (
    <div className="overlay shopWrap">
      <div className="shop customs" role="dialog" aria-label="BAY CUSTOMS">
        <div className="shopHead"><b>BAY CUSTOMS</b><span>${game.money.toLocaleString('en-US')}</span></div>
        <div className="cuPrev" style={{ boxShadow: m.neon ? `0 18px 30px -12px ${m.neon}` : undefined }}><CarSVG kind={v.def.kind} color={v.color} /><b>{v.def.name}</b>{v.owned < 0 && <span>（自分の車ではないので、改造はこの車にだけ残ります）</span>}</div>

        <h4 className="adH">塗装 $500</h4>
        <div className="swatches big">{PAINTS.map((c) => <button type="button" key={c} aria-label={'色 ' + c} className={v.color === c ? 'on' : ''} style={{ background: c }} onClick={() => pay(500, '塗装', () => { v.color = c; })} />)}</div>
        <div className="cuHue"><input type="range" min={0} max={359} value={hue} onChange={(e) => setHue(+e.target.value)} aria-label="カスタム色相" /><button type="button" style={{ background: hsl }} onClick={() => pay(800, 'カスタム塗装', () => { v.color = toHex(hue); })}>この色 $800</button></div>

        <h4 className="adH">仕上げ</h4>
        <div className="adRow">{FINISH.map(([f, n, p]) => <button type="button" key={f} className={m.finish === f ? 'sel' : ''} onClick={() => pay(p, n + '仕上げ', () => { m.finish = f; })}>{n}{p ? ` $${p.toLocaleString('en-US')}` : ''}</button>)}</div>

        <h4 className="adH">ネオン（車体下の光） $3,000</h4>
        <div className="swatches big">
          <button type="button" className={!m.neon ? 'on off' : 'off'} onClick={() => pay(0, 'ネオンなし', () => { m.neon = ''; })}>なし</button>
          {NEONS.map((c) => <button type="button" key={c} aria-label={'ネオン ' + c} className={m.neon === c ? 'on' : ''} style={{ background: c, boxShadow: `0 0 10px ${c}` }} onClick={() => pay(m.neon ? 500 : 3000, 'ネオン', () => { m.neon = c; })} />)}
        </div>

        <h4 className="adH">ホイール $800</h4>
        <div className="swatches big">{WHEELS.map((c) => <button type="button" key={c || 'chrome'} aria-label={c ? 'ホイール ' + c : 'クローム'} className={m.wheel === c ? 'on' : ''} style={{ background: c || 'linear-gradient(135deg,#f4f4f4,#8a8f9a)' }} onClick={() => pay(800, 'ホイール', () => { m.wheel = c; })} />)}</div>

        <h4 className="adH">性能</h4>
        <div className="cuRows">
          <div className="shopRow"><div><b>エンジン {LV(m.engine)}</b><span>加速 +{m.engine * 15}% · 最高速 +{m.engine * 6}%</span></div>{m.engine < 3 ? <button type="button" onClick={() => pay(ENGINE[m.engine + 1], 'エンジン ' + LV(m.engine + 1), () => { m.engine++; })}>${ENGINE[m.engine + 1].toLocaleString('en-US')}</button> : <button type="button" disabled>最大</button>}</div>
          <div className="shopRow"><div><b>装甲 {LV(m.armor)}</b><span>受けるダメージ -{Math.round((1 - 1 / (1 + m.armor * 0.5)) * 100)}%</span></div>{m.armor < 3 ? <button type="button" onClick={() => pay(ARMOR[m.armor + 1], '装甲 ' + LV(m.armor + 1), () => { m.armor++; })}>${ARMOR[m.armor + 1].toLocaleString('en-US')}</button> : <button type="button" disabled>最大</button>}</div>
          {v.def.kind !== 'heli' && <div className="shopRow"><div><b>ニトロ</b><span>ボタンで3秒間の超加速（12秒で回復）</span></div><button type="button" disabled={m.nitro} onClick={() => pay(6000, 'ニトロ', () => { m.nitro = true; })}>{m.nitro ? '装着済み' : '$6,000'}</button></div>}
          <div className="shopRow"><div><b>スモークガラス</b><span>窓を濃くする</span></div><button type="button" onClick={() => pay(m.tint ? 0 : 1200, m.tint ? 'スモーク解除' : 'スモークガラス', () => { m.tint = !m.tint; })}>{m.tint ? '外す' : '$1,200'}</button></div>
          <div className="shopRow"><div><b>修理</b><span>状態 {Math.round((v.hp / v.def.hp) * 100)}%</span></div><button type="button" disabled={v.hp >= v.def.hp && !v.dead} onClick={() => pay(300, '修理', () => { v.hp = v.def.hp; v.dead = false; v.burn = 0; })}>$300</button></div>
          <div className="shopRow"><div><b>全部ノーマルに戻す</b><span>改造を外す（返金なし）</span></div><button type="button" onClick={() => pay(0, 'ノーマルに戻した', () => { Object.assign(m, stockMods()); })}>リセット</button></div>
        </div>
        <button type="button" className="pHome" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
