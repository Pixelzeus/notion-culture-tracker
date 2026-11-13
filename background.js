// Background service worker / script dual-mode (Chrome MV3, Firefox MV3, Safari MV3)
// Gère l'injection des en-têtes CORS (Firefox) et le proxy fetch universel pour contourner les restrictions CORS

const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

// 1. Injection dynamique des en-têtes Access-Control-* (supporté dans Firefox avec webRequestBlocking)
if (api?.webRequest?.onHeadersReceived) {
  try {
    api.webRequest.onHeadersReceived.addListener(
      (details) => {
        const responseHeaders = details?.responseHeaders || [];
        const lowerNames = responseHeaders.map(h => (h?.name || '').toLowerCase());

        if (!lowerNames.includes('access-control-allow-origin')) {
          responseHeaders.push({ name: 'Access-Control-Allow-Origin', value: '*' });
        }
        if (!lowerNames.includes('access-control-allow-headers')) {
          responseHeaders.push({
            name: 'Access-Control-Allow-Headers',
            value: 'Authorization, Notion-Version, Content-Type, Accept, Origin, X-Requested-With, *'
          });
        }
        if (!lowerNames.includes('access-control-allow-methods')) {
          responseHeaders.push({
            name: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
          });
        }
        if (!lowerNames.includes('access-control-max-age')) {
          responseHeaders.push({ name: 'Access-Control-Max-Age', value: '86400' });
        }
        return { responseHeaders };
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

// 2. Gestionnaire universel de messages d'extension (Proxy fetch et ouverture d'options)
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

    if (message?.type === 'OPEN_OPTIONS_PAGE') {
      (async () => {
        try {
          if (api.runtime?.openOptionsPage) {
            await api.runtime.openOptionsPage();
          } else if (api.tabs?.create) {
            await api.tabs.create({ url: api.runtime.getURL('options/options.html'), active: true });
          }
          sendResponse({ success: true });
        } catch (e) {
          if (api.tabs?.create) {
            api.tabs.create({ url: api.runtime.getURL('options/options.html'), active: true })
              .then(() => sendResponse({ success: true }))
              .catch(err => sendResponse({ success: false, error: err.message }));
          } else {
            sendResponse({ success: false, error: e?.message || String(e) });
          }
        }
      })();

      return true;
    }
  });
}
