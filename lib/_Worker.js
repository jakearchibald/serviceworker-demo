var ServiceWorker = require('./spec/ServiceWorker');

module.exports = _Worker;

function _Worker(url, body) {
    this.url = url;
    this.body = body;
    this.scope = new ServiceWorker(url.origin);

    // TODO: how much of this could/should go into ../spec/ServiceWorker.js?
    // Feels like they could be instance vars
    var workerFn = new Function(
        // Argument names
        'Event', 'InstallEvent', 'ActivateEvent', 'FetchEvent', 'MessageEvent',
        'Response', 'SameOriginResponse',
        'Request',
        'fetch', 'URL', 'importScripts',
        'Promise',
        'console', // teehee
        // Function body
        this.body
    );

    workerFn.call(
        // this
        worker,
        // Arguments
        Event, InstallEvent, ActivateEvent, FetchEvent, MessageEvent,
        Response, SameOriginResponse,
        Request,
        fetch, URL, importer,
        Promise,
        fakeConsole
    );
}