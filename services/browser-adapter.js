// services/browser-adapter.js
// Unified Promise-based browser API adapter for Google Chrome, Mozilla Firefox, and Apple Safari

function getGlobal() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof self !== 'undefined') return self;
  return {};
}

function getBrowserRoot() {
  const g = getGlobal();
  return g.browser || g.chrome || {};
}

export const browserAPI = {
  storage: {
    local: {
      get: async (keys) => {
        const g = getGlobal();
        if (g.browser?.storage?.local?.get) {
          return g.browser.storage.local.get(keys);
        }
        const root = getBrowserRoot();
        if (!root.storage?.local?.get) return {};
        return new Promise((resolve, reject) => {
          try {
            let settled = false;
            const res = root.storage.local.get(keys, (items) => {
              if (settled) return;
              settled = true;
              if (root.runtime?.lastError) {
                reject(new Error(root.runtime.lastError.message || String(root.runtime.lastError)));
              } else {
                resolve(items || {});
              }
            });
            if (res && typeof res.then === 'function') {
              res.then(
                (val) => { if (!settled) { settled = true; resolve(val || {}); } },
                (err) => { if (!settled) { settled = true; reject(err); } }
              );
            }
          } catch (err) {
            reject(err);
          }
        });
      },

      set: async (items) => {
        const g = getGlobal();
        if (g.browser?.storage?.local?.set) {
          return g.browser.storage.local.set(items);
        }
        const root = getBrowserRoot();
        if (!root.storage?.local?.set) return;
        return new Promise((resolve, reject) => {
          try {
            let settled = false;
            const res = root.storage.local.set(items, () => {
              if (settled) return;
              settled = true;
              if (root.runtime?.lastError) {
                reject(new Error(root.runtime.lastError.message || String(root.runtime.lastError)));
              } else {
                resolve();
              }
            });
            if (res && typeof res.then === 'function') {
              res.then(
                () => { if (!settled) { settled = true; resolve(); } },
                (err) => { if (!settled) { settled = true; reject(err); } }
              );
            }
          } catch (err) {
            reject(err);
          }
        });
      }
    }
  },

  tabs: {
    query: async (queryInfo) => {
      const g = getGlobal();
      if (g.browser?.tabs?.query) {
        return g.browser.tabs.query(queryInfo);
      }
      const root = getBrowserRoot();
      if (!root.tabs?.query) return [];
      return new Promise((resolve, reject) => {
        try {
          let settled = false;
          const res = root.tabs.query(queryInfo, (tabs) => {
            if (settled) return;
            settled = true;
            if (root.runtime?.lastError) {
              reject(new Error(root.runtime.lastError.message || String(root.runtime.lastError)));
            } else {
              resolve(tabs || []);
            }
          });
          if (res && typeof res.then === 'function') {
            res.then(
              (val) => { if (!settled) { settled = true; resolve(val || []); } },
              (err) => { if (!settled) { settled = true; reject(err); } }
            );
          }
        } catch (err) {
          reject(err);
        }
      });
    },

    sendMessage: async (tabId, message) => {
      const g = getGlobal();
      if (g.browser?.tabs?.sendMessage) {
        return g.browser.tabs.sendMessage(tabId, message);
      }
      const root = getBrowserRoot();
      if (!root.tabs?.sendMessage) return null;
      return new Promise((resolve, reject) => {
        try {
          let settled = false;
          const res = root.tabs.sendMessage(tabId, message, (response) => {
            if (settled) return;
            settled = true;
            if (root.runtime?.lastError) {
              reject(new Error(root.runtime.lastError.message || String(root.runtime.lastError)));
            } else {
              resolve(response);
            }
          });
          if (res && typeof res.then === 'function') {
            res.then(
              (val) => { if (!settled) { settled = true; resolve(val); } },
              (err) => { if (!settled) { settled = true; reject(err); } }
            );
          }
        } catch (err) {
          reject(err);
        }
      });
    }
  },

  runtime: {
    getURL: (path) => {
      const root = getBrowserRoot();
      if (root.runtime?.getURL) {
        return root.runtime.getURL(path);
      }
      return path;
    },

    sendMessage: async (message) => {
      const g = getGlobal();
      if (g.browser?.runtime?.sendMessage) {
        return g.browser.runtime.sendMessage(message);
      }
      const root = getBrowserRoot();
      if (!root.runtime?.sendMessage) return null;
      return new Promise((resolve, reject) => {
        try {
          let settled = false;
          const res = root.runtime.sendMessage(message, (response) => {
            if (settled) return;
            settled = true;
            if (root.runtime?.lastError) {
              reject(new Error(root.runtime.lastError.message || String(root.runtime.lastError)));
            } else {
              resolve(response);
            }
          });
          if (res && typeof res.then === 'function') {
            res.then(
              (val) => { if (!settled) { settled = true; resolve(val); } },
              (err) => { if (!settled) { settled = true; reject(err); } }
            );
          }
        } catch (err) {
          reject(err);
        }
      });
    },

    get onMessage() {
      const root = getBrowserRoot();
      return root.runtime?.onMessage || {
        addListener: () => {},
        removeListener: () => {},
        hasListener: () => false
      };
    }
  },

  permissions: {
    contains: async (perms) => {
      const g = getGlobal();
      if (g.browser?.permissions?.contains) {
        return g.browser.permissions.contains(perms);
      }
      const root = getBrowserRoot();
      if (!root.permissions?.contains) return true;
      return new Promise((resolve, reject) => {
        try {
          let settled = false;
          const res = root.permissions.contains(perms, (result) => {
            if (settled) return;
            settled = true;
            if (root.runtime?.lastError) {
              reject(new Error(root.runtime.lastError.message || String(root.runtime.lastError)));
            } else {
              resolve(!!result);
            }
          });
          if (res && typeof res.then === 'function') {
            res.then(
              (val) => { if (!settled) { settled = true; resolve(!!val); } },
              (err) => { if (!settled) { settled = true; reject(err); } }
            );
          }
        } catch (err) {
          reject(err);
        }
      });
    },

    request: async (perms) => {
      const g = getGlobal();
      if (g.browser?.permissions?.request) {
        return g.browser.permissions.request(perms);
      }
      const root = getBrowserRoot();
      if (!root.permissions?.request) return true;
      return new Promise((resolve, reject) => {
        try {
          let settled = false;
          const res = root.permissions.request(perms, (granted) => {
            if (settled) return;
            settled = true;
            if (root.runtime?.lastError) {
              reject(new Error(root.runtime.lastError.message || String(root.runtime.lastError)));
            } else {
              resolve(!!granted);
            }
          });
          if (res && typeof res.then === 'function') {
            res.then(
              (val) => { if (!settled) { settled = true; resolve(!!val); } },
              (err) => { if (!settled) { settled = true; reject(err); } }
            );
          }
        } catch (err) {
          reject(err);
        }
      });
    }
  }
};

export default browserAPI;
