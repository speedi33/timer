class Timer {
    constructor(interval, callback) {
        this.started = false;
        this.interval = interval;
        this.callback = callback;
    }

    start = () => {
        this.started = true;
        this.expected = Date.now() + this.interval;
        this.timeout = setTimeout(this._increment, this.interval);
    }

    stop = () => {
        clearTimeout(this.timeout);
        this.started = false;
    }

    isStarted = () => {
        return this.started;
    }

    _increment = () => {
        const drift = Date.now() - this.expected;
        this.callback();
        this.expected += this.interval;
        this.timeout = setTimeout(this._increment, Math.max(0, this.interval - drift));
    }
}

module.exports = Timer;
