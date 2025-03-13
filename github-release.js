const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// GitHub APIのトークンを環境変数から取得
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error('環境変数GITHUB_TOKENが設定されていません。');
  console.error('GitHubの個人アクセストークンを作成し、GITHUB_TOKEN環境変数に設定してください。');
  console.error('例: export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx');
  process.exit(1);
}

// GitHubリポジトリの情報
const owner = 'KYOTA-IZUMI';
const repo = 'interval-screenshot';

// package.jsonからバージョン情報を取得
const packageJson = require('./package.json');
const version = packageJson.version;
const tagName = `v${version}`;

// DMGファイルのパス
const dmgFileName = `IntervalScreenshot-${version}-arm64.dmg`;
const dmgFilePath = path.join(__dirname, 'dist', dmgFileName);

// DMGファイルが存在するか確認
if (!fs.existsSync(dmgFilePath)) {
  console.error(`DMGファイルが見つかりません: ${dmgFilePath}`);
  console.error('先にビルドを実行してください: npm run dist');
  process.exit(1);
}

// GitHubクライアントを初期化
const octokit = new Octokit({
  auth: token
});

// リリースを作成してDMGファイルをアップロードする関数
async function createReleaseWithAsset() {
  try {
    console.log(`バージョン ${version} のリリースを作成中...`);

    // 既存のリリースを確認
    try {
      const { data: release } = await octokit.repos.getReleaseByTag({
        owner,
        repo,
        tag: tagName
      });

      console.log(`既存のリリース ${tagName} が見つかりました。リリースを削除します...`);
      
      // 既存のリリースを削除
      await octokit.repos.deleteRelease({
        owner,
        repo,
        release_id: release.id
      });
      
      console.log(`リリース ${tagName} を削除しました。`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      // リリースが見つからない場合は何もしない
    }

    // 既存のタグを確認
    try {
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo,
        ref: `tags/${tagName}`
      });

      console.log(`既存のタグ ${tagName} が見つかりました。タグを削除します...`);
      
      // 既存のタグを削除
      await octokit.git.deleteRef({
        owner,
        repo,
        ref: `tags/${tagName}`
      });
      
      console.log(`タグ ${tagName} を削除しました。`);
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }
      // タグが見つからない場合は何もしない
    }

    // 新しいリリースを作成
    const { data: release } = await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tagName,
      name: `IntervalScreenshot ${version} (プレビュー版)`,
      body: `
# IntervalScreenshot ${version}

## 変更点
- メニューバー専用アプリに変更
- バックグラウンドで動作するように改善
- 自動バージョン管理機能を追加

## インストール方法
1. DMGファイルをダウンロード
2. アプリケーションフォルダにドラッグ＆ドロップ
3. アプリケーションを起動
      `,
      draft: false,
      prerelease: true
    });

    console.log(`リリース ${tagName} を作成しました。`);

    // DMGファイルをアップロード
    console.log(`DMGファイルをアップロード中: ${dmgFileName}`);
    
    const fileContent = fs.readFileSync(dmgFilePath);
    const { data: asset } = await octokit.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.id,
      name: dmgFileName,
      data: fileContent,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': fileContent.length
      }
    });

    console.log(`DMGファイルをアップロードしました: ${asset.browser_download_url}`);
    console.log(`リリースURL: ${release.html_url}`);

    // リリースディレクトリにDMGファイルをコピー
    const releasesDir = path.join(__dirname, 'releases');
    if (!fs.existsSync(releasesDir)) {
      fs.mkdirSync(releasesDir, { recursive: true });
    }
    
    const releaseDmgPath = path.join(releasesDir, dmgFileName);
    fs.copyFileSync(dmgFilePath, releaseDmgPath);
    console.log(`DMGファイルをリリースディレクトリにコピーしました: ${releaseDmgPath}`);

  } catch (error) {
    console.error('リリース作成中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// リリース作成を実行
createReleaseWithAsset(); 