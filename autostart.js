const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

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

module.exports = AutoStart;
