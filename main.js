const {
  Menu,
  Notification,
  Tray,
  app,
  globalShortcut,
} = require('electron');
const path = require('path');

// FIXME: Verify if this function is written in JS idiomatic way.
function timeToString(ms) {
  if (ms <= 0) {
    return '';
  }

  let t = Math.ceil(ms / 1000);
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

  return `${daysPrefix}${hoursPrefix}${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function showNotification(text) {
  const n = new Notification({
    body: text,
  });
  n.show();
}

class ZenFlow {
  constructor() {
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
    });

    this.transitionToIdle();

    // FIXME: This doesn't play well with alternate keybard layouts.
    this.shortcut = globalShortcut.register('CmdOrCtrl+Alt+R', () => { this.tray.popUpContextMenu(); });
  }

  startTask() {
    const length = 25 * 60 * 1000;
    this.currentActivity = 'Task';
    this.startTimer(length);
  }

  startShortBreak() {
    const length = 5 * 60 * 1000;
    this.currentActivity = 'Short break';
    this.startTimer(length);
  }

  startLongBreak() {
    const length = 15 * 60 * 1000;
    this.currentActivity = 'Long break';
    this.startTimer(length);
  }

  cancelCurrentActivity() {
    if (this.interval != null) {
      this.stopTimer();
      this.updateTrayTitle();
      showNotification(`${this.currentActivity} cancelled.`);
    }
  }

  willQuit() {
    this.stopTimer();
    globalShortcut.unregisterAll();
  }

  startTimer(length) {
    this.tray.setTitle(timeToString(length));
    this.transitionToRunning(length);
  }

  stopTimer() {
    if (this.interval != null) {
      clearInterval(this.interval);
    }
    this.transitionToIdle();
  }

  updateTrayTitle() {
    const remaining = this.end - Date.now();
    this.tray.setTitle(timeToString(remaining));

    if (this.interval != null && remaining <= 0) {
      this.transitionToIdle();
      showNotification(`${this.currentActivity} completed.`);
    }
  }

  transitionToIdle() {
    this.interval = null;
    this.end = Date.now();
    this.contextMenu.items[this.menuIndex.start].enabled = true;
    this.contextMenu.items[this.menuIndex.shortBreak].enabled = true;
    this.contextMenu.items[this.menuIndex.longBreak].enabled = true;
    this.contextMenu.items[this.menuIndex.cancel].enabled = false;
  }

  transitionToRunning(length) {
    this.end = new Date(Date.now() + length).getTime();
    this.interval = setInterval(() => { this.updateTrayTitle(); }, 500);
    this.contextMenu.items[this.menuIndex.start].enabled = false;
    this.contextMenu.items[this.menuIndex.shortBreak].enabled = false;
    this.contextMenu.items[this.menuIndex.longBreak].enabled = false;
    this.contextMenu.items[this.menuIndex.cancel].enabled = true;
  }
}

let flow;

app.on('ready', () => {
  app.dock.hide();
  flow = new ZenFlow();
});

app.on('will-quit', () => {
  flow.willQuit();
});
