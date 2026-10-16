/* ヨリミチ珈琲 — サイトの動き
   ・営業中かどうかの表示（日本時間で判定）
   ・メニューのタブ、アレルギー表示
   ・テイクアウト事前注文（デモ：送信しない）
   ・席の予約（デモ：送信しない）
   ・混雑の目安グラフ
   営業時間を変えるときは HOURS だけを書き換えてください。 */
(function () {
  "use strict";

  // ---------------------------------------------------------------- 設定
  // 曜日（0=日〜6=土）ごとの [開店, 閉店, ラストオーダー]（0時からの分）。null は定休日。
  var HOURS = {
    0: [480, 1140, 1110], // 日 8:00-19:00 L.O.18:30
    1: [450, 1080, 1050], // 月 7:30-18:00 L.O.17:30
    2: [450, 1080, 1050], // 火
    3: null,              // 水 定休日
    4: [450, 1080, 1050], // 木
    5: [450, 1080, 1050], // 金
    6: [480, 1140, 1110]  // 土
  };
  var DAY = ["日", "月", "火", "水", "木", "金", "土"];
  var MORNING_END = 630;       // 10:30 までは予約を受け付けない
  var PICKUP_LEAD = 20;        // テイクアウトは注文から20分後以降
  var RESERVE_DAYS = 30;       // 予約は30日先まで
  var BUSY = {                 // 混雑の目安（0〜100、サンプルの値）
    weekday: { start: 7, values: [35, 80, 55, 30, 35, 85, 75, 40, 30, 45, 35, 20] },
    weekend: { start: 8, values: [30, 50, 60, 70, 90, 95, 85, 70, 60, 45, 30, 20] }
  };

  // ---------------------------------------------------------------- 時刻（日本時間）
  function jstNow() {
    var parts = {};
    try {
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", hourCycle: "h23"
      }).formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
      return makeDay(+parts.year, +parts.month, +parts.day, (+parts.hour % 24) * 60 + +parts.minute);
    } catch (e) {
      var d = new Date();
      return makeDay(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours() * 60 + d.getMinutes());
    }
  }
  function makeDay(y, m, d, min) {
    var u = new Date(Date.UTC(y, m - 1, d));
    return { y: u.getUTCFullYear(), m: u.getUTCMonth() + 1, d: u.getUTCDate(), dow: u.getUTCDay(), min: min || 0 };
  }
  function addDays(day, n) { return makeDay(day.y, day.m, day.d + n, 0); }
  function iso(day) { return day.y + "-" + pad(day.m) + "-" + pad(day.d); }
  function fromIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return null;
    var day = makeDay(+m[1], +m[2], +m[3], 0);
    return iso(day) === s ? day : null;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(min) { return Math.floor(min / 60) + ":" + pad(min % 60); }
  function label(day) { return day.m + "月" + day.d + "日（" + DAY[day.dow] + "）"; }
  function yen(n) { return "¥" + n.toLocaleString("ja-JP"); }

  // ---------------------------------------------------------------- 営業中の判定
  function nextOpen(day) {
    for (var i = 1; i <= 7; i++) {
      var nd = addDays(day, i);
      if (HOURS[nd.dow]) return { day: nd, offset: i };
    }
    return null;
  }
  function nextOpenText(day) {
    var n = nextOpen(day);
    if (!n) return "";
    var when = n.offset === 1 ? "明日" : DAY[n.day.dow] + "曜";
    return when + " " + hm(HOURS[n.day.dow][0]) + "から";
  }
  function statusFor(now) {
    var h = HOURS[now.dow];
    if (!h) return { state: "closed", text: "本日定休日・" + nextOpenText(now) };
    if (now.min < h[0]) return { state: "closed", text: "開店前・" + hm(h[0]) + "から" };
    if (now.min >= h[1]) return { state: "closed", text: "営業終了・" + nextOpenText(now) };
    if (h[1] - now.min <= 30) return { state: "soon", text: "まもなく閉店・" + hm(h[1]) + "まで" };
    return { state: "open", text: "営業中・" + hm(h[1]) + "まで" };
  }

  // ---------------------------------------------------------------- テイクアウトの受け取り時間
  function pickupSlots(day, now) {
    var h = HOURS[day.dow];
    if (!h) return [];
    var from = h[0] + 15;
    if (now && iso(now) === iso(day)) from = Math.max(from, Math.ceil((now.min + PICKUP_LEAD) / 15) * 15);
    var out = [];
    for (var t = from; t <= h[2]; t += 15) out.push(t);
    return out;
  }
  function pickupDays(now) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var day = addDays(now, i);
      if (pickupSlots(day, now).length) out.push(day);
    }
    return out;
  }

  // ---------------------------------------------------------------- 予約
  function reserveSlots(day) {
    var h = day && HOURS[day.dow];
    if (!h) return [];
    var out = [];
    for (var t = MORNING_END; t <= h[1] - 60; t += 30) out.push(t);
    return out;
  }
  function normalizeTel(s) {
    return String(s || "")
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xfee0); })
      .replace(/[‐－―ー−]/g, "-")
      .replace(/[\s()（）]/g, "");
  }
  function validateReservation(v, now) {
    var e = {};
    var day = fromIso(v.date);
    var first = addDays(now, 1);
    var last = addDays(now, RESERVE_DAYS);
    if (!v.date) e.date = "日にちを選んでください。";
    else if (!day) e.date = "日にちの形式が正しくありません。";
    else if (iso(day) < iso(first)) e.date = "ネット予約は前日までです。当日はお電話でお問い合わせください。";
    else if (iso(day) > iso(last)) e.date = RESERVE_DAYS + "日先（" + label(last) + "）までの日にちを選んでください。";
    else if (!HOURS[day.dow]) e.date = DAY[day.dow] + "曜日は定休日です。ほかの日を選んでください。";
    if (!e.date && reserveSlots(day).indexOf(+v.time) < 0) e.time = "時間を選んでください。";
    if (+v.people >= 7) e.people = "7名以上のご予約はお電話で承ります（000-0000-0000）。";
    if (!String(v.name || "").trim()) e.name = "お名前を入力してください。";
    var tel = normalizeTel(v.tel);
    if (!tel) e.tel = "電話番号を入力してください。";
    else if (!/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/.test(tel) || tel.replace(/-/g, "").length < 10 || tel.replace(/-/g, "").length > 11) e.tel = "電話番号は 090-1234-5678 のように、10〜11桁で入力してください。";
    return e;
  }

  // 他のスクリプトやテストから使えるように公開
  window.Yorimichi = {
    HOURS: HOURS, statusFor: statusFor, pickupSlots: pickupSlots, pickupDays: pickupDays,
    reserveSlots: reserveSlots, validateReservation: validateReservation, normalizeTel: normalizeTel,
    makeDay: makeDay, now: jstNow
  };

  // ---------------------------------------------------------------- 画面
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* 保存できなくても動く */ } }
  };

  var toastTimer;
  function toast(msg) {
    var t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function initStatus() {
    function update() {
      var now = jstNow();
      var s = statusFor(now);
      $$("[data-open-status]").forEach(function (chip) {
        chip.dataset.state = s.state;
        $(".status-text", chip).textContent = s.text;
      });
      $$("#hoursBody tr").forEach(function (tr) {
        tr.classList.toggle("today", +tr.dataset.day === now.dow);
      });
    }
    update();
    setInterval(update, 60000);
  }

  function initNav() {
    var btn = $("#menuBtn"), nav = $("#mobileNav");
    function set(open) {
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
      nav.hidden = !open;
    }
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !nav.hidden) { set(false); btn.focus(); }
    });
  }

  function initTabs() {
    var tabs = $$(".tab");
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
      store.set("yorimichi-tab", tab.id);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === "Home") n = tabs[0];
        if (e.key === "End") n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    var saved = document.getElementById(store.get("yorimichi-tab") || "");
    if (saved && tabs.indexOf(saved) >= 0) select(saved);

    var allergy = $("#allergyToggle");
    allergy.addEventListener("change", function () {
      $("#menu").classList.toggle("show-allergy", allergy.checked);
    });
  }

  // ---------- テイクアウト
  function initOrder() {
    var list = $("#orderList"), form = $("#orderForm"), done = $("#orderDone");
    var qty = {};
    var items = $$(".item[data-takeout]").map(function (li) {
      return { id: li.dataset.id, name: $("h3", li).textContent, price: +li.dataset.price };
    });
    list.innerHTML = items.map(function (it) {
      return '<li class="order-row" data-id="' + it.id + '">' +
        '<span class="o-name">' + it.name + "</span>" +
        '<span class="o-price">' + yen(it.price) + "</span>" +
        '<span class="stepper">' +
        '<button type="button" data-step="-1" aria-label="' + it.name + 'を1つ減らす" disabled>−</button>' +
        '<output aria-label="' + it.name + 'の数">0</output>' +
        '<button type="button" data-step="1" aria-label="' + it.name + 'を1つ増やす">＋</button>' +
        "</span></li>";
    }).join("");

    function render() {
      var count = 0, total = 0;
      items.forEach(function (it) {
        var q = qty[it.id] || 0;
        count += q; total += q * it.price;
        var row = list.querySelector('[data-id="' + it.id + '"]');
        $("output", row).textContent = q;
        $('[data-step="-1"]', row).disabled = q === 0;
        $('[data-step="1"]', row).disabled = q >= 9;
        row.classList.toggle("has-qty", q > 0);
      });
      $("#cartCount").textContent = count ? count + "点を選んでいます" : "まだ商品が選ばれていません";
      $("#cartTotal").textContent = yen(total);
      if (count) $("#orderErr").textContent = "";
      return { count: count, total: total };
    }
    list.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-step]");
      if (!b) return;
      var id = b.closest(".order-row").dataset.id;
      qty[id] = Math.min(9, Math.max(0, (qty[id] || 0) + +b.dataset.step));
      render();
    });

    var dateSel = $("#pickupDate"), timeSel = $("#pickupTime");
    function fillDates() {
      var now = jstNow();
      var days = pickupDays(now);
      dateSel.innerHTML = days.map(function (d, i) {
        var pre = i === 0 && iso(d) === iso(now) ? "今日 " : iso(d) === iso(addDays(now, 1)) ? "明日 " : "";
        return '<option value="' + iso(d) + '">' + pre + d.m + "/" + d.d + "（" + DAY[d.dow] + "）</option>";
      }).join("");
      fillTimes();
    }
    function fillTimes() {
      var day = fromIso(dateSel.value);
      var slots = day ? pickupSlots(day, jstNow()) : [];
      timeSel.innerHTML = slots.map(function (t) { return '<option value="' + t + '">' + hm(t) + "</option>"; }).join("");
    }
    dateSel.addEventListener("change", fillTimes);
    fillDates();

    var nameInput = $("#orderName");
    nameInput.addEventListener("input", function () { setErr(nameInput, $("#orderNameErr"), ""); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = render();
      var ok = true;
      if (!r.count) { $("#orderErr").textContent = "商品を1つ以上選んでください。"; ok = false; }
      if (!nameInput.value.trim()) { setErr(nameInput, $("#orderNameErr"), "受け取りのときにお呼びするお名前を入力してください。"); ok = false; }
      if (!timeSel.value) { $("#orderErr").textContent = "受け取りの時間を選んでください。"; ok = false; }
      if (!ok) {
        var first = form.querySelector('[aria-invalid="true"]');
        (first || $("#orderErr")).scrollIntoView({ block: "center" });
        if (first) first.focus();
        return;
      }
      var lines = items.filter(function (it) { return qty[it.id]; }).map(function (it) {
        return "<li>" + it.name + " × " + qty[it.id] + "　" + yen(it.price * qty[it.id]) + "</li>";
      }).join("");
      var no = "T-" + String(Math.floor(1000 + Math.random() * 9000));
      done.innerHTML =
        "<h3>ご注文を受け付けました（デモ）</h3>" +
        '<p>受付番号 <span class="num">' + no + "</span></p>" +
        "<p>" + dateSel.options[dateSel.selectedIndex].text + " " + hm(+timeSel.value) + " ごろ、レジで受付番号とお名前をお伝えください。</p>" +
        '<ul class="done-list">' + lines + "</ul>" +
        "<p>合計 <b>" + yen(r.total) + "</b>（税込・お支払いは受け取りのときに）</p>" +
        '<p class="hint">これはデザインサンプルです。実際には注文は送られていません。</p>' +
        '<button class="btn btn-line" type="button" id="orderAgain">注文画面にもどる</button>';
      form.hidden = true;
      done.hidden = false;
      done.focus();
      $("#orderAgain").addEventListener("click", function () {
        qty = {}; render(); nameInput.value = "";
        done.hidden = true; form.hidden = false; fillDates();
        $("#takeout").scrollIntoView();
      });
    });
    render();
  }

  // ---------- 予約
  function setErr(input, out, msg) {
    out.textContent = msg;
    if (msg) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function initReserve() {
    var form = $("#reserveForm"), confirmBox = $("#reserveConfirm"), done = $("#reserveDone");
    var f = { date: $("#rDate"), time: $("#rTime"), people: $("#rPeople"), name: $("#rName"), tel: $("#rTel") };
    var errs = { date: $("#rDateErr"), time: $("#rTimeErr"), people: $("#rPeopleErr"), name: $("#rNameErr"), tel: $("#rTelErr") };
    var now = jstNow();
    f.date.min = iso(addDays(now, 1));
    f.date.max = iso(addDays(now, RESERVE_DAYS));

    // 最初は「次の営業日」を入れておく（見本として埋まった状態で見せる）
    var first = addDays(now, 1);
    while (!HOURS[first.dow]) first = addDays(first, 1);
    f.date.value = iso(first);

    function fillTimes() {
      var day = fromIso(f.date.value);
      var keep = f.time.value || "780";
      var slots = day ? reserveSlots(day) : [];
      f.time.innerHTML = slots.length
        ? slots.map(function (t) { return '<option value="' + t + '">' + hm(t) + "</option>"; }).join("")
        : '<option value="">定休日のため選べません</option>';
      if (slots.indexOf(+keep) >= 0) f.time.value = keep;
    }
    fillTimes();
    f.time.value = "780";
    f.date.addEventListener("change", function () {
      fillTimes();
      var e = validateReservation(values(), jstNow());
      setErr(f.date, errs.date, e.date || "");
    });
    Object.keys(f).forEach(function (k) {
      f[k].addEventListener("input", function () { if (f[k].getAttribute("aria-invalid")) setErr(f[k], errs[k], ""); });
    });
    f.tel.addEventListener("blur", function () { if (f.tel.value) f.tel.value = normalizeTel(f.tel.value); });

    function values() {
      var seat = form.querySelector('input[name="rSeat"]:checked');
      return {
        date: f.date.value, time: f.time.value, people: f.people.value,
        name: f.name.value, tel: f.tel.value, seat: seat ? seat.value : "どこでも",
        note: $("#rNote").value
      };
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = values();
      var errors = validateReservation(v, jstNow());
      var firstBad = null;
      Object.keys(f).forEach(function (k) {
        setErr(f[k], errs[k], errors[k] || "");
        if (errors[k] && !firstBad) firstBad = f[k];
      });
      if (firstBad) { firstBad.focus(); return; }
      var day = fromIso(v.date);
      var rows = [
        ["日時", label(day) + " " + hm(+v.time)],
        ["人数", v.people + "名"],
        ["席", v.seat],
        ["お名前", v.name.trim()],
        ["電話番号", normalizeTel(v.tel)],
        ["ご要望", v.note.trim() || "なし"]
      ];
      var dl = $("#confirmList");
      dl.innerHTML = "";
      rows.forEach(function (r) {
        var div = document.createElement("div");
        var dt = document.createElement("dt"); dt.textContent = r[0];
        var dd = document.createElement("dd"); dd.textContent = r[1];
        div.appendChild(dt); div.appendChild(dd); dl.appendChild(div);
      });
      form.hidden = true;
      confirmBox.hidden = false;
      confirmBox.focus();
    });

    $("#reserveBack").addEventListener("click", function () {
      confirmBox.hidden = true; form.hidden = false; f.name.focus();
    });
    $("#reserveSend").addEventListener("click", function () {
      var v = values();
      var day = fromIso(v.date);
      var no = "R-" + String(Math.floor(1000 + Math.random() * 9000));
      done.innerHTML = "";
      var h = document.createElement("h3"); h.textContent = "ご予約を受け付けました（デモ）";
      var p1 = document.createElement("p"); p1.innerHTML = '予約番号 <span class="num">' + no + "</span>";
      var p2 = document.createElement("p");
      p2.textContent = label(day) + " " + hm(+v.time) + "、" + v.people + "名さまでお待ちしています。お席は15分間おさえておきます。";
      var p3 = document.createElement("p"); p3.className = "hint";
      p3.textContent = "これはデザインサンプルです。実際には予約は送られていません。公開するときは、予約サービスやメール通知とつなぎます。";
      var b = document.createElement("button"); b.className = "btn btn-line"; b.type = "button"; b.textContent = "予約フォームにもどる";
      b.addEventListener("click", function () { done.hidden = true; form.hidden = false; f.name.focus(); });
      [h, p1, p2, p3, b].forEach(function (n) { done.appendChild(n); });
      confirmBox.hidden = true;
      done.hidden = false;
      done.focus();
    });
  }

  // ---------- 混雑の目安
  function initBusy() {
    var chart = $("#busyChart");
    var btns = $$(".seg-btn");
    function draw(kind) {
      var data = BUSY[kind];
      var now = jstNow();
      var isWeekend = now.dow === 0 || now.dow === 6;
      var nowHour = Math.floor(now.min / 60);
      var showNow = HOURS[now.dow] && (kind === "weekend") === isWeekend;
      chart.innerHTML = data.values.map(function (v, i) {
        var hour = data.start + i;
        var lv = v >= 75 ? 3 : v >= 45 ? 2 : 1;
        var cls = "bar lv-" + lv + (showNow && hour === nowHour ? " now" : "");
        var lab = i % 2 === 0 ? "<span>" + hour + "</span>" : "";
        return '<div class="' + cls + '"><i style="height:' + v + '%"></i>' + lab + "</div>";
      }).join("");
      var peaks = data.values.map(function (v, i) { return v >= 75 ? data.start + i + "時" : null; }).filter(Boolean);
      chart.setAttribute("aria-label", (kind === "weekday" ? "平日" : "土日祝") + "の混雑の目安。混みやすいのは " + peaks.join("、") + " ごろ");
      btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.busy === kind)); });
    }
    btns.forEach(function (b) { b.addEventListener("click", function () { draw(b.dataset.busy); }); });
    var now = jstNow();
    draw(now.dow === 0 || now.dow === 6 ? "weekend" : "weekday");
  }

  function initMisc() {
    $$(".copy-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var text = b.dataset.copy;
        function fallback() {
          var el = $("#telText");
          var range = document.createRange();
          range.selectNodeContents(el);
          var sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(range);
          toast("番号を選択しました。コピーしてお使いください");
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast("電話番号をコピーしました"); }, fallback);
        } else fallback();
      });
    });
    var map = $("#mapLink");
    if (map) map.addEventListener("click", function (e) {
      if (map.getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        toast("公開するときに、お店のGoogleマップのURLを設定します");
      }
    });
  }

  function start() {
    initStatus();
    initNav();
    initTabs();
    initOrder();
    initReserve();
    initBusy();
    initMisc();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
