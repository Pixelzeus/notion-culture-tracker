// Unit tests for services/browser-adapter.js
// Tests cross-browser compatibility across Firefox (browser.*), Chrome (chrome.*), and fallback environments

import { browserAPI } from '../services/browser-adapter.js';
import { safeFetch } from '../services/fetch-proxy.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 1. Tests in Empty Environment (Fallback / Node.js)');
  // Clean globals
  delete globalThis.browser;
  delete globalThis.chrome;

  const emptyStorage = await browserAPI.storage.local.get('notion_token');
  assert(typeof emptyStorage === 'object' && Object.keys(emptyStorage).length === 0, 'storage.local.get returns empty object when unconfigured');

  await browserAPI.storage.local.set({ key: 'value' });
  assert(true, 'storage.local.set succeeds without throwing');

  const emptyTabs = await browserAPI.tabs.query({ active: true });
  assert(Array.isArray(emptyTabs) && emptyTabs.length === 0, 'tabs.query returns empty array when unconfigured');

  const emptySendMsg = await browserAPI.tabs.sendMessage(1, { ping: true });
  assert(emptySendMsg === null, 'tabs.sendMessage returns null when unconfigured');

  const url = browserAPI.runtime.getURL('popup/popup.html');
  assert(url === 'popup/popup.html', 'runtime.getURL returns original path when unconfigured');

  const emptyRuntimeSend = await browserAPI.runtime.sendMessage({ ping: true });
  assert(emptyRuntimeSend === null, 'runtime.sendMessage returns null when unconfigured');

  const permsContains = await browserAPI.permissions.contains({ origins: ['*'] });
  assert(permsContains === true, 'permissions.contains defaults to true when unconfigured');

  const permsRequest = await browserAPI.permissions.request({ origins: ['*'] });
  assert(permsRequest === true, 'permissions.request defaults to true when unconfigured');

  console.log('\n🧪 2. Tests in Firefox / Safari Environment (globalThis.browser with native Promises)');
  const mockStorageStore = {};
  globalThis.browser = {
    storage: {
      local: {
        get: async (keys) => {
          if (typeof keys === 'string') return { [keys]: mockStorageStore[keys] };
          return { ...mockStorageStore };
        },
        set: async (items) => {
          Object.assign(mockStorageStore, items);
        }
      }
    },
    tabs: {
      query: async (queryInfo) => [
        { id: 42, url: 'https://www.notion.so/my-workspace', active: true }
      ],
      sendMessage: async (tabId, msg) => ({ receivedTabId: tabId, ...msg })
    },
    runtime: {
      getURL: (path) => `moz-extension://mock-uuid/${path}`,
      sendMessage: async (msg) => ({ echo: msg }),
      onMessage: {
        addListener: () => {}
      }
    },
    permissions: {
      contains: async (perms) => perms.origins?.includes('https://api.notion.com/*') ?? false,
      request: async (perms) => true
    }
  };

  await browserAPI.storage.local.set({ notion_token: 'secret_123', culture_mode: 'game' });
  const ffStorage = await browserAPI.storage.local.get('notion_token');
  assert(ffStorage.notion_token === 'secret_123', 'Firefox storage.local set & get works');

  const ffTabs = await browserAPI.tabs.query({ active: true });
  assert(ffTabs.length === 1 && ffTabs[0].id === 42, 'Firefox tabs.query returns active tab');

  const ffTabMsg = await browserAPI.tabs.sendMessage(42, { action: 'TOGGLE' });
  assert(ffTabMsg.receivedTabId === 42 && ffTabMsg.action === 'TOGGLE', 'Firefox tabs.sendMessage returns response');

  const ffUrl = browserAPI.runtime.getURL('assets/icon.png');
  assert(ffUrl === 'moz-extension://mock-uuid/assets/icon.png', 'Firefox runtime.getURL resolves extension path');

  const ffRuntimeMsg = await browserAPI.runtime.sendMessage({ test: 'hello' });
  assert(ffRuntimeMsg.echo.test === 'hello', 'Firefox runtime.sendMessage receives echo');

  const ffPermsContains = await browserAPI.permissions.contains({ origins: ['https://api.notion.com/*'] });
  assert(ffPermsContains === true, 'Firefox permissions.contains returns true for granted origin');

  const ffPermsRequest = await browserAPI.permissions.request({ origins: ['https://api.thegamesdb.net/*'] });
  assert(ffPermsRequest === true, 'Firefox permissions.request returns true');

  console.log('\n🧪 3. Tests in Chrome Environment (globalThis.chrome with callback-style APIs)');
  delete globalThis.browser;
  const mockChromeStore = {};
  globalThis.chrome = {
    runtime: {
      lastError: null,
      getURL: (path) => `chrome-extension://mock-extension-id/${path}`,
      sendMessage: (msg, callback) => {
        if (msg.causeError) {
          globalThis.chrome.runtime.lastError = { message: 'Mock runtime error' };
          callback(null);
          globalThis.chrome.runtime.lastError = null;
        } else {
          callback({ chromeEcho: msg });
        }
      },
      onMessage: {
        addListener: () => {}
      }
    },
    storage: {
      local: {
        get: (keys, callback) => {
          callback(mockChromeStore);
        },
        set: (items, callback) => {
          Object.assign(mockChromeStore, items);
          if (callback) callback();
        }
      }
    },
    tabs: {
      query: (queryInfo, callback) => {
        callback([{ id: 101, url: 'https://notion.so/test', active: true }]);
      },
      sendMessage: (tabId, msg, callback) => {
        if (tabId === 999) {
          globalThis.chrome.runtime.lastError = { message: 'Receiving end does not exist' };
          callback(null);
          globalThis.chrome.runtime.lastError = null;
        } else {
          callback({ chromeTabReply: true, tabId });
        }
      }
    },
    permissions: {
      contains: (perms, callback) => {
        callback(true);
      },
      request: (perms, callback) => {
        callback(true);
      }
    }
  };

  await browserAPI.storage.local.set({ chrome_key: 'chrome_val' });
  const crStorage = await browserAPI.storage.local.get('chrome_key');
  assert(crStorage.chrome_key === 'chrome_val', 'Chrome callback storage.local.set & get wrapped into Promise');

  const crTabs = await browserAPI.tabs.query({ active: true });
  assert(crTabs.length === 1 && crTabs[0].id === 101, 'Chrome callback tabs.query returns tabs array');

  const crTabMsg = await browserAPI.tabs.sendMessage(101, { test: 1 });
  assert(crTabMsg.chromeTabReply === true && crTabMsg.tabId === 101, 'Chrome callback tabs.sendMessage returns response');

  let crTabErrorCaught = false;
  try {
    await browserAPI.tabs.sendMessage(999, { test: 2 });
  } catch (err) {
    crTabErrorCaught = true;
    assert(err.message.includes('Receiving end does not exist'), 'Chrome lastError rejected as Error');
  }
  assert(crTabErrorCaught === true, 'Chrome tab error was properly caught');

  const crUrl = browserAPI.runtime.getURL('popup/popup.html');
  assert(crUrl === 'chrome-extension://mock-extension-id/popup/popup.html', 'Chrome runtime.getURL resolves chrome-extension:// path');

  const crRuntimeMsg = await browserAPI.runtime.sendMessage({ greeting: 'chrome' });
  assert(crRuntimeMsg.chromeEcho.greeting === 'chrome', 'Chrome callback runtime.sendMessage wrapped into Promise');

  const crPermsContains = await browserAPI.permissions.contains({ origins: ['*'] });
  assert(crPermsContains === true, 'Chrome permissions.contains wrapped into Promise');

  const crPermsRequest = await browserAPI.permissions.request({ origins: ['*'] });
  assert(crPermsRequest === true, 'Chrome permissions.request wrapped into Promise');

  console.log('\n🧪 4. Tests safeFetch cross-origin proxy fallback');
  // Configure mock chrome runtime to handle PROXY_FETCH
  globalThis.chrome.runtime.sendMessage = (msg, callback) => {
    if (msg.type === 'PROXY_FETCH') {
      callback({
        success: true,
        ok: true,
        status: 200,
        statusText: 'OK',
        text: JSON.stringify({ proxied: true, url: msg.url }),
        json: { proxied: true, url: msg.url }
      });
    } else {
      callback(null);
    }
  };

  // Mock global fetch to fail, triggering fallback
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch due to CORS');
  };

  try {
    const proxyRes = await safeFetch('https://api.thegamesdb.net/Games/ByGameName?name=Zelda');
    assert(proxyRes.ok === true, 'safeFetch fallback returns ok response');
    const proxyData = await proxyRes.json();
    assert(proxyData.proxied === true, 'safeFetch routed through PROXY_FETCH message handler');
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.chrome;
    delete globalThis.browser;
  }

  console.log(`\n========================================`);
  console.log(`RÉSULTAT GLOBAL: ${passed} PASSÉS, ${failed} ÉCHECS`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 TOUS LES TESTS BROWSER-ADAPTER SONT AU VERT !');
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
