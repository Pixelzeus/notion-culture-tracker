// Background service worker / script dual-mode (Chrome MV3, Firefox MV3, Safari MV3)
// Gère l'injection des en-têtes CORS (Firefox) et le proxy fetch universel pour contourner les restrictions CORS

const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

// 1. Injection dynamique des en-têtes Access-Control-Allow-Origin (supporté dans Firefox avec webRequestBlocking)
if (api?.webRequest?.onHeadersReceived) {
  try {
    api.webRequest.onHeadersReceived.addListener(
      (details) => {
        const responseHeaders = details?.responseHeaders || [];
        const hasAcao = responseHeaders.some(h => (h?.name || '').toLowerCase() === 'access-control-allow-origin');
        if (!hasAcao && details?.responseHeaders) {
          details.responseHeaders.push({ name: 'Access-Control-Allow-Origin', value: '*' });
        }
        return { responseHeaders: details?.responseHeaders || [] };
      },
      {
        urls: [
          'https://api.thegamesdb.net/*',
          'https://cdn.thegamesdb.net/*',
          'https://store.steampowered.com/*',
          'https://api.themoviedb.org/*',
          'https://api.notion.com/*'
        ]
      },
      ['blocking', 'responseHeaders']
    );
  } catch (err) {
    // webRequestBlocking n'est pas disponible dans Chrome MV3 ni Safari MV3
    // Le relai via PROXY_FETCH prend le relai de manière transparente
  }
}

// 2. Proxy universel pour les requêtes fetch cross-origin
if (api?.runtime?.onMessage) {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'PROXY_FETCH') {
      fetch(message.url, message.options || {})
        .then(async (res) => {
          const text = await res.text();
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // Pas du JSON
          }
          sendResponse({
            success: true,
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            text,
            json
          });
        })
        .catch((err) => {
          sendResponse({
            success: false,
            ok: false,
            error: err.message || 'Erreur réseau dans le background script'
          });
        });

      return true; // Garde le canal ouvert pour la réponse asynchrone
    }
  });
}
