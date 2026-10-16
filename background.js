// Background service worker / script pour Firefox MV3
// Gère l'injection des en-têtes CORS et le proxy fetch sécurisé pour TheGamesDB et Steam

// 1. Injection dynamique des en-têtes Access-Control-Allow-Origin
if (typeof browser !== 'undefined' && browser.webRequest && browser.webRequest.onHeadersReceived) {
  browser.webRequest.onHeadersReceived.addListener(
    (details) => {
      const responseHeaders = details.responseHeaders || [];
      const hasAcao = responseHeaders.some(h => h.name.toLowerCase() === 'access-control-allow-origin');
      if (!hasAcao) {
        responseHeaders.push({ name: 'Access-Control-Allow-Origin', value: '*' });
      }
      return { responseHeaders };
    },
    {
      urls: [
        'https://api.thegamesdb.net/*',
        'https://cdn.thegamesdb.net/*',
        'https://store.steampowered.com/*'
      ]
    },
    ['blocking', 'responseHeaders']
  );
}

// 2. Proxy de secours pour les requêtes fetch cross-origin
if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.onMessage) {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROXY_FETCH') {
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
