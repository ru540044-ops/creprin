import { game, toast, progress, save } from '../state/store';
import { nearestPed, scare, Ped } from '../ai/peds';
import { ev, rep, addRep } from './events';
import { say, nextMission, missionElsewhere, mission } from './story';
import { nearest, CATS, PlaceCat } from '../ui/places';
import { setWanted, copSees } from './crime';
import { REGION } from '../world/region';
import { armed } from '../combat/weapons';
import { cine } from '../cine';
import { sfx } from '../audio';

/**
 * Talking to people on the street. Walk up to someone and you can greet them (they answer according to your name in the
 * city), ask the way to a ramen shop, a convenience store, a station or a shrine (the nearest one is put on your map
 * and they point you the right way), hear what is going on in the neighbourhood (which sometimes points you at a job), or
 * pick on them. Whoever you stop for stands still and looks at you until you are done.
 */
const SURN = ['田中', '佐藤', '鈴木', '高橋', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田'];
const JOBS = ['会社員', '大学生', '買い物帰りの人', '観光客', '主婦', 'お年寄り', '配達員'];
export const talkState = { ped: null as Ped | null, t: 0, count: 0 };
const personOf = (p: Ped) => ({ name: SURN[p.id % SURN.length], job: p.outfit === 2 ? '作業員' : p.outfit === 3 || p.state === 'jog' ? 'ランナー' : p.outfit === 1 ? '海水浴客' : p.state === 'fish' ? '釣り人' : p.state === 'dance' ? 'ダンサー' : p.state === 'sit' || p.state === 'lie' ? '休憩中の人' : JOBS[p.id % JOBS.length] });
const COMPASS = (dx: number, dz: number) => { const a = Math.atan2(dx, -dz), k = Math.round(a / (Math.PI / 4)); return ['北', '北東', '東', '南東', '南', '南西', '西', '北西', '北'][((k % 8) + 8) % 8]; }; // north is up the map, i.e. towards -z
const BUSY = new Set(['dead', 'down', 'flee', 'hands', 'handsup', 'cower', 'getup', 'enter', 'exit']);

/** The prompt: someone close enough to talk to. */
export function talkNear() {
  if (game.where !== 'out' || game.inCar || ev.choice || cine.lock || armed() || talkState.ped) return null;
  const p = game.player, q = nearestPed(p.x, p.z, 2.1);
  if (!q || BUSY.has(q.state) || Math.abs(q.y - p.y) > 1.2) return null;
  return { kind: 'job' as const, id: 'talk:' + q.id, label: '話しかける（' + personOf(q).job + '）', btn: '話す' };
}
export function talkAction(id: string) {
  const q = nearestPed(game.player.x, game.player.z, 3, true); if (!q || 'talk:' + q.id !== id) return;
  talkState.ped = q; talkState.t = 0; keep(q); face(q);
  const who = personOf(q), r = rep();
  const hello = () => {
    const night = game.hour > 19 || game.hour < 5;
    const line = r >= 5 ? `あっ、評判は聞いてますよ。いつも助かってます！` : r >= 1 ? (night ? 'こんばんは。夜道は気をつけてね。' : 'こんにちは。いい天気ですね。') : r <= -5 ? '…………（目をそらして足早に離れていく）' : r <= -1 ? '…何か用ですか。' : night ? 'こんばんは。' : 'こんにちは。';
    reply(q, line); if (r <= -5) { q.state = 'walk'; talkState.ped = null; }
    progress.stats.flags.talks = (progress.stats.flags.talks || 0) + 1; save();
  };
  ev.choice = {
    title: `${who.name}さん（${who.job}）`, who: '', text: r >= 5 ? '感じのいい笑顔で、こちらを見ている。' : r <= -5 ? '警戒した目でこちらを見ている。' : '立ち止まって、こちらを見ている。', options: [
      { label: '挨拶する', sub: '評判で返事が変わる', pick: () => { close(); hello(); } },
      { label: '道を聞く', sub: 'ラーメン・コンビニ・駅など', pick: () => { ask(q); } },
      { label: '噂話を聞く', sub: 'このあたりの話', pick: () => { close(); gossip(q); } },
      { label: '絡む', sub: '評判 -1', pick: () => { close(); provoke(q); } },
      { label: '立ち去る', pick: () => { close(); release(q); } },
    ],
  };
}
function close() { ev.choice = null; }
function keep(q: Ped) { q.state = 'idle'; q.t = Math.max(q.t, 3); q.vx = q.vz = 0; }
function face(q: Ped) { q.yaw = Math.atan2(game.player.x - q.x, game.player.z - q.z); }
function reply(q: Ped, text: string) { const w = personOf(q); say([{ who: `${w.name}さん`, text }]); talkState.t = 2.5 + text.length * 0.08; }
function release(q: Ped) { talkState.ped = null; if (q.state === 'idle') q.t = Math.min(q.t, 1); }

/** Ask the way: the kinds of place this city has, then the nearest of the kind you pick. */
function ask(q: Ped) {
  const p = game.player, opts: { label: string; sub?: string; pick: () => void }[] = [];
  for (const c of CATS) {
    if (c.id === 'senbei' && REGION.id !== 'nara') continue;
    const n = nearest(c.id as PlaceCat, p.x, p.z, 1)[0]; if (!n) continue;
    opts.push({ label: `${c.icon} ${c.name}`, sub: `約${Math.round(n.d / 10) * 10}m ${COMPASS(n.x - p.x, n.z - p.z)}`, pick: () => {
      close(); game.waypoint = { x: n.x, z: n.z }; save();
      reply(q, `${n.name}なら、ここから${COMPASS(n.x - p.x, n.z - p.z)}に${Math.round(n.d / 10) * 10}mくらいですよ。地図に印をつけておきますね。`); sfx('ui', 0.6);
      progress.stats.flags.asked = (progress.stats.flags.asked || 0) + 1;
    } });
  }
  opts.push({ label: 'やめる', pick: () => { close(); release(q); } });
  ev.choice = { title: '何を探してる？', who: '', text: '近くの場所を教えてもらえる。聞いた場所は地図に印がつく。', options: opts.slice(0, 7) };
}
const GOSSIP: Record<string, string[]> = {
  tokyo: ['最近、港のほうで夜中にヘリの音がするんだよね。', '地下の店に、面白いものを売ってる人がいるらしいよ。', '新宿のほうは夜になると、昼より人が多いくらいだよ。', 'このへんは毎週どこかで工事してるね。'],
  osaka: ['道頓堀のたこ焼きは、行列の長いほうが当たりやで。', '最近、ミナミの店に妙な連中が出入りしてるらしいで。', '新世界の串カツ、二度づけ禁止やからな。'],
  nara: ['鹿はね、せんべいを持ってると本当に寄ってくるんですよ。', '夕方の大仏殿は、人が少なくて静かでいいですよ。', '奈良町のお店は、細い路地の奥が面白いです。'],
  fukuoka: ['中洲の屋台は、夜がほんとにええけんね。', '博多ラーメンは、替え玉が基本ばい。', '天神のほうは、最近ようさん店が増えたとよ。'],
  naha: ['国際通りは、夕方からが賑やかさー。', '首里城からの眺めは、朝がいちばんいいよ。', '港のほうは、夜は静かだけど、たまに怪しい船が来るさ。'],
};
function gossip(q: Ped) {
  const M = nextMission(), L = GOSSIP[REGION.id] || GOSSIP.tokyo, base = L[Math.floor(Math.random() * L.length)];
  if (M && !missionElsewhere() && mission.id < 0) { // a rumour that points at the next job
    const s = M.start(); game.waypoint = { x: s.x, z: s.z }; save();
    reply(q, `${base} …そういえば、あっちのほうで誰かが人を探してるって話を聞いたよ。`); toast('📍 噂の場所を地図に記した', 2); return;
  }
  reply(q, base);
}
function provoke(q: Ped) {
  addRep(-1, '絡んだ'); reply(q, 'な、なんなんですか…！ やめてください！');
  q.state = 'flee'; q.t = 4; scare(q.x, q.z, 6); talkState.ped = null;
  if (copSees(q.x, q.z, 45)) setWanted(1, '絡んでいるところを警察に見られた');
}

/** Per frame: the person you stopped for stays put and watches you; let them go when you walk off or the talk is over. */
export function updateTalk(dt: number) {
  const q = talkState.ped; if (!q) return;
  const p = game.player;
  if (BUSY.has(q.state) || Math.hypot(q.x - p.x, q.z - p.z) > 5 || game.where !== 'out' || game.inCar) { if (ev.choice && ev.choice.title !== '何を探してる？' && !ev.choice.story) { /* leave it up: the panel closes itself */ } talkState.ped = null; if (ev.choice && /さん（|何を探してる/.test(ev.choice.title)) ev.choice = null; return; }
  keep(q); face(q);
  if (!ev.choice) { talkState.t -= dt; if (talkState.t <= 0) release(q); }
}
