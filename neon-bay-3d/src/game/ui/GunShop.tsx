import { useReducer } from 'react';
import { game, toast } from '../state/store';
import { WEAPONS, ARMOR_PRICE, buy } from '../combat/weapons';

/** BAY ARMS counter: buy guns, ammo and body armour. */
export default function GunShop({ onClose }: { onClose: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const A = game.arms;
  const item = (key: Parameters<typeof buy>[0], title: string, sub: string, price: number, owned = false) => (
    <div className="shopRow" key={key}>
      <div><b>{title}</b><span>{sub}</span></div>
      <button type="button" disabled={owned || game.money < price} onClick={() => { const err = buy(key); toast(err || title + 'を購入', 1.6); refresh(); }}>{owned ? '購入済み' : '$' + price.toLocaleString('en-US')}</button>
    </div>
  );
  return (
    <div className="overlay shopWrap">
      <div className="shop" role="dialog" aria-label="BAY ARMS">
        <div className="shopHead"><b>BAY ARMS</b><span>${game.money.toLocaleString('en-US')}</span></div>
        {item('pistol', WEAPONS.pistol.name, `1発34ダメージ · 連射0.3秒 · 弾${WEAPONS.pistol.pack}発付き`, WEAPONS.pistol.price, A.owned.pistol)}
        {item('smg', WEAPONS.smg.name, `フルオート · 1発17ダメージ · 弾${WEAPONS.smg.pack}発付き`, WEAPONS.smg.price, A.owned.smg)}
        {item('pistolAmmo', 'ピストル弾 ×' + WEAPONS.pistol.pack, '所持 ' + A.ammo.pistol + '発', WEAPONS.pistol.ammoPrice)}
        {item('smgAmmo', 'SMG弾 ×' + WEAPONS.smg.pack, '所持 ' + A.ammo.smg + '発', WEAPONS.smg.ammoPrice)}
        {item('armor', '防弾ベスト', '被ダメージを先に吸収 · 現在 ' + Math.round(A.armor) + '%', ARMOR_PRICE, A.armor >= 100)}
        <p className="appNote">銃を持つとコンビニ強盗・カツアゲができる。人前や警察の近くで撃つと手配される。</p>
        <button type="button" className="pHome" onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}
