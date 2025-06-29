# GitHub Terraform Plan Formatter

GitHubのPRページで表示されるHCP Terraform（旧Terraform Cloud）の実行結果を整形し、シンプルで読みやすい形式で表示するChrome/Edge拡張機能です。

## 機能

### 1. HCP Terraformプレフィックス削除
長い組織名・プロジェクト名を自動削除:
```
変更前: Terraform Cloud/<ORG_NAME>/<WORKSPACE_NAME>
変更後: <WORKSPACE_NAME>
```

### 2. プラン結果のカラー表示
Terraformプランの結果を3行レイアウトで見やすく表示し、数値に応じたカラー表示:

```
<WORKSPACE_NAME>
Terraform plan:
1 to add, 0 to change, 1 to destroy
```

- **Add（追加）**: 青色表示、0以外の場合は太字
- **Change（変更）**: オレンジ色表示、0以外の場合は太字  
- **Destroy（削除）**: 赤色表示、0以外の場合は太字
- **0の数値**: 通常フォント、背景色なし

### 3. 自動動作
- GitHubのPRページで自動的に動作
- ページ遷移、動的コンテンツ読み込みにも対応
- Chrome、Edge両方で動作

## インストール方法

### 開発者モードでインストール

1. Chromeまたはエッジを開く
2. アドレスバーに以下を入力：
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. 「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. このフォルダーを選択

## ファイル構成

```
.
├── manifest.json    # 拡張機能の設定（Manifest V3）
├── content.js       # メインスクリプト（IIFE形式、無限ループ対策済み）
├── style.css        # カラー表示用スタイルシート
├── README.md        # このファイル
└── CLAUDE.md        # 開発情報
```

## 技術仕様

- **Manifest Version**: 3
- **権限**: `activeTab`, `*://github.com/*`
- **実行タイミング**: `document_idle`
- **対応イベント**: turbo:load（GitHub SPA対応）、MutationObserver
- **重複処理防止**: data-terraform-formatted属性によるマーキング

## 動作確認

1. 拡張機能をインストール後、GitHubのPRページにアクセス
2. HCP Terraformのチェック結果が表示されているPRで動作確認
3. F12でコンソールを開き、処理ログを確認可能
4. 結果が簡潔な形式で表示されることを確認

## 対象ページ

- `https://github.com/*/pull/*` パターンのPRページ
- HCP Terraform（旧Terraform Cloud）のチェック結果が表示されているページ

## 開発履歴

- v1.0.0: 基本機能実装
- プレフィックス削除機能追加
- 無限ループ対策実装
- GitHub-web-cosmetic拡張機能のアプローチを参考に安定化
- カラー表示機能追加（数値別の色分けと強調表示）