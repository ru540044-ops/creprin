// ヨリミチ珈琲 サンプルの動作チェック（実ブラウザ：Chromium / Playwright）
//
// 使い方（cafe-sample/ で）:
//   node tests/check.mjs
// 環境変数:
//   PLAYWRIGHT_MODULE  playwright の場所（未指定なら "playwright" を import）
//   FONTS_DIR          @fontsource を入れた node_modules/@fontsource の場所。
//                      指定するとGoogle Fontsの代わりにローカルのフォントで描画（オフライン用）
//   SHOTS=1            docs/screenshots/ にスクリーンショットを保存
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = p.endsWith("/") ? path.join(p, "index.html") : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}

async function routeFonts(page) {
  const dir = process.env.FONTS_DIR;
  if (!dir) return;
  const css = ["shippori-mincho-b1/500.css", "shippori-mincho-b1/700.css", "shippori-mincho-b1/800.css",
    "zen-kaku-gothic-new/400.css", "zen-kaku-gothic-new/500.css", "zen-kaku-gothic-new/700.css"]
    .map((f) => fs.readFileSync(path.join(dir, f), "utf8").replace(/url\(\.\/files\//g, `url(https://fonts.local/${f.split("/")[0]}/files/`))
    .join("\n");
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: css }));
  await page.route("https://fonts.local/**", (r) => {
    const rel = new URL(r.request().url()).pathname.slice(1);
    r.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(dir, rel)) });
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

// ---------------------------------------------------------------- 1. 計算ロジック
{
  const page = await browser.newPage();
  await page.goto(BASE);
  const r = await page.evaluate(() => {
    const Y = window.Yorimichi;
    const d = (y, m, dd, h = 0, mi = 0) => Y.makeDay(y, m, dd, h * 60 + mi);
    // 2026-10-19 は月曜、10-21 は水曜、10-24 は土曜
    return {
      mon9: Y.statusFor(d(2026, 10, 19, 9, 0)),
      mon7: Y.statusFor(d(2026, 10, 19, 7, 0)),
      mon1740: Y.statusFor(d(2026, 10, 19, 17, 40)),
      wed: Y.statusFor(d(2026, 10, 21, 12, 0)),
      tue18: Y.statusFor(d(2026, 10, 20, 18, 5)),
      sat1930: Y.statusFor(d(2026, 10, 24, 19, 30)),
      pickMon: Y.pickupSlots(d(2026, 10, 19), d(2026, 10, 19, 9, 3)),
      pickWed: Y.pickupSlots(d(2026, 10, 21), d(2026, 10, 20, 9, 0)),
      pickDays: Y.pickupDays(d(2026, 10, 20, 17, 50)).map((x) => `${x.m}/${x.d}`),
      resMon: Y.reserveSlots(d(2026, 10, 19)),
      resSat: Y.reserveSlots(d(2026, 10, 24)),
      vWed: Y.validateReservation({ date: "2026-10-21", time: "780", people: "2", name: "a", tel: "09012345678" }, d(2026, 10, 18, 10)),
      vToday: Y.validateReservation({ date: "2026-10-18", time: "780", people: "2", name: "a", tel: "09012345678" }, d(2026, 10, 18, 10)),
      vFar: Y.validateReservation({ date: "2026-12-30", time: "780", people: "2", name: "a", tel: "09012345678" }, d(2026, 10, 18, 10)),
      vOk: Y.validateReservation({ date: "2026-10-19", time: "780", people: "2", name: "寄道", tel: "０９０－１２３４－５６７８" }, d(2026, 10, 18, 10)),
      vBad: Y.validateReservation({ date: "2026-10-19", time: "600", people: "7", name: " ", tel: "123" }, d(2026, 10, 18, 10)),
      tel: Y.normalizeTel("０９０ー１２３４ー５６７８"),
    };
  });
  check("月曜9:00は営業中", r.mon9.state === "open" && r.mon9.text === "営業中・18:00まで", r.mon9.text);
  check("月曜7:00は開店前", r.mon7.state === "closed" && r.mon7.text === "開店前・7:30から", r.mon7.text);
  check("閉店30分前は「まもなく閉店」", r.mon1740.state === "soon", r.mon1740.text);
  check("水曜は定休日で、次は木曜7:30", r.wed.state === "closed" && r.wed.text === "本日定休日・明日 7:30から", r.wed.text);
  check("火曜閉店後の次の営業日は木曜（水曜を飛ばす）", r.tue18.text === "営業終了・木曜 7:30から", r.tue18.text);
  check("土曜閉店後は「明日 8:00から」", r.sat1930.text === "営業終了・明日 8:00から", r.sat1930.text);
  check("受け取り時間は注文20分後以降・15分刻み", r.pickMon[0] === 570 && r.pickMon.at(-1) === 1050, `${r.pickMon[0]}〜${r.pickMon.at(-1)}`);
  check("定休日は受け取り時間なし", r.pickWed.length === 0);
  check("受け取り日から定休日と締切後の当日を除く", r.pickDays[0] === "10/22" && !r.pickDays.includes("10/21") && !r.pickDays.includes("10/20"), r.pickDays.join(","));
  check("予約は10:30〜閉店1時間前（平日）", r.resMon[0] === 630 && r.resMon.at(-1) === 1020, `${r.resMon.length}枠`);
  check("予約は10:30〜閉店1時間前（土曜）", r.resSat.at(-1) === 1080);
  check("定休日の予約はエラー", /定休日/.test(r.vWed.date || ""), r.vWed.date);
  check("当日のネット予約はエラー", /前日まで/.test(r.vToday.date || ""), r.vToday.date);
  check("30日より先の予約はエラー", /30日先/.test(r.vFar.date || ""), r.vFar.date);
  check("全角の電話番号でも通る", Object.keys(r.vOk).length === 0, JSON.stringify(r.vOk));
  check("モーニング時間・7名以上・空の名前・短い電話番号はエラー", r.vBad.time && r.vBad.people && r.vBad.name && r.vBad.tel);
  check("電話番号の全角→半角", r.tel === "090-1234-5678", r.tel);
  await page.close();
}

// ---------------------------------------------------------------- 2. 画面の動作
for (const vp of [{ name: "スマホ", width: 390, height: 844 }, { name: "PC", width: 1280, height: 860 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.width < 500 ? 2 : 1, locale: "ja-JP", timezoneId: "Asia/Tokyo" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(m.text()); });
  await routeFonts(page);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`[${vp.name}] 横スクロールが出ない`, overflow <= 0, `はみ出し ${overflow}px`);
  const status = await page.textContent("#openStatus .status-text");
  check(`[${vp.name}] 営業状況が表示される`, /営業中|開店前|営業終了|定休日|まもなく閉店/.test(status), status);
  check(`[${vp.name}] 今日の営業時間に印がつく`, (await page.locator("#hoursBody tr.today").count()) === 1);

  if (vp.width < 960) {
    await page.click("#menuBtn");
    check(`[${vp.name}] メニューボタンで開く`, await page.isVisible("#mobileNav"));
    await page.keyboard.press("Escape");
    check(`[${vp.name}] Escで閉じる`, !(await page.isVisible("#mobileNav")));
  }

  await page.click("#tab-sweets");
  check(`[${vp.name}] タブで焼き菓子に切り替わる`, (await page.isVisible("#panel-sweets")) && !(await page.isVisible("#panel-coffee")));
  await page.focus("#tab-sweets");
  await page.keyboard.press("ArrowRight");
  check(`[${vp.name}] 矢印キーでタブ移動（最後→最初）`, await page.isVisible("#panel-coffee"));
  await page.locator("label.switch").click();
  check(`[${vp.name}] アレルギー表示を切り替えられる`, await page.locator("#panel-coffee .allergy").first().isVisible());

  // テイクアウト：空のまま送信 → エラー
  await page.click('#orderForm button[type="submit"]');
  check(`[${vp.name}] 未選択で注文するとエラー`, /1つ以上/.test(await page.textContent("#orderErr")));
  const rows = await page.locator(".order-row").count();
  check(`[${vp.name}] 注文リストはテイクアウト可の商品だけ`, rows === (await page.locator(".item[data-takeout]").count()) && rows > 0, `${rows}品`);
  await page.click('.order-row[data-id="blend"] [data-step="1"]');
  await page.click('.order-row[data-id="blend"] [data-step="1"]');
  await page.click('.order-row[data-id="montblanc"] [data-step="1"]');
  check(`[${vp.name}] 合計金額（520×2＋720）`, (await page.textContent("#cartTotal")) === "¥1,760", await page.textContent("#cartTotal"));
  const hasPickup = (await page.locator("#pickupTime option").count()) > 0;
  check(`[${vp.name}] 受け取り時間の候補がある`, hasPickup);
  await page.fill("#orderName", "寄道 花子");
  await page.click('#orderForm button[type="submit"]');
  check(`[${vp.name}] 注文すると受付番号が出る`, (await page.isVisible("#orderDone")) && /T-\d{4}/.test(await page.textContent("#orderDone")));

  // 予約：名前・電話なし → エラー、入力 → 確認 → 完了
  await page.click('#reserveForm button[type="submit"]');
  check(`[${vp.name}] 予約の必須項目が空だとエラー`, (await page.getAttribute("#rName", "aria-invalid")) === "true" && (await page.getAttribute("#rTel", "aria-invalid")) === "true");
  await page.fill("#rName", "寄道 花子");
  await page.fill("#rTel", "０９０１２３４５６７８");
  await page.locator('label:has(input[value="カウンター"])').click();
  await page.click('#reserveForm button[type="submit"]');
  const conf = await page.textContent("#confirmList");
  check(`[${vp.name}] 確認画面に入力内容が出る`, (await page.isVisible("#reserveConfirm")) && conf.includes("カウンター") && conf.includes("09012345678"), conf.replace(/\s+/g, " ").slice(0, 80));
  await page.click("#reserveSend");
  check(`[${vp.name}] 予約を確定すると予約番号が出る`, /R-\d{4}/.test(await page.textContent("#reserveDone")));

  await page.click(".seg-btn[data-busy='weekend']");
  check(`[${vp.name}] 混雑グラフを土日祝に切り替え`, (await page.getAttribute(".seg-btn[data-busy='weekend']", "aria-pressed")) === "true" && (await page.locator("#busyChart .bar").count()) === 12);

  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`[${vp.name}] 操作後も横スクロールが出ない`, overflow2 <= 0, `はみ出し ${overflow2}px`);
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  check(`[${vp.name}] 画像の読み込み切れがない`, broken.length === 0, broken.join(","));
  check(`[${vp.name}] JavaScriptのエラーがない`, errors.length === 0, errors.join(" / "));

  if (process.env.SHOTS) {
    const dir = path.join(ROOT, "docs", "screenshots");
    fs.mkdirSync(dir, { recursive: true });
    const page2 = await ctx.newPage();
    await routeFonts(page2);
    await page2.goto(BASE, { waitUntil: "networkidle" });
    await page2.evaluate(async () => {
      document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = "eager"; });
      await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
      await document.fonts.ready;
    });
    const tag = vp.width < 500 ? "sp" : "pc";
    await page2.screenshot({ path: path.join(dir, `${tag}-top.png`) });
    await page2.screenshot({ path: path.join(dir, `${tag}-full.png`), fullPage: true });
    await page2.close();
  }
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(ROOT, "docs", "test-results.json"), JSON.stringify({ date: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
