import { handleUpdates } from './server/updates.mjs';
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname.startsWith('/api/updates')) return handleUpdates(request,env);
    return env.ASSETS.fetch(request);
  }
};
