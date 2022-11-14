document.getElementById('play-pause-button').addEventListener('click', async () => {
    await window.timerButton.playPause();
});

document.getElementById('reset-button').addEventListener('click', async () => {
    await window.timerButton.reset();
});

document.getElementById('close-button').addEventListener('click', async () => {
    await window.closeButton.click();
});

document.getElementById('menu-button').addEventListener('click', async () => {
    await window.menuButton.click();
});
