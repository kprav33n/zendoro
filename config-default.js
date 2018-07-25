module.exports = {
  config: {
    // Activity length in milliseconds.
    activityLength: {
      task: 25 * 60 * 1000,
      shortBreak: 5 * 60 * 1000,
      longBreak: 15 * 60 * 1000
    },

    // Show idle duration timer.
    showIdle: true,

    // Keyboard shortcuts.
    globalShortcut: {
      showMenu: 'CmdOrCtrl+Alt+R'
    }
  }
}
