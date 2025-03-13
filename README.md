# WorkLog App

作業ログを自動的に記録するためのデスクトップアプリケーションです。定期的にスクリーンショットを撮影し、Gitリポジトリで管理します。

![WorkLog App](screenshots/app_screenshot.png)

## 機能

- メニューバーから簡単に操作可能
- カスタマイズ可能なスクリーンショット間隔
- スクリーンショットの自動Git管理
- スクリーンショットフォルダの簡単アクセス

## インストール

### 方法1: リリースからダウンロード

1. [リリースページ](https://github.com/KYOTA-IZUMI/worklog-app/releases)から最新のDMGファイルをダウンロード
2. ダウンロードしたDMGファイルを開き、アプリケーションをApplicationsフォルダにドラッグ＆ドロップ
3. アプリケーションを起動

### 方法2: ソースからビルド

```bash
# リポジトリをクローン
git clone https://github.com/KYOTA-IZUMI/worklog-app.git
cd worklog-app

# 依存パッケージをインストール
npm install

# アプリケーションを起動
npm start

# アプリケーションをビルド（DMGファイル作成）
npm run build
```

## 使い方

### 初回起動

初回起動時、アプリケーションはメニューバーにアイコンとして表示されます。

![メニューバーアイコン](screenshots/menubar_icon.png)

### スクリーンショットの記録開始

1. メニューバーのアイコンをクリックしてメニューを表示
2. 「記録を開始」をクリック

![記録開始](screenshots/start_recording.png)

記録が開始されると、設定された間隔でスクリーンショットが自動的に撮影されます。

### 間隔の設定

1. メニューバーのアイコンをクリックしてメニューを表示
2. 「間隔を設定」をクリック
3. 表示されたダイアログで秒単位で間隔を入力（最小10秒）
4. 「保存」ボタンをクリック

![間隔設定](screenshots/interval_settings.png)

### スクリーンショットフォルダを開く

1. メニューバーのアイコンをクリックしてメニューを表示
2. 「フォルダを開く」をクリック

スクリーンショットは `~/Documents/WorkLog/screenshots` フォルダに保存され、Gitリポジトリとして管理されます。

![スクリーンショットフォルダ](screenshots/screenshots_folder.png)

### 記録の停止

1. メニューバーのアイコンをクリックしてメニューを表示
2. 「記録を停止」をクリック

## 開発

```bash
# 開発モードで実行
npm start

# アプリケーションをビルド
npm run build
```

## ライセンス

MIT 