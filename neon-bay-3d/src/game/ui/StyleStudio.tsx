import { useEffect, useReducer, useRef, useState } from 'react';
import { game, progress, save, toast } from '../state/store';
import { sfx } from '../audio';
import { styleCam } from '../player/Player';
import {
  Appearance, SKINS, HAIR_COLORS, EYE_COLORS, CLOTH, LIPS, HAIR_STYLES, HAIR_NAMES, BEARDS, BEARD_NAMES, TOPS, TOP_NAMES, BOTTOMS, BOTTOM_NAMES, HATS, HAT_NAMES, GLASSES, GLASSES_NAMES,
  ITEMS, Item, itemById, lookState, drawWatch, drawBag, monogramCanvas, fashion, setCityStyle, CityStyle, CITY_STYLE_NAMES,
} from '../player/appearance';

type Tab = 'face' | 'hair' | 'top' | 'bottom' | 'acc' | 'shop' | 'city';
const TABS: [Tab, string][] = [['face', '顔・体'], ['hair', '髪'], ['top', 'トップス'], ['bottom', 'ボトムス'], ['acc', '小物'], ['shop', 'ブティック'], ['city', '街の人']];
const FACE_NAMES = ['卵型', 'ほっそり', 'しっかり', '小顔', '頬骨', '彫り深め'];
const money = (n: number) => '$' + n.toLocaleString('en-US');

/** Item picture for the boutique cards, drawn straight into an on-screen canvas (no image encoding). */
function ItemArt({ it }: { it: Item }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const c = cv.getContext('2d')!;
    if (it.slot === 'watch') drawWatch(c, it.model, 160, 120);
    else if (it.slot === 'bag') drawBag(c, it.model, 160, 120);
    else { c.clearRect(0, 0, 160, 120); const pat = c.createPattern(monogramCanvas(96), 'repeat')!; c.fillStyle = pat; if (it.slot === 'top') { c.beginPath(); c.moveTo(45, 20); c.lineTo(115, 20); c.lineTo(140, 50); c.lineTo(122, 60); c.lineTo(115, 50); c.lineTo(115, 108); c.lineTo(45, 108); c.lineTo(45, 50); c.lineTo(38, 60); c.lineTo(20, 50); c.closePath(); c.fill(); } else if (it.slot === 'hat') { c.beginPath(); c.ellipse(80, 70, 46, 34, 0, Math.PI, 0); c.fill(); c.fillRect(70, 66, 70, 10); } else { c.beginPath(); c.roundRect(25, 60, 110, 34, 14); c.fill(); c.fillStyle = '#efe9df'; c.fillRect(25, 86, 110, 10); } }
  }, [it]);
  return <canvas ref={ref} width={160} height={120} aria-hidden="true" />;
}
function ItemCard({ it, owned, worn, onBuy, onWear }: { it: Item; owned: boolean; worn: boolean; onBuy: () => void; onWear: () => void }) {
  return (
    <div className={'icard' + (worn ? ' worn' : '')}>
      <ItemArt it={it} />
      <i>{it.brand}</i><b>{it.name}</b><span>{it.desc}</span>
      {owned ? <button type="button" className={worn ? 'on' : ''} onClick={onWear}>{worn ? '着用中（外す）' : '身につける'}</button>
        : <button type="button" className="buy" disabled={game.money < it.price} onClick={onBuy}>{game.money < it.price ? '資金不足 ' : '購入 '}{money(it.price)}</button>}
    </div>
  );
}
const Sw = ({ cols, val, set, label }: { cols: string[]; val: number; set: (i: number) => void; label: string }) => (
  <div className="srow2"><span>{label}</span><div className="sws">{cols.map((c, i) => <button type="button" key={i} aria-label={label + ' ' + (i + 1)} className={i === val ? 'on' : ''} style={{ background: c || 'linear-gradient(135deg,#fff 45%,#e33 50%,#fff 55%)' }} onClick={() => set(i)} />)}</div></div>
);
function Opts<T extends string>({ list, names, val, set, label }: { list: readonly T[]; names: Record<T, string>; val: T; set: (v: T) => void; label: string }) {
  return <div className="srow2"><span>{label}</span><div className="opts">{list.map((v) => <button type="button" key={v} className={v === val ? 'on' : ''} onClick={() => set(v)}>{names[v]}</button>)}</div></div>;
}

/** Character creator and wardrobe: live 3D preview on the player, boutique for the luxury pieces, the city's fashion mood. */
export default function StyleStudio({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('face');
  const [, re] = useReducer((x: number) => x + 1, 0);
  const L = progress.look, own = (id: string) => progress.wardrobe.includes(id);
  useEffect(() => { game.styling = true; styleCam.rot = 0; styleCam.zoom = true; return () => { game.styling = false; styleCam.zoom = false; }; }, []);
  useEffect(() => { styleCam.zoom = tab === 'face' || tab === 'hair'; }, [tab]);
  const set = <K extends keyof Appearance>(k: K, v: Appearance[K]) => { (L as Appearance)[k] = v; lookState.ver++; sfx('ui', 0.4); re(); };
  const buy = (it: Item) => { if (game.money < it.price || own(it.id)) return; game.money -= it.price; progress.wardrobe.push(it.id); sfx('buy'); toast(`${it.brand} ${it.name} を購入した`, 2.4); wear(it, true); save(); };
  const wear = (it: Item, on: boolean) => {
    if (it.slot === 'watch') set('watch', on ? it.id : ''); else if (it.slot === 'bag') set('bag', on ? it.id : '');
    else if (it.slot === 'top') { set('luxTop', on); if (on) set('top', 'blazer'); } else if (it.slot === 'hat') { set('luxHat', on); if (on) set('hat', 'cap'); } else set('luxShoes', on);
  };
  const worn = (it: Item) => (it.slot === 'watch' ? L.watch === it.id : it.slot === 'bag' ? L.bag === it.id : it.slot === 'top' ? L.luxTop && L.top === 'blazer' : it.slot === 'hat' ? L.luxHat && L.hat === 'cap' : L.luxShoes);
  const close = () => { save(); sfx('ui'); onClose(); };
  const ownedOf = (slot: Item['slot']) => ITEMS.filter((i) => i.slot === slot && own(i.id));
  return (
    <div className="studio">
      <div className="stage" onPointerDown={(e) => { (e.currentTarget as HTMLElement).dataset.x = String(e.clientX); }} onPointerMove={(e) => { const el = e.currentTarget as HTMLElement; if (!el.dataset.x || e.buttons === 0 && e.pointerType === 'mouse') return; const x = +el.dataset.x; styleCam.rot -= (e.clientX - x) * 0.012; el.dataset.x = String(e.clientX); }} onPointerUp={(e) => { delete (e.currentTarget as HTMLElement).dataset.x; }}>
        <div className="stage-btns">
          <button type="button" onClick={() => { styleCam.rot += 0.5; }} aria-label="左に回す">⟲</button>
          <button type="button" onClick={() => { styleCam.zoom = !styleCam.zoom; re(); }}>{styleCam.zoom ? '全身' : '顔'}</button>
          <button type="button" onClick={() => { styleCam.rot -= 0.5; }} aria-label="右に回す">⟳</button>
        </div>
      </div>
      <div className="spanel">
        <div className="stop"><b>スタイル</b><span>${game.money.toLocaleString('en-US')}</span><button type="button" className="done" onClick={close}>完了</button></div>
        <div className="stabs">{TABS.map(([t, n]) => <button type="button" key={t} className={t === tab ? 'on' : ''} onClick={() => { sfx('ui', 0.5); setTab(t); }}>{n}</button>)}</div>
        <div className="sbody">
          {tab === 'face' && <>
            <div className="srow2"><span>体型</span><div className="opts"><button type="button" className={!L.fem ? 'on' : ''} onClick={() => set('fem', false)}>がっしり</button><button type="button" className={L.fem ? 'on' : ''} onClick={() => set('fem', true)}>しなやか</button></div></div>
            <label className="srow2"><span>身長</span><input type="range" min={0.94} max={1.06} step={0.01} value={L.height} onChange={(e) => set('height', +e.target.value)} /></label>
            <Sw label="肌の色" cols={SKINS} val={L.skin} set={(i) => set('skin', i)} />
            <div className="srow2"><span>顔の形</span><div className="opts">{FACE_NAMES.map((n, i) => <button type="button" key={n} className={i === L.face ? 'on' : ''} onClick={() => set('face', i)}>{n}</button>)}</div></div>
            <Sw label="瞳の色" cols={EYE_COLORS} val={L.eye} set={(i) => set('eye', i)} />
            <div className="srow2"><span>眉</span><div className="opts">{['細め', '普通', '太め'].map((n, i) => <button type="button" key={n} className={i === L.brow ? 'on' : ''} onClick={() => set('brow', i)}>{n}</button>)}</div></div>
            <Sw label="リップ" cols={LIPS} val={L.lips} set={(i) => set('lips', i)} />
            <Opts label="ひげ" list={BEARDS} names={BEARD_NAMES} val={L.beard} set={(v) => set('beard', v)} />
          </>}
          {tab === 'hair' && <>
            <Opts label="髪型" list={HAIR_STYLES} names={HAIR_NAMES} val={L.hair} set={(v) => set('hair', v)} />
            <Sw label="髪の色" cols={HAIR_COLORS} val={L.hairColor} set={(i) => set('hairColor', i)} />
          </>}
          {tab === 'top' && <>
            <Opts label="トップス" list={TOPS} names={TOP_NAMES} val={L.top} set={(v) => { set('top', v); if (v === 'dress') set('bottom', 'skirt'); if (v !== 'blazer') set('luxTop', false); }} />
            <Sw label="色" cols={CLOTH} val={L.topColor} set={(i) => set('topColor', i)} />
            {own('ml_jacket') && <div className="srow2"><span>MAISON LAVELLE</span><div className="opts"><button type="button" className={L.luxTop && L.top === 'blazer' ? 'on' : ''} onClick={() => wear(itemById('ml_jacket')!, !(L.luxTop && L.top === 'blazer'))}>モノグラム ジャケット</button></div></div>}
          </>}
          {tab === 'bottom' && <>
            <Opts label="ボトムス" list={BOTTOMS} names={BOTTOM_NAMES} val={L.bottom} set={(v) => set('bottom', v)} />
            <Sw label="色" cols={CLOTH} val={L.bottomColor} set={(i) => set('bottomColor', i)} />
            <Sw label="靴の色" cols={CLOTH} val={L.shoeColor} set={(i) => { set('shoeColor', i); set('luxShoes', false); }} />
            {own('ml_sneak') && <div className="srow2"><span>MAISON LAVELLE</span><div className="opts"><button type="button" className={L.luxShoes ? 'on' : ''} onClick={() => set('luxShoes', !L.luxShoes)}>トレーナー スニーカー</button></div></div>}
          </>}
          {tab === 'acc' && <>
            <Opts label="帽子" list={HATS} names={HAT_NAMES} val={L.hat} set={(v) => { set('hat', v); if (v !== 'cap') set('luxHat', false); }} />
            {L.hat !== 'none' && <Sw label="帽子の色" cols={CLOTH} val={L.hatColor} set={(i) => { set('hatColor', i); set('luxHat', false); }} />}
            <Opts label="メガネ" list={GLASSES} names={GLASSES_NAMES} val={L.glasses} set={(v) => set('glasses', v)} />
            <div className="srow2"><span>腕時計</span><div className="opts"><button type="button" className={!L.watch ? 'on' : ''} onClick={() => set('watch', '')}>なし</button>{ownedOf('watch').map((i) => <button type="button" key={i.id} className={L.watch === i.id ? 'on' : ''} onClick={() => set('watch', i.id)}>{i.brand} {i.name}</button>)}</div></div>
            <div className="srow2"><span>バッグ</span><div className="opts"><button type="button" className={!L.bag ? 'on' : ''} onClick={() => set('bag', '')}>なし</button>{ownedOf('bag').map((i) => <button type="button" key={i.id} className={L.bag === i.id ? 'on' : ''} onClick={() => set('bag', i.id)}>{i.name}</button>)}</div></div>
            {own('ml_cap') && <div className="srow2"><span>MAISON LAVELLE</span><div className="opts"><button type="button" className={L.luxHat && L.hat === 'cap' ? 'on' : ''} onClick={() => wear(itemById('ml_cap')!, !(L.luxHat && L.hat === 'cap'))}>モノグラム キャップ</button></div></div>}
            {!ownedOf('watch').length && !ownedOf('bag').length && <p className="snote">腕時計とバッグは「ブティック」で買えます。</p>}
          </>}
          {tab === 'shop' && <>
            <p className="snote">ネオンベイの高級ブランド。買ったものは「小物」タブからいつでも身につけられます。</p>
            {(['SOLARE', 'AXEL VOSS', 'MAISON LAVELLE'] as const).map((br) => (
              <div key={br} className="brand">
                <h4>{br}<span>{{ SOLARE: 'スイスの名門ダイバーズ＆ドレスウォッチ', 'AXEL VOSS': '透けるムーブメントのハイパーウォッチ', 'MAISON LAVELLE': 'パリのモノグラム・メゾン' }[br]}</span></h4>
                <div className="icards">{ITEMS.filter((i) => i.brand === br).map((it) => <ItemCard key={it.id} it={it} owned={own(it.id)} worn={worn(it)} onBuy={() => buy(it)} onWear={() => wear(it, !worn(it))} />)}</div>
              </div>
            ))}
            <p className="snote">※ ブランドはすべてこのゲームのための架空のものです。</p>
          </>}
          {tab === 'city' && <>
            <p className="snote">街を歩く人たちのファッションの傾向を選べます（すぐに反映）。</p>
            <div className="opts big">{(Object.keys(CITY_STYLE_NAMES) as CityStyle[]).map((k) => <button type="button" key={k} className={fashion.style === k ? 'on' : ''} onClick={() => { setCityStyle(k); sfx('ui'); save(); re(); }}>{CITY_STYLE_NAMES[k]}</button>)}</div>
            <p className="snote">ハイブランドにすると、高級時計やモノグラムのバッグを持った人が増えます。</p>
          </>}
        </div>
      </div>
    </div>
  );
}
