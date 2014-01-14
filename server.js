/**
 * serviceworker-demo
 */

var http = require('http');
var fs = require('fs');
var falafel = require('falafel');
var WebSocketServer = require('ws').Server;
var urlLib = require('url');
var chalk = require('chalk');
var httpProxy = require('http-proxy');
var astUtils = require('./lib/astUtils');
var vm = require('vm');

/**
  * Internal APIs
  */
var _WorkerRegistry = require('./lib/_WorkerRegistry');
var _WorkerRegistration = require('./lib/_WorkerRegistration');
var _Responder = require('./lib/_Responder');
var _ProxyRequest = require('./lib/_ProxyRequest');

/**
 * DOM APIs
 * These are (mostly) passed to the worker on execution
 */
var ServiceWorker = require('./spec/ServiceWorker');

var Promise = require('rsvp').Promise;

var URL = require('dom-urls');

var fetch = require('./spec/fetch');
var importScripts = require('./spec/importScripts');

var ResponsePromise = require('./spec/ResponsePromise');
var Response = require('./spec/Response');
var SameOriginResponse = require('./spec/SameOriginResponse');
var Request = require('./spec/Request');

var Map = require('./spec/Map');
var AsyncMap = require('./spec/AsyncMap');
var CacheList = require('./spec/CacheList');
var Cache = require('./spec/Cache');

var Event = require('./spec/Event');
var InstallEvent = require('./spec/InstallEvent');
var FetchEvent = require('./spec/FetchEvent');
var ActivateEvent = require('./spec/ActivateEvent');
var MessageEvent = require('./spec/MessageEvent');

var fakeConsole = Object.getOwnPropertyNames(console).reduce(function (memo, method) {
    memo[method] = console[method];
    if (typeof console[method] === "function") {
        memo[method] = memo[method].bind(console, chalk.blue('sw:'));
    }
    return memo;
}, {});

/**
 * Worker data
 */

var workerRegistry = new _WorkerRegistry();

/** ================================================================================================
 * Go, go, go.
 =============================================================================================== **/

module.exports.startServer = startServer;
function startServer(port) {
    return Promise.resolve().then(function () {
        // Proxy server
        var server = httpProxy.createServer(handleRequest).listen(port);

        // WebSocket server. The WebSocket is added to pages by the extension.
        var wss = new WebSocketServer({ server: server });
        wss.on('connection', handleWebSocket);
        return server;
    });
}

/**
 * Request processors
 */

function handleRequest(_request, _response, proxy) {
    // Ignore requests without the X-For-Service-Worker header
    // if (typeof _request.headers['x-for-service-worker'] === 'undefined') {
    //     return passThroughRequest(_request, _response, proxy);
    // }

    // This may go to the network, so delete the ServiceWorker header
    // delete _request.headers['x-for-service-worker'];
    _response.setHeader('x-meddled-with', true);

    var request = new Request(_request);

    var urlToMatch = request.url;
    if (request.headers['x-service-worker-request-type'] === 'fetch') {
        // No referer header, not much we can do
        if (!request.headers.referer) {
            console.log(chalk.blue('info:'), 'no referer header for', request.url.toString());
            return passThroughRequest(_request, _response, proxy);
        }
        urlToMatch = new URL(request.headers.referer);
    }

    // Find glob for URL
    var matchedGlob = workerRegistry.findGlobMatchForUrl(urlToMatch);

    // Nothing matched against this URL, so pass-through
    if (!matchedGlob) {
        _response.setHeader('x-glob-match', 'none');
        return passThroughRequest(_request, _response, proxy);
    }

    // Get the worker state for this glob
    var workerRegistration = workerRegistry.getRegistrationFromUrl(urlToMatch);

    // A glob matched, but no registration was found. wat.
    if (!workerRegistration) {
        _response.setHeader('x-worker-registration', 'none');
        _response.setHeader('x-wat', 'indeed');
        return passThroughRequest(_request, _response, proxy);
    }

    console.log(chalk.yellow('%s'), _request.headers['x-service-worker-request-type'], request.url.toString());

    var _responder = new _Responder(request, _response);
    var fetchEvent = new FetchEvent(_request.headers['x-service-worker-request-type'], request, _responder);

    var readyPromise = Promise.resolve();

    // If we have an installed worker waiting, activate it
    if (workerRegistration.hasInstalledWorker()) {
        console.log('activating worker');
        readyPromise = activateWorker(workerRegistration.installed.worker)
            .then(workerRegistration.activateInstalledWorker.bind(workerRegistration));
    }

    // We should now have an installed and active worker.
    readyPromise
        .then(function () {
            workerRegistration.active.worker.dispatchEvent(fetchEvent);
            // If the worker has not called respondWith, we should go to network.
            if (!fetchEvent._isStopped()) {
                _responder.respondWithNetwork().catch(logError);
            }
        })
        .catch(logError)
}

function passThroughRequest(_request, _response, proxy) {
    var buffer = httpProxy.buffer(_request);
    return proxy.proxyRequest(_request, _response, {
        host: _request.headers.host.split(':')[0],
        port: parseInt(_request.headers.host.split(':')[1], 10) || 80,
        buffer: buffer
    });
}

function handleWebSocket(socket) {
    // Listen up!
    socket.on('message', function (message) {
        // TODO guard this
        var data;

        try {
            data = JSON.parse(message);
        } catch (e) {
            return logError(e);
        }

        if (data.type === 'register') {
            workerRegistry.register.apply(workerRegistry, data.data.args);
            return;
        }
        
        if (data.type === 'postMessage') {
            workerRegistry.postMessageWorker.apply(workerRegistry, data.data.args);
            return;
        }
    });
    socket.on('close', function (message) {});
}

/**
 * Error handler
 */
function logError(why) {
    console.error(chalk.red(why.stack));
}