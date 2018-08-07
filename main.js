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
const process = require('child_process');
const uuidv4 = require('uuid/v4');

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

class TaskWarriorExtension {
  constructor() {
    this.taskId = 0;
  }

  makeMenu(flow) {
    const ext = this;
    if (!flow.inProgress) {
      const tasks = JSON.parse(process.execSync('/usr/local/bin/task export').toString());
      const tasksMenu = tasks.filter(
        t => (t.status !== 'deleted' && t.status !== 'completed'),
      ).sort((x, y) => y.urgency - x.urgency).map(t => ({
        label: t.description,
        click() {
          ext.taskId = t.id;
          flow.startTask();
        },
      }));
      return [
        {
          label: 'Start a TaskWarrior task',
          submenu: tasksMenu,
        },
      ];
    }

    const tasks = JSON.parse(process.execSync(`/usr/local/bin/task ${this.taskId} export`).toString());
    return tasks.map(t => ({
      label: `Active: ${t.description}`,
      enabled: false,
    }));
  }

  onTaskStart() {
    if (this.taskId !== 0) {
      process.execSync(`/usr/local/bin/task start ${this.taskId}`);
    }
  }

  onSmallBreakStart() {
  }

  onLongBreakStart() {
  }

  onEnd() {
    if (this.taskId !== 0) {
      process.execSync(`/usr/local/bin/task stop ${this.taskId}`);
      this.taskId = 0;
    }
  }
}

class Task {
  constructor(id = 0) {
    if (id === 0) {
      this.id = uuidv4();
    } else {
      this.id = id;
    }
  }
}

class StatsExtension {
  constructor() {
    this.task = null;
    this.tasks = [];
  }

  makeMenu(_) {
    const now = Date.now();
    const tasks24H = this.tasks.filter(t => now - t.startTime < 24 * 60 * 60 * 1000);
    const numTasks = tasks24H.filter(t => t.type === 'task').length;
    const numSmallBreaks = tasks24H.filter(t => t.type === 'smallBreak').length;
    const numLongBreaks = tasks24H.filter(t => t.type === 'longBreak').length;
    return [
      {
        type: 'separator',
      },
      {
        label: `🍅 ${numTasks} ☕ ${numSmallBreaks} 🍔 ${numLongBreaks} 24 Hours`,
        enabled: false,
      },
    ];
  }

  onTaskStart() {
    this.task = new Task();
    this.task.startTime = Date.now();
    this.task.type = 'task';
    this.tasks.push(this.task);
  }

  onSmallBreakStart() {
    this.task = new Task();
    this.task.startTime = Date.now();
    this.task.type = 'smallBreak';
    this.tasks.push(this.task);
  }

  onLongBreakStart() {
    this.task = new Task();
    this.task.startTime = Date.now();
    this.task.type = 'longBreak';
    this.tasks.push(this.task);
  }

  onEnd() {
    if (this.task !== null) {
      this.task.endTime = Date.now();
    }
  }
}

class ZenFlow {
  constructor(config) {
    const that = this;

    this.config = config;
    this.tray = new Tray(path.join(__dirname, 'assets/images/TrayIconTemplate.png'));
    this.tray.setToolTip('Zendoro');

    this.tray.on('click', _ => that.tray.popUpContextMenu(that.makeMenu()));

    this.updateInterval = setInterval(() => { this.updateTrayTitle(); }, 500);

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

    this.extensions = [
      new TaskWarriorExtension(this),
      new StatsExtension(this),
    ];
    this.transitionToIdle();
  }

  makeMenu() {
    const that = this;
    let template = [];
    if (!this.inProgress) {
      template = template.concat([
        {
          label: 'Start a task',
          accelerator: 'T',
          enabled: !that.inProgress,
          click() { that.startTask(); },
        },
        {
          label: 'Take a short break',
          accelerator: 'S',
          enabled: !that.inProgress,
          click() { that.startShortBreak(); },
        },
        {
          label: 'Take a long break',
          accelerator: 'L',
          enabled: !that.inProgress,
          click() { that.startLongBreak(); },
        },
      ]);
    } else {
      template = template.concat([
        {
          label: 'Cancel/Finish',
          accelerator: 'C',
          enabled: that.inProgress,
          click() { that.cancelCurrentActivity(); },
        },
      ]);
    }
    template = template.concat([
      {
        label: 'Quit',
        accelerator: 'Q',
        selector: 'terminate:',
      },
      {
        type: 'separator',
      },
    ]);

    template = template.concat(
      this.extensions.map(e => e.makeMenu(this)).reduce((x, y) => x.concat(y), []),
    );

    return Menu.buildFromTemplate(template);
  }

  startTask() {
    this.currentActivity = 'Task';
    this.startTimer(this.config.config.activityLength.task);
    this.extensions.forEach(e => e.onTaskStart());
  }

  startShortBreak() {
    this.currentActivity = 'Short break';
    this.startTimer(this.config.config.activityLength.shortBreak);
    this.extensions.forEach(e => e.onSmallBreakStart());
  }

  startLongBreak() {
    this.currentActivity = 'Long break';
    this.startTimer(this.config.config.activityLength.longBreak);
    this.extensions.forEach(e => e.onLongBreakStart());
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
    this.transitionToIdle();
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
    this.extensions.forEach(e => e.onEnd());
    this.inProgress = false;
    this.end = Date.now();
  }

  transitionToRunning(length) {
    this.inProgress = true;
    this.end = new Date(Date.now() + length).getTime();
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
