const { ipcRenderer, contextBridge } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
    const sections = {
        start: document.getElementById('start'),
        timer: document.getElementById('timer'),
        pause: document.getElementById('pause')
    };

    const timerHours = document.getElementById('timer-hours');
    const timerMinutes = document.getElementById('timer-minutes');
    const timerSeconds = document.getElementById('timer-seconds');

    const pauseHours = document.getElementById('pause-hours');
    const pauseMinutes = document.getElementById('pause-minutes');
    const pauseSeconds = document.getElementById('pause-seconds');

    const startHours = document.getElementById('start-hours');
    const startMinutes = document.getElementById('start-minutes');

    ipcRenderer.on('start', (_event, value) => {
        const hoursMinutes = value.split(':');
        startHours.innerText = hoursMinutes[0];
        startMinutes.innerText = hoursMinutes[1];
    });

    ipcRenderer.on('timer', (_event, value) => {
        const hoursMinutesSeconds = value.split(':');
        timerHours.innerText = hoursMinutesSeconds[0];
        timerMinutes.innerText = hoursMinutesSeconds[1];
        timerSeconds.innerText = hoursMinutesSeconds[2];
        
        const hours = parseInt(hoursMinutesSeconds[0]);
        if (hours >= 8 && hours < 10) {
            sections.timer.classList.remove('blue-font');
            sections.timer.classList.add('yellow-font');
        } else if (hours >= 10) {
            sections.timer.classList.remove('yellow-font');
            sections.timer.classList.add('red-font');
        }
    });

    ipcRenderer.on('pause', (_event, value) => {
        if (value === '00:00:00') {
            sections.pause.classList.add('hidden');
            pauseHours.innerText = '00';
            pauseMinutes.innerText = '00';
            pauseSeconds.innerText = '00';
        } else if (value === 'show') {
            // This is only required for the one second after
            // clicking the pause button so that you can see
            // 00:00:00 as the pause time.
            if (sections.pause.classList.contains('hidden')) {
                sections.pause.classList.remove('hidden');
            }
        } else {
            const hoursMinutesSeconds = value.split(':');
            pauseHours.innerText = hoursMinutesSeconds[0];
            pauseMinutes.innerText = hoursMinutesSeconds[1];
            pauseSeconds.innerText = hoursMinutesSeconds[2];
        }
    });
});

contextBridge.exposeInMainWorld('timerButton', {
    playPause: () => ipcRenderer.invoke('timer-play-pause'),
    reset: () => ipcRenderer.invoke('timer-reset')
});

contextBridge.exposeInMainWorld('closeButton', {
    click: () => ipcRenderer.invoke('click-close-button')
});
