import { useReducer, useRef, useState } from 'react';
import { game } from '../state/store';
import { INTERIORS } from '../world/Interiors';
import { SHOP_DEFS, ITEMS, ITEM_IDS, buyGoods, cantBuy, meal, priceOf } from '../crime/shops';
import { discount } from '../crime/events';

/** Counter of a shop you can use (convenience store, ticket machine, cafe, bar, pharmacy, diner): buy and eat or pocket things. */
export default function ShopPanel({ kind, onClose }: { kind: string; onClose: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0), [msg, setMsg] = useState('');
  // things you keep fly from the counter into your bag, which gives a little hop
  const bag = useRef<HTMLSpanElement>(null), [fly, setFly] = useState<{ k: number; icon: string; x: number; y: number; dx: number; dy: number }[]>([]), [hop, setHop] = useState(0);
  const flyIn = (icon: string, from: HTMLElement) => {
    const a = from.getBoundingClientRect(), b = bag.current?.getBoundingClientRect(); if (!b) return;
    const k = performance.now(), x = a.left + a.width / 2, y = a.top + a.height / 2;
    setFly((f) => [...f, { k, icon, x, y, dx: b.left + b.width / 2 - x, dy: b.top + b.height / 2 - y }]);
    setTimeout(() => { setFly((f) => f.filter((q) => q.k !== k)); setHop((h) => h + 1); }, 650);
  };
  const S = SHOP_DEFS[kind]; if (!S) return null;
  const name = INTERIORS[game.where]?.name || S.title;
  return (
    <div className="overlay shopWrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'shop food ' + kind} role="dialog" aria-label={name}>
        <div className="shopHead"><b>{name}</b><span className={'shopBag' + (hop % 2 ? ' hopA' : hop ? ' hopB' : '')} ref={bag} aria-label="持ち物">{kind === 'konbini' ? '🛍️' : '👜'}<i>{ITEM_IDS.reduce((a, k) => a + game.items[k], 0)}</i></span><span>${game.money.toLocaleString('en-US')}</span></div>
        <p className="shopSub">{S.title}　体力 {Math.round(game.health)} / 100　{ITEM_IDS.filter((k) => game.items[k] > 0).map((k) => `${ITEMS[k].icon}${game.items[k]}`).join(' ')}</p>
        {S.goods.map((g) => {
          const why = cantBuy(g);
          return (
            <div className="shopRow" key={g.id}>
              <div><b>{g.name}</b><span>{g.sub}{g.carry ? `（所持 ${game.items[g.carry]}/${ITEMS[g.carry].max}）` : ''}</span></div>
              <button type="button" disabled={!!why} title={why} onClick={(e) => { const btn = e.currentTarget, before = g.carry ? game.items[g.carry] : 0; const m = buyGoods(kind, g); setMsg(m); refresh(); if (g.carry && game.items[g.carry] > before) flyIn(ITEMS[g.carry].icon, btn); if (g.ticket && meal.ticket === g) { flyIn('🎫', btn); setTimeout(onClose, 900); } }}>{why && why !== 'お金が足りない' ? (g.ticket ? '購入済み' : '満杯') : '$' + priceOf(g)}</button>
            </div>
          );
        })}
        {msg && <p className="shopMsg" role="status">{msg}</p>}
        {fly.map((f) => <span key={f.k} className="flyItem" style={{ left: f.x, top: f.y, ['--dx' as string]: f.dx + 'px', ['--dy' as string]: f.dy + 'px' }}>{f.icon}</span>)}
        {discount() < 1 && <p className="shopMsg">🤝 評判がいいので 10% 引き</p>}
        <p className="appNote">{S.note}</p>
        <button type="button" className="pHome" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
