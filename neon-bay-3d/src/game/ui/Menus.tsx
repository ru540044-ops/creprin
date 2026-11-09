import { Component, ReactNode, useEffect, useReducer, useState } from 'react';
import { game, progress, save } from '../state/store';
import { settings, saveSettings, QualityMode } from '../settings';
import { applyVolumes, sfx } from '../audio';
import { ACHIEVEMENTS, DISTRICT_GOAL } from '../progression';
import { giftBoxes, boxesFound } from '../crime/gifts';
import { REGION } from '../world/region';
import { MISSIONS } from '../crime/story';
import { VDEFS } from '../vehicles/defs';

export const VERSION = 'v1.1';
const fmtTime = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}時間${m}分` : `${m}分`; };
const km = (m: number) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');

/** Two-tap confirm (window.confirm is blocked inside the artifact frame). */
function Confirm({ label, ask, onOk, cls = 'mbtn' }: { label: string; ask: string; onOk: () => void; cls?: string }) {
  const [arm, setArm] = useState(false);
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 3000); return () => clearTimeout(t); }, [arm]);
  return <button type="button" className={cls + (arm ? ' armed' : '')} onClick={() => { sfx('ui'); if (arm) { setArm(false); onOk(); } else setArm(true); }}>{arm ? ask : label}</button>;
}

export function Panel({ title, onBack, children, wide }: { title: string; onBack: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="mpanel-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onBack(); }}>
      <div className={'mpanel' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="mpanel-top"><button type="button" className="mback" onClick={() => { sfx('ui'); onBack(); }} aria-label="戻る">‹ 戻る</button><b>{title}</b><span /></div>
        <div className="mpanel-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ settings */
export function SettingsPanel({ mode, setMode, effective }: { mode: QualityMode; setMode: (q: QualityMode) => void; effective: string }) {
  const [, re] = useReducer((x: number) => x + 1, 0);
  const set = <K extends keyof typeof settings>(k: K, v: (typeof settings)[K]) => { settings[k] = v; saveSettings(); applyVolumes(); re(); };
  const slider = (k: 'master' | 'music' | 'sfx', label: string) => (
    <label className="srow"><span>{label}</span><input type="range" min={0} max={1} step={0.05} value={settings[k]} onChange={(e) => set(k, +e.target.value)} aria-label={label} /><em>{Math.round(settings[k] * 100)}</em></label>
  );
  return (
    <div className="sgrid">
      <div className="srow"><span>画質</span><div className="seg">{(['auto', 'low', 'medium', 'high'] as QualityMode[]).map((q) => <button type="button" key={q} className={q === mode ? 'on' : ''} onClick={() => { sfx('ui'); setMode(q); settings.quality = q; saveSettings(); re(); }}>{{ auto: '自動', low: '低', medium: '中', high: '高' }[q]}</button>)}</div></div>
      <p className="snote">{mode === 'auto' ? `自動：いまは「${{ low: '低', medium: '中', high: '高' }[effective as 'low']}」。重いときは自動で下げます。` : '「低」は影をオフにして最も軽くなります。'}</p>
      {slider('master', '全体の音量')}
      {slider('music', '音楽・ラジオ')}
      {slider('sfx', '効果音')}
      <label className="srow"><span>視点の感度</span><input type="range" min={0.4} max={2} step={0.1} value={settings.sens} onChange={(e) => set('sens', +e.target.value)} aria-label="視点の感度" /><em>{settings.sens.toFixed(1)}</em></label>
      <div className="srow"><span>上下の視点を反転</span><button type="button" className={'tog' + (settings.invertY ? ' on' : '')} aria-pressed={settings.invertY} onClick={() => { sfx('ui'); set('invertY', !settings.invertY); }}>{settings.invertY ? 'ON' : 'OFF'}</button></div>
      <div className="srow"><span>FPSを表示</span><button type="button" className={'tog' + (settings.showFps ? ' on' : '')} aria-pressed={settings.showFps} onClick={() => { sfx('ui'); set('showFps', !settings.showFps); }}>{settings.showFps ? 'ON' : 'OFF'}</button></div>
    </div>
  );
}

/* ------------------------------------------------------------------ controls */
export function ControlsPanel() {
  const t = game.isTouch;
  const rows: [string, string][] = t ? [
    ['歩く・走る', '左下のスティック。「ダッシュ」で走る、「ジャンプ」「しゃがむ」'],
    ['視点', '画面の右側をドラッグ。「視点」で距離を切り替え'],
    ['乗る・入る', '近づくと出るボタン（乗る／入る／アクション）'],
    ['車', '◀ ▶ でハンドル、アクセル・ブレーキ（長押しでバック）・サイド・ニトロ'],
    ['ヘリ', '上昇・下降・前進・後退、◀ ▶ で旋回'],
    ['戦闘機', 'スロットル＋／−、機首上げ・下げ、◀ ▶ でバンク、機銃・AB（アフターバーナー）'],
    ['船', 'スロットル・後進、◀ ▶ で舵。ヨットは停船して「キャビン」'],
    ['戦う', '武器ボタンで切替、「狙う」で照準、「撃つ」。銃は BAY ARMS で購入'],
    ['スマホ', '右上「スマホ」：地図・乗り物・仕事・ギフト・不動産・設定'],
    ['一時停止', '右上「Ⅱ」'],
  ] : [
    ['歩く・走る', 'W A S D · Shift ダッシュ · Space ジャンプ · C しゃがむ'],
    ['視点', 'マウスをドラッグ · V 視点切替'],
    ['乗る・入る', 'E'],
    ['車', 'W アクセル · S ブレーキ/バック · A D ハンドル · Space サイド · Shift ニトロ · R ラジオ'],
    ['ヘリ', 'Space 上昇 · Shift 下降 · W/S 前後 · A D 旋回'],
    ['戦闘機', 'W/S スロットル · A D バンク · Space 機首上げ · C 機首下げ · Shift AB · F 機銃'],
    ['船', 'W スロットル · S 後進 · A D 舵'],
    ['戦う', 'X 武器切替 · 右クリック/Q 狙う · 左クリック/F 撃つ'],
    ['スマホ', 'P または Tab'],
    ['一時停止', 'Esc'],
  ];
  return <div className="ctl">{rows.map(([a, b]) => <div key={a}><b>{a}</b><span>{b}</span></div>)}</div>;
}

/* ------------------------------------------------------------------ achievements / stats / credits */
export function AchievementsPanel() {
  const got = progress.ach;
  return (
    <>
      <p className="snote">解除 {got.length} / {ACHIEVEMENTS.length}</p>
      <div className="achs">{ACHIEVEMENTS.map((a) => { const ok = got.includes(a.id); return <div key={a.id} className={'ach' + (ok ? ' ok' : '')}><i>{ok ? a.icon : '🔒'}</i><b>{a.title}</b><span>{a.desc}</span></div>; })}</div>
    </>
  );
}
export function StatsPanel() {
  const S = progress.stats, total = ACHIEVEMENTS.length;
  const rows: [string, string][] = [
    ['プレイ時間', fmtTime(S.time)], ['ストーリー', `${Math.min(progress.story, MISSIONS.length)} / ${MISSIONS.length} 話`], ['実績', `${progress.ach.length} / ${total}`],
    ['所持金', '$' + game.money.toLocaleString('en-US')], ['累計で稼いだお金', '$' + Math.round(S.earned).toLocaleString('en-US')],
    ['歩いた距離', km(S.walk)], ['運転した距離', km(S.drive)], ['飛んだ距離', km(S.fly)], ['船で進んだ距離', km(S.sail)],
    ['乗った乗り物', `${S.vehicles.length} / ${Object.keys(VDEFS).length} 種類`], ['最高速度（地上）', `${S.top} km/h`], ['最高手配度', '★'.repeat(S.maxWanted) || 'なし'],
    ['訪れた地区', `${S.districts.length} / ${DISTRICT_GOAL}`], [`ギフトボックス（${REGION.name}）`, `${boxesFound()} / ${giftBoxes().length}（全国 ${progress.gift.boxes.length}）`], ['持ち家', `${game.homes.length} 軒`],
  ];
  return <div className="stats2">{rows.map(([a, b]) => <div key={a}><span>{a}</span><b>{b}</b></div>)}</div>;
}
export function CreditsPanel() {
  return (
    <div className="credits">
      <p className="clogo">NEON BAY</p>
      <p>オリジナルのオープンワールド・ゲーム</p>
      <p className="snote">舞台は実在の都市名・地名を使っていますが、街並みはゲーム用に作り直したもので実際の地理や建物とは異なります。登場する人物・団体・店舗・乗り物・ブランドはすべて架空のものです。</p>
      <h4>音楽・効果音</h4><p>すべてゲーム内でリアルタイムに合成しています。</p>
      <h4>使用しているオープンソース</h4>
      <ul><li>three.js — MIT License</li><li>React / React DOM — MIT License</li><li>React Three Fiber — MIT License</li><li>drei — MIT License</li></ul>
      <p className="snote">{VERSION} · © 2026 Neon Bay</p>
    </div>
  );
}

/* ------------------------------------------------------------------ pause */
type Sub = '' | 'settings' | 'controls' | 'ach' | 'stats' | 'credits';
export function PauseMenu({ onResume, mode, setMode, effective, goal }: { onResume: () => void; mode: QualityMode; setMode: (q: QualityMode) => void; effective: string; goal: string }) {
  const [sub, setSub] = useState<Sub>('');
  const open = (s: Sub) => { sfx('ui'); setSub(s); };
  return (
    <div className="overlay pause">
      <div className="pcol">
        <p className="ptitle">PAUSE</p>
        <p className="pgoal">{goal}</p>
        <p className="pmeta">${game.money.toLocaleString('en-US')} · {fmtTime(progress.stats.time)} · 実績 {progress.ach.length}/{ACHIEVEMENTS.length}</p>
      </div>
      <div className="menu">
        <button type="button" className="mbtn primary" onClick={() => { sfx('ui'); onResume(); }}>再開する<span>▶</span></button>
        <button type="button" className="mbtn" onClick={() => open('settings')}>設定<span>›</span></button>
        <button type="button" className="mbtn" onClick={() => open('controls')}>操作方法<span>›</span></button>
        <button type="button" className="mbtn" onClick={() => open('ach')}>実績<span>{progress.ach.length}/{ACHIEVEMENTS.length}</span></button>
        <button type="button" className="mbtn" onClick={() => open('stats')}>記録<span>›</span></button>
        <Confirm label="セーブしてタイトルへ" ask="もう一度タップで戻る" onOk={() => { save(); location.reload(); }} />
      </div>
      {sub === 'settings' && <Panel title="設定" onBack={() => setSub('')}><SettingsPanel mode={mode} setMode={setMode} effective={effective} /></Panel>}
      {sub === 'controls' && <Panel title="操作方法" onBack={() => setSub('')} wide><ControlsPanel /></Panel>}
      {sub === 'ach' && <Panel title="実績" onBack={() => setSub('')} wide><AchievementsPanel /></Panel>}
      {sub === 'stats' && <Panel title="記録" onBack={() => setSub('')}><StatsPanel /></Panel>}
      {sub === 'credits' && <Panel title="クレジット" onBack={() => setSub('')}><CreditsPanel /></Panel>}
    </div>
  );
}

/* ------------------------------------------------------------------ title */
export function TitleScreen({ hadSave, ready, onStart, onNewGame, mode, setMode, effective, onFirstTouch }: {
  hadSave: boolean; ready: boolean; onStart: () => void; onNewGame: () => void; mode: QualityMode; setMode: (q: QualityMode) => void; effective: string; onFirstTouch: () => void;
}) {
  const [sub, setSub] = useState<Sub>('');
  const open = (s: Sub) => { sfx('ui'); setSub(s); };
  return (
    <div className="overlay ttl" onPointerDown={onFirstTouch}>
      <div className="brand">
        <div className="logo" aria-label="NEON BAY"><span className="l1">NEON</span><span className="l2">BAY</span></div>
        <p className="tag">東京から那覇まで。ネオンの日本を、自由に生きろ。</p>
        <p className="feat">東京・大阪・福岡・那覇 · 新幹線を運転して次の街へ · 全ビルに入れる · ストーリー5話</p>
        {hadSave && <p className="tcity">現在地：{REGION.name}（{REGION.en}）</p>}
      </div>
      <div className="menu">
        {!ready && <div className="loading"><span>街を読み込み中…</span><i><b /></i></div>}
        {hadSave && <button type="button" className="mbtn primary" disabled={!ready} onClick={() => { sfx('ui'); onStart(); }}>つづきから<span>▶</span></button>}
        {hadSave
          ? <Confirm label="はじめから" ask="セーブを消して始める（もう一度タップ）" onOk={onNewGame} />
          : <button type="button" className="mbtn primary" disabled={!ready} onClick={() => { sfx('ui'); onNewGame(); }}>はじめる<span>▶</span></button>}
        <button type="button" className="mbtn" onClick={() => open('settings')}>設定<span>›</span></button>
        <button type="button" className="mbtn" onClick={() => open('controls')}>操作方法<span>›</span></button>
        {hadSave && <button type="button" className="mbtn" onClick={() => open('ach')}>実績・記録<span>{progress.ach.length}/{ACHIEVEMENTS.length}</span></button>}
        <button type="button" className="mbtn" onClick={() => open('credits')}>クレジット<span>›</span></button>
      </div>
      <p className="tfoot">{VERSION} · {game.isTouch ? '横向き推奨 · タップでサウンドON' : 'クリックでサウンドON'}</p>
      {sub === 'settings' && <Panel title="設定" onBack={() => setSub('')}><SettingsPanel mode={mode} setMode={setMode} effective={effective} /></Panel>}
      {sub === 'controls' && <Panel title="操作方法" onBack={() => setSub('')} wide><ControlsPanel /></Panel>}
      {sub === 'ach' && <Panel title="実績・記録" onBack={() => setSub('')} wide><StatsPanel /><AchievementsPanel /></Panel>}
      {sub === 'credits' && <Panel title="クレジット" onBack={() => setSub('')}><CreditsPanel /></Panel>}
    </div>
  );
}

/* ------------------------------------------------------------------ crash screen */
export class ErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { err: e instanceof Error ? e.message : String(e) }; }
  componentDidCatch() { try { save(); } catch { /* ignore */ } }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="overlay fatal">
        <div className="mpanel">
          <div className="mpanel-body">
            <p className="ptitle small">問題が発生しました</p>
            <p>ゲームを続けられなくなりました。進行状況は保存されています。再読み込みすると続きから遊べます。</p>
            <p className="snote">{this.state.err.slice(0, 160)}</p>
            <button type="button" className="mbtn primary" onClick={() => location.reload()}>再読み込み<span>↻</span></button>
          </div>
        </div>
      </div>
    );
  }
}
