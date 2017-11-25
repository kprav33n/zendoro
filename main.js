const {
  Menu,
  Tray,
  app,
  globalShortcut,
} = require('electron');
const path = require('path');

function registerGlobalShortcuts(tray) {
  // FIXME: This doesn't play well with alternate keybard layouts.
  globalShortcut.register('CmdOrCtrl+Alt+R', () => { tray.popUpContextMenu(); });
}

// FIXME: Verify if this function is written in JS idiomatic way.
function timeToString(ms) {
  let t = Math.trunc(ms / 1000);
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

function updateCounter(tray, end) {
  const remaining = end - Date.now();
  tray.setTitle(timeToString(remaining));
}

function clearCounter(tray) {
  tray.setTitle('');
}

const MenuIndex = Object.freeze({
  start: 0,
  cancel: 1,
});

/* eslint-disable no-param-reassign */
function idleState(contextMenu) {
  contextMenu.items[MenuIndex.start].enabled = true;
  contextMenu.items[MenuIndex.cancel].enabled = false;
}

function timerState(contextMenu) {
  contextMenu.items[MenuIndex.start].enabled = false;
  contextMenu.items[MenuIndex.cancel].enabled = true;
}
/* eslint-enable no-param-reassign */


function startTask(tray, contextMenu, interval) {
  timerState(contextMenu);
  if (interval != null) {
    return interval;
  }
  const taskLength = (25 * 60 * 1000);
  const end = new Date(Date.now() + taskLength).getTime();
  updateCounter(tray, end);
  return setInterval(() => { updateCounter(tray, end); }, 500);
}

function cancelTimer(tray, contextMenu, interval) {
  idleState(contextMenu);
  clearInterval(interval);
  clearCounter(tray);
}

app.on('ready', () => {
  const tray = new Tray(path.join(__dirname, 'assets/images/TrayIconTemplate.png'));
  let interval = null;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Start a task',
      accelerator: 'T',
      click() { interval = startTask(tray, contextMenu, interval); },
    },
    {
      label: 'Cancel',
      accelerator: 'C',
      click() { cancelTimer(tray, contextMenu, interval); interval = null; },
    },
    {
      label: 'Quit',
      accelerator: 'Q',
      selector: 'terminate:',
    },
  ]);
  tray.setToolTip('Zendoro');
  tray.setContextMenu(contextMenu);
  idleState(contextMenu);

  registerGlobalShortcuts(tray);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
