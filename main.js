const { app, Tray, Menu, BrowserWindow } = require('electron');
const path = require('path');

let tray = null;

app.on('ready', function () {
      tray = new Tray(path.join(__dirname, 'assets/images/TrayIconTemplate.png'));
      const contextMenu = Menu.buildFromTemplate([
            {
                  label: 'Quit',
                  accelerator: 'Command+Q',
                  selector: 'terminate:',
            }
      ]);
      tray.setToolTip('Zendoro');
      tray.setContextMenu(contextMenu);
});
