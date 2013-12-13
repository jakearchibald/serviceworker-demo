# ServiceWorker demo

This is a (partial) [ServiceWorker](https://github.com/slightlyoff/ServiceWorker) implementation, written in JavaScript. The idea is to enable exploration of the ServiceWorker API and the implications it has for users, applications and developer workflow.

## Setup

It's a bit complicated.

### Requirements

- Node + npm
- hoxy (`npm install -g hoxy`) (or another http proxy that can modify requests based on hostname)
- Possibly OSX – I haven't tried on other platforms

You'll need to be able host a local server and give it a different hostname than `localhost` - this will be your *network host*. I'd recommend `something-origin.dev`. You'll use use `something.dev` (so, no `-origin` bit) to hit the service worker. This second host is your *local host*.

I built [`distra`](https://github.com/phuu/distra) which can do this, but there are other ways. You could also use a remote server (I think, not tried).

### Starting it up

1. Start the *network host server*. You should be able to access it as you would any other website.
2. Edit the [`hoxy-rules.txt`](hoxy-rules.txt) file to match your *local host*. The idea is the the proxy rewrites requests to the *local origin* to go to the ServiceWorker, which can then make requests to the *network origin*, but pretend it's the *local origin*. Sneaky!
3. Start `hoxy` (or your proxy) in the project's directory. It will read the `hoxy-rules.txt` file.
4. Configure your machine/browser's HTTP proxy settings to go through the proxy. By default with `hoxy`, this will be `localhost:8080`.
5. Start the SevicerWorker server. Run `node --harmony server.js 5678 http://your.local.origin/ http://your.network.origin/ worker.js`.
6. Install the unpacked Chrome extension from the devtools folder of this project. You *must* have devtools open when testing this stuff; the devtools extension connects to the ServiceWorker server via WebSocket to inform it when a navigation is occuring.

You should now be able to visit the local origin and have it proxy through to the network origin, and see logging from the ServiceWorker coming from node. They'll be prefixed with `sw: `.

You can now add to the `worker.js` to play with the API. Lots of stuff it missing, but the core request interception, caching and response APIs are there.

### Notes

- This stuff doesn't play nice with VPNs.
- If something's not working, try adding logging to hoxy/your proxy. You might be in a redirect loop, or not forwarding to the right place.

## Contributing

The TODO files contains what need to be done. I'll be submitted this as issues too. Please do add your own issues or submit PRs!

If you're adding a "class" not from the spec, please prefix it with an underscore.
