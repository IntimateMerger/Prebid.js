# Prebid User ID Module (IM-UID System) の動作確認サーバー

## セットアップ

プロジェクトルートで以下を実行

```sh
npm install
npm run serve --nolint # このディレクトリのファイルでLintエラーになるため
```

## 起動

上記 `セットアップ` にて `build/dev/prebid.js` を開発ビルド後、プロジェクトルートで以下を実行

```sh
node im_test/server.js
```
