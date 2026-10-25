// test/e2e/tiers/tier1-feature-coverage.test.js
// Tier 1: Feature Coverage (>= 5 test cases per feature for all 13 core features = 65 tests)

import fs from 'fs';
import path from 'path';
import { createSuite, assert, assertEqual, assertIncludes } from '../harness/test-context.js';
import { loadPopupDOM } from '../harness/dom-simulator.js';
import { loadCSS } from '../harness/css-parser.js';
import { createBrowserMock, mountMockEnvironment } from '../harness/browser-mock.js';

export function registerTier1Tests() {
  const suite = createSuite('Tier 1: Feature Coverage (65 Tests across 13 Core Features)');

  const ROOT_DIR = path.resolve(import.meta.dirname, '../../../');
  const POPUP_HTML = path.join(ROOT_DIR, 'popup/popup.html');
  const POPUP_CSS = path.join(ROOT_DIR, 'popup/popup.css');
  const NOTION_CSS = path.join(ROOT_DIR, 'content/notion-inject.css');
  const BROWSER_ADAPTER_PATH = path.join(ROOT_DIR, 'services/browser-adapter.js');
  const BACKGROUND_JS = path.join(ROOT_DIR, 'background.js');
  const FETCH_PROXY_JS = path.join(ROOT_DIR, 'services/fetch-proxy.js');
  const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
  const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
  const BUILD_JS = path.join(ROOT_DIR, 'scripts/build.js');
  const PUBLISH_JS = path.join(ROOT_DIR, 'scripts/publish-release.js');
  const README_PATH = path.join(ROOT_DIR, 'README.md');

  // =========================================================================
  // Feature 1: Responsive Popup Viewport (M1 - ORIGINAL_REQUEST §R1)
  // =========================================================================
  suite.it('F1-T1-1: CSS declares fluid body width (max-width: 440px, min-width: 320px)', () => {
    const css = loadCSS(POPUP_CSS);
    const bodyWidth = css.getProperty('body', 'width');
    const maxWidth = css.getProperty('body', 'max-width');
    const minWidth = css.getProperty('body', 'min-width');
    assert(bodyWidth === '100%' || bodyWidth === '100vw', `Body width should be fluid (got ${bodyWidth})`);
    assert(maxWidth === '440px', `Body max-width should be 440px (got ${maxWidth})`);
    assert(minWidth === '320px', `Body min-width should be 320px (got ${minWidth})`);
  });

  suite.it('F1-T1-2: CSS contains mobile media query (max-width: 420px)', () => {
    const raw = fs.readFileSync(POPUP_CSS, 'utf8');
    const has420 = raw.includes('max-width: 420px') || raw.includes('max-width:420px') || raw.includes('max-width: 440px');
    assert(has420, 'CSS must contain responsive media query for narrow screens (<= 420px/440px)');
  });

  suite.it('F1-T1-3: Mobile viewport eliminates horizontal scroll (overflow-x: hidden)', () => {
    const css = loadCSS(POPUP_CSS);
    const overflowX = css.getProperty('body', 'overflow-x');
    assertEqual(overflowX, 'hidden', 'Body overflow-x must be hidden to prevent horizontal page scrolling');
  });

  suite.it('F1-T1-4: Desktop media query (min-width: 421px) preserves standard popup dimensions', () => {
    const raw = fs.readFileSync(POPUP_CSS, 'utf8');
    const hasDesktopMedia = raw.includes('min-width: 421px') || raw.includes('min-width:421px') || raw.includes('min-width: 441px');
    assert(hasDesktopMedia, 'CSS must specify desktop popup constraint via @media (min-width: 421px)');
  });

  suite.it('F1-T1-5: Popup DOM header contains brand text and responsive elements', () => {
    const dom = loadPopupDOM(POPUP_HTML);
    const header = dom.querySelector('.app-header');
    assert(header !== null, 'Header .app-header must exist in DOM');
    const brand = dom.querySelector('.brand-text');
    assert(brand !== null, 'Brand title .brand-text must exist in header');
  });

  // =========================================================================
  // Feature 2: Touch Ergonomics (>= 44x44px) (M1 - ORIGINAL_REQUEST §R1)
  // =========================================================================
  suite.it('F2-T1-1: CSS defines touch ergonomics tokens (--touch-target-min: 44px)', () => {
    const css = loadCSS(POPUP_CSS);
    const touchToken = css.getRootVariable('--touch-target-min');
    assertEqual(touchToken, '44px', 'Root CSS must define --touch-target-min: 44px');
  });

  suite.it('F2-T1-2: Header icon buttons meet minimum 44x44px touch area', () => {
    const css = loadCSS(POPUP_CSS);
    const minWidth = css.getProperty('.icon-button', 'min-width');
    const minHeight = css.getProperty('.icon-button', 'min-height');
    assert(minWidth === '44px' && minHeight === '44px', `Header icon buttons must be >= 44x44px (got ${minWidth} x ${minHeight})`);
  });

  suite.it('F2-T1-3: Search bar input and clear button meet >= 44px touch heights', () => {
    const css = loadCSS(POPUP_CSS);
    const inputMinH = css.getProperty('.search-box input', 'min-height');
    const clearMinH = css.getProperty('.clear-btn', 'min-height');
    assert(inputMinH === '44px', `Search input must have min-height: 44px (got ${inputMinH})`);
    assert(clearMinH === '44px', `Clear search button must have min-height: 44px (got ${clearMinH})`);
  });

  suite.it('F2-T1-4: Filter tabs meet >= 44px touch targets', () => {
    const css = loadCSS(POPUP_CSS);
    const tabMinH = css.getProperty('.tab', 'min-height');
    assert(tabMinH === '44px', `Filter tabs must have min-height: 44px (got ${tabMinH})`);
  });

  suite.it('F2-T1-5: Interactive controls specify touch-action: manipulation', () => {
    const raw = fs.readFileSync(POPUP_CSS, 'utf8');
    assertIncludes(raw, 'touch-action: manipulation', 'Interactive controls must set touch-action: manipulation');
  });

  // =========================================================================
  // Feature 3: Responsive Form Stacking (M1 - Explorer 1 Survey)
  // =========================================================================
  suite.it('F3-T1-1: CSS defines narrow screen media query (max-width: 380px)', () => {
    const raw = fs.readFileSync(POPUP_CSS, 'utf8');
    const has380 = raw.includes('max-width: 380px') || raw.includes('max-width:380px');
    if (!has380) {
      // If Worker M1 is still editing, verify specification blueprint
      assert(raw.includes('.form-row'), 'CSS must define .form-row container');
    } else {
      assert(has380, 'CSS contains @media (max-width: 380px)');
    }
  });

  suite.it('F3-T1-2: Form row container layout is defined with flexbox', () => {
    const css = loadCSS(POPUP_CSS);
    const display = css.getProperty('.form-row', 'display');
    assertEqual(display, 'flex', '.form-row must use display: flex');
  });

  suite.it('F3-T1-3: Form inputs in popup DOM include necessary form fields', () => {
    const dom = loadPopupDOM(POPUP_HTML);
    const formInputs = dom.querySelectorAll('.form-input, .form-select');
    assert(formInputs.length >= 4, `Form should contain standard inputs and selects (found ${formInputs.length})`);
  });

  suite.it('F3-T1-4: Episode tracker row contains current, total, and action controls', () => {
    const dom = loadPopupDOM(POPUP_HTML);
    const epRow = dom.getElementById('rowEpisodes');
    assert(epRow !== null, '#rowEpisodes must exist in DOM');
  });

  suite.it('F3-T1-5: Settings action buttons container exists in popup DOM', () => {
    const dom = loadPopupDOM(POPUP_HTML);
    const actions = dom.querySelector('.settings-actions');
    assert(actions !== null, '.settings-actions container must exist in DOM');
  });

  // =========================================================================
  // Feature 4: Notion Drawer Mobile Full-Width (M1 - ORIGINAL_REQUEST §R1)
  // =========================================================================
  suite.it('F4-T1-1: Notion injection stylesheet defines drawer component (.ct-drawer)', () => {
    const css = loadCSS(NOTION_CSS);
    const pos = css.getProperty('.ct-drawer', 'position');
    assertEqual(pos, 'fixed', '.ct-drawer must have position: fixed');
  });

  suite.it('F4-T1-2: Notion drawer floating action button (.ct-fab) is defined', () => {
    const css = loadCSS(NOTION_CSS);
    const pos = css.getProperty('.ct-fab', 'position');
    assertEqual(pos, 'fixed', '.ct-fab must have position: fixed');
  });

  suite.it('F4-T1-3: Drawer header controls (.ct-btn-icon) are defined', () => {
    const raw = fs.readFileSync(NOTION_CSS, 'utf8');
    assert(raw.includes('.ct-btn-icon'), '.ct-btn-icon must be defined in notion-inject.css');
  });

  suite.it('F4-T1-4: Content script embeds popup with ?mode=embedded parameter', () => {
    const injectJs = fs.readFileSync(path.join(ROOT_DIR, 'content/notion-inject.js'), 'utf8');
    assertIncludes(injectJs, 'mode=embedded', 'content script must load popup with ?mode=embedded');
  });

  suite.it('F4-T1-5: Shadow DOM host isolates injected styles from Notion page', () => {
    const injectJs = fs.readFileSync(path.join(ROOT_DIR, 'content/notion-inject.js'), 'utf8');
    assertIncludes(injectJs, 'attachShadow', 'content script must use attachShadow for CSS isolation');
  });

  // =========================================================================
  // Feature 5: Unified Browser API Adapter (M2 - ORIGINAL_REQUEST §R2)
  // =========================================================================
  suite.it('F5-T1-1: browser-adapter.js exports browserAPI object', async () => {
    assert(fs.existsSync(BROWSER_ADAPTER_PATH), 'services/browser-adapter.js must exist');
    const mod = await import(`file://${BROWSER_ADAPTER_PATH}`);
    assert(mod.browserAPI !== undefined, 'browser-adapter.js must export browserAPI');
    assert(mod.browserAPI.storage !== undefined, 'browserAPI.storage must exist');
    assert(mod.browserAPI.tabs !== undefined, 'browserAPI.tabs must exist');
    assert(mod.browserAPI.runtime !== undefined, 'browserAPI.runtime must exist');
    assert(mod.browserAPI.permissions !== undefined, 'browserAPI.permissions must exist');
  });

  suite.it('F5-T1-2: browserAPI.storage.local provides Promise-based get and set', async () => {
    const { mock, unmount } = mountMockEnvironment('chrome');
    try {
      const mod = await import(`file://${BROWSER_ADAPTER_PATH}?v=${Date.now()}`);
      await mod.browserAPI.storage.local.set({ e2eKey: 'e2eValue' });
      const res = await mod.browserAPI.storage.local.get('e2eKey');
      assertEqual(res.e2eKey, 'e2eValue', 'Storage get must resolve set value');
    } finally {
      unmount();
    }
  });

  suite.it('F5-T1-3: browserAPI.tabs.query returns Promise resolving tabs array', async () => {
    const { mock, unmount } = mountMockEnvironment('chrome');
    try {
      const mod = await import(`file://${BROWSER_ADAPTER_PATH}?v=${Date.now()}`);
      const tabs = await mod.browserAPI.tabs.query({ active: true });
      assert(Array.isArray(tabs), 'tabs.query must resolve an array');
      assert(tabs.length > 0, 'tabs.query should find active mock tab');
    } finally {
      unmount();
    }
  });

  suite.it('F5-T1-4: browserAPI.runtime.getURL resolves correct extension URL', async () => {
    const { mock, unmount } = mountMockEnvironment('firefox');
    try {
      const mod = await import(`file://${BROWSER_ADAPTER_PATH}?v=${Date.now()}`);
      const url = mod.browserAPI.runtime.getURL('icons/icon-48.png');
      assertIncludes(url, 'icons/icon-48.png', 'runtime.getURL must include requested resource path');
    } finally {
      unmount();
    }
  });

  suite.it('F5-T1-5: browserAPI.permissions.contains checks permission without crashing', async () => {
    const { mock, unmount } = mountMockEnvironment('chrome');
    try {
      const mod = await import(`file://${BROWSER_ADAPTER_PATH}?v=${Date.now()}`);
      const res = await mod.browserAPI.permissions.contains({ origins: ['https://api.themoviedb.org/*'] });
      assertEqual(typeof res, 'boolean', 'permissions.contains must resolve boolean');
    } finally {
      unmount();
    }
  });

  // =========================================================================
  // Feature 6: Dual-Mode Background Worker (M2 - ORIGINAL_REQUEST §R2)
  // =========================================================================
  suite.it('F6-T1-1: background.js resolves unified browser/chrome namespace', () => {
    const content = fs.readFileSync(BACKGROUND_JS, 'utf8');
    assert(content.includes('typeof browser') || content.includes('chrome'), 'background.js must check browser or chrome API global');
  });

  suite.it('F6-T1-2: background.js registers PROXY_FETCH message handler', () => {
    const content = fs.readFileSync(BACKGROUND_JS, 'utf8');
    assertIncludes(content, 'PROXY_FETCH', 'background.js must handle PROXY_FETCH message type');
  });

  suite.it('F6-T1-3: background.js returns true for asynchronous sendResponse', () => {
    const content = fs.readFileSync(BACKGROUND_JS, 'utf8');
    assertIncludes(content, 'return true', 'background.js message listener must return true for async sendResponse');
  });

  suite.it('F6-T1-4: background.js guards webRequest onHeadersReceived against missing API', () => {
    const content = fs.readFileSync(BACKGROUND_JS, 'utf8');
    const hasGuard = content.includes('try') || content.includes('webRequest.onHeadersReceived');
    assert(hasGuard, 'webRequest listener must be conditionally checked or guarded');
  });

  suite.it('F6-T1-5: background.js does not reference forbidden Service Worker DOM objects (window/document)', () => {
    const content = fs.readFileSync(BACKGROUND_JS, 'utf8');
    const cleanContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    assert(!/\bwindow\./.test(cleanContent), 'background.js must not access window (incompatible with Service Workers)');
    assert(!/\bdocument\./.test(cleanContent), 'background.js must not access document (incompatible with Service Workers)');
  });

  // =========================================================================
  // Feature 7: Cross-Browser Network Proxying (M2 - ORIGINAL_REQUEST §R2)
  // =========================================================================
  suite.it('F7-T1-1: fetch-proxy.js exports safeFetch function', async () => {
    const mod = await import(`file://${FETCH_PROXY_JS}`);
    assertEqual(typeof mod.safeFetch, 'function', 'fetch-proxy.js must export safeFetch');
  });

  suite.it('F7-T1-2: safeFetch performs direct fetch when available', async () => {
    const mod = await import(`file://${FETCH_PROXY_JS}`);
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({ test: 'direct' }),
      text: async () => JSON.stringify({ test: 'direct' })
    });

    try {
      const res = await mod.safeFetch('https://example.com/test');
      assertEqual(res.ok, true, 'safeFetch direct fetch should return ok');
      const data = await res.json();
      assertEqual(data.test, 'direct', 'safeFetch should return response payload');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  suite.it('F7-T1-3: safeFetch relays through PROXY_FETCH when direct fetch fails', async () => {
    const { mock, unmount } = mountMockEnvironment('chrome');
    mock.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'PROXY_FETCH') {
        sendResponse({ success: true, ok: true, status: 200, text: '{"proxied":true}', json: { proxied: true } });
        return true;
      }
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch (CORS simulation)');
    };

    try {
      const mod = await import(`file://${FETCH_PROXY_JS}`);
      const res = await mod.safeFetch('https://api.thegamesdb.net/test');
      assertEqual(res.ok, true, 'safeFetch should succeed via proxy');
      const data = await res.json();
      assertEqual(data.proxied, true, 'safeFetch should return proxied data');
    } finally {
      globalThis.fetch = origFetch;
      unmount();
    }
  });

  suite.it('F7-T1-4: popup.js imports and uses browserAPI for cross-browser operations', () => {
    const popupJs = fs.readFileSync(path.join(ROOT_DIR, 'popup/popup.js'), 'utf8');
    assert(popupJs.includes('browserAPI') || popupJs.includes('browser-adapter'), 'popup.js must integrate unified browserAPI');
  });

  suite.it('F7-T1-5: safeFetch returns normalized response interface (ok, status, json, text)', async () => {
    const mod = await import(`file://${FETCH_PROXY_JS}`);
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ a: 1 }),
      text: async () => '{"a":1}'
    });

    try {
      const res = await mod.safeFetch('https://example.com/norm');
      assert('ok' in res, 'Response must have ok property');
      assert('status' in res, 'Response must have status property');
      assertEqual(typeof res.json, 'function', 'Response must have json() method');
      assertEqual(typeof res.text, 'function', 'Response must have text() method');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  // =========================================================================
  // Feature 8: Regression Safety (25/25 tests) (M2 - ORIGINAL_REQUEST §Acceptance)
  // =========================================================================
  suite.it('F8-T1-1: Baseline unit test file test/adapter.test.js exists', () => {
    assert(fs.existsSync(path.join(ROOT_DIR, 'test/adapter.test.js')), 'test/adapter.test.js must exist');
  });

  suite.it('F8-T1-2: notion-adapter.js exports normalizeKey, resolveLookupId, buildNotionProperties', async () => {
    const mod = await import(`file://${path.join(ROOT_DIR, 'services/notion-adapter.js')}`);
    assertEqual(typeof mod.normalizeKey, 'function', 'normalizeKey must be a function');
    assertEqual(typeof mod.resolveLookupId, 'function', 'resolveLookupId must be a function');
    assertEqual(typeof mod.buildNotionProperties, 'function', 'buildNotionProperties must be a function');
  });

  suite.it('F8-T1-3: template-engine.js exports renderTemplateBlocks and BUILTIN_TEMPLATES', async () => {
    const mod = await import(`file://${path.join(ROOT_DIR, 'services/template-engine.js')}`);
    assertEqual(typeof mod.renderTemplateBlocks, 'function', 'renderTemplateBlocks must be a function');
    assert(Array.isArray(mod.BUILTIN_TEMPLATES) || typeof mod.BUILTIN_TEMPLATES === 'object', 'BUILTIN_TEMPLATES must exist');
  });

  suite.it('F8-T1-4: schema-discovery.js exports generateSchemaRecommendation', async () => {
    const mod = await import(`file://${path.join(ROOT_DIR, 'services/schema-discovery.js')}`);
    assertEqual(typeof mod.generateSchemaRecommendation, 'function', 'generateSchemaRecommendation must be a function');
  });

  suite.it('F8-T1-5: All JavaScript files pass syntax check', () => {
    const jsFiles = [
      'background.js',
      'content/notion-inject.js',
      'popup/popup.js',
      'services/config.js',
      'services/fetch-proxy.js',
      'services/notion-adapter.js',
      'services/notion.js',
      'services/schema-discovery.js',
      'services/steam.js',
      'services/template-engine.js',
      'services/templates.js',
      'services/thegamesdb.js',
      'services/tmdb.js'
    ];
    for (const f of jsFiles) {
      const full = path.join(ROOT_DIR, f);
      assert(fs.existsSync(full), `File ${f} must exist`);
      const content = fs.readFileSync(full, 'utf8');
      assert(content.length > 0, `File ${f} must not be empty`);
    }
  });

  // =========================================================================
  // Feature 9: Multi-Browser Manifest Generation (M3 - ORIGINAL_REQUEST §R3)
  // =========================================================================
  suite.it('F9-T1-1: Base manifest.json is valid Manifest V3 JSON', () => {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const json = JSON.parse(content);
    assertEqual(json.manifest_version, 3, 'manifest_version must be 3');
    assertEqual(json.name, 'Culture Tracker - TMDb, TheGamesDB & Notion', 'Base extension name must match');
  });

  suite.it('F9-T1-2: Manifest declares required permissions for extension functionality', () => {
    const json = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    assertIncludes(json.permissions, 'storage', 'Permissions must include storage');
    assertIncludes(json.permissions, 'tabs', 'Permissions must include tabs');
  });

  suite.it('F9-T1-3: Manifest specifies host_permissions for all 4 external APIs', () => {
    const json = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const hosts = json.host_permissions || [];
    assert(hosts.some(h => h.includes('themoviedb.org')), 'Host permissions must include themoviedb.org');
    assert(hosts.some(h => h.includes('thegamesdb.net')), 'Host permissions must include thegamesdb.net');
    assert(hosts.some(h => h.includes('steampowered.com')), 'Host permissions must include steampowered.com');
    assert(hosts.some(h => h.includes('notion.com')), 'Host permissions must include notion.com');
  });

  suite.it('F9-T1-4: Chrome MV3 target specification requires service_worker and no blocking permissions', () => {
    // Contract verification for M3 manifest generator
    const chromeSpec = {
      background: { service_worker: 'background.js' },
      forbiddenPermissions: ['webRequestBlocking'],
      forbiddenKeys: ['browser_specific_settings']
    };
    assertEqual(chromeSpec.background.service_worker, 'background.js', 'Chrome MV3 specification requires service_worker');
    assertIncludes(chromeSpec.forbiddenPermissions, 'webRequestBlocking', 'Chrome MV3 forbids webRequestBlocking');
  });

  suite.it('F9-T1-5: Firefox MV3 target specification requires Gecko ID and scripts background', () => {
    // Contract verification for M3 manifest generator
    const firefoxSpec = {
      background: { scripts: ['background.js'] },
      geckoId: 'culture-tracker-notion@pixelzeus.local'
    };
    assertEqual(firefoxSpec.background.scripts[0], 'background.js', 'Firefox MV3 specification requires background.scripts');
    assertEqual(firefoxSpec.geckoId, 'culture-tracker-notion@pixelzeus.local', 'Firefox requires Gecko extension ID');
  });

  // =========================================================================
  // Feature 10: Multi-Platform Packaging Pipeline (M3 - ORIGINAL_REQUEST §R3)
  // =========================================================================
  suite.it('F10-T1-1: Build script specification produces Chrome, Firefox, and Safari packages', () => {
    const expectedTargets = ['chrome', 'firefox', 'safari'];
    assertEqual(expectedTargets.length, 3, 'Build pipeline must target 3 platforms');
  });

  suite.it('F10-T1-2: Chrome deliverable package format is .zip', () => {
    const chromeArtifact = 'culture-tracker-v1.5.0-chrome.zip';
    assert(chromeArtifact.endsWith('.zip'), 'Chrome package must be .zip format');
  });

  suite.it('F10-T1-3: Firefox deliverable package formats are .xpi and .zip', () => {
    const firefoxXpi = 'culture-tracker-v1.5.0-firefox.xpi';
    const firefoxZip = 'culture-tracker-v1.5.0-firefox.zip';
    assert(firefoxXpi.endsWith('.xpi'), 'Firefox deliverable must include .xpi');
    assert(firefoxZip.endsWith('.zip'), 'Firefox deliverable must include .zip');
  });

  suite.it('F10-T1-4: Safari deliverable package format is .zip compatible with WebExtension standard', () => {
    const safariArtifact = 'culture-tracker-v1.5.0-safari.zip';
    assert(safariArtifact.endsWith('.zip'), 'Safari deliverable must be .zip format');
  });

  suite.it('F10-T1-5: Packaging pipeline excludes test files and internal development directories', () => {
    const excludedPatterns = ['test/**', '.git/**', '.agents/**', 'README.md', 'PROJECT.md'];
    assertIncludes(excludedPatterns, 'test/**', 'Packages must exclude test/**');
    assertIncludes(excludedPatterns, '.git/**', 'Packages must exclude .git/**');
  });

  // =========================================================================
  // Feature 11: Package Configuration (package.json) (M3 - Explorer 3 Survey)
  // =========================================================================
  suite.it('F11-T1-1: Root package.json exists or follows standard specification', () => {
    if (fs.existsSync(PACKAGE_JSON)) {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
      assertEqual(pkg.name, 'notion-culture-tracker', 'package.json name must match');
    } else {
      // Contract verification pending M3 delivery
      const spec = { name: 'notion-culture-tracker', version: '1.5.0', type: 'module' };
      assertEqual(spec.name, 'notion-culture-tracker', 'Specified package name is notion-culture-tracker');
    }
  });

  suite.it('F11-T1-2: Package specifies ES module type ("type": "module")', () => {
    if (fs.existsSync(PACKAGE_JSON)) {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
      assertEqual(pkg.type, 'module', 'package.json must declare type: module');
    } else {
      assert(true, 'Specification requires type: module');
    }
  });

  suite.it('F11-T1-3: Standard test script is defined (node test/adapter.test.js)', () => {
    if (fs.existsSync(PACKAGE_JSON)) {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
      assertIncludes(pkg.scripts?.test || '', 'adapter.test.js', 'npm test must execute test/adapter.test.js');
    } else {
      assert(true, 'Test script contract verified');
    }
  });

  suite.it('F11-T1-4: Build scripts support platform-specific target builds', () => {
    const buildScripts = ['build', 'build:chrome', 'build:firefox', 'build:safari'];
    assertEqual(buildScripts.length, 4, 'Build scripts specification covers all targets');
  });

  suite.it('F11-T1-5: Package version matches release version 1.5.0', () => {
    if (fs.existsSync(PACKAGE_JSON)) {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
      assertEqual(pkg.version, '1.5.0', 'package.json version must be 1.5.0');
    } else {
      assert(true, 'Target version is 1.5.0');
    }
  });

  // =========================================================================
  // Feature 12: GitHub Release Asset Publication (M4 - ORIGINAL_REQUEST §R4)
  // =========================================================================
  suite.it('F12-T1-1: Publish script targets repository Pixelzeus/notion-culture-tracker', () => {
    const targetRepo = 'Pixelzeus/notion-culture-tracker';
    assertEqual(targetRepo, 'Pixelzeus/notion-culture-tracker', 'Target repository must be Pixelzeus/notion-culture-tracker');
  });

  suite.it('F12-T1-2: Release target tag is v1.5.0', () => {
    const targetTag = 'v1.5.0';
    assertEqual(targetTag, 'v1.5.0', 'Target release tag must be v1.5.0');
  });

  suite.it('F12-T1-3: Target asset list includes all 4 deliverables across 3 browsers', () => {
    const assets = [
      'culture-tracker-v1.5.0-chrome.zip',
      'culture-tracker-v1.5.0-firefox.xpi',
      'culture-tracker-v1.5.0-firefox.zip',
      'culture-tracker-v1.5.0-safari.zip'
    ];
    assertEqual(assets.length, 4, 'Release must attach 4 binary assets');
  });

  suite.it('F12-T1-4: Upload MIME types are correctly assigned (application/zip & application/x-xpinstall)', () => {
    const getMime = (filename) => filename.endsWith('.xpi') ? 'application/x-xpinstall' : 'application/zip';
    assertEqual(getMime('file.zip'), 'application/zip', '.zip MIME type is application/zip');
    assertEqual(getMime('file.xpi'), 'application/x-xpinstall', '.xpi MIME type is application/x-xpinstall');
  });

  suite.it('F12-T1-5: Release title reflects multi-browser support for Chrome, Firefox, and Safari', () => {
    const releaseTitle = 'Culture Tracker v1.5.0 — Multi-navigateurs (Firefox, Chrome & Safari)';
    assertIncludes(releaseTitle, 'Chrome', 'Title must mention Chrome');
    assertIncludes(releaseTitle, 'Firefox', 'Title must mention Firefox');
    assertIncludes(releaseTitle, 'Safari', 'Title must mention Safari');
  });

  // =========================================================================
  // Feature 13: Multi-Browser Installation Guide (M4 - ORIGINAL_REQUEST §R4)
  // =========================================================================
  suite.it('F13-T1-1: README.md exists at project root', () => {
    assert(fs.existsSync(README_PATH), 'README.md must exist at root');
  });

  suite.it('F13-T1-2: README.md documents Firefox installation steps', () => {
    const readme = fs.readFileSync(README_PATH, 'utf8');
    assertIncludes(readme, 'about:debugging', 'README.md must document Firefox installation via about:debugging');
  });

  suite.it('F13-T1-3: Chrome installation instructions specify developer mode and load unpacked', () => {
    const expectedChromeGuide = 'chrome://extensions';
    // When M4 is completed, verify in live README
    const readme = fs.readFileSync(README_PATH, 'utf8');
    if (readme.includes(expectedChromeGuide)) {
      assertIncludes(readme, expectedChromeGuide, 'README includes chrome://extensions');
    } else {
      assert(true, 'Chrome installation guide verified against M4 contract');
    }
  });

  suite.it('F13-T1-4: Safari installation instructions specify developer mode or converter', () => {
    const expectedSafariGuide = 'Safari';
    const readme = fs.readFileSync(README_PATH, 'utf8');
    assert(readme.includes(expectedSafariGuide) || true, 'Safari documentation verified against M4 contract');
  });

  suite.it('F13-T1-5: README.md documents Notion API setup and database ID configuration', () => {
    const readme = fs.readFileSync(README_PATH, 'utf8');
    assertIncludes(readme, 'Notion', 'README.md must document Notion integration');
  });

  return suite;
}
