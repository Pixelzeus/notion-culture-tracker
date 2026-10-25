// test/adversarial-runtime.test.js
// Adversarial Stress and Compatibility Harness for services/browser-adapter.js, background.js, and services/fetch-proxy.js
// Written by Challenger 1 (Adversarial Runtime & Compatibility Verifier)

import { browserAPI } from '../services/browser-adapter.js';
import { safeFetch } from '../services/fetch-proxy.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message, errorDetail = null) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    const detail = errorDetail ? ` (${errorDetail})` : '';
    console.error(`  ❌ FAIL: ${message}${detail}`);
    failures.push({ message, errorDetail });
  }
}

async function testSuite() {
  console.log('================================================================');
  console.log('⚡ ADVERSARIAL RUNTIME & COMPATIBILITY STRESS HARNESS (CHALLENGER 1)');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Uninitialized and Hostile Global Environments
  // --------------------------------------------------------------------------
  console.log('🧪 [Suite 1] Uninitialized & Hostile Global Environments');

  // 1.1 Complete absence of browser/chrome
  delete globalThis.browser;
  delete globalThis.chrome;

  const s1 = await browserAPI.storage.local.get('token');
  assert(typeof s1 === 'object' && Object.keys(s1).length === 0, 'storage.local.get returns {} in null environment');

  let sSetError = null;
  try {
    await browserAPI.storage.local.set({ a: 1 });
  } catch (err) {
    sSetError = err;
  }
  assert(sSetError === null, 'storage.local.set does not throw in null environment');

  const tabs1 = await browserAPI.tabs.query({ active: true });
  assert(Array.isArray(tabs1) && tabs1.length === 0, 'tabs.query returns [] in null environment');

  const tabSend1 = await browserAPI.tabs.sendMessage(123, { ping: true });
  assert(tabSend1 === null, 'tabs.sendMessage returns null in null environment');

  const runUrl1 = browserAPI.runtime.getURL('manifest.json');
  assert(runUrl1 === 'manifest.json', 'runtime.getURL returns original path in null environment');

  const runSend1 = await browserAPI.runtime.sendMessage({ ping: true });
  assert(runSend1 === null, 'runtime.sendMessage returns null in null environment');

  const permCont1 = await browserAPI.permissions.contains({ origins: ['*'] });
  assert(permCont1 === true, 'permissions.contains defaults to true in null environment');

  const permReq1 = await browserAPI.permissions.request({ origins: ['*'] });
  assert(permReq1 === true, 'permissions.request defaults to true in null environment');

  const onMsg1 = browserAPI.runtime.onMessage;
  assert(typeof onMsg1.addListener === 'function' && typeof onMsg1.removeListener === 'function' && onMsg1.hasListener() === false, 'runtime.onMessage fallback interface is valid');

  // 1.2 Null and partially empty objects
  globalThis.chrome = null;
  globalThis.browser = null;
  const s2 = await browserAPI.storage.local.get(['k1', 'k2']);
  assert(typeof s2 === 'object' && Object.keys(s2).length === 0, 'storage.local.get handles explicit null globals');

  globalThis.chrome = {}; // empty object
  const s3 = await browserAPI.storage.local.get(null);
  assert(typeof s3 === 'object' && Object.keys(s3).length === 0, 'storage.local.get handles empty chrome object');

  globalThis.chrome = { storage: {}, tabs: {}, runtime: {}, permissions: {} }; // empty sub-objects
  const s4 = await browserAPI.storage.local.get('x');
  assert(typeof s4 === 'object' && Object.keys(s4).length === 0, 'storage.local.get handles empty sub-objects');

  delete globalThis.chrome;
  delete globalThis.browser;

  // --------------------------------------------------------------------------
  // SECTION 2: Pure Callback-Based Chrome Environment (Asynchronous & Errors)
  // --------------------------------------------------------------------------
  console.log('\n🧪 [Suite 2] Pure Callback-Based Chrome Environment (No Native Promises)');

  const mockChromeStore = new Map();
  let chromeLastError = null;

  globalThis.chrome = {
    runtime: {
      get lastError() {
        return chromeLastError;
      },
      getURL: (p) => `chrome-extension://adversarial-id/${p}`,
      sendMessage: (msg, cb) => {
        setTimeout(() => {
          if (chromeLastError) {
            cb(undefined);
          } else {
            cb({ reply: 'ok', msg });
          }
        }, 5);
      },
      onMessage: {
        addListener: () => {}
      }
    },
    storage: {
      local: {
        get: (keys, cb) => {
          setTimeout(() => {
            if (chromeLastError) {
              cb(undefined);
            } else if (typeof keys === 'string') {
              cb({ [keys]: mockChromeStore.get(keys) });
            } else {
              cb(Object.fromEntries(mockChromeStore.entries()));
            }
          }, 5);
        },
        set: (items, cb) => {
          setTimeout(() => {
            if (chromeLastError) {
              cb(undefined);
            } else {
              for (const [k, v] of Object.entries(items)) {
                mockChromeStore.set(k, v);
              }
              cb();
            }
          }, 5);
        }
      }
    },
    tabs: {
      query: (info, cb) => {
        setTimeout(() => {
          if (chromeLastError) {
            cb(undefined);
          } else {
            cb([{ id: 99, active: true }]);
          }
        }, 5);
      },
      sendMessage: (tabId, msg, cb) => {
        setTimeout(() => {
          if (chromeLastError) {
            cb(undefined);
          } else {
            cb({ tabId, received: true });
          }
        }, 5);
      }
    },
    permissions: {
      contains: (perms, cb) => {
        setTimeout(() => {
          if (chromeLastError) {
            cb(undefined);
          } else {
            cb(perms.origins?.includes('https://valid.com/*') ?? false);
          }
        }, 5);
      },
      request: (perms, cb) => {
        setTimeout(() => {
          if (chromeLastError) {
            cb(undefined);
          } else {
            cb(true);
          }
        }, 5);
      }
    }
  };

  // 2.1 Happy path asynchronous callbacks
  await browserAPI.storage.local.set({ 'theme': 'dark', 'volume': 80 });
  const val1 = await browserAPI.storage.local.get('theme');
  assert(val1.theme === 'dark', 'Chrome callback storage.local.set & get works asynchronously');

  const tabsRes = await browserAPI.tabs.query({ active: true });
  assert(tabsRes.length === 1 && tabsRes[0].id === 99, 'Chrome callback tabs.query resolves async');

  const tabReply = await browserAPI.tabs.sendMessage(99, { ping: true });
  assert(tabReply.tabId === 99 && tabReply.received === true, 'Chrome callback tabs.sendMessage resolves async');

  const runReply = await browserAPI.runtime.sendMessage({ test: 123 });
  assert(runReply.reply === 'ok' && runReply.msg.test === 123, 'Chrome callback runtime.sendMessage resolves async');

  const permGranted = await browserAPI.permissions.contains({ origins: ['https://valid.com/*'] });
  assert(permGranted === true, 'Chrome callback permissions.contains evaluates true');

  const permDenied = await browserAPI.permissions.contains({ origins: ['https://unknown.com/*'] });
  assert(permDenied === false, 'Chrome callback permissions.contains evaluates false');

  // 2.2 Rejections via lastError ({ message: '...' })
  chromeLastError = { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' };
  let setQuotaError = null;
  try {
    await browserAPI.storage.local.set({ huge: 'data' });
  } catch (err) {
    setQuotaError = err;
  }
  assert(setQuotaError instanceof Error && setQuotaError.message === 'QUOTA_BYTES_PER_ITEM quota exceeded', 'storage.local.set rejects with Error on lastError');

  chromeLastError = { message: 'Could not read from storage backend' };
  let getError = null;
  try {
    await browserAPI.storage.local.get('theme');
  } catch (err) {
    getError = err;
  }
  assert(getError instanceof Error && getError.message === 'Could not read from storage backend', 'storage.local.get rejects with Error on lastError');

  chromeLastError = { message: 'Could not establish connection. Receiving end does not exist.' };
  let tabError = null;
  try {
    await browserAPI.tabs.sendMessage(999, { ping: true });
  } catch (err) {
    tabError = err;
  }
  assert(tabError instanceof Error && tabError.message.includes('Receiving end does not exist'), 'tabs.sendMessage rejects with Error on lastError');

  chromeLastError = { message: 'Runtime message port closed' };
  let runError = null;
  try {
    await browserAPI.runtime.sendMessage({ action: 'TEST' });
  } catch (err) {
    runError = err;
  }
  assert(runError instanceof Error && runError.message === 'Runtime message port closed', 'runtime.sendMessage rejects with Error on lastError');

  chromeLastError = { message: 'Permission query failed' };
  let permError = null;
  try {
    await browserAPI.permissions.contains({ origins: ['*'] });
  } catch (err) {
    permError = err;
  }
  assert(permError instanceof Error && permError.message === 'Permission query failed', 'permissions.contains rejects with Error on lastError');

  // 2.3 Rejection when lastError is primitive string or empty object
  chromeLastError = 'Raw string error in lastError';
  let rawStrError = null;
  try {
    await browserAPI.storage.local.get('theme');
  } catch (err) {
    rawStrError = err;
  }
  assert(rawStrError instanceof Error && rawStrError.message === 'Raw string error in lastError', 'Handles raw string in lastError');

  chromeLastError = null;

  // 2.4 Double-invocation guard: underlying API calls callback multiple times
  let doubleCallCount = 0;
  globalThis.chrome.storage.local.get = (keys, cb) => {
    doubleCallCount++;
    cb({ test: 'first' });
    cb({ test: 'second' }); // Rogue duplicate callback
  };

  const doubleRes = await browserAPI.storage.local.get('test');
  assert(doubleRes.test === 'first', 'settled flag prevents multiple resolutions from duplicate callbacks');

  // 2.5 Synchronous throw inside chrome API call
  globalThis.chrome.storage.local.get = () => {
    throw new TypeError('Invalid arguments to chrome.storage.local.get');
  };
  let syncError = null;
  try {
    await browserAPI.storage.local.get('bad');
  } catch (err) {
    syncError = err;
  }
  assert(syncError instanceof TypeError && syncError.message.includes('Invalid arguments'), 'Synchronous throw inside callback-style API is caught and rejected as Promise');

  delete globalThis.chrome;

  // --------------------------------------------------------------------------
  // SECTION 3: Firefox Native Promise Rejections & Edge Cases
  // --------------------------------------------------------------------------
  console.log('\n🧪 [Suite 3] Firefox Native Promise Environment (browser.* with Rejections)');

  globalThis.browser = {
    storage: {
      local: {
        get: async (keys) => {
          if (keys === 'crash') throw new Error('Firefox storage IndexedDB corrupted');
          if (keys === 'null-promise') return null;
          return { [keys]: 'firefox_value' };
        },
        set: async (items) => {
          if (items.crash) throw new Error('Firefox storage disk full');
        }
      }
    },
    tabs: {
      query: async (info) => {
        if (info.fail) throw new Error('Firefox tabs query rejected');
        return [{ id: 42, url: 'https://firefox.org' }];
      },
      sendMessage: async (tabId, msg) => {
        if (tabId === 0) throw new Error('Firefox no receiver tab');
        return { ffReceived: true, tabId };
      }
    },
    runtime: {
      sendMessage: async (msg) => {
        if (msg.error) throw new Error('Firefox runtime message failed');
        return { ffEcho: msg };
      },
      getURL: (p) => `moz-extension://uuid-42/${p}`,
      onMessage: { addListener: () => {} }
    },
    permissions: {
      contains: async (p) => {
        if (p.fail) throw new Error('Firefox permission check error');
        return false;
      },
      request: async (p) => {
        if (p.fail) throw new Error('Firefox permission request rejected by user');
        return false;
      }
    }
  };

  // 3.1 Successful calls
  const ffGet = await browserAPI.storage.local.get('key');
  assert(ffGet.key === 'firefox_value', 'Firefox storage.local.get resolves Promise');

  const ffNull = await browserAPI.storage.local.get('null-promise');
  assert(ffNull === null, 'Firefox storage.local.get passes through underlying promise resolution');

  // 3.2 Rejection handling in Firefox
  let ffStorageErr = null;
  try {
    await browserAPI.storage.local.get('crash');
  } catch (err) {
    ffStorageErr = err;
  }
  assert(ffStorageErr instanceof Error && ffStorageErr.message === 'Firefox storage IndexedDB corrupted', 'Firefox storage.local.get rejection propagates correctly');

  let ffSetErr = null;
  try {
    await browserAPI.storage.local.set({ crash: true });
  } catch (err) {
    ffSetErr = err;
  }
  assert(ffSetErr instanceof Error && ffSetErr.message === 'Firefox storage disk full', 'Firefox storage.local.set rejection propagates correctly');

  let ffTabErr = null;
  try {
    await browserAPI.tabs.sendMessage(0, { ping: true });
  } catch (err) {
    ffTabErr = err;
  }
  assert(ffTabErr instanceof Error && ffTabErr.message === 'Firefox no receiver tab', 'Firefox tabs.sendMessage rejection propagates correctly');

  let ffRunErr = null;
  try {
    await browserAPI.runtime.sendMessage({ error: true });
  } catch (err) {
    ffRunErr = err;
  }
  assert(ffRunErr instanceof Error && ffRunErr.message === 'Firefox runtime message failed', 'Firefox runtime.sendMessage rejection propagates correctly');

  let ffPermErr = null;
  try {
    await browserAPI.permissions.request({ fail: true });
  } catch (err) {
    ffPermErr = err;
  }
  assert(ffPermErr instanceof Error && ffPermErr.message.includes('rejected by user'), 'Firefox permissions.request rejection propagates correctly');

  delete globalThis.browser;

  // --------------------------------------------------------------------------
  // SECTION 4: High-Concurrency Storage Stress Testing
  // --------------------------------------------------------------------------
  console.log('\n🧪 [Suite 4] High-Concurrency Storage Stress Testing (Race Conditions)');

  // 4.1 Concurrent writes in pure Chrome callback mode (100 parallel operations)
  const concurrentStore = new Map();
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get: (keys, cb) => {
          setTimeout(() => {
            if (typeof keys === 'string') {
              cb({ [keys]: concurrentStore.get(keys) });
            } else {
              cb(Object.fromEntries(concurrentStore.entries()));
            }
          }, Math.floor(Math.random() * 5));
        },
        set: (items, cb) => {
          setTimeout(() => {
            for (const [k, v] of Object.entries(items)) {
              concurrentStore.set(k, v);
            }
            cb();
          }, Math.floor(Math.random() * 5));
        }
      }
    }
  };

  const CONCURRENCY_COUNT = 100;
  const writePromises = [];
  for (let i = 0; i < CONCURRENCY_COUNT; i++) {
    writePromises.push(browserAPI.storage.local.set({ [`item_${i}`]: i * 2 }));
  }
  await Promise.all(writePromises);
  assert(concurrentStore.size === CONCURRENCY_COUNT, `All ${CONCURRENCY_COUNT} concurrent writes succeeded in callback mode`);

  // 4.2 Interleaved concurrent reads and writes (50 sets + 50 gets running simultaneously)
  const mixedOps = [];
  for (let i = 0; i < 50; i++) {
    mixedOps.push(browserAPI.storage.local.set({ [`mixed_${i}`]: `value_${i}` }));
    mixedOps.push(browserAPI.storage.local.get(`item_${i}`));
  }
  const mixedResults = await Promise.all(mixedOps);
  assert(mixedResults.length === 100, '100 interleaved concurrent get/set operations completed without hangs');

  // 4.3 Concurrent operations with partial errors (isolated rejections)
  const partialFailingStore = new Map();
  let failOddKeys = true;
  globalThis.chrome.storage.local.set = (items, cb) => {
    setTimeout(() => {
      const keys = Object.keys(items);
      const isOdd = keys.some(k => k.includes('odd'));
      if (failOddKeys && isOdd) {
        globalThis.chrome.runtime.lastError = { message: 'Write failed for odd key' };
        cb();
        globalThis.chrome.runtime.lastError = null;
      } else {
        for (const [k, v] of Object.entries(items)) {
          partialFailingStore.set(k, v);
        }
        cb();
      }
    }, Math.floor(Math.random() * 3));
  };

  const concurrencyWithErrors = [];
  for (let i = 0; i < 20; i++) {
    const key = i % 2 === 0 ? `even_${i}` : `odd_${i}`;
    concurrencyWithErrors.push(
      browserAPI.storage.local.set({ [key]: i }).then(
        () => ({ key, status: 'resolved' }),
        (err) => ({ key, status: 'rejected', error: err.message })
      )
    );
  }

  const outcomes = await Promise.all(concurrencyWithErrors);
  const resolvedCount = outcomes.filter(o => o.status === 'resolved').length;
  const rejectedCount = outcomes.filter(o => o.status === 'rejected').length;

  assert(resolvedCount === 10 && rejectedCount === 10, 'Concurrency error isolation: exact 10 succeeded, 10 failed without leaking errors across operations');

  delete globalThis.chrome;

  // --------------------------------------------------------------------------
  // SECTION 5: background.js Adversarial Message Handling & webRequest
  // --------------------------------------------------------------------------
  console.log('\n🧪 [Suite 5] background.js Adversarial Message Handling & WebRequest');

  // We test the listeners registered by background.js
  let messageHandler = null;
  let headerHandler = null;

  globalThis.chrome = {
    webRequest: {
      onHeadersReceived: {
        addListener: (fn) => { headerHandler = fn; }
      }
    },
    runtime: {
      onMessage: {
        addListener: (fn) => { messageHandler = fn; }
      }
    }
  };

  // Import background.js with cache buster
  await import(`../background.js?adversarial=${Date.now()}`);

  assert(typeof messageHandler === 'function', 'background.js registered onMessage listener');

  // Helper to send message to background handler and await response
  function sendToBackground(msg, sender = {}) {
    return new Promise((resolve) => {
      let syncReturned = false;
      try {
        const ret = messageHandler(msg, sender, (response) => {
          resolve({ response, threw: null, syncReturned });
        });
        syncReturned = ret;
        // If handler did not return true (not keeping channel open) and didn't call sendResponse
        if (ret !== true) {
          setTimeout(() => resolve({ response: undefined, threw: null, syncReturned: ret }), 10);
        }
      } catch (err) {
        resolve({ response: undefined, threw: err, syncReturned });
      }
    });
  }

  // 5.1 Test null / undefined / primitive messages
  console.log('  Testing message boundary inputs against background.js:');
  const nullMsgRes = await sendToBackground(null);
  assert(nullMsgRes.threw === null, 'background onMessage handles null message without throwing uncaught exception', nullMsgRes.threw?.message);

  const undefMsgRes = await sendToBackground(undefined);
  assert(undefMsgRes.threw === null, 'background onMessage handles undefined message without throwing uncaught exception', undefMsgRes.threw?.message);

  const stringMsgRes = await sendToBackground('PING');
  assert(stringMsgRes.threw === null, 'background onMessage handles string primitive without throwing', stringMsgRes.threw?.message);

  const numMsgRes = await sendToBackground(42);
  assert(numMsgRes.threw === null, 'background onMessage handles number primitive without throwing', numMsgRes.threw?.message);

  const emptyObjRes = await sendToBackground({});
  assert(emptyObjRes.threw === null, 'background onMessage handles empty object {} without throwing', emptyObjRes.threw?.message);

  const otherTypeRes = await sendToBackground({ type: 'SOME_OTHER_EVENT' });
  assert(otherTypeRes.threw === null, 'background onMessage ignores unknown message type safely', otherTypeRes.threw?.message);

  // 5.2 Test PROXY_FETCH with malformed / extreme payloads
  // Mock global fetch to simulate network states
  const originalFetch = globalThis.fetch;

  // Case A: Missing URL
  globalThis.fetch = async (url) => {
    if (url === undefined || url === null || url === '') {
      throw new TypeError(`Failed to parse URL from ${url}`);
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '{"mock":true}',
    };
  };

  const missingUrlRes = await sendToBackground({ type: 'PROXY_FETCH' });
  assert(missingUrlRes.response?.success === false, 'PROXY_FETCH with missing URL returns success: false');
  assert(typeof missingUrlRes.response?.error === 'string', 'PROXY_FETCH with missing URL returns descriptive error');

  const nullUrlRes = await sendToBackground({ type: 'PROXY_FETCH', url: null });
  assert(nullUrlRes.response?.success === false, 'PROXY_FETCH with null URL returns success: false');

  // Case B: Non-JSON response (e.g. 500 HTML error page)
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => '<!DOCTYPE html><html><body>Error 500</body></html>'
  });

  const html500Res = await sendToBackground({ type: 'PROXY_FETCH', url: 'https://api.thegamesdb.net/test' });
  assert(html500Res.response?.success === true, 'PROXY_FETCH with non-JSON 500 response still succeeds as response delivery');
  assert(html500Res.response?.ok === false && html500Res.response?.status === 500, 'PROXY_FETCH passes status 500 and ok: false');
  assert(html500Res.response?.json === null, 'PROXY_FETCH sets json: null for HTML responses without throwing');
  assert(html500Res.response?.text.includes('Error 500'), 'PROXY_FETCH passes raw HTML text correctly');

  // Case C: Network exception (DNS failure, offline, CORS)
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch: NetworkError when attempting to fetch resource.');
  };

  const netErrRes = await sendToBackground({ type: 'PROXY_FETCH', url: 'https://api.themoviedb.org/3/movie/550' });
  assert(netErrRes.response?.success === false, 'PROXY_FETCH on network failure returns success: false');
  assert(netErrRes.response?.error.includes('NetworkError'), 'PROXY_FETCH passes original error message');

  // Case D: Stream read error during res.text()
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => { throw new Error('Stream terminated prematurely by server'); }
  });

  const streamErrRes = await sendToBackground({ type: 'PROXY_FETCH', url: 'https://api.notion.com/v1/pages' });
  assert(streamErrRes.response?.success === false, 'PROXY_FETCH handles stream read error gracefully');
  assert(streamErrRes.response?.error.includes('Stream terminated'), 'PROXY_FETCH conveys stream error message');

  // Restore fetch
  globalThis.fetch = originalFetch;

  // 5.3 Test webRequest.onHeadersReceived edge cases
  if (headerHandler) {
    console.log('  Testing webRequest header handler boundary inputs:');
    let nullDetailsThrew = false;
    try {
      headerHandler(null);
    } catch {
      nullDetailsThrew = true;
    }
    assert(!nullDetailsThrew, 'webRequest onHeadersReceived handles null details object without crashing');

    let malformedHeaderThrew = false;
    let handledHeaders = null;
    try {
      handledHeaders = headerHandler({ responseHeaders: [{ value: 'no-name' }, { name: 'ACCESS-CONTROL-ALLOW-ORIGIN', value: '*' }] });
    } catch {
      malformedHeaderThrew = true;
    }
    assert(!malformedHeaderThrew, 'webRequest onHeadersReceived handles header without name property without crashing');
  }

  delete globalThis.chrome;
  delete globalThis.browser;

  // --------------------------------------------------------------------------
  // SECTION 6: safeFetch Robustness & Fallback Chains
  // --------------------------------------------------------------------------
  console.log('\n🧪 [Suite 6] safeFetch Robustness & Fallback Edge Cases');

  // Case 6.1: Direct fetch succeeds -> safeFetch returns native Response
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '{"direct":true}',
    json: async () => ({ direct: true })
  });

  const directRes = await safeFetch('https://direct.com/data');
  const directJson = await directRes.json();
  assert(directJson.direct === true, 'safeFetch uses direct fetch when successful');

  // Case 6.2: Direct fetch fails, background proxy returns success: false
  globalThis.fetch = async () => {
    throw new TypeError('Blocked by CORS');
  };

  globalThis.chrome = {
    runtime: {
      sendMessage: (msg, cb) => {
        cb({ success: false, ok: false, error: 'Target API 401 Unauthorized' });
      }
    }
  };

  let proxyError = null;
  try {
    await safeFetch('https://blocked.com/data');
  } catch (err) {
    proxyError = err;
  }
  assert(proxyError instanceof Error && proxyError.message.includes('Target API 401 Unauthorized'), 'safeFetch propagates proxy error message when proxy reports success: false');

  // Case 6.3: Direct fetch fails, background proxy returns null (no listener)
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    cb(null);
  };

  let nullProxyErr = null;
  try {
    await safeFetch('https://blocked.com/data');
  } catch (err) {
    nullProxyErr = err;
  }
  assert(nullProxyErr instanceof Error && nullProxyErr.message.includes('Blocked by CORS'), 'safeFetch preserves original error when proxy returns null');

  // Case 6.4: Direct fetch fails, browserAPI.runtime.sendMessage throws/rejects
  globalThis.chrome.runtime.lastError = { message: 'Extension context invalidated' };
  globalThis.chrome.runtime.sendMessage = (msg, cb) => {
    cb(undefined);
  };

  let rejectedProxyErr = null;
  try {
    await safeFetch('https://blocked.com/data');
  } catch (err) {
    rejectedProxyErr = err;
  }
  assert(rejectedProxyErr instanceof Error && rejectedProxyErr.message.includes('Extension context invalidated'), 'safeFetch propagates extension context error');

  // Restore
  globalThis.fetch = originalFetch;
  delete globalThis.chrome;

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TOTAL ADVERSARIAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('\nFAILURES SUMMARY:');
    for (const f of failures) {
      console.error(`- ${f.message}${f.errorDetail ? ` (${f.errorDetail})` : ''}`);
    }
    process.exit(1);
  } else {
    console.log('🎉 ALL ADVERSARIAL STRESS & COMPATIBILITY CHECKS PASSED!');
    process.exit(0);
  }
}

testSuite().catch((err) => {
  console.error('Fatal unhandled error in test suite:', err);
  process.exit(1);
});
