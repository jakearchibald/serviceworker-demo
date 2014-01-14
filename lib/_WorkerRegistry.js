var _WorkerRegistration = require('../lib/_WorkerRegistration');
var URL = require('dom-urls');
var chalk = require('chalk');

module.exports = _WorkerRegistry;

function _WorkerRegistry() {
    this.globToRegistration = {};
}

_WorkerRegistry.prototype.getRegistrationFromUrl = function (url) {
    url = new URL(url);
    url.hash = '';
    var matchedGlob = this.findGlobMatchForUrl(url.toString());
    if (!matchedGlob) return null;
    return this.getRegistrationFromGlob(matchedGlob);
};

_WorkerRegistry.prototype.findGlobMatchForUrl = function (url) {
    url = url.toString();

    return Object.keys(this.globToRegistration).reduce(function (memo, glob) {
        if (url.indexOf(glob) === 0 && (!memo || glob.length > memo.length)) {
            return glob;
        }
        return memo;
    }, undefined);
};

_WorkerRegistry.prototype.getRegistrationFromGlob = function (glob) {
    return this.globToRegistration[glob];
};

_WorkerRegistry.prototype.postMessageWorker = function (msg, documentUrl) {
    var workerRegistration = this.getRegistrationFromUrl(documentUrl);
    if (!workerRegistration) return;
    workerRegistration.postMessageWorker.apply(workerRegistration, arguments);
};

_WorkerRegistry.prototype.register = function(pageUrl, globUrl, workerUrl) {
    pageUrl   = new URL(pageUrl);
    globUrl   = new URL(globUrl);
    workerUrl = new URL(workerUrl);

    // Trailing stars are pointless
    globUrl.pathname = globUrl.pathname.replace(/\*$/, '');

    var registration = this.getRegistrationFromGlob(globUrl);

    // already registered? No op.
    if (registration && registration.url.href === workerUrl.href) {
        return;
    }

    // catch x-origin stuff that isn't allowed
    if (globUrl.origin != pageUrl.origin) {
        throw Error("Registration rejected: Glob must be on the same origin as the registering page");
    }

    if (workerUrl.origin != pageUrl.origin) {
        throw Error("Registration rejected: Worker must be on the same origin as the registering page");
    }

    // create new, or update existing registration
    if (!registration) {
        registration = this.globToRegistration[globUrl] = new _WorkerRegistration(workerUrl, globUrl);
        console.log(chalk.green('Registering: ') + '%s for %s.', workerUrl.toString(), globUrl.toString());
    }
    else {
        registration.url = workerUrl;
        console.log(chalk.green('Changing worker url: ') + '%s for %s.', workerUrl.toString(), globUrl.toString());
    }
};