const { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain, nativeTheme, screen, globalShortcut } = require('electron');
const path = require('path');
const AutoStart = require('./autostart');

const isMacOs = process.platform === 'darwin';

const autoStart = new AutoStart(app.getName());
const windowWidth = 330;
const windowHeight = 250;
const windowHeightForPause = 335;
const windowMarginRight = 5;
const windowMarginBottom = 45;
const windowMarginBottomMacOs = 95;
const shortcutPlayPause = 'Ctrl+Shift+Space';
const shortcutReset = 'Ctrl+Shift+0';

let tray;
let mainWindow;
let timerSeconds = 0;
let pauseSeconds = 0;
let intervalId;
let pauseIntervalId;
let balloonInterval = 0;

const stopTimer = () => {
    clearInterval(intervalId);
    intervalId = undefined;
}

const startTimer = () => {
    intervalId = setInterval(sendTimerSeconds, 1000);
}

const stopPauseTimer = () => {
    clearInterval(pauseIntervalId);
    pauseIntervalId = undefined;
}

const startPauseTimer = () => {
    showPauseTimer();
    pauseIntervalId = setInterval(sendPauseSeconds, 1000);
}

const toggleDarkMode = () => {
    if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light';
    } else {
        nativeTheme.themeSource = 'dark';
    }
}

const resetToSystemDarkMode = () => {
    nativeTheme.themeSource = 'system';
}

const resizeMainWindow = (newWidth, newHeight) => {
    if (!mainWindow.isDestroyed()) {
        mainWindow.setSize(newWidth, newHeight);
    }
}

const toggleTimer = () => {
    if (intervalId) {
        stopTimer();
        startPauseTimer();
        resizeMainWindow(windowWidth, windowHeightForPause);
    } else {
        startTimer();
        stopPauseTimer();
        resetPauseTimer();
        resizeMainWindow(windowWidth, windowHeight);
    }
    positionMainWindow();
}

const resetTimer = () => {
    if (!mainWindow.isDestroyed()) {
        timerSeconds = 0;
        mainWindow.webContents.send('timer', '00:00:00');
    }
}

const resetPauseTimer = () => {
    if (!mainWindow.isDestroyed()) {
        pauseSeconds = 0;
        mainWindow.webContents.send('pause', '00:00:00');
    }
}

const registerIpcMainHandles = () => {
    ipcMain.handle('timer-play-pause', toggleTimer);
    ipcMain.handle('timer-reset', resetTimer);
    ipcMain.handle('click-close-button', () => { mainWindow.close(); });
    ipcMain.handle('click-menu-button', () => { tray.popUpContextMenu(); });
}

const toggleShortcutRegistration = (shortcut, shortcutFunction) => {
    if (globalShortcut.isRegistered(shortcut)) {
        globalShortcut.unregister(shortcut);
    } else {
        globalShortcut.register(shortcut, shortcutFunction);
    }
}

const createMainWindow = () => {
    mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        webPreferences: { preload: path.join(__dirname, 'preload.js') },
        frame: false, // do not show the native "frame" (with the red X button on the top-right corner)
        skipTaskbar: true // do not show app icon in the task bar
    });
    mainWindow.on('close', (event) => {
        if(!app.isQuiting){
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });
    mainWindow.loadFile('index.html');
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('start', new Date().toLocaleTimeString('de-DE').substring(0, 5));
    });

    positionMainWindow();
    registerIpcMainHandles();

    // Debugging...
    //mainWindow.webContents.openDevTools();
}

const toggleMainWindow = () => {
    if (mainWindow) {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
        }
    } else {
        createMainWindow();
    }
}

const sendTimerSeconds = () => {
    timerSeconds += 1;
    sendSeconds(timerSeconds, 'timer', 'You work for');

    if (balloonInterval > 0) {
        const secondsInAnHour = 3600;
        if (timerSeconds === balloonInterval * secondsInAnHour) {
            const workedHours = Math.floor(timerSeconds / secondsInAnHour);
            tray.displayBalloon({
                title: 'Timer', 
                content: `You are working now for ${workedHours} hours.`, 
                respectQuietTime: true,
                iconType: 'info'
            });
        }
    }
}

const sendPauseSeconds = () => {
    pauseSeconds += 1;
    sendSeconds(pauseSeconds, 'pause', 'You pause for');
}

const sendSeconds = (seconds, endpoint, tooltipMessagePrefix) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        const timerString = new Date(seconds * 1000).toISOString().substring(11, 19);
        mainWindow.webContents.send(endpoint, timerString);
        if (tray) {
            tray.setToolTip(tooltipMessagePrefix + ` ${timerString}.`);
        }
    }
}

const showPauseTimer = () => {
    mainWindow.webContents.send('pause', 'show');
}

const positionMainWindow = () => {
    const mainWindowBounds = mainWindow.getBounds();
    const screenOfMainWindow = screen.getDisplayNearestPoint({x: mainWindowBounds.x, y: mainWindowBounds.y});
    
    const x = screenOfMainWindow.bounds.width - mainWindowBounds.width - windowMarginRight;
    let y = screenOfMainWindow.bounds.height - mainWindowBounds.height;
    if (isMacOs) {
        y -= windowMarginBottomMacOs;
    } else {
        y -= windowMarginBottom;
    }
    mainWindow.setPosition(x, y);
}

const buildMenuTemplate = (isAutoStartRegistered, isShortcutPlayPauseRegistered, isShortcutResetRegistered) => {
    const showNotificationsSubmenu = [
        { label: 'Never', type: 'radio', click: () => { balloonInterval = 0; } },
        { label: 'Every Hour', type: 'radio', click: () => { balloonInterval = 1; }  },
        { label: 'Every 2 Hours', type: 'radio', click: () => { balloonInterval = 2; }  },
        { label: 'Every 4 Hours', type: 'radio', click: () => { balloonInterval = 4; }  },
    ];
    const useShortcutsSubmenu = [
        { label: `Use ${shortcutPlayPause} For Pause/Play`, type: 'checkbox', checked: isShortcutPlayPauseRegistered,
            click: () => {toggleShortcutRegistration(shortcutPlayPause, toggleTimer);} },
        { label: `Use ${shortcutReset} For Reset`, type: 'checkbox', checked: isShortcutResetRegistered,
            click: () => {toggleShortcutRegistration(shortcutReset, resetTimer);} },
    ];
    const settingsSubmenu = [
        { label: 'Set As Autostart', type: 'checkbox', checked: isAutoStartRegistered, click: autoStart.toggle },
        { label: 'Use Shortcuts', submenu: useShortcutsSubmenu },
        { label: 'Show Notifications', submenu: showNotificationsSubmenu }
    ];
    const appearanceSubmenu = [
        { label: 'Toggle Dark Mode', click: toggleDarkMode },
        { label: 'Reset To System Theme', click: resetToSystemDarkMode },
    ]

    return [
        { label: 'Appearance', submenu: appearanceSubmenu },
        { label: 'Settings', submenu: settingsSubmenu},
        { label: 'Exit', click: () => { app.isQuiting = true; app.quit(); } }
    ];
}

const createTray = (isAutoStartRegistered) => {
    let trayIcon = nativeImage.createFromPath(path.join(__dirname, 'timer.png'));
    if (isMacOs) {
        trayIcon = trayIcon.resize({height: 20});
    }
    tray = new Tray(trayIcon);
    const isShortcutPlayPauseRegistered = globalShortcut.isRegistered(shortcutPlayPause);
    const isShortcutResetRegistered = globalShortcut.isRegistered(shortcutReset);
    const trayContextMenu = Menu.buildFromTemplate(buildMenuTemplate(isAutoStartRegistered, isShortcutPlayPauseRegistered, isShortcutResetRegistered));
    tray.setContextMenu(trayContextMenu);
    if (isMacOs) {
        tray.on('click', (_event) => {toggleMainWindow();});
    } else {
        tray.on('double-click', (_event) => { toggleMainWindow(); });
    }
}

app.whenReady().then(() => {
    autoStart.isRegisteredForAutoStart().then(isAutoStartRegistered => {
        createTray(isAutoStartRegistered);
        createMainWindow();
    });
    startTimer();
});
