var URL = require('dom-urls');
var chalk = require('chalk');

var MessageEvent = require('../spec/MessageEvent');
var fetch = require('./spec/fetch');
var _Worker = require('./lib/_Worker');

module.exports = _WorkerRegistration;

function _WorkerRegistration(url, glob) {
    this.url = new URL(url);
    this.glob = new URL(glob);

    // instances of _Worker
    this.nextWorker = null;
    this.currentWorker = null;

    this.update();
}

_WorkerRegistration.prototype.update = function() {
    var workerRegistration = this;
    
    // TODO: we have a race condition here
    // update() should abort any current update request
    fetch(this.url).then(function(response) {
        var body = response.body.toString();

        if (workerRegistration.currentWorker && workerRegistration.currentWorker.body == body) {
            throw Error('Ignoring new worker – identical to active worker');
        }

        if (workerRegistration.nextWorker && workerRegistration.nextWorker.body == body) {
            throw Error('Ignoring new worker – identical to installing worker');
        }

        // YOU ARE HERE
        workerRegistration.nextWorker = new _Worker();
    }, function() {
        // TODO:
        // If network failure, fail silently
        // If off-domain redirect, fail silently
        // If 404 ??? - either fail silenty or treat as unregister
        // If != 200, fail silently
        throw new Error("Ignoring new worker - network error");
    }).catch(function(err) {
        console.log(chalk.red(err.message));
    });
};

_WorkerRegistration.prototype.hasActiveWorker = function () {
    return this.active && this.active.worker;
}

_WorkerRegistration.prototype.hasInstalledWorker = function () {
    return this.installed && this.installed.worker;
}

_WorkerRegistration.prototype.activateInstalledWorker = function () {
    this.active = this.installed;
    this.installed = null;
}

_WorkerRegistration.prototype.postMessageWorker = function (msg, documentUrl) {
    if (!this.hasActiveWorker()) {
        return console.log('No active worker for the postMessage.');
    }
    // Fake the origin. TODO this should be better
    var messageEvent = new MessageEvent(msg, documentUrl.protocol + '//' + documentUrl.host);
    this.active.worker.dispatchEvent(messageEvent);
}