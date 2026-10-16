// Script de contenu injecté sur Notion (https://www.notion.so/*)
// Crée un Shadow DOM étanche avec un bouton flottant et un tiroir latéral (Sidebar Drawer)

(function () {
  if (window.__cultureTrackerInjected) return;
  window.__cultureTrackerInjected = true;

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  function initCultureTracker() {
    if (document.getElementById('culture-tracker-host')) return;

    // 1. Création de l'hôte isolé
    const host = document.createElement('div');
    host.id = 'culture-tracker-host';
    document.body.appendChild(host);

    // 2. Attachement du Shadow DOM (mode open pour gestion interne propre)
    const shadow = host.attachShadow({ mode: 'open' });

    // 3. Injection des styles CSS
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = browserAPI.runtime.getURL('content/notion-inject.css');
    shadow.appendChild(styleLink);

    // 4. Structure HTML du bouton flottant et du tiroir latéral
    const container = document.createElement('div');
    container.className = 'ct-root';
    container.innerHTML = `
      <button id="ctFab" class="ct-fab" title="Ouvrir Culture Tracker (Alt + C)">
        <span class="ct-fab-icon">🍿</span>
        <span class="ct-fab-label">Culture Tracker</span>
        <span class="ct-fab-badge">v1.4</span>
      </button>

      <aside id="ctDrawer" class="ct-drawer" aria-label="Culture Tracker Notion Panel">
        <div class="ct-drawer-header">
          <div class="ct-drawer-title-group">
            <span class="ct-drawer-title">🍿 Culture Tracker</span>
            <span class="ct-drawer-tag">Intégré</span>
          </div>
          <div class="ct-drawer-actions">
            <button id="ctBtnReload" class="ct-btn-icon" title="Recharger l'extension">↻</button>
            <button id="ctBtnClose" class="ct-btn-icon ct-btn-close" title="Fermer le panneau (Échap)">✕</button>
          </div>
        </div>
        <div class="ct-drawer-body">
          <iframe id="ctIframe" class="ct-iframe" title="Culture Tracker Interface"></iframe>
        </div>
      </aside>
    `;

    shadow.appendChild(container);

    const fab = shadow.getElementById('ctFab');
    const drawer = shadow.getElementById('ctDrawer');
    const btnClose = shadow.getElementById('ctBtnClose');
    const btnReload = shadow.getElementById('ctBtnReload');
    const iframe = shadow.getElementById('ctIframe');

    let isOpen = false;
    let isIframeLoaded = false;
    const iframeUrl = browserAPI.runtime.getURL('popup/popup.html?mode=embedded');

    function toggleDrawer(force) {
      isOpen = typeof force === 'boolean' ? force : !isOpen;

      if (isOpen) {
        if (!isIframeLoaded) {
          iframe.src = iframeUrl;
          isIframeLoaded = true;
        }
        drawer.classList.add('open');
        fab.classList.add('active');
        fab.setAttribute('aria-expanded', 'true');
      } else {
        drawer.classList.remove('open');
        fab.classList.remove('active');
        fab.setAttribute('aria-expanded', 'false');
      }
    }

    // Événements boutons
    fab.addEventListener('click', () => toggleDrawer());
    btnClose.addEventListener('click', () => toggleDrawer(false));
    btnReload.addEventListener('click', () => {
      if (iframe.src) {
        iframe.src = iframeUrl + '&t=' + Date.now();
      }
    });

    // Raccourcis clavier (Alt + C pour basculer, Échap pour fermer)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        toggleDrawer(false);
        e.stopPropagation();
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        toggleDrawer();
        e.preventDefault();
      }
    }, true);

    // Messages venant de l'iframe (ex: clic sur un bouton fermer depuis l'interface)
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'CULTURE_TRACKER_CLOSE') {
        toggleDrawer(false);
      }
    });

    // Messages venant du background script de l'extension
    browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message && message.type === 'TOGGLE_NOTION_PANEL') {
        toggleDrawer();
        sendResponse({ success: true, isOpen });
      }
    });
  }

  // Initialisation dès que le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCultureTracker);
  } else {
    initCultureTracker();
  }
})();
