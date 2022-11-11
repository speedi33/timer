const { app, Tray, Menu, BrowserWindow, nativeImage, ipcMain, nativeTheme, screen } = require('electron');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const StartUp = require('./startup');

const startUp = new StartUp(app.getName());
const windowWidth = 330;
const windowHeight = 250;
const windowHeightForPause = 335;
const windowMarginRight = 5;
const windowMarginBottom = 45;

let tray;
let mainWindow;
let timerSeconds = 0;
let pauseSeconds = 0;
let intervalId;
let pauseIntervalId;


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

    // Debugging...
    //mainWindow.webContents.openDevTools();

    ipcMain.handle('timer-play-pause', toggleTimer);
    ipcMain.handle('timer-reset', resetTimer);
    ipcMain.handle('click-close-button', () => { mainWindow.close(); });
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
    mainWindow.setPosition(
        screenOfMainWindow.bounds.width - mainWindowBounds.width - windowMarginRight, 
        screenOfMainWindow.bounds.height - mainWindowBounds.height - windowMarginBottom);
}

const buildMenuTemplate = (isRegistered) => {
    return [
        { label: 'Appearance', submenu: [
            { label: 'Toggle Dark Mode', click: toggleDarkMode },
            { label: 'Reset To System Theme', click: resetToSystemDarkMode },
        ]},
        { label: 'Settings', submenu: [
            { label: 'Set As Autostart', type: 'checkbox', checked: isRegistered, click: startUp.toggle }
        ]},
        { label: 'Exit', click: () => { app.isQuiting = true; app.quit(); } }
    ];
}

const createTray = (isRegistered) => {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'timer.png')));
    const trayContextMenu = Menu.buildFromTemplate(buildMenuTemplate(isRegistered));
    tray.setContextMenu(trayContextMenu);
    tray.on("double-click", (_event) => { toggleMainWindow(); });
}

app.whenReady().then(() => {
    startUp.isRegisteredForAutoStart().then(isRegistered => {
        createTray(isRegistered);
        createMainWindow();
    });
    startTimer();
});
