// Retired pages redirect permanently; _redirects is ignored when a Pages _worker.js exists.
const RETIRED = { '/stocks.html': '/index.html', '/sources.html': '/index.html', '/shorts.html': '/index.html', '/shorts': '/index.html', '/crypto.html': '/index.html', '/crypto': '/index.html' };
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (RETIRED[url.pathname]) return Response.redirect(new URL(RETIRED[url.pathname] + url.search, url).toString(), 301);
    return env.ASSETS.fetch(request);
  }
};
