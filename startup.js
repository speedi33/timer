
class StartUp {
    constructor(appName) {
        this.appName = appName;
        this.registryKey = 'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run';
        this.executableFormat = 'exe';
    }
    
    async isRegisteredForAutoStart() {
        try {
            let output = await exec(`reg query ${this.registryKey} /v ${this.appName}`);
            return output.stdout.includes(`${this.appName}.${this.executableFormat}`);
        } catch (regQueryError) {
            return false;
        }
    }
    
    toggle() {
        this.isRegisteredForAutoStart().then(isRegistered => {
            if (isRegistered) {
                exec(`reg delete ${this.registryKey} /v ${this.appName} /f`);
            } else {
                exec(`reg add ${this.registryKey} /v ${this.appName} /d "${path.join(process.env.PORTABLE_EXECUTABLE_DIR, this.appName)}.${this.executableFormat}"`);
            }
        });
    }
}

module.exports = StartUp;
