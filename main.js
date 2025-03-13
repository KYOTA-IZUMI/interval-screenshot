const { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, dialog, Notification, systemPreferences } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const sharp = require('sharp');

// アイコンデータは外部ファイルから読み込む
let iconData;
try {
  iconData = require('./icon-data.js').iconData;
} catch (error) {
  // アイコンデータが見つからない場合は、デフォルトのアイコンを使用
  iconData = '';
  console.error('アイコンデータの読み込みに失敗しました:', error);
}

let tray = null;
let isRecording = false;
let screenshotInterval = 300000; // デフォルト5分
let screenshotTimer = null;
let settingsWindow = null;
let dailyReportTimer = null;

// アプリケーションの設定を保存するディレクトリ
const configDir = path.join(app.getPath('documents'), 'IntervalScreenshot');
const configFile = path.join(configDir, 'config.json');
const screenshotsDir = path.join(configDir, 'screenshots');
const reportsDir = path.join(configDir, 'reports');

// デフォルト設定
const defaultConfig = {
  interval: 300000, // デフォルト5分
  autoStart: false, // 起動時に自動的に記録を開始するかどうか
  notifications: true, // スクリーンショット撮影時に通知を表示するかどうか
  startAtLogin: false, // ログイン時に自動的に起動するかどうか
  gitEnabled: true, // Gitリポジトリを使用するかどうか
  compressToJpeg: true, // JPEGに圧縮するかどうか
  jpegQuality: 80, // JPEG圧縮品質（0-100）
  createDailyReport: false, // 毎日レポートを作成するかどうか
  dailyReportTime: "18:00" // レポート作成時刻（24時間形式）
};

let appConfig = { ...defaultConfig };

/**
 * スクリーンキャプチャ権限を確認する
 * @returns {boolean} 権限があるかどうか
 */
function checkScreenCapturePermission() {
  if (process.platform !== 'darwin') {
    return true; // macOS以外では常にtrueを返す
  }
  
  // macOSの場合、画面録画の権限を確認
  return systemPreferences.getMediaAccessStatus('screen') === 'granted';
}

/**
 * スクリーンキャプチャ権限をリクエストする
 */
function requestScreenCapturePermission() {
  if (process.platform !== 'darwin') {
    return; // macOS以外では何もしない
  }
  
  // 権限がない場合、システム設定を開くように促す
  const result = dialog.showMessageBoxSync({
    type: 'info',
    title: '画面キャプチャ権限が必要です',
    message: 'このアプリケーションはスクリーンショットを撮影するために画面キャプチャ権限が必要です。',
    detail: 'システム設定の「プライバシーとセキュリティ」から「画面収録」を選択し、このアプリケーションにチェックを入れてください。',
    buttons: ['システム設定を開く', 'キャンセル'],
    defaultId: 0,
    cancelId: 1
  });
  
  if (result === 0) {
    // システム設定を開く
    systemPreferences.openSystemPreferences('security', 'Privacy_ScreenCapture');
  }
}

/**
 * アプリケーションの初期化
 */
async function initializeApp() {
  try {
    // 設定ディレクトリの作成
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(screenshotsDir, { recursive: true });
    await fs.mkdir(reportsDir, { recursive: true });

    // 設定ファイルの読み込み
    await loadConfig();

    // Gitリポジトリの初期化（設定で有効になっている場合のみ）
    if (appConfig.gitEnabled) {
      await initGitRepository();
    }

    // 自動起動の設定
    app.setLoginItemSettings({
      openAtLogin: appConfig.startAtLogin
    });

    // 画面キャプチャ権限を確認
    if (!checkScreenCapturePermission()) {
      requestScreenCapturePermission();
    } else {
      // 自動開始の設定（権限がある場合のみ）
      if (appConfig.autoStart) {
        toggleRecording();
      }
    }

    // 毎日のレポート作成タイマーを設定
    if (appConfig.createDailyReport) {
      scheduleDailyReport();
    }
  } catch (error) {
    showError('Initialization Error', `Failed to initialize the application: ${error.message}`);
  }
}

/**
 * 毎日のレポート作成タイマーをスケジュールする
 */
function scheduleDailyReport() {
  // 既存のタイマーをクリア
  if (dailyReportTimer) {
    clearTimeout(dailyReportTimer);
  }

  // 次の実行時間を計算
  const now = new Date();
  const [hours, minutes] = appConfig.dailyReportTime.split(':').map(Number);
  const targetTime = new Date(now);
  targetTime.setHours(hours, minutes, 0, 0);
  
  // 既に今日の時間を過ぎている場合は明日にスケジュール
  if (now > targetTime) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const timeUntilTarget = targetTime - now;
  
  // タイマーを設定
  dailyReportTimer = setTimeout(async () => {
    await createDailyReport();
    scheduleDailyReport(); // 次の日のタイマーを設定
  }, timeUntilTarget);
}

/**
 * 今日撮影したスクリーンショットからHTMLレポートを作成する
 */
async function createDailyReport() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayPrefix = `wl_${today.replace(/-/g, '')}`;
    
    // 今日のスクリーンショットを取得
    const files = await fs.readdir(screenshotsDir);
    const todayFiles = files.filter(file => file.startsWith(todayPrefix) && (file.endsWith('.png') || file.endsWith('.jpg')));
    
    if (todayFiles.length === 0) {
      console.log('No screenshots found for today');
      return;
    }
    
    // ファイルを時間順にソート
    todayFiles.sort();
    
    // HTMLレポートファイル名
    const reportFilename = `${todayPrefix}_report.html`;
    const reportPath = path.join(reportsDir, reportFilename);
    
    // 時間帯ごとにスクリーンショットをグループ化
    const timeGroups = {};
    
    for (const file of todayFiles) {
      // ファイル名から時間を抽出（wl_YYYYMMDD_HHMMSS.jpg/png）
      const timeMatch = file.match(/_(\d{2})(\d{2})(\d{2})\./);
      
      if (timeMatch) {
        const hours = timeMatch[1];
        const minutes = timeMatch[2];
        const seconds = timeMatch[3];
        
        // 時間帯（1時間ごと）でグループ化
        const timeGroup = `${hours}:00 - ${hours}:59`;
        
        if (!timeGroups[timeGroup]) {
          timeGroups[timeGroup] = [];
        }
        
        timeGroups[timeGroup].push({
          file,
          time: `${hours}:${minutes}:${seconds}`
        });
      }
    }
    
    // HTMLレポートを作成
    let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>WorkLog Daily Report - ${today}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
          color: #333;
        }
        h1 {
          color: #007AFF;
          text-align: center;
          margin-bottom: 30px;
        }
        h2 {
          color: #333;
          border-bottom: 2px solid #007AFF;
          padding-bottom: 5px;
          margin-top: 40px;
          margin-bottom: 20px;
        }
        .summary {
          background-color: white;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary p {
          margin: 5px 0;
        }
        .screenshot-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }
        .screenshot-item {
          background-color: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          transition: transform 0.2s;
        }
        .screenshot-item:hover {
          transform: scale(1.02);
        }
        .screenshot-item img {
          width: 100%;
          height: auto;
          display: block;
        }
        .screenshot-info {
          padding: 10px;
          border-top: 1px solid #eee;
        }
        .screenshot-time {
          font-weight: 500;
        }
        .time-navigation {
          position: sticky;
          top: 0;
          background-color: white;
          padding: 10px;
          margin-bottom: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          z-index: 100;
        }
        .time-navigation ul {
          display: flex;
          flex-wrap: wrap;
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .time-navigation li {
          margin-right: 10px;
          margin-bottom: 5px;
        }
        .time-navigation a {
          display: inline-block;
          padding: 5px 10px;
          background-color: #e9ecef;
          color: #495057;
          text-decoration: none;
          border-radius: 4px;
        }
        .time-navigation a:hover {
          background-color: #007AFF;
          color: white;
        }
        .back-to-top {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background-color: #007AFF;
          color: white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .back-to-top:hover {
          background-color: #0056b3;
        }
      </style>
    </head>
    <body>
      <h1>WorkLog Daily Report - ${today}</h1>
      
      <div class="summary">
        <p><strong>Total Screenshots:</strong> ${todayFiles.length}</p>
        <p><strong>Time Periods:</strong> ${Object.keys(timeGroups).length}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="time-navigation">
        <ul>
          ${Object.keys(timeGroups).map(timeGroup => 
            `<li><a href="#time-${timeGroup.replace(/[^0-9]/g, '')}">${timeGroup}</a></li>`
          ).join('')}
        </ul>
      </div>
    `;
    
    // 時間帯ごとにスクリーンショットを追加
    for (const timeGroup of Object.keys(timeGroups).sort()) {
      const screenshots = timeGroups[timeGroup];
      
      htmlContent += `
        <h2 id="time-${timeGroup.replace(/[^0-9]/g, '')}">${timeGroup} (${screenshots.length} screenshots)</h2>
        <div class="screenshot-container">
      `;
      
      // 各スクリーンショットをHTMLに追加
      for (const screenshot of screenshots) {
        const filePath = path.join(screenshotsDir, screenshot.file);
        
        // 相対パスを計算
        const relativeFilePath = path.relative(reportsDir, filePath).replace(/\\/g, '/');
        
        htmlContent += `
          <div class="screenshot-item">
            <img src="${relativeFilePath}" alt="Screenshot at ${screenshot.time}">
            <div class="screenshot-info">
              <div class="screenshot-time">${screenshot.time}</div>
            </div>
          </div>
        `;
      }
      
      htmlContent += `
        </div>
      `;
    }
    
    htmlContent += `
      <a href="#" class="back-to-top">↑</a>
    </body>
    </html>
    `;
    
    // HTMLファイルを保存
    await fs.writeFile(reportPath, htmlContent);
    
    // 通知を表示
    if (appConfig.notifications) {
      new Notification({
        title: 'WorkLog - Daily Report',
        body: `Created daily report with ${todayFiles.length} screenshots`
      }).show();
    }
    
    return reportPath;
  } catch (error) {
    console.error('Error creating daily report:', error);
    showError('Report Creation Error', `Failed to create daily report: ${error.message}`);
  }
}

/**
 * Gitリポジトリを初期化する
 */
async function initGitRepository() {
  const git = simpleGit(screenshotsDir);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    await git.addConfig('user.name', 'WorkLog App');
    await git.addConfig('user.email', 'worklog@example.com');
  }
}

/**
 * 設定を読み込む
 */
async function loadConfig() {
  try {
    const data = await fs.readFile(configFile, 'utf8');
    const loadedConfig = JSON.parse(data);
    
    // デフォルト設定とマージして、新しい設定項目が追加された場合にも対応
    appConfig = { ...defaultConfig, ...loadedConfig };
    
    // 設定値を適用
    screenshotInterval = appConfig.interval;
  } catch (error) {
    // 設定ファイルが存在しない場合は、デフォルト値を保存
    await saveConfig();
  }
}

/**
 * 設定を保存する
 */
async function saveConfig() {
  try {
    await fs.writeFile(configFile, JSON.stringify(appConfig, null, 2));
  } catch (error) {
    showError('Configuration Error', `Failed to save configuration: ${error.message}`);
  }
}

/**
 * 設定を更新する
 */
async function updateConfig(newConfig) {
  try {
    const oldConfig = { ...appConfig };
    
    // 設定を更新
    appConfig = { ...appConfig, ...newConfig };
    
    // 設定値を適用
    screenshotInterval = appConfig.interval;
    
    // 自動起動の設定を更新
    app.setLoginItemSettings({
      openAtLogin: appConfig.startAtLogin
    });
    
    // 設定を保存
    await saveConfig();
    
    // 記録中の場合は、タイマーを再設定
    if (isRecording) {
      clearInterval(screenshotTimer);
      screenshotTimer = setInterval(takeScreenshot, screenshotInterval);
    }
    
    // 毎日のレポート作成設定が変更された場合
    if (oldConfig.createDailyReport !== appConfig.createDailyReport || 
        oldConfig.dailyReportTime !== appConfig.dailyReportTime) {
      if (appConfig.createDailyReport) {
        scheduleDailyReport();
      } else if (dailyReportTimer) {
        clearTimeout(dailyReportTimer);
      }
    }
  } catch (error) {
    showError('Configuration Error', `Failed to update configuration: ${error.message}`);
  }
}

/**
 * スクリーンショットを撮影する
 */
async function takeScreenshot() {
  try {
    // 現在の日時を取得
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // ファイル名を生成（wl_YYYYMMDD_HHMMSS.png）
    const dateStr = `${year}${month}${day}`;
    const timeStr = `${hours}${minutes}${seconds}`;
    const baseFilename = `wl_${dateStr}_${timeStr}`;
    
    // 一時的なPNGファイルパス
    const tempPngPath = path.join(screenshotsDir, `${baseFilename}_temp.png`);
    
    // 最終的なファイルパス
    const finalFilename = appConfig.compressToJpeg ? `${baseFilename}.jpg` : `${baseFilename}.png`;
    const finalFilePath = path.join(screenshotsDir, finalFilename);
    
    // スクリーンショットを撮影（一時的にPNGとして保存）
    await screenshot({ filename: tempPngPath });
    
    // JPEGに圧縮する場合
    if (appConfig.compressToJpeg) {
      await sharp(tempPngPath)
        .jpeg({ quality: appConfig.jpegQuality })
        .toFile(finalFilePath);
      
      // 一時ファイルを削除
      await fs.unlink(tempPngPath);
    } else {
      // PNGのままの場合は、ファイル名を変更
      await fs.rename(tempPngPath, finalFilePath);
    }
    
    // 通知を表示（設定で有効になっている場合のみ）
    if (appConfig.notifications) {
      new Notification({
        title: 'WorkLog',
        body: 'Screenshot captured'
      }).show();
    }
    
    // Gitリポジトリを使用する場合のみコミット
    if (appConfig.gitEnabled) {
      const git = simpleGit(screenshotsDir);
      await git.add(finalFilePath);
      await git.commit(`Screenshot taken at ${dateStr} ${timeStr}`);
    }
  } catch (error) {
    console.error('Screenshot error:', error);
    showError('Screenshot Error', `Failed to take screenshot: ${error.message}`);
    
    // エラーが発生した場合、記録を停止
    if (isRecording) {
      toggleRecording();
    }
  }
}

/**
 * 記録の開始/停止を切り替える
 */
async function toggleRecording() {
  try {
    isRecording = !isRecording;
    if (isRecording) {
      await takeScreenshot();
      screenshotTimer = setInterval(takeScreenshot, screenshotInterval);
    } else {
      clearInterval(screenshotTimer);
    }
    updateMenu();
  } catch (error) {
    showError('Recording Error', `Failed to ${isRecording ? 'start' : 'stop'} recording: ${error.message}`);
    isRecording = !isRecording; // 状態を元に戻す
    updateMenu();
  }
}

/**
 * 設定ウィンドウを表示する
 */
function showSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  try {
    // macOS風のネイティブな見た目のウィンドウを作成
    settingsWindow = new BrowserWindow({
      width: 450,
      height: 550,
      titleBarStyle: 'hiddenInset',
      vibrancy: 'under-window',
      visualEffectState: 'active',
      backgroundColor: '#00ffffff', // 透明な背景
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      resizable: false
    });

    // macOS風のネイティブUIを使用するためのHTMLを読み込む
    settingsWindow.loadFile('settings-native.html');

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
  } catch (error) {
    showError('Settings Error', `Failed to open settings window: ${error.message}`);
  }
}

/**
 * メニューを更新する
 */
function updateMenu() {
  try {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isRecording ? 'Stop Recording' : 'Start Recording',
        click: toggleRecording
      },
      {
        label: 'Settings',
        click: showSettingsWindow
      },
      {
        label: 'Open Screenshots Folder',
        click: () => {
          try {
            require('electron').shell.openPath(screenshotsDir);
          } catch (error) {
            showError('Folder Error', `Failed to open screenshots folder: ${error.message}`);
          }
        }
      },
      {
        label: 'Open Reports Folder',
        click: () => {
          try {
            require('electron').shell.openPath(reportsDir);
          } catch (error) {
            showError('Folder Error', `Failed to open reports folder: ${error.message}`);
          }
        }
      },
      {
        label: 'Create Daily Report Now',
        click: async () => {
          try {
            const reportPath = await createDailyReport();
            if (reportPath) {
              require('electron').shell.openPath(reportPath);
            }
          } catch (error) {
            showError('Report Error', `Failed to create report: ${error.message}`);
          }
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',
        click: () => app.quit()
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip(`WorkLog - ${isRecording ? 'Recording' : 'Stopped'}`);
  } catch (error) {
    console.error('Menu update error:', error);
  }
}

/**
 * エラーダイアログを表示する
 */
function showError(title, message) {
  dialog.showErrorBox(title, message);
}

// IPC通信の設定
ipcMain.on('update-interval', async (event, interval) => {
  try {
    const seconds = Math.max(10, parseInt(interval));
    await updateConfig({ interval: seconds * 1000 });
    
    if (settingsWindow) {
      settingsWindow.close();
    }
  } catch (error) {
    showError('Interval Update Error', `Failed to update interval: ${error.message}`);
  }
});

// 設定の更新
ipcMain.on('update-config', async (event, newConfig) => {
  try {
    await updateConfig(newConfig);
    
    if (settingsWindow) {
      settingsWindow.close();
    }
  } catch (error) {
    showError('Configuration Error', `Failed to update configuration: ${error.message}`);
  }
});

// 設定の取得
ipcMain.handle('get-config', async () => {
  return appConfig;
});

app.whenReady().then(async () => {
  try {
    await initializeApp();
    
    // Base64データからアイコンを作成
    const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconData}`);
    
    // メニューバーにアイコンを表示
    tray = new Tray(icon);
    updateMenu();
    
    // アイコンをクリックしたときに設定ウィンドウを表示
    tray.on('click', () => {
      // 画面キャプチャ権限を確認
      if (!checkScreenCapturePermission()) {
        requestScreenCapturePermission();
      } else {
        showSettingsWindow();
      }
    });
  } catch (error) {
    showError('Startup Error', `Failed to start the application: ${error.message}`);
    app.quit();
  }
});

// macOSでウィンドウを閉じてもアプリを終了しないようにする
app.on('window-all-closed', () => {
  // Do nothing to keep the app running
});

// Dockアイコンを非表示にする（macOSのみ）
if (process.platform === 'darwin') {
  app.dock.hide();
} 