var vm = require('vm');
var util = require('util');
var chalk = require('chalk');
var EventEmitter = require('events').EventEmitter;

var ServiceWorker = require('../spec/ServiceWorker');
var createScriptLoader = require('../spec/importScripts');
var InstallEvent = require('../spec/InstallEvent');
var ActivateEvent = require('../spec/ActivateEvent');
var MessageEvent = require('../spec/MessageEvent');
var Request = require('../spec/Request');

util.inherits(_Worker, EventEmitter);
module.exports = _Worker;

function _Worker(url, body) {
    EventEmitter.call(this);

    var worker = this;
    var loadScripts = createScriptLoader(url);
    var scope = new ServiceWorker(url);

    this.url = url;
    this.body = body;
    this.scope = scope;

    // these promises are resolved in install()
    this.isInstalled = false;
    this._installCalled = false;
    this._installResolver = null;
    this._install = new Promise(function(resolve, reject) {
        worker._installResolver = {
            resolve: resolve,
            reject: reject,
        };
    }).then(function() {
        worker.isInstalled = true;
        console.log(chalk.green('Installed worker version:'), chalk.yellow(worker.scope.version));
    }, function(err) {
        // TODO: ???
        // What do we do if waitUntil rejects?
        console.log(chalk.red('Install failed for worker version:'), chalk.yellow(worker.scope.version));
        throw err;
    });
    
    // these promises are resolved in install()
    this._activateCalled = false;
    this._activateResolver = null;
    this._activate = new Promise(function(resolve, reject) {
        worker._activateResolver = {
            resolve: resolve,
            reject: reject,
        };
    }).then(function() {
        console.log(chalk.green('Activated worker version:'), chalk.yellow(worker.scope.version));
    }, function(err) {
        console.log(chalk.green('Activate failed for worker version:'), chalk.yellow(worker.scope.version));
        throw err;
    });

    // The vm stuff involves some hackery
    // http://nodejs.org/api/vm.html#vm_sandboxes
    // This recovers from:
    // a) The lack of prototype use
    // b) The loss of 'this' context
    for (var key in scope) {
        if (scope.hasOwnProperty(key)) continue;

        if (scope[key].bind) {
            scope[key] = scope[key].bind(scope);
        }
        else {
            scope[key] = scope[key];
        }
    }

    scope.importScripts = function() {
        var urls = arguments;

        loadScripts.apply(this, urls).forEach(function(script, i) {
            vm.runInContext(script, worker.context, urls[i]);
        });
    };

    // TODO: run worker execution in a forked node process so it can be killed
    this.context = vm.createContext(scope);
    vm.runInContext(body, this.context, url);
    loadScripts.disable();
}

_Worker.prototype.install = function() {
    var worker = this;

    if (this._installCalled) {
        throw Error("Worker already installing/installed");
    }

    this._installCalled = true;
    console.log("Installing…");

    var installEvent = new InstallEvent(function() {
        worker.emit("replace");
    });

    this.scope.dispatchEvent(installEvent);
    installEvent._wait.then(this._installResolver.resolve, this._installResolver.reject);
};

_Worker.prototype.activate = function() {
    var worker = this;

    if (this._activateCalled) {
        throw Error("Worker already active/activating");
    }

    this._activateCalled = true;
    console.log("Activating…");

    this._install.then(function() {
        var activateEvent = new ActivateEvent();
        worker.scope.dispatchEvent(activateEvent);

        // TODO: ???
        // What do we do if waitUntil rejects?
        activateEvent._wait.then(this._activateResolver.resolve, this._activateResolver.reject);
    });
};

_Worker.prototype.postMessage = function(msg, documentUrl) {
    var messageEvent = new MessageEvent(msg, documentUrl.protocol + '//' + documentUrl.host);
    this.scope.dispatchEvent(messageEvent);
};

_Worker.prototype.handleRequest = function(_request, _response, proxy) {
    // Ignore requests without the X-For-Service-Worker header
    // if (typeof _request.headers['x-for-service-worker'] === 'undefined') {
    //     return passThroughRequest(_request, _response, proxy);
    // }

    // This may go to the network, so delete the ServiceWorker header
    // delete _request.headers['x-for-service-worker'];
    _response.setHeader('x-meddled-with', true);

    var request = new Request(_request);
};