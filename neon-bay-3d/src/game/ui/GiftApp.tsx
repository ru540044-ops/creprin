import { REGION } from '../world/region';
import { useEffect, useState } from 'react';
import { game, toast, save, progress, ownedCars } from '../state/store';
import { VDEFS } from '../vehicles/defs';
import { playerCar } from '../vehicles/sim';
import { sfx } from '../audio';
import { DAILY, dailyState, claimDaily, rewardLabel, net, unclaimed, claimNet, giftBoxes, nearestBox, CARD_CASH, CARD_KINDS, makeCashCard, makeVehicleCard, redeemCard, boxesFound } from '../crime/gifts';

const money = (n: number) => '$' + n.toLocaleString('en-US');

/** Two-tap button (window.confirm is blocked in the artifact frame). */
function Two({ label, ask, onOk, disabled }: { label: string; ask: string; onOk: () => void; disabled?: boolean }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 3000); return () => clearTimeout(t); }, [arm]);
  return <button type="button" className={arm ? 'armed' : ''} disabled={disabled} onClick={() => { if (arm) { setArm(false); onOk(); } else setArm(true); }}>{arm ? ask : label}</button>;
}

export default function GiftApp({ close, refresh }: { close: () => void; refresh: () => void }) {
  const [code, setCode] = useState(''), [made, setMade] = useState(''), [msg, setMsg] = useState(''), [veh, setVeh] = useState(-1);
  const ds = dailyState(), list = net.list, boxes = giftBoxes(), found = boxesFound(), me = playerCar();
  const copy = async () => { try { await navigator.clipboard.writeText(made); toast('コードをコピーした', 1.4); } catch { toast('長押しで選択してコピーしてください', 1.8); } };
  return (
    <div className="appBody">
      <div className="jobCard gift">
        <b>🎁 ログインボーナス（毎日）</b>
        <div className="daily">{DAILY.map((r, i) => {
          const day = i + 1, done = ds.can ? day < ds.day : day <= ds.day, now = ds.can && day === ds.day;
          return <div key={day} className={'dcell' + (done ? ' done' : '') + (now ? ' now' : '')}><span>{day}日目</span><b>{rewardLabel(r)}</b></div>;
        })}</div>
        <p>毎日ログインすると連続日数に応じて豪華になります（7日目はジェットスキー）。1日空くと1日目に戻ります。</p>
        <div className="jobBtns"><button type="button" disabled={!ds.can} onClick={() => { claimDaily(); refresh(); }}>{ds.can ? `${ds.day}日目を受け取る` : '今日は受け取り済み（また明日）'}</button></div>
      </div>

      <div className="jobCard gift">
        <b>📬 運営からのギフト</b>
        {net.state === 'off' && <p>claude.ai でこのゲームを開くと、オーナーが配布したギフトを受け取れます。</p>}
        {net.state === 'loading' && <p>受信中…</p>}
        {net.state === 'error' && <p>ギフトサーバーに接続できません。しばらくしてからもう一度開いてください。</p>}
        {net.state === 'ready' && list.length === 0 && <p>今は配布中のギフトはありません。</p>}
        {list.map((g) => {
          const got = progress.gift.claimed.includes(g.id);
          return (
            <div className="trow gnet" key={g.id}>
              <span><b>{g.title}</b>{g.msg ? <em>{g.msg}</em> : null}<i>{rewardLabel(g.reward)}</i></span>
              <div className="jobBtns"><button type="button" disabled={got} onClick={() => { claimNet(g.id); refresh(); }}>{got ? '受け取り済み' : '受け取る'}</button></div>
            </div>
          );
        })}
        {net.state === 'ready' && unclaimed().length > 1 && <div className="jobBtns"><button type="button" onClick={() => { for (const g of unclaimed()) claimNet(g.id); refresh(); }}>すべて受け取る</button></div>}
      </div>

      <div className="jobCard gift">
        <b>💳 ギフトカード（友達にプレゼント）</b>
        <p>お金か持っている乗り物をカードにして、コードを友達に送ろう。友達はこの画面でコードを入れると受け取れます（1枚につき1回）。</p>
        <div className="jobBtns">{CARD_CASH.map((v, i) => <Two key={v} label={money(v)} ask={money(v) + 'で作る'} disabled={game.money < v} onOk={() => { const c = makeCashCard(i); if (c) { setMade(c); setMsg(''); refresh(); } }} />)}</div>
        {ownedCars.length > 0 && (
          <div className="trow">
            <select value={veh} onChange={(e) => setVeh(Number(e.target.value))} aria-label="プレゼントする乗り物">
              <option value={-1}>乗り物をプレゼント…</option>
              {ownedCars.map((o, i) => <option key={i} value={i} disabled={!CARD_KINDS.includes(o.kind) || (me ? me.owned === i : false)}>{VDEFS[o.kind].name}</option>)}
            </select>
            <div className="jobBtns"><Two label="カードにする" ask="手放してカード化" disabled={veh < 0} onOk={() => { const c = makeVehicleCard(veh); if (c) { setMade(c); setVeh(-1); setMsg(''); refresh(); } else toast('運転中の乗り物はカードにできない', 1.6); }} /></div>
          </div>
        )}
        {made && <div className="gcode"><span>このコードを友達に送ってね</span><b>{made}</b><div className="jobBtns"><button type="button" onClick={copy}>コピー</button></div></div>}
        <div className="trow">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="NB-XXX-XXX-XXX" aria-label="ギフトコード" maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
          <div className="jobBtns"><button type="button" disabled={code.trim().length < 9} onClick={() => { const r = redeemCard(code); setMsg(r.msg); if (r.ok) { setCode(''); toast('🎁 ' + r.msg, 3); } else sfx('ui'); refresh(); }}>受け取る</button></div>
        </div>
        {msg && <p className="gmsg">{msg}</p>}
      </div>

      <div className="jobCard gift">
        <b>📦 隠しギフトボックス</b>
        <p>{REGION.name}のどこかに光るギフトボックスが {boxes.length} 個（街ごとに別の箱）。歩くか車で触れると開く。10個・25個・40個でボーナス、全部集めるとApex F1。</p>
        <span className="pay">発見 {found}/{boxes.length}</span>
        <div className="jobBtns"><button type="button" disabled={found >= boxes.length || game.money < 500} onClick={() => {
          const o = game.where === 'out' ? game.player : game.outsidePos, b = nearestBox(o.x, o.z); if (!b) return;
          game.money -= 500; game.waypoint = { x: b.x, z: b.z }; save(); sfx('buy'); toast(`ヒント：${b.hint}（目的地に設定・$500）`, 2.6); close();
        }}>一番近い箱のヒント（$500）</button></div>
      </div>
    </div>
  );
}
