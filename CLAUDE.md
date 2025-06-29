# GitHub Terraform Plan Formatter - 開発情報

## プロジェクト概要

GitHubのPull Requestページで表示されるTerraform Cloudの実行結果を整形するChrome拡張機能。
長いプレフィックスを削除し、プラン結果を読みやすい形式で表示する。

## 開発環境

- **対象ブラウザ**: Chrome, Edge (Manifest V3)
- **開発言語**: JavaScript (ES6+)
- **実行環境**: GitHub.com (Content Script)

## 技術的課題と解決策

### 1. 無限ループ問題
**問題**: textContentの変更がMutationObserverを再発動し、無限ループが発生
**解決策**: 
- `data-terraform-formatted="true"`による処理済みマーキング
- テキスト変更前後の比較チェック

### 2. セレクター問題
**問題**: GitHubの複雑なCSSモジュール名に依存したセレクターが不安定
**解決策**: 
- github-web-cosmetic拡張機能のアプローチを参考
- 複数セレクターによる包括的検索
- 属性ベースのセレクター使用

### 3. SPA対応
**問題**: GitHubはSPA（Single Page Application）でページ遷移時にスクリプトが動作しない
**解決策**:
- turbo:loadイベント対応
- MutationObserverによる動的コンテンツ監視
- URL変化検出による再実行

## 処理フロー

```
1. ページロード/遷移検出
   ├─ turbo:load イベント
   ├─ DOMContentLoaded イベント
   └─ URL変化検出

2. 要素検索
   ├─ div.TimelineItem strong (通常GitHub)
   ├─ ul li div a span (GitHub EMU)
   ├─ span[class*='titleDescription'] (PRチェック結果)
   └─ *[class*='StatusCheckRow'] (ステータスチェック行)

3. テキスト処理
   ├─ 処理済みチェック (data-terraform-formatted)
   ├─ Terraform Cloud/PROJECT/ プレフィックス削除
   ├─ プラン数値の簡潔化
   └─ 処理済みマーク付与

4. イベント監視
   ├─ MutationObserver (DOM変更)
   ├─ ボタンクリック検出
   └─ debounceタイマー (過度な実行防止)
```

## 参考資料

- **github-web-cosmetic**: `removeCiPrefix()`関数の実装パターンを参考
- **sample.html**: 実際のGitHub PR HTMLから要素構造を分析
- **Manifest V3**: 最新のChrome拡張機能仕様に準拠

## 設定ファイル

### manifest.json
```json
{
  "manifest_version": 3,
  "permissions": ["activeTab"],
  "host_permissions": ["*://github.com/*"],
  "content_scripts": [{
    "matches": ["*://github.com/*/pull/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

## デバッグ情報

コンソールログで以下の情報を確認可能:
- `🔍 Terraform Formatter: Starting...` - 処理開始
- `✅ Processed element:` - 要素処理完了
- `🎯 Processed X Terraform elements` - 処理件数

## 今後の改善案

1. **設定画面追加**: プレフィックス削除の有効/無効切り替え
2. **カスタムパターン**: ユーザー定義の置換ルール
3. **他CI対応**: GitHub Actions、Jenkins等への対応拡張

## 開発メモ

- 2025-06-29: 初期開発完了
- 参考拡張機能のアプローチが非常に有効
- GitHub EMUとの互換性も確保済み
- 無限ループ対策が重要なポイント