const { app, Tray, Menu, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const simpleGit = require('simple-git');
const fs = require('fs').promises;

// アイコンデータ（Base64エンコード）
const iconData = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABQSURBVFiD7c6xDYAwDETRH4pMwCIMwyIMwwRUVBmJIhVNLCdYUZo7+VVnS76IiB5NamvvR3BL05qZ4wN4AAcWdWBRBxZ1YFEHFnVgUQcW3QBxJQ1tN1PgIAAAAABJRU5ErkJggg==';

let tray = null;
let isRecording = false;
let screenshotInterval = 300000; // デフォルト5分
let screenshotTimer = null;
let settingsWindow = null;

// アプリケーションの設定を保存するディレクトリ
const configDir = path.join(app.getPath('documents'), 'WorkLog');
const configFile = path.join(configDir, 'config.json');
const screenshotsDir = path.join(configDir, 'screenshots');

async function initializeApp() {
  // 設定ディレクトリの作成
  await fs.mkdir(configDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });

  // Gitリポジトリの初期化
  const git = simpleGit(screenshotsDir);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
    await git.addConfig('user.name', 'WorkLog App');
    await git.addConfig('user.email', 'worklog@example.com');
  }

  // 設定ファイルの読み込み
  try {
    const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
    screenshotInterval = config.interval || screenshotInterval;
  } catch (error) {
    // 設定ファイルが存在しない場合は、デフォルト値を保存
    await saveConfig();
  }
}

async function saveConfig() {
  const config = {
    interval: screenshotInterval
  };
  await fs.writeFile(configFile, JSON.stringify(config, null, 2));
}

async function takeScreenshot() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.png`;
    const filepath = path.join(screenshotsDir, filename);
    
    await screenshot({ filename: filepath });
    
    // Gitにコミット
    const git = simpleGit(screenshotsDir);
    await git.add(filepath);
    await git.commit(`Screenshot taken at ${timestamp}`);
  } catch (error) {
    console.error('Screenshot error:', error);
  }
}

async function toggleRecording() {
  isRecording = !isRecording;
  if (isRecording) {
    await takeScreenshot();
    screenshotTimer = setInterval(takeScreenshot, screenshotInterval);
  } else {
    clearInterval(screenshotTimer);
  }
  updateMenu();
}

function showSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

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
}

function updateMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: isRecording ? '記録を停止' : '記録を開始',
      click: toggleRecording
    },
    {
      label: '間隔を設定',
      click: showSettingsWindow
    },
    {
      label: 'フォルダを開く',
      click: () => require('electron').shell.openPath(screenshotsDir)
    },
    {
      type: 'separator'
    },
    {
      label: '終了',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`WorkLog - ${isRecording ? '記録中' : '停止中'}`);
}

// IPC通信の設定
ipcMain.on('update-interval', async (event, interval) => {
  const seconds = Math.max(10, parseInt(interval));
  screenshotInterval = seconds * 1000;
  await saveConfig();
  
  if (isRecording) {
    clearInterval(screenshotTimer);
    screenshotTimer = setInterval(takeScreenshot, screenshotInterval);
  }

  if (settingsWindow) {
    settingsWindow.close();
  }
});

app.whenReady().then(async () => {
  await initializeApp();
  
  // Base64データからアイコンを作成
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${iconData}`);
  tray = new Tray(icon);
  updateMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 