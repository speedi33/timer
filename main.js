const { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain, nativeTheme, screen, globalShortcut } = require('electron');
const path = require('path');
const Timer = require('./timer');
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

const timers = { work: undefined, pause: undefined };
const seconds = { work: 0, pause: 0 };
const updateIntervalInMillis = 1000;
let tray;
let mainWindow;
let balloonInterval = 0;

const startTimer = () => {
    if (!timers.work) {
        timers.work = new Timer(updateIntervalInMillis, sendTimerSeconds);
    }
    timers.work.start();
}

const startPauseTimer = () => {
    if (!timers.pause) {
        timers.pause = new Timer(updateIntervalInMillis, sendPauseSeconds);
    }
    timers.pause.start();
    showPauseTimer();
}

const toggleDarkMode = () => {
    if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light';
    } else {
        nativeTheme.themeSource = 'dark';
    }
    mainWindow.webContents.send('dark-mode', nativeTheme.shouldUseDarkColors);
}

const resetToSystemDarkMode = () => {
    nativeTheme.themeSource = 'system';
    mainWindow.webContents.send('dark-mode', nativeTheme.shouldUseDarkColors);
}

const resizeMainWindow = (newWidth, newHeight) => {
    if (!mainWindow.isDestroyed()) {
        mainWindow.setSize(newWidth, newHeight);
    }
}

const toggleWorkTimer = () => {
    if (timers.work.isStarted()) {
        timers.work.stop();
        startPauseTimer();
        resizeMainWindow(windowWidth, windowHeightForPause);
    } else {
        startTimer();
        timers.pause.stop();
        resetPauseTimer();
        resizeMainWindow(windowWidth, windowHeight);
    }
    positionMainWindow();
}

const resetWorkTimer = () => {
    resetTimer('work');
}

const resetPauseTimer = () => {
    resetTimer('pause');
}

const resetTimer = (timerType) => {
    seconds[timerType] = 0;
    mainWindow.webContents.send(timerType, '00:00:00');
}

const registerIpcMainHandles = () => {
    ipcMain.handle('timer-play-pause', toggleWorkTimer);
    ipcMain.handle('timer-reset', resetWorkTimer);
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

const handleNotification = () => {
    if (balloonInterval > 0) {
        const secondsInAnHour = 3600;
        if (seconds.work === balloonInterval * secondsInAnHour) {
            const workedHours = Math.floor(seconds.work / secondsInAnHour);
            tray.displayBalloon({
                title: 'Timer', 
                content: `You work for ${workedHours} hour${workedHours === 1 ? '' : 's'}.`, 
                respectQuietTime: true,
                iconType: 'info'
            });
        }
    }
}

const sendTimerSeconds = () => {
    sendSeconds('work');
    handleNotification();
}

const sendPauseSeconds = () => {
    sendSeconds('pause');
}

const sendSeconds = (timerType) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        seconds[timerType] += 1;
        const timerString = new Date(seconds[timerType] * 1000).toISOString().substring(11, 19);
        mainWindow.webContents.send(timerType, timerString);
        if (tray) {
            tray.setToolTip(`You ${timerType} for ${timerString}.`);
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
            click: () => {toggleShortcutRegistration(shortcutPlayPause, toggleWorkTimer);} },
        { label: `Use ${shortcutReset} For Reset`, type: 'checkbox', checked: isShortcutResetRegistered,
            click: () => {toggleShortcutRegistration(shortcutReset, resetWorkTimer);} },
    ];
    const settingsSubmenu = [
        { label: 'Set As Autostart', type: 'checkbox', checked: isAutoStartRegistered, click: autoStart.toggle },
        { label: 'Shortcuts', submenu: useShortcutsSubmenu },
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
        globalShortcut.register(shortcutPlayPause, toggleWorkTimer);
        createTray(isAutoStartRegistered);
        createMainWindow();
    });
    startTimer();
});
