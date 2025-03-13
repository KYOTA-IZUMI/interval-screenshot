const { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage, dialog, Notification } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const simpleGit = require('simple-git');
const fs = require('fs').promises;

// アイコンデータ（Base64エンコード）- より洗練されたカメラアイコン
const iconData = `iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAARjSURBVFiFtZdbbBRVGMd/Z2Z32e52u+1uW6BAW6BFLgUF5WKQmKgxaiIJGhJfTAgPJj5oTPTFxMQXE318MTEEE33AB2OCXEzAcAkCAcIlSi+U0pZ2t9vdbbfb3e7OzPFhd9ll293OpZzkZGbO+c7/9805c74zQpqmABuBZ4H7gQVAzk3TReAk8BXwJaCnGyTSCFABvAfsAHJvw1cH9gL7gJ+nEyJVgEeBj4HlM0l9C6eAV4Gfkhmb0wR4HvgGyLtDx5HIA14EPgCMRIZKgvGdwOe3cW4CZZiGiVAEQhFpO48kC/gQKAZ2xxvEC1AJfA/kpHJsGiZnB8/yS/8v9A/3Y9kWpmVimRaWZQFgGAaGbqAbOjnuHCryK1hXtI6FuQtTDZEDvABcAX6LNYgV4FHgMJCdyrGu6xw5f4QfLvxAz1BPSvt4lOeX82TZk2wq2YSu6MnMB4HNwLFIRySABXxPmvJblsUPF37g0NlDDI4NphMhKQW5BWxftJ2Hi1JeVl3AJuBCZCcCe4Cn0jnUNI1D5w5x9OLRtM5TYWXBSp5Z+gx5nrxkpjrwGvBRZMcNbAMOpnOm6zqHzx3mWM+xZKZTYlkWmqahqRqaplFgFvBY8WOUuEpQhIKu6OiKjlDEpL0QgqfLnqbIW8SXp7/EsqxxY+AQsB1oBXABR4D1qZwZhsHhrsP82PVjUuGWZdHZ30lTZxOtva10D3bTM9RD/0g/o/oopmWiCpUsTxaFOYWU5JawLH8Za4vWUpZXNjFGU2cTB04dwLTMeNcngPXAqBvYQRrnpmny3dnvONp9NKldJDRN003rQCvHe47T0tvCmDGGK8NFjjuHbHc2Xo8Xj+5BVVRMy2RMH2NoYoiugS7a+9rRFI3lBct5YP4DrClaQ3NXM1+d+QrDMuJdrwc2u4HXSZPzTd1NvNf0XkrnEQzpQ5zoPcHxnuMMjg3idXspzStlRcEKluUvY0HOAjxuz6S9aZmM6qP0DPVwtu8szV3NtPS2UJhTyM7VO/G6vfFDvO4G6oBFyZyOG+O809BaWgdak9pFQjd1Wvta+a3nN452H0URCgvzFrK2aC1ritZQkl2CpqTOZUIIvB4vZXllrCtex9YlW/G4PJP2QFcbqAZKkzlr7W3l/ab3GdPHUjqPYHBskKauJn7t/pWB0QHyPHlsLNnIQ/MfYlHuorTOE0EIgcftSbS/5AZKSJHzDd0NvNv4LqZlpnUOYFkWHf0dHLlwhObeZlRFZXXhah4vfZyVBStRFXXGzqeDEKLLDcwjSc439jRyoOUAhmXMyLllWXT2d/Lzpd/5o/cPTMukPL+cLWVbWF+8Hpeauq5MF0KIPjewINGgoa+B95veRzd1ZgLLsugZ6uFo91F+7/kdwzIozSvl6bKn2VS6CY/Lc8fOIxFCXHUDnngDXdfZ37yfUX10xs4jGDfGae5q5nj3cYb1YQpyCnhx5YtsLt2MqqgzHzQOQohRN3A50iCEYGR8hOHx4TtyHoEQAq/by8vVL7OldAuKSF1gZgIhxJgbOBHbPzg2yJgxdsfOI/C6vWwu3Zz2/+FMIYQYcQNfAK2x/blZuXhd3v9VgNb/APz5KK+FBU9lAAAAAElFTkSuQmCC`;

let tray = null;
let isRecording = false;
let screenshotInterval = 300000; // デフォルト5分
let screenshotTimer = null;
let settingsWindow = null;

// アプリケーションの設定を保存するディレクトリ
const configDir = path.join(app.getPath('documents'), 'WorkLog');
const configFile = path.join(configDir, 'config.json');
const screenshotsDir = path.join(configDir, 'screenshots');

// デフォルト設定
const defaultConfig = {
  interval: 300000, // デフォルト5分
  autoStart: false, // 起動時に自動的に記録を開始するかどうか
  notifications: true, // スクリーンショット撮影時に通知を表示するかどうか
  startAtLogin: false, // ログイン時に自動的に起動するかどうか
  gitEnabled: true // Gitリポジトリを使用するかどうか
};

let appConfig = { ...defaultConfig };

/**
 * アプリケーションの初期化
 */
async function initializeApp() {
  try {
    // 設定ディレクトリの作成
    await fs.mkdir(configDir, { recursive: true });
    await fs.mkdir(screenshotsDir, { recursive: true });

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

    // 自動開始の設定
    if (appConfig.autoStart) {
      toggleRecording();
    }
  } catch (error) {
    showError('Initialization Error', `Failed to initialize the application: ${error.message}`);
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
  } catch (error) {
    showError('Configuration Error', `Failed to update configuration: ${error.message}`);
  }
}

/**
 * スクリーンショットを撮影する
 */
async function takeScreenshot() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filepath = path.join(screenshotsDir, filename);
    
    await screenshot({ filename: filepath });
    
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
      await git.add(filepath);
      await git.commit(`Screenshot taken at ${timestamp}`);
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
    settingsWindow = new BrowserWindow({
      width: 300,
      height: 150,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      resizable: false
    });

    settingsWindow.loadFile('settings.html');

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
        label: 'Set Interval',
        click: showSettingsWindow
      },
      {
        label: 'Open Folder',
        click: () => {
          try {
            require('electron').shell.openPath(screenshotsDir);
          } catch (error) {
            showError('Folder Error', `Failed to open screenshots folder: ${error.message}`);
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
    tray = new Tray(icon);
    updateMenu();
  } catch (error) {
    showError('Startup Error', `Failed to start the application: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 