// test/e2e/harness/browser-mock.js
// Mock implementations of Chrome and Firefox WebExtension APIs

export function createBrowserMock(options = {}) {
  const isFirefox = options.flavor === 'firefox' || options.flavor === 'safari';
  const isChrome = options.flavor === 'chrome';
  const hasCallbacks = !isFirefox;

  const storageData = new Map();
  const messageListeners = [];
  let lastError = null;

  const storageLocal = {
    get: (keys, cb) => {
      let result = {};
      if (typeof keys === 'string') {
        result[keys] = storageData.get(keys);
      } else if (Array.isArray(keys)) {
        for (const k of keys) {
          result[k] = storageData.get(k);
        }
      } else if (keys && typeof keys === 'object') {
        for (const [k, defaultVal] of Object.entries(keys)) {
          result[k] = storageData.has(k) ? storageData.get(k) : defaultVal;
        }
      } else {
        result = Object.fromEntries(storageData.entries());
      }

      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(result), 0);
        return;
      }
      return Promise.resolve(result);
    },

    set: (items, cb) => {
      for (const [k, v] of Object.entries(items)) {
        storageData.set(k, v);
      }
      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(), 0);
        return;
      }
      return Promise.resolve();
    },

    remove: (keys, cb) => {
      const arr = Array.isArray(keys) ? keys : [keys];
      for (const k of arr) storageData.delete(k);
      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(), 0);
        return;
      }
      return Promise.resolve();
    },

    clear: (cb) => {
      storageData.clear();
      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(), 0);
        return;
      }
      return Promise.resolve();
    },

    _dump: () => Object.fromEntries(storageData.entries())
  };

  const tabs = {
    _tabsList: [
      { id: 101, url: 'https://www.notion.so/my-workspace/page-123', active: true, currentWindow: true },
      { id: 102, url: 'https://store.steampowered.com/app/367520', active: false, currentWindow: true }
    ],

    query: (queryInfo, cb) => {
      let filtered = [...tabs._tabsList];
      if (queryInfo.active !== undefined) {
        filtered = filtered.filter(t => t.active === queryInfo.active);
      }
      if (queryInfo.currentWindow !== undefined) {
        filtered = filtered.filter(t => t.currentWindow === queryInfo.currentWindow);
      }
      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(filtered), 0);
        return;
      }
      return Promise.resolve(filtered);
    },

    sendMessage: (tabId, message, cb) => {
      const tab = tabs._tabsList.find(t => t.id === tabId);
      const response = tab ? { received: true, tabId, message } : null;
      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(response), 0);
        return;
      }
      return Promise.resolve(response);
    }
  };

  const runtime = {
    get lastError() {
      return lastError;
    },
    set lastError(val) {
      lastError = val;
    },

    getURL: (path) => {
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const prefix = isChrome ? 'chrome-extension://mock-id/' : 'moz-extension://mock-uuid/';
      return `${prefix}${cleanPath}`;
    },

    onMessage: {
      addListener: (fn) => {
        messageListeners.push(fn);
      },
      removeListener: (fn) => {
        const idx = messageListeners.indexOf(fn);
        if (idx !== -1) messageListeners.splice(idx, 1);
      }
    },

    sendMessage: (message, cb) => {
      return new Promise((resolve) => {
        let responded = false;
        const sendResponse = (res) => {
          if (!responded) {
            responded = true;
            if (cb && typeof cb === 'function') cb(res);
            resolve(res);
          }
        };

        let keptOpen = false;
        for (const listener of [...messageListeners]) {
          const ret = listener(message, { id: 'mock-sender' }, sendResponse);
          if (ret === true) {
            keptOpen = true;
          }
        }

        if (!keptOpen && !responded) {
          responded = true;
          if (cb && typeof cb === 'function') cb(null);
          resolve(null);
        }
      });
    }
  };

  const permissions = {
    _grantedOrigins: new Set(['https://api.themoviedb.org/*', 'https://api.thegamesdb.net/*']),

    contains: (perms, cb) => {
      let allGranted = true;
      if (perms?.origins) {
        for (const orig of perms.origins) {
          if (!permissions._grantedOrigins.has(orig)) {
            allGranted = false;
            break;
          }
        }
      }
      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(allGranted), 0);
        return;
      }
      return Promise.resolve(allGranted);
    },

    request: (perms, cb) => {
      if (perms?.origins) {
        for (const orig of perms.origins) {
          permissions._grantedOrigins.add(orig);
        }
      }
      if (cb && typeof cb === 'function') {
        setTimeout(() => cb(true), 0);
        return;
      }
      return Promise.resolve(true);
    }
  };

  return {
    storage: { local: storageLocal },
    tabs,
    runtime,
    permissions,
    _listeners: messageListeners,
    _storageData: storageData
  };
}

export function mountMockEnvironment(flavor = 'chrome') {
  const originalBrowser = globalThis.browser;
  const originalChrome = globalThis.chrome;

  const mock = createBrowserMock({ flavor });

  if (flavor === 'firefox') {
    globalThis.browser = mock;
    delete globalThis.chrome;
  } else if (flavor === 'chrome') {
    globalThis.chrome = mock;
    delete globalThis.browser;
  } else if (flavor === 'safari') {
    globalThis.browser = mock;
    globalThis.chrome = mock;
  }

  return {
    mock,
    unmount: () => {
      if (originalBrowser !== undefined) globalThis.browser = originalBrowser;
      else delete globalThis.browser;

      if (originalChrome !== undefined) globalThis.chrome = originalChrome;
      else delete globalThis.chrome;
    }
  };
}
