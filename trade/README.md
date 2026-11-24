# トレード PRO

`trade/index.html` をブラウザで開くと使えます。

| タブ | 内容 | データ元 |
|---|---|---|
| 📊 マーケット | 日本株・米国株・暗号資産のヒートマップ / 一覧、主要指数 | GitHub Actions（株）、CoinGecko（暗号資産・1分ごと） |
| 🚀 上昇候補 | トレンド・モメンタム・出来高などを点数化したスクリーニング | GitHub Actions |
| ⭐ ウォッチ | お気に入り銘柄の追跡と価格アラート | ブラウザに保存 |
| 📰 ニュース | 国内・米国・暗号資産ニュース（銘柄を自動ひも付け） | GitHub Actions（RSS） |
| 🤖 AI運用 | Claude が仮想資金1000万円で売買し、1億円を目指す記録。実資金向けの目安も表示 | GitHub Actions + Claude API |
| 🎮 デモトレード | 模擬価格で最大100倍レバレッジの練習 | ブラウザ内 |

## 初回セットアップ

1. このブランチを **main（既定ブランチ）にマージ**する（Actions の定期実行は既定ブランチでのみ動くため）
2. AI 運用を使う場合は [Anthropic Console](https://console.anthropic.com/settings/keys) で API キーを作り、
   リポジトリの **Settings → Secrets and variables → Actions** に `ANTHROPIC_API_KEY` として登録
3. **Actions → Market data → Run workflow** を実行（AI に今すぐ判断させるなら「今すぐ Claude に売買判断させる」にチェック）

以後は30分ごとにデータが更新され、Claude は6時間ごとに売買を判断します。

## 設定（Settings → Secrets and variables → Actions → Variables）

| 変数 | 既定 | 内容 |
|---|---|---|
| `AI_INTERVAL_HOURS` | `6` | Claude が判断する間隔（時間）。短くすると API 料金が増えます |
| `AI_MODEL` | `claude-opus-5-5` | 使用するモデル |

## 仕組み

- `.github/workflows/market-data.yml` が `scripts/market_data.py`（相場・ニュース取得）と
  `scripts/ai_trader.py`（AI 運用）を実行し、`market.json` と `ai.json` を `market-data` ブランチに保存します
  （毎回1コミットで上書きするので履歴は増えません）。
- AI の注文はコードで次の制限を強制してから執行します: 1銘柄20%まで、最大10銘柄、暗号資産30%まで、
  現金5%以上、損切り3〜25%、日本株100株単位。損切り・利確は30分ごとに自動チェックします。
- 取引時間外の市場への注文は、次に市場が開いたときに執行します（祝日は考慮していません）。

## 注意

- AI は相場を予測できません。表示はすべて情報提供で、投資助言ではありません。
- このアプリが実際の証券口座に発注することはありません。実資金での取引はご自身の判断で行ってください。
