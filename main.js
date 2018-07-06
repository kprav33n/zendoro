const {
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  app,
  globalShortcut,
} = require('electron');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// FIXME: Verify if this function is written in JS idiomatic way.
function timeToString(ms, showIdle) {
  if (!showIdle && ms <= 0) {
    return '';
  }

  let idlePrefix = '';
  let remMs = ms;
  if (ms <= 0) {
    idlePrefix = 'Idle for ';
    remMs = -ms;
  }

  let t = Math.ceil(remMs / 1000);
  const seconds = t % 60;
  t = Math.trunc(t / 60);
  const minutes = t % 60;
  t = Math.trunc(t / 60);
  const hours = t % 24;
  t = Math.trunc(t / 24);
  const days = t;

  let daysPrefix = '';
  if (days > 1) {
    daysPrefix = `${days} days, `;
  } else if (days > 0) {
    daysPrefix = `${days} day, `;
  }

  let hoursPrefix = '';
  if (hours > 0) {
    hoursPrefix = `${hours.toString().padStart(2, '0')}:`;
  }

  return `${idlePrefix}${daysPrefix}${hoursPrefix}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function showNotification(text) {
  const n = new Notification({
    body: text,
  });
  n.show();
}

class ConfigStore {
  constructor() {
    this.config = {
      activityLength: {
        task: 25 * 60 * 1000,
        shortInterval: 5 * 60 * 1000,
        longInterval: 15 * 60 * 1000,
      },
      showIdle: true,
    };
    this.configFile = path.join(app.getPath('userData'), 'config.js');

    this.initUserConfig();
  }

  loadConfig() {
    if (!fs.existsSync(this.configFile)) {
      return;
    }

    const configData = fs.readFileSync(this.configFile);
    const script = new vm.Script(configData);
    const module = {};
    const context = vm.createContext({ module });
    script.runInContext(context);
    this.config = module.exports.config;

    const that = this;
    /* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
    fs.watchFile(this.configFile, (_curr, _prev) => {
      that.loadConfig();
      showNotification('Configuration reloaded.');
    });
  }

  initUserConfig() {
    if (fs.existsSync(this.configFile)) {
      this.loadConfig();
      return;
    }

    showNotification("Initializing user's default configuration.");
    const defaultConfigFile = path.resolve(__dirname, 'config-default.js');
    const pipe = fs.createReadStream(defaultConfigFile).pipe(fs.createWriteStream(this.configFile));
    const that = this;
    pipe.on('finish', () => { that.loadConfig(); });
  }
}

class ZenFlow {
  constructor(config) {
    this.config = config;
    this.tray = new Tray(path.join(__dirname, 'assets/images/TrayIconTemplate.png'));
    this.tray.setToolTip('Zendoro');
    const that = this;
    this.contextMenu = Menu.buildFromTemplate([
      {
        label: 'Start a task',
        accelerator: 'T',
        click() { that.startTask(); },
      },
      {
        label: 'Take a short break',
        accelerator: 'S',
        click() { that.startShortBreak(); },
      },
      {
        label: 'Take a long break',
        accelerator: 'L',
        click() { that.startLongBreak(); },
      },
      {
        label: 'Cancel',
        accelerator: 'C',
        click() { that.cancelCurrentActivity(); },
      },
      {
        label: 'Quit',
        accelerator: 'Q',
        selector: 'terminate:',
      },
    ]);
    this.tray.setContextMenu(this.contextMenu);
    this.menuIndex = Object.freeze({
      start: 0,
      shortBreak: 1,
      longBreak: 2,
      cancel: 3,
      quit: 4,
    });

    this.updateInterval = setInterval(() => { this.updateTrayTitle(); }, 500);
    this.transitionToIdle();

    this.willQuit = false;
    this.window = new BrowserWindow({ show: false });
    this.window.on('close', (e) => {
      if (this.willQuit) {
        this.window = null;
        app.exit();
      } else {
        e.preventDefault();
        this.window.hide();
      }
    });
    app.dock.hide();

    // FIXME: This doesn't play well with alternate keybard layouts.
    this.shortcut = globalShortcut.register(
      this.config.config.globalShortcut.showMenu,
      () => { this.tray.popUpContextMenu(); },
    );
  }

  startTask() {
    this.currentActivity = 'Task';
    this.startTimer(this.config.config.activityLength.task);
  }

  startShortBreak() {
    this.currentActivity = 'Short break';
    this.startTimer(this.config.config.activityLength.shortBreak);
  }

  startLongBreak() {
    this.currentActivity = 'Long break';
    this.startTimer(this.config.config.activityLength.longBreak);
  }

  cancelCurrentActivity() {
    if (this.inProgress) {
      this.transitionToIdle();
      showNotification(`${this.currentActivity} cancelled.`);
    }
  }

  beforeQuit() {
    clearInterval(this.updateInterval);
    globalShortcut.unregisterAll();
    this.willQuit = true;
  }

  startTimer(length) {
    this.tray.setTitle(timeToString(length));
    this.transitionToRunning(length);
  }

  updateTrayTitle() {
    const remaining = this.end - Date.now();
    this.tray.setTitle(timeToString(remaining, this.config.config.showIdle));

    if (this.inProgress && remaining <= 0) {
      this.transitionToIdle();
      showNotification(`${this.currentActivity} completed.`);
    }
  }

  transitionToIdle() {
    this.inProgress = false;
    this.end = Date.now();
    this.contextMenu.items[this.menuIndex.start].enabled = true;
    this.contextMenu.items[this.menuIndex.shortBreak].enabled = true;
    this.contextMenu.items[this.menuIndex.longBreak].enabled = true;
    this.contextMenu.items[this.menuIndex.cancel].enabled = false;
  }

  transitionToRunning(length) {
    this.inProgress = true;
    this.end = new Date(Date.now() + length).getTime();
    this.contextMenu.items[this.menuIndex.start].enabled = false;
    this.contextMenu.items[this.menuIndex.shortBreak].enabled = false;
    this.contextMenu.items[this.menuIndex.longBreak].enabled = false;
    this.contextMenu.items[this.menuIndex.cancel].enabled = true;
  }
}

let flow;

app.on('ready', () => {
  const config = new ConfigStore();
  flow = new ZenFlow(config);
});

app.on('before-quit', () => {
  flow.beforeQuit();
});
