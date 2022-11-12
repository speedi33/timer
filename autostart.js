const { dialog, nativeImage } = require('electron')
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const isMacOs = process.platform === 'darwin';

class AutoStart {
    constructor(appName) {
        this.appName = appName;
        this.registryKey = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run';
        this.executableFormat = 'exe';
    }
    
    isRegisteredForAutoStart = async () => {
        try {
            let output = await exec(`reg query ${this.registryKey} /v ${this.appName}`);
            return output.stdout.includes(`${this.appName}.${this.executableFormat}`);
        } catch (regQueryError) {
            return false;
        }
    }
    
    toggle = () => {
        if (isMacOs) {
            dialog.showMessageBox({
                type: 'warning', 
                message: 'Unfortunately, \'Set As Autostart\' is currently unsupported on ' + 
                    ' MacOS and needs to be configured manually.\n' +
                    'Go to System Settings > Users & Groups > Login Items and add Timer.app via the \'+\'.',
                title: 'Set As Autostart currently unsupported',
                icon: nativeImage.createFromPath(path.join(__dirname, 'timer.png'))
            });
        } else {
            let executableDir = process.env.PORTABLE_EXECUTABLE_DIR;
            if (!executableDir) {
                console.log('Set as auto start not supported for local development environment!');
            } else {
                this.isRegisteredForAutoStart().then(isRegistered => {
                    if (isRegistered) {
                        exec(`reg delete ${this.registryKey} /v ${this.appName} /f`);
                    } else {
                        exec(`reg add ${this.registryKey} /v ${this.appName} /d "${path.join(executableDir, this.appName)}.${this.executableFormat}"`);
                    }
                });
            }
        }
    }
}

module.exports = AutoStart;
