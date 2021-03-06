const {app, BrowserWindow, ipcMain, Tray} = require('electron');
const path = require('path');
const gitconfig = require('gitconfig');
const storage = require('electron-json-storage');
const uuidv1 = require('uuid/v1');

const assetsDirectory = path.join(__dirname, 'assets');

let tray = undefined;
let window = undefined;

// Don't show the app in the doc
app.dock.hide();

app.on('ready', () => {
  tray = createTray();
  window = createWindow();
});

// Quit the app when the window is closed
app.on('window-all-closed', () => {
  app.quit();
});

const createTray = () => {
  const tray = new Tray(path.join(assetsDirectory, 'git.png'));
  tray.on('right-click', toggleWindow);
  tray.on('double-click', toggleWindow);
  tray.on('click', (event) => {
    toggleWindow();

    // Show devtools when command clicked
    if (window.isVisible() && process.defaultApp && event.metaKey) {
      window.openDevTools({ mode: 'detach' });
    }
  });

 return tray; 
}

const getWindowPosition = () => {
  const windowBounds = window.getBounds();
  const trayBounds = tray.getBounds();

  // Center window horizontally below the tray icon
  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));

  // Position window 4 pixels vertically below the tray icon
  const y = Math.round(trayBounds.y + trayBounds.height + 4);

  return { x: x, y: y };
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 500,
    height: 300,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    webPreferences: {
      // Prevents renderer process code from not running when window is
      // hidden
      backgroundThrottling: false
    }
  });
  window.loadURL(`file://${path.join(__dirname, 'index.html')}`);

  // Hide the window when it loses focus
  window.on('blur', () => {
    if (!window.webContents.isDevToolsOpened()) {
      window.hide();
    }
  });

 return window; 
}

const toggleWindow = () => {
  if (window.isVisible()) {
    window.hide();
  } else {
    showWindow();
  }
}

const showWindow = () => {
  const position = getWindowPosition();
  window.setPosition(position.x, position.y, false);
  window.show();
  window.focus();
}

ipcMain.on('show-window', () => {
  showWindow();
});

ipcMain.on('get-active', (event) => {
  gitconfig.get({
    location: 'global'
  }).then((data) => {
    event.sender.send('user-active', data.user);
  })
});

ipcMain.on('get-users', (event) => {
  storage.get('users', (err, data) => {
    const userData = data && data.users || [];
    event.sender.send('user-saved', userData);
  }); 
});

ipcMain.on('git-user-selected', (event, user) => {
  // Set git config values. 
  gitconfig.set({
    'user.name': user.name,
    'user.email': user.email
  }, {
    location: 'global'
  }).then(() => {
    event.sender.send('user-active', user);
  });
}); 

ipcMain.on('git-user-remove', (event, id) => {
  storage.get('users', (err, data) => {
    let userData = data && data.users || [];
    userData = userData.filter((user) => user.id !== id);
    storage.set('users', { users: userData }, (err) => {
      event.sender.send('user-saved', userData);
    });
  });
}); 

ipcMain.on('git-user-added', (event, addedUser) => {
  storage.get('users', (err, data) => {
    const userData = data && data.users || [];
    addedUser.id = uuidv1();
    userData.push(addedUser);
    storage.set('users', { users: userData }, (err) => {
      event.sender.send('user-saved', userData);
    });
  });
});
