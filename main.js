const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');

// 設定の保存用
const store = new Store();

let mainWindow;
let tray;
let intervalId = null;
let isCapturing = false;

// スクリーンショットの保存先フォルダの初期設定
const defaultSavePath = path.join(app.getPath('pictures'), 'IntervalScreenshots');
let saveDirectory = store.get('saveDirectory') || defaultSavePath;

// 撮影間隔の初期設定（分単位）
const defaultInterval = 5;
let captureInterval = store.get('captureInterval') || defaultInterval;

// アプリが準備完了したときの処理
app.whenReady().then(() => {
  createWindow();
  createTray();
  
  // 保存先フォルダが存在しない場合は作成
  if (!fs.existsSync(saveDirectory)) {
    fs.mkdirSync(saveDirectory, { recursive: true });
  }
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// メインウィンドウの作成
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // 開発者ツールを開きたい場合はコメントを外す
  // mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // メインウィンドウが準備できたら現在の設定を送信
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('update-settings', {
      interval: captureInterval,
      saveDir: saveDirectory,
      isCapturing: isCapturing
    });
  });
}

// トレイアイコンの作成
function createTray() {
  // デフォルトのアイコンを生成
  const icon = nativeImage.createEmpty();
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '設定', 
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      }
    },
    { 
      label: isCapturing ? 'キャプチャ停止' : 'キャプチャ開始', 
      click: () => {
        if (isCapturing) {
          stopCapturing();
        } else {
          startCapturing();
        }
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Interval Screenshot');
  tray.setContextMenu(contextMenu);
  
  // トレイアイコンのクリックでウィンドウを表示
  tray.on('click', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
}

// トレイメニューの更新
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '設定', 
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      }
    },
    { 
      label: isCapturing ? 'キャプチャ停止' : 'キャプチャ開始', 
      click: () => {
        if (isCapturing) {
          stopCapturing();
        } else {
          startCapturing();
        }
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: '終了',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// スクリーンショットの撮影開始
function startCapturing() {
  if (isCapturing) return;
  
  isCapturing = true;
  
  // 初回の撮影をすぐに実行
  captureScreen();
  
  // 設定した間隔で定期的に撮影
  intervalId = setInterval(() => {
    captureScreen();
  }, captureInterval * 60 * 1000); // 分をミリ秒に変換
  
  // メインウィンドウが開いていれば状態を更新
  if (mainWindow) {
    mainWindow.webContents.send('capture-state-changed', isCapturing);
  }
}

// スクリーンショットの撮影停止
function stopCapturing() {
  if (!isCapturing) return;
  
  isCapturing = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  // メインウィンドウが開いていれば状態を更新
  if (mainWindow) {
    mainWindow.webContents.send('capture-state-changed', isCapturing);
  }
}

// スクリーンショットの撮影
function captureScreen() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `screenshot_${timestamp}.png`;
  const filePath = path.join(saveDirectory, filename);
  
  // Macのscreencaptureコマンドでスクリーンショットを撮影
  exec(`screencapture -x "${filePath}"`, (error) => {
    if (error) {
      console.error('スクリーンショットの撮影に失敗しました:', error);
      if (mainWindow) {
        mainWindow.webContents.send('capture-error', error.message);
      }
      return;
    }
    
    console.log(`スクリーンショットを保存しました: ${filePath}`);
    if (mainWindow) {
      mainWindow.webContents.send('capture-success', filePath);
    }
  });
}

// IPC通信の設定
ipcMain.on('start-capture', () => {
  startCapturing();
  updateTrayMenu();
});

ipcMain.on('stop-capture', () => {
  stopCapturing();
  updateTrayMenu();
});

ipcMain.on('set-interval', (event, minutes) => {
  captureInterval = parseInt(minutes, 10) || defaultInterval;
  store.set('captureInterval', captureInterval);
  
  // 撮影中なら一度停止して再開
  if (isCapturing) {
    stopCapturing();
    startCapturing();
  }
});

ipcMain.on('set-save-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'スクリーンショットの保存先を選択'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    saveDirectory = result.filePaths[0];
    store.set('saveDirectory', saveDirectory);
    
    // フォルダが存在しない場合は作成
    if (!fs.existsSync(saveDirectory)) {
      fs.mkdirSync(saveDirectory, { recursive: true });
    }
    
    if (mainWindow) {
      mainWindow.webContents.send('update-save-directory', saveDirectory);
    }
  }
});

ipcMain.on('get-settings', (event) => {
  event.reply('update-settings', {
    interval: captureInterval,
    saveDir: saveDirectory,
    isCapturing: isCapturing
  });
});

// アプリ終了時の処理
app.on('window-all-closed', () => {
  // Macの場合はDockアイコンをクリックで再度ウィンドウを表示できるようにする
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// アプリ終了前に撮影を停止
app.on('before-quit', () => {
  stopCapturing();
}); 