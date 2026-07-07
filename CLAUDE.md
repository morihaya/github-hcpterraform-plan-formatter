# GitHub Terraform Plan Formatter - 開発情報

## プロジェクト概要

GitHubのPull Requestページで表示されるHCP Terraform（旧Terraform Cloud）の実行結果を整形するChrome拡張機能。
長い組織名・ワークスペース名プレフィックスを削除し、プラン結果を読みやすい形式で表示する。

## 開発環境

- **対象ブラウザ**: Chrome, Edge (Manifest V3)
- **開発言語**: JavaScript (ES6+)
- **実行環境**: GitHub.com (Content Script)

## 技術的課題と解決策

### 1. 無限ループ問題
**問題**: DOM書き換えがMutationObserverを再発動し、無限ループが発生
**解決策**:
- `data-terraform-formatted="true"`による処理済みマーキング
- 自身が生成した`.terraform-plan-result`内の変更は監視対象から除外
- debounceタイマーによる実行間引き

### 2. セレクター問題
**問題**: GitHubの複雑なCSSモジュール名に依存したセレクターが不安定（React化された新マージボックス等でクラス名が変わると全滅する）
**解決策** (v1.2.0):
- テキストノード走査（TreeWalker）ベースの検出を主軸に変更（セレクター非依存）
- 既知レイアウト用セレクターは補助ヒントとして維持
- `<script>`/`<style>`等のタグ内テキストは除外（GitHubの埋め込みJSONペイロードを壊さないために必須）

### 3. SPA対応
**問題**: GitHubはSPA（Turboによるソフト遷移）のため、旧実装（`*/pull/*`のみに注入）では他ページからPRへ遷移した場合にスクリプトが注入されず一切動作しなかった
**解決策** (v1.2.0):
- content scriptを`*://github.com/*`全体に注入し、実行時に`/pull/<番号>`のURL判定で処理をゲート
- turbo:loadイベント対応
- MutationObserverによる動的コンテンツ監視
- URL変化検出による再実行（遷移時にバッジカウントをリセット）

### 4. HCP Terraformリブランド対応 (v1.2.0)
**問題**: チェック名プレフィックスが`Terraform Cloud/`から`HCP Terraform/`に変わり、旧実装ではマッチしない
**解決策**: 正規表現で両プレフィックスに対応

### 5. 行全体の破壊防止 (v1.2.0)
**問題**: `StatusCheckRow`全体をinnerHTML置換すると「Details」リンク等の兄弟要素が消える
**解決策**:
- プランサマリーを含む最小要素まで降りてから書き換え（`narrowToSummary`）
- ワークスペースリンクが兄弟要素の場合は、リンクを保持したままテキストノード単位でプレフィックスのみ削除（`stripProviderPrefix`）
- 挿入する文字列はすべてHTMLエスケープ

## 処理フロー

```
1. ページロード/遷移検出
   ├─ turbo:load イベント
   ├─ DOMContentLoaded イベント
   └─ URL変化検出（MutationObserver内）

2. 候補要素の収集 (collectCandidates)
   ├─ 既知セレクター（TimelineItem strong / titleDescription / StatusCheckRow）
   └─ TreeWalkerによるテキストノード走査（セレクター非依存のフォールバック）
      └─ script/style/noscript/template/textarea 内は除外

3. 整形 (formatElement)
   ├─ 処理済みチェック (data-terraform-formatted / .terraform-plan-result)
   ├─ プランサマリーあり → 最小要素に絞って2行のカラー表示に書き換え
   │   ├─ "N to add, N to change, N to destroy" → 色付きカウント
   │   └─ "no changes" → "Terraform plan: No changes"
   └─ サマリーなし（チェック名リンク等）→ プレフィックスのみ削除

4. イベント監視
   ├─ MutationObserver (DOM変更、childList + subtree)
   └─ debounceタイマー (過度な実行防止)
```

## 設定ファイル

### manifest.json（要点）
```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "tabs"],
  "host_permissions": ["*://github.com/*"],
  "content_scripts": [{
    "matches": ["*://github.com/*"],
    "js": ["content.js"],
    "css": ["style.css"],
    "run_at": "document_idle"
  }]
}
```

※ `matches`はPRページ限定ではなくgithub.com全体。SPAソフト遷移対応のため（処理自体はURL判定でPRページのみ実行）。

## デバッグ情報

コンソール（debugレベル）で以下を確認可能:
- `🎯 Terraform Plan Formatter: formatted X element(s)` - 処理件数

## 動作検証

`node --check content.js background.js`で構文チェック。
DOM動作はGitHub風のフィクスチャHTMLをローカルサーバーで`/owner/repo/pull/123`パスとして配信して確認する
（content.jsはパスに`/pull/<番号>`を含まないと動作しないため、静的ファイルを直接開いても動かない点に注意）。
検証観点: 旧TimelineItemレイアウト / リンクと説明が兄弟の新レイアウト / no changes /
Detailsリンクの保持 / 無関係な"No changes"テキストの非破壊 / 埋め込みJSON scriptの非破壊 /
動的挿入(MutationObserver) / 再実行時の冪等性。

## 実装済み機能

### カラー表示機能
- **Add**: 青色、数値>0で強調表示
- **Change**: オレンジ色、数値>0で強調表示
- **Destroy**: 赤色、数値>0で強調表示
- **ダークモード対応**: システム設定に応じた色調整（style.css）

### バッジ表示（background.js）
- タブ単位で整形済みプラン数をバッジ表示（ページ内累計、遷移でリセット）

## 今後の改善案

1. **設定画面追加**: プレフィックス削除の有効/無効切り替え
2. **カスタムパターン**: ユーザー定義の置換ルール
3. **カラーカスタマイズ**: ユーザー定義の色設定
4. **GitHub Enterprise Server対応**: `matches`のホストをオプションで拡張

## 開発メモ

- 2025-06-29: 初期開発完了
- 2026-07-07: v1.2.0 大規模リファクタリング（テキストベース検出、HCP Terraformプレフィックス対応、SPA遷移対応、最小要素書き換え、HTMLエスケープ、script除外）
- 無限ループ対策と`<script>`内テキストの除外が重要なポイント
