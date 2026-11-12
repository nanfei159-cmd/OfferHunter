// GetJobs 猎聘投递助手 · Electron 桌面壳
//
// ponytail: 第一版直接复用现有 Spring Boot + Next.js 页面，只负责启动后端、
// 等待端口、开窗口、退出时杀进程。Java 21 和 Node.js 用本机已安装的版本；
// 要发给别人时再做 jlink 运行时 + 内置 node.exe。

const { app, BrowserWindow, dialog, shell, Menu, session } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

app.setName('Offer猎手');
app.commandLine.appendSwitch('no-proxy-server');

const isDev = !app.isPackaged;
const PROJECT_ROOT = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const JAR_PATH = isDev
  ? findJar(path.join(PROJECT_ROOT, 'build', 'libs'))
  : path.join(PROJECT_ROOT, 'getjobs.jar');
const DRIVER_DIR = isDev
  ? path.join(PROJECT_ROOT, 'build', 'patchright-driver')
  : path.join(PROJECT_ROOT, 'patchright-driver');
const SEED_DB = isDev
  ? path.join(PROJECT_ROOT, 'db-template', 'getjobs.db')
  : path.join(PROJECT_ROOT, 'db', 'getjobs.db');

let mainWindow = null;
let splashWindow = null;
let javaProc = null;
let quitting = false;
let dataDir = '';
let logPath = '';
let tail = [];

function findJar(dir) {
  try {
    const jars = fs.readdirSync(dir).filter((f) => f.endsWith('.jar'));
    return jars.length ? path.join(dir, jars[0]) : null;
  } catch {
    return null;
  }
}

function resolveJava() {
  const candidates = [];
  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
  }
  candidates.push('java');

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ['-version'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      });
      if (result.status !== 0) continue;
      const output = `${result.stdout || ''}${result.stderr || ''}`;
      const match = output.match(/version "(\d+)/);
      if (match && Number(match[1]) >= 21) return candidate;
    } catch {
      // 换下一个候选
    }
  }
  return null;
}

function findNode() {
  try {
    const result = spawnSync('where', ['node'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    });
    if (result.status === 0) {
      const first = result.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
      if (first) return first;
    }
  } catch {
    // 后端会自己从 PATH 找
  }
  return null;
}

function appendLog(chunk) {
  const text = chunk.toString();
  if (!text) return;
  fs.appendFileSync(logPath, text);
  const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
  tail.push(...clean.split(/\r?\n/).filter(Boolean));
  if (tail.length > 120) tail = tail.slice(-120);
}

function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1200 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForServer() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (javaProc && javaProc.exitCode !== null) return false;
    const health = await httpOk('http://127.0.0.1:9527/api/health');
    const ui = health && (await httpOk('http://127.0.0.1:6866/liepin'));
    if (health && ui) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

function startBackend(java) {
  dataDir = app.getPath('userData');
  logPath = path.join(dataDir, 'backend.log');
  fs.mkdirSync(dataDir, { recursive: true });

  const dbDir = path.join(dataDir, 'db');
  const dbPath = path.join(dbDir, 'getjobs.db');
  fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    if (!SEED_DB || !fs.existsSync(SEED_DB)) {
      throw new Error('缺少初始数据库模板: ' + SEED_DB);
    }
    fs.copyFileSync(SEED_DB, dbPath);
  }

  if (!JAR_PATH || !fs.existsSync(JAR_PATH)) {
    throw new Error('未找到后端 jar。开发环境请先运行: gradlew bootJar');
  }
  if (!fs.existsSync(path.join(DRIVER_DIR, 'package', 'cli.js'))) {
    throw new Error('未找到 patchright driver。开发环境请先运行: gradlew installPatchrightDriver');
  }

  fs.appendFileSync(
    logPath,
    `\n===== ${new Date().toISOString()} 启动桌面版 =====\njar: ${JAR_PATH}\njava: ${java}\n`,
  );

  const nodePath = findNode();
  const env = { ...process.env, GETJOBS_DESKTOP: '1' };
  if (nodePath) env.PLAYWRIGHT_NODEJS_PATH = nodePath;

  javaProc = spawn(java, [`-Dplaywright.cli.dir=${DRIVER_DIR}`, '-jar', JAR_PATH], {
    cwd: dataDir,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  javaProc.stdout.on('data', appendLog);
  javaProc.stderr.on('data', appendLog);
  javaProc.on('error', (error) => {
    if (!quitting) showFatal('无法启动 Java 进程: ' + error.message);
  });
  javaProc.on('exit', (code) => {
    if (!quitting) showFatal(`后端进程已退出（code=${code}）。最近日志：`);
  });
}

function stopBackend() {
  if (!javaProc || javaProc.exitCode !== null) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(javaProc.pid), '/T', '/F'], {
        windowsHide: true,
        timeout: 8000,
      });
    } else {
      javaProc.kill('SIGTERM');
    }
  } catch {
    try {
      javaProc.kill();
    } catch {
      // 已经退出
    }
  }
  javaProc = null;
}

function showFatal(message) {
  if (quitting) return;
  quitting = true;
  const detail = tail.slice(-30).join('\n') || '（日志为空）';
  const choice = dialog.showMessageBoxSync({
    type: 'error',
    title: '启动失败',
    message,
    detail,
    buttons: ['打开日志', '退出'],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
  });
  if (choice === 0 && logPath) shell.openPath(logPath);
  app.quit();
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 320,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    backgroundColor: '#FFF9EF',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FFF9EF',
    title: 'Offer猎手 · 猎聘投递助手',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    showFatal(`页面加载失败（${code} ${description}）。`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });

  mainWindow.loadURL('http://127.0.0.1:6866/liepin');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // 改名后继续沿用旧数据目录，保留配置、投递记录和猎聘登录态
    app.setPath('userData', path.join(app.getPath('appData'), 'GetJobs Liepin'));
    Menu.setApplicationMenu(null);
    await session.defaultSession.setProxy({ mode: 'direct' });

    createSplash();

    const java = resolveJava();
    if (!java) {
      showFatal('未找到 Java 21。请安装 Temurin/OpenJDK 21 后重试。');
      return;
    }

    try {
      startBackend(java);
    } catch (error) {
      showFatal(error.message);
      return;
    }

    const ready = await waitForServer();
    if (quitting) return;
    if (!ready) {
      showFatal('后端启动超时。最近日志：');
      return;
    }

    createMainWindow();
  });
}

app.on('before-quit', () => {
  quitting = true;
  stopBackend();
});

app.on('window-all-closed', () => {
  app.quit();
});
