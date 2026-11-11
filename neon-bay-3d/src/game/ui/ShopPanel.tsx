import { useReducer, useState } from 'react';
import { game } from '../state/store';
import { INTERIORS } from '../world/Interiors';
import { SHOP_DEFS, ITEMS, ITEM_IDS, buyGoods, cantBuy, meal } from '../crime/shops';

/** Counter of a shop you can use (convenience store, ticket machine, cafe, bar, pharmacy, diner): buy and eat or pocket things. */
export default function ShopPanel({ kind, onClose }: { kind: string; onClose: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0), [msg, setMsg] = useState('');
  const S = SHOP_DEFS[kind]; if (!S) return null;
  const name = INTERIORS[game.where]?.name || S.title;
  return (
    <div className="overlay shopWrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'shop food ' + kind} role="dialog" aria-label={name}>
        <div className="shopHead"><b>{name}</b><span>${game.money.toLocaleString('en-US')}</span></div>
        <p className="shopSub">{S.title}　体力 {Math.round(game.health)} / 100　{ITEM_IDS.filter((k) => game.items[k] > 0).map((k) => `${ITEMS[k].icon}${game.items[k]}`).join(' ')}</p>
        {S.goods.map((g) => {
          const why = cantBuy(g);
          return (
            <div className="shopRow" key={g.id}>
              <div><b>{g.name}</b><span>{g.sub}{g.carry ? `（所持 ${game.items[g.carry]}/${ITEMS[g.carry].max}）` : ''}</span></div>
              <button type="button" disabled={!!why} title={why} onClick={() => { const m = buyGoods(kind, g); setMsg(m); refresh(); if (g.ticket && meal.ticket === g) setTimeout(onClose, 700); }}>{why && why !== 'お金が足りない' ? (g.ticket ? '購入済み' : '満杯') : '$' + g.price}</button>
            </div>
          );
        })}
        {msg && <p className="shopMsg" role="status">{msg}</p>}
        <p className="appNote">{S.note}</p>
        <button type="button" className="pHome" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
