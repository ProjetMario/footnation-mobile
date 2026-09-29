// Loaded only by the disposable recipe entrypoint, never by the application.
function permitted(value, ports = ["8081", "7082"]) {
  try {
    const url = new URL(
      typeof value === "string" ? value : value.url,
      `http://127.0.0.1:${ports[0]}`,
    );
    return (
      ["http:", "ws:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      ports.includes(url.port) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function install(target = globalThis, ports = ["8081", "7082"]) {
  const originalFetch = target.fetch.bind(target);
  target.fetch = (url, options) =>
    permitted(url, ports)
      ? originalFetch(url, options)
      : Promise.reject(new Error("Recette : requête extérieure bloquée"));
  if (target.XMLHttpRequest) {
    const open = target.XMLHttpRequest.prototype.open;
    target.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      if (!permitted(url, ports))
        throw new Error("Recette : requête extérieure bloquée");
      return open.call(this, method, url, ...rest);
    };
  }
  if (target.WebSocket) {
    const Socket = target.WebSocket;
    target.WebSocket = class extends Socket {
      constructor(url, ...args) {
        if (!permitted(String(url), ports))
          throw new Error("Recette : connexion extérieure bloquée");
        super(url, ...args);
      }
    };
  }
  if (target.navigator?.sendBeacon) target.navigator.sendBeacon = () => false;
}
module.exports = { permitted, install };
