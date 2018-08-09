# Zendoro

Zendoro is a nifty time management app built using electron. It builds on
[pomodoro](https://en.wikipedia.org/wiki/Pomodoro_Technique) technique and integrates 
task management using [taskwarrior](https://taskwarrior.org/).

## Installation

Install source code:

```bash
git clone https://github.com/kprav33n/zendoro.git
cd zendoro
./install.sh
```

You can now start the application. Binary distributions will be available soon.

## Configuration

The configuration file is located at:

```
$HOME/Library/Application\ Support/Zendoro/config.js
```

Here is the default configuration:

```js
module.exports = {
  config: {
    // Activity length in milliseconds.
    activityLength: {
      task: 25 * 60 * 1000,
      shortBreak: 5 * 60 * 1000,
      longBreak: 15 * 60 * 1000,
    },

    // Show idle duration timer.
    showIdle: false,

    // Keyboard shortcuts.
    globalShortcut: {
      showMenu: 'CmdOrCtrl+Alt+R',
    },
  },
};
```

* config.activityLength.task: Duration of a pomodoro (default: 25 minutes)
* config.activityLength.shortBreak: Duration of a short break (default: 5 minutes)
* config.activityLength.longBreak: Duration of a long break (default: 15 minutes)
* config.showIdle: Display the idle time in the system tray icon

## Plugins

### Taskwarrior

Zendoro integrates with taskwarrior, simple installtion steps for
installing taskwarrior:

```bash
brew install task
brew install timewarrior
# Replace the home dir with your custom .task dir if required
TASK_HOOKS="${HOME}/.task/hooks/"
cp $(brew --prefix)/share/doc/timew/ext/on-modify.timewarrior ${TASK_HOOKS}
chmod +x ${TASK_HOOKS}/on-modify.timewarrior
```

### Stats Plugin

Zendoro comes pre-installed with a stats plugin that shows the number
of pomodoros completed and the number of short and long breaks taken
for the last 24 hours.

