// Module de requête réseau sécurisé avec fallback automatique sur le background script

export async function safeFetch(url, options = {}) {
  // 1. Tentative de fetch direct
  try {
    const res = await fetch(url, options);
    return res;
  } catch (err) {
    // 2. Si le fetch échoue (CORS, restriction Firefox dans le popup...), relais via le background
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
      try {
        const resp = await browser.runtime.sendMessage({
          type: 'PROXY_FETCH',
          url,
          options
        });
        if (!resp) {
          throw err;
        }
        if (!resp.success) {
          throw new Error(resp.error || `Erreur réseau: ${err.message}`);
        }
        return {
          ok: resp.ok,
          status: resp.status,
          statusText: resp.statusText,
          json: async () => resp.json !== null ? resp.json : JSON.parse(resp.text),
          text: async () => resp.text
        };
      } catch (proxyErr) {
        throw new Error(proxyErr.message || err.message);
      }
    }
    throw err;
  }
}
