#!/usr/bin/env python3
"""トレードアプリ用の相場データ・ニュースを集めて JSON に書き出す。

GitHub Actions（.github/workflows/market-data.yml）から定期実行される。
  python scripts/market_data.py --out out/market.json
ネットワークなしで動作確認する場合:
  python scripts/market_data.py --out out/market.json --synthetic
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import random
import re
import sys
import time

import numpy as np
import pandas as pd

# ---------------------------------------------------------------- 銘柄リスト
# 値: (表示名, ニュース照合用の別名)
JP = {
    "7203.T": ("トヨタ自動車", ["トヨタ"]), "6758.T": ("ソニーグループ", ["ソニー"]),
    "9984.T": ("ソフトバンクグループ", ["ソフトバンクG", "ソフトバンクグループ"]),
    "8306.T": ("三菱UFJ FG", ["三菱UFJ", "MUFG"]), "6861.T": ("キーエンス", ["キーエンス"]),
    "9983.T": ("ファーストリテイリング", ["ファーストリテ", "ユニクロ"]), "8035.T": ("東京エレクトロン", ["東京エレクトロン", "東エレク"]),
    "6098.T": ("リクルートHD", ["リクルート"]), "4063.T": ("信越化学工業", ["信越化"]),
    "9432.T": ("NTT", ["NTT"]), "7974.T": ("任天堂", ["任天堂"]), "6501.T": ("日立製作所", ["日立"]),
    "8316.T": ("三井住友FG", ["三井住友"]), "8058.T": ("三菱商事", ["三菱商事"]), "8001.T": ("伊藤忠商事", ["伊藤忠"]),
    "8031.T": ("三井物産", ["三井物産"]), "4502.T": ("武田薬品工業", ["武田薬"]), "4568.T": ("第一三共", ["第一三共"]),
    "4519.T": ("中外製薬", ["中外製薬"]), "6902.T": ("デンソー", ["デンソー"]), "7267.T": ("ホンダ", ["ホンダ"]),
    "6367.T": ("ダイキン工業", ["ダイキン"]), "6981.T": ("村田製作所", ["村田製"]), "9433.T": ("KDDI", ["KDDI"]),
    "9434.T": ("ソフトバンク", ["ソフトバンク株"]), "6954.T": ("ファナック", ["ファナック"]), "7741.T": ("HOYA", ["HOYA"]),
    "6146.T": ("ディスコ", ["ディスコ"]), "6857.T": ("アドバンテスト", ["アドバンテスト", "アドテスト"]),
    "6920.T": ("レーザーテック", ["レーザーテック"]), "6723.T": ("ルネサス", ["ルネサス"]), "6526.T": ("ソシオネクスト", ["ソシオネクスト"]),
    "5803.T": ("フジクラ", ["フジクラ"]), "8411.T": ("みずほFG", ["みずほ"]), "8766.T": ("東京海上HD", ["東京海上"]),
    "7011.T": ("三菱重工業", ["三菱重工"]), "7012.T": ("川崎重工業", ["川崎重工"]), "7013.T": ("IHI", ["IHI"]),
    "6702.T": ("富士通", ["富士通"]), "6503.T": ("三菱電機", ["三菱電機"]), "4661.T": ("オリエンタルランド", ["オリエンタルランド", "ディズニー"]),
    "2914.T": ("JT", ["日本たばこ", "JT"]), "3382.T": ("セブン&アイ", ["セブン"]), "9101.T": ("日本郵船", ["日本郵船"]),
    "9104.T": ("商船三井", ["商船三井"]), "5401.T": ("日本製鉄", ["日本製鉄"]), "4385.T": ("メルカリ", ["メルカリ"]),
    "4755.T": ("楽天グループ", ["楽天"]), "6594.T": ("ニデック", ["ニデック"]), "7735.T": ("SCREEN HD", ["SCREEN"]),
}
US = {
    "AAPL": ("アップル", ["Apple", "アップル"]), "MSFT": ("マイクロソフト", ["Microsoft", "マイクロソフト"]),
    "NVDA": ("エヌビディア", ["Nvidia", "NVIDIA", "エヌビディア"]), "AMZN": ("アマゾン", ["Amazon", "アマゾン"]),
    "GOOGL": ("アルファベット", ["Alphabet", "Google", "グーグル"]), "META": ("メタ", ["Meta", "メタ"]),
    "TSLA": ("テスラ", ["Tesla", "テスラ"]), "AVGO": ("ブロードコム", ["Broadcom", "ブロードコム"]),
    "AMD": ("AMD", ["AMD"]), "NFLX": ("ネットフリックス", ["Netflix", "ネットフリックス"]), "ORCL": ("オラクル", ["Oracle", "オラクル"]),
    "CRM": ("セールスフォース", ["Salesforce"]), "ADBE": ("アドビ", ["Adobe"]), "INTC": ("インテル", ["Intel", "インテル"]),
    "QCOM": ("クアルコム", ["Qualcomm"]), "MU": ("マイクロン", ["Micron", "マイクロン"]), "PLTR": ("パランティア", ["Palantir", "パランティア"]),
    "COIN": ("コインベース", ["Coinbase", "コインベース"]), "MSTR": ("ストラテジー", ["MicroStrategy", "Strategy"]),
    "SMCI": ("スーパー・マイクロ", ["Super Micro"]), "ARM": ("アーム", ["Arm Holdings"]), "TSM": ("TSMC", ["TSMC"]),
    "ASML": ("ASML", ["ASML"]), "JPM": ("JPモルガン", ["JPMorgan", "JPモルガン"]), "BAC": ("バンク・オブ・アメリカ", ["Bank of America"]),
    "GS": ("ゴールドマン・サックス", ["Goldman"]), "V": ("ビザ", ["Visa"]), "MA": ("マスターカード", ["Mastercard"]),
    "BRK-B": ("バークシャー", ["Berkshire", "バークシャー"]), "WMT": ("ウォルマート", ["Walmart"]), "COST": ("コストコ", ["Costco"]),
    "KO": ("コカ・コーラ", ["Coca-Cola"]), "MCD": ("マクドナルド", ["McDonald"]), "DIS": ("ディズニー", ["Disney"]),
    "LLY": ("イーライリリー", ["Eli Lilly", "Lilly"]), "UNH": ("ユナイテッドヘルス", ["UnitedHealth"]), "JNJ": ("J&J", ["Johnson & Johnson"]),
    "XOM": ("エクソンモービル", ["Exxon"]), "BA": ("ボーイング", ["Boeing", "ボーイング"]), "CAT": ("キャタピラー", ["Caterpillar"]),
    "UBER": ("ウーバー", ["Uber"]), "SHOP": ("ショッピファイ", ["Shopify"]), "CRWD": ("クラウドストライク", ["CrowdStrike"]),
    "PANW": ("パロアルト", ["Palo Alto"]), "NOW": ("サービスナウ", ["ServiceNow"]), "ANET": ("アリスタ", ["Arista"]),
    "IONQ": ("イオンQ", ["IonQ"]), "RKLB": ("ロケット・ラボ", ["Rocket Lab"]), "HOOD": ("ロビンフッド", ["Robinhood"]),
    "SOFI": ("ソーファイ", ["SoFi"]), "VRT": ("バーティブ", ["Vertiv"]),
}
CRYPTO = {
    "BTC-JPY": ("ビットコイン", ["ビットコイン", "BTC", "Bitcoin"]), "ETH-JPY": ("イーサリアム", ["イーサリアム", "ETH", "Ethereum"]),
    "XRP-JPY": ("XRP", ["XRP", "リップル"]), "SOL-JPY": ("ソラナ", ["ソラナ", "SOL", "Solana"]),
    "BNB-JPY": ("BNB", ["BNB"]), "DOGE-JPY": ("ドージコイン", ["ドージ", "DOGE"]), "ADA-JPY": ("カルダノ", ["カルダノ", "ADA"]),
    "TRX-JPY": ("トロン", ["トロン", "TRX"]), "AVAX-JPY": ("アバランチ", ["アバランチ", "AVAX"]), "LINK-JPY": ("チェーンリンク", ["チェーンリンク", "LINK"]),
    "DOT-JPY": ("ポルカドット", ["ポルカドット", "DOT"]), "LTC-JPY": ("ライトコイン", ["ライトコイン", "LTC"]),
    "BCH-JPY": ("ビットコインキャッシュ", ["ビットコインキャッシュ", "BCH"]), "SHIB-JPY": ("柴犬コイン", ["SHIB"]),
    "XLM-JPY": ("ステラ", ["ステラ", "XLM"]), "SUI20947-JPY": ("スイ", ["SUI"]),
}
INDICES = {
    "^N225": "日経平均", "^GSPC": "S&P 500", "^IXIC": "NASDAQ", "^DJI": "NYダウ", "^SOX": "SOX指数",
    "JPY=X": "ドル円", "^VIX": "VIX", "GC=F": "金先物", "CL=F": "WTI原油", "BTC-JPY": "ビットコイン",
}
FEEDS = [
    ("jp", "NHK 経済", "https://www.nhk.or.jp/rss/news/cat5.xml"),
    ("jp", "Yahoo!ニュース 経済", "https://news.yahoo.co.jp/rss/topics/business.xml"),
    ("crypto", "CoinPost", "https://coinpost.jp/?feed=rss2"),
    ("crypto", "CoinDesk JAPAN", "https://www.coindeskjapan.com/feed/"),
    ("us", "CNBC Markets", "https://www.cnbc.com/id/20910258/device/rss/rss.html"),
    ("us", "Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
]
HIST_DAYS = 120


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def sig(x, n=6):
    """有効数字 n 桁に丸める（JSON サイズ削減）。NaN は None。"""
    if x is None:
        return None
    x = float(x)
    if not math.isfinite(x):
        return None
    return float(f"{x:.{n}g}")


# ---------------------------------------------------------------- 取得
def download(tickers: list[str]) -> dict[str, pd.DataFrame]:
    import yfinance as yf

    out: dict[str, pd.DataFrame] = {}
    for k in range(0, len(tickers), 40):
        chunk = tickers[k:k + 40]
        for attempt in range(3):
            try:
                df = yf.download(chunk, period="1y", interval="1d", group_by="ticker",
                                 auto_adjust=True, threads=True, progress=False)
                break
            except Exception as e:  # noqa: BLE001
                log("download failed", attempt, e)
                time.sleep(5 * (attempt + 1))
        else:
            continue
        for t in chunk:
            try:
                d = df[t] if isinstance(df.columns, pd.MultiIndex) else df
                d = d.dropna(subset=["Close"])
                if len(d) >= 30:
                    out[t] = d
            except KeyError:
                pass
    log(f"downloaded {len(out)}/{len(tickers)}")
    return out


def synthetic(tickers: list[str]) -> dict[str, pd.DataFrame]:
    """ネットワークなしで動作確認するための疑似データ。"""
    rng = np.random.default_rng(7)
    idx = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=250)
    out = {}
    for t in tickers:
        p0 = float(rng.uniform(100, 30000))
        drift = rng.normal(0.0005, 0.0015)
        r = rng.normal(drift, 0.02, len(idx))
        c = p0 * np.exp(np.cumsum(r))
        o = c * np.exp(rng.normal(0, 0.006, len(idx)))
        h = np.maximum(o, c) * (1 + np.abs(rng.normal(0, 0.008, len(idx))))
        l = np.minimum(o, c) * (1 - np.abs(rng.normal(0, 0.008, len(idx))))
        v = rng.lognormal(13, 0.5, len(idx))
        out[t] = pd.DataFrame({"Open": o, "High": h, "Low": l, "Close": c, "Volume": v}, index=idx)
    return out


# ---------------------------------------------------------------- 指標
def rsi(c: pd.Series, n=14) -> pd.Series:
    d = c.diff()
    g = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    l = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + g / l.replace(0, np.nan))


def metrics(d: pd.DataFrame) -> dict:
    c, h, l, v = d["Close"], d["High"], d["Low"], d["Volume"].fillna(0)
    last = float(c.iloc[-1])

    def chg(n):
        return sig(last / float(c.iloc[-1 - n]) - 1, 5) if len(c) > n and c.iloc[-1 - n] else None

    sma25, sma75 = c.rolling(25).mean(), c.rolling(75).mean()
    sma200 = c.rolling(200).mean() if len(c) >= 200 else None
    rs = rsi(c)
    ema12, ema26 = c.ewm(span=12, adjust=False).mean(), c.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    hist = macd - macd.ewm(span=9, adjust=False).mean()
    avgv = v.iloc[-21:-1].mean()
    volr = float(v.iloc[-1] / avgv) if avgv > 0 else None
    hi52, lo52 = float(h.iloc[-252:].max()), float(l.iloc[-252:].min())
    atr = (pd.concat([h - l, (h - c.shift()).abs(), (l - c.shift()).abs()], axis=1).max(axis=1)).rolling(14).mean()

    s25, s75 = sma25.iloc[-1], sma75.iloc[-1]
    m = {
        "price": sig(last), "prev": sig(c.iloc[-2]) if len(c) > 1 else None,
        "d": d.index[-1].strftime("%Y-%m-%d"),
        "c1": chg(1), "c5": chg(5), "c21": chg(21), "c63": chg(63), "c126": chg(126),
        "rsi": sig(rs.iloc[-1], 4), "volr": sig(volr, 3),
        "sma25": sig(s25), "sma75": sig(s75), "sma200": sig(sma200.iloc[-1]) if sma200 is not None else None,
        "hi52": sig(hi52), "lo52": sig(lo52), "fromHi": sig(last / hi52 - 1, 4),
        "atrp": sig(atr.iloc[-1] / last, 3) if pd.notna(atr.iloc[-1]) else None,
        "macdH": sig(hist.iloc[-1], 4),
    }
    # シグナル判定
    sg = []
    trend = pd.notna(s25) and pd.notna(s75) and last > s25 > s75
    if trend:
        sg.append(("trend", "上昇トレンド（株価＞25日線＞75日線）"))
    if pd.notna(s75) and len(sma25) > 6 and (sma25.iloc[-6:-1] <= sma75.iloc[-6:-1]).any() and s25 > s75:
        sg.append(("gc", "ゴールデンクロス（直近5日）"))
    if len(hist) > 4 and hist.iloc[-1] > 0 and (hist.iloc[-4:-1] <= 0).any():
        sg.append(("macd", "MACD 好転（直近3日）"))
    if len(h) > 21 and last >= float(h.iloc[-21:-1].max()):
        sg.append(("brk20", "20日高値ブレイク"))
    if last >= hi52 * 0.995:
        sg.append(("hi52", "52週高値圏"))
    if volr and volr >= 1.8:
        sg.append(("vol", f"出来高急増（平常の{volr:.1f}倍）"))
    r_ = m["rsi"]
    if r_ is not None and r_ >= 75:
        sg.append(("ob", f"RSI {r_:.0f} 買われすぎ注意"))
    elif r_ is not None and r_ <= 30:
        sg.append(("os", f"RSI {r_:.0f} 売られすぎ（反発狙い）"))
    m["sig"] = [k for k, _ in sg]
    m["why"] = [t for _, t in sg]
    m["_trend"] = bool(trend)
    return m


def score_market(rows: list[dict]):
    """市場内の相対モメンタムも加味して 0〜100 のスコアを付ける。"""
    def pct_rank(key):
        vals = sorted(r[key] for r in rows if r.get(key) is not None)
        def f(v):
            if v is None or not vals:
                return 0.5
            return np.searchsorted(vals, v, side="right") / len(vals)
        return f
    r21, r63, r5 = pct_rank("c21"), pct_rank("c63"), pct_rank("c5")
    for r in rows:
        s = 0.0
        s += 20 if r["_trend"] else 0
        s += 18 * r21(r.get("c21")) + 10 * r63(r.get("c63")) + 7 * r5(r.get("c5"))
        rv = r.get("rsi")
        if rv is not None:
            s += 10 if 50 <= rv <= 70 else 5 if 45 <= rv < 50 or 70 < rv < 75 else -8 if rv >= 80 else 0
        if r.get("volr") and r["volr"] >= 1.5:
            s += 8
        sg = set(r["sig"])
        s += 8 if "gc" in sg else 0
        s += 6 if "macd" in sg else 0
        s += 7 if "brk20" in sg else 0
        s += 6 if "hi52" in sg else 0
        if r.get("macdH") is not None and r["macdH"] > 0:
            s += 4
        r["score"] = int(max(0, min(100, round(s))))
        del r["_trend"]


def hist_of(d: pd.DataFrame) -> dict:
    t = d.iloc[-HIST_DAYS:]
    return {
        "t": [int(x.timestamp() // 86400) for x in t.index],
        "o": [sig(x) for x in t["Open"]], "h": [sig(x) for x in t["High"]],
        "l": [sig(x) for x in t["Low"]], "c": [sig(x) for x in t["Close"]],
        "v": [sig(x, 4) for x in t["Volume"].fillna(0)],
    }


# ---------------------------------------------------------------- ニュース
def match_tickers(text: str) -> list[str]:
    hits = []
    for book in (JP, US, CRYPTO):
        for t, (_, aliases) in book.items():
            for a in aliases:
                if re.fullmatch(r"[A-Za-z0-9&\-. ]+", a):
                    if re.search(rf"(?<![A-Za-z]){re.escape(a)}(?![A-Za-z])", text):
                        hits.append(t); break
                elif a in text:
                    hits.append(t); break
    return hits[:4]


def fetch_news(synthetic_mode=False) -> list[dict]:
    items = []
    if synthetic_mode:
        now = dt.datetime.now(dt.timezone.utc)
        samples = [("jp", "トヨタ、通期見通しを上方修正　円安が追い風"), ("us", "Nvidia shares rally on strong data center demand"),
                   ("crypto", "ビットコイン、一時1500万円台を回復"), ("jp", "日経平均、半導体株主導で反発　東京エレクトロンが高い"),
                   ("crypto", "イーサリアムETFに資金流入続く"), ("us", "Apple unveils new AI features")]
        for k, (cat, title) in enumerate(samples):
            items.append({"cat": cat, "src": "サンプル", "title": title, "url": "https://example.com/",
                          "t": (now - dt.timedelta(minutes=20 * k)).isoformat(), "tk": match_tickers(title)})
        return items
    import feedparser
    for cat, src, url in FEEDS:
        try:
            f = feedparser.parse(url, agent="Mozilla/5.0 (market-data bot)")
            for e in f.entries[:25]:
                tm = e.get("published_parsed") or e.get("updated_parsed")
                t = dt.datetime(*tm[:6], tzinfo=dt.timezone.utc).isoformat() if tm else None
                title = re.sub(r"\s+", " ", e.get("title", "")).strip()
                if not title:
                    continue
                items.append({"cat": cat, "src": src, "title": title, "url": e.get("link", ""), "t": t, "tk": match_tickers(title)})
            log(f"news {src}: {len(f.entries)}")
        except Exception as ex:  # noqa: BLE001
            log("feed failed", src, ex)
    return items


def ticker_news(tickers: list[str]) -> list[dict]:
    """上昇候補の個別ニュース（Yahoo Finance）。"""
    import yfinance as yf
    out = []
    for t in tickers:
        try:
            for n in (yf.Ticker(t).news or [])[:3]:
                c = n.get("content") or n
                title = c.get("title")
                url = ((c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url") or n.get("link"))
                pub = c.get("pubDate") or c.get("displayTime")
                if not pub and n.get("providerPublishTime"):
                    pub = dt.datetime.fromtimestamp(n["providerPublishTime"], dt.timezone.utc).isoformat()
                src = (c.get("provider") or {}).get("displayName") or n.get("publisher") or "Yahoo Finance"
                if title and url:
                    cat = "jp" if t.endswith(".T") else "crypto" if t.endswith("-JPY") else "us"
                    out.append({"cat": cat, "src": src, "title": title, "url": url, "t": pub, "tk": [t]})
        except Exception as ex:  # noqa: BLE001
            log("ticker news failed", t, ex)
    return out


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/market.json")
    ap.add_argument("--synthetic", action="store_true", help="ネットワークなしの疑似データで出力")
    a = ap.parse_args()

    books = {"jp": JP, "us": US, "crypto": CRYPTO}
    all_t = sorted(set(JP) | set(US) | set(CRYPTO) | set(INDICES))
    data = synthetic(all_t) if a.synthetic else download(all_t)

    markets, hist = {}, {}
    for mk, book in books.items():
        rows = []
        for t, (name, _) in book.items():
            d = data.get(t)
            if d is None or len(d) < 30:
                continue
            try:
                m = metrics(d)
            except Exception as ex:  # noqa: BLE001
                log("metrics failed", t, ex)
                continue
            m.update({"tk": t, "name": name, "spark": [sig(x, 5) for x in d["Close"].iloc[-30:]]})
            rows.append(m)
            hist[t] = hist_of(d)
        score_market(rows)
        rows.sort(key=lambda r: -r["score"])
        markets[mk] = rows
        log(mk, len(rows))

    indices = []
    for t, name in INDICES.items():
        d = data.get(t)
        if d is None or len(d) < 2:
            continue
        c = d["Close"]
        indices.append({"tk": t, "name": name, "price": sig(c.iloc[-1]), "c1": sig(c.iloc[-1] / c.iloc[-2] - 1, 4),
                        "c21": sig(c.iloc[-1] / c.iloc[-22] - 1, 4) if len(c) > 22 else None,
                        "d": d.index[-1].strftime("%Y-%m-%d"), "spark": [sig(x, 5) for x in c.iloc[-30:]]})
        if t not in hist:
            hist[t] = hist_of(d)

    news = fetch_news(a.synthetic)
    if not a.synthetic:
        top = [r["tk"] for mk in ("us", "jp") for r in markets.get(mk, [])[:6]]
        news += ticker_news(top)
    seen, uniq = set(), []
    for n in sorted(news, key=lambda n: n.get("t") or "", reverse=True):
        key = n["title"][:60]
        if key in seen:
            continue
        seen.add(key)
        uniq.append(n)

    out = {
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "synthetic": a.synthetic,
        "markets": markets, "indices": indices, "news": uniq[:200], "hist": hist,
    }
    import os
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    log("wrote", a.out, os.path.getsize(a.out), "bytes")
    if not a.synthetic and sum(len(v) for v in markets.values()) == 0:
        sys.exit("no market data downloaded")


if __name__ == "__main__":
    main()
