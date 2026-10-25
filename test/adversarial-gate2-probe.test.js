// test/adversarial-gate2-probe.test.js
// Independent Empirical Stress Probe by Challenger 2

let total = 0;
let passed = 0;
let failed = 0;

function check(cond, desc) {
  total++;
  if (cond) {
    passed++;
    console.log(`  ✅ PASS: ${desc}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${desc}`);
  }
}

async function runProbes() {
  console.log('================================================================');
  console.log('⚡ INDEPENDENT EMPIRICAL CHALLENGER PROBE (GATE 2 RE-CHECK)');
  console.log('================================================================\n');

  let headerCb = null;
  let msgCb = null;

  globalThis.browser = {
    webRequest: {
      onHeadersReceived: {
        addListener: (cb) => { headerCb = cb; }
      }
    },
    runtime: {
      onMessage: {
        addListener: (cb) => { msgCb = cb; }
      }
    }
  };

  // Import background
  await import(`../background.js?gate2probe=${Date.now()}`);

  console.log('🧪 1. Testing background.js onHeadersReceived:');

  const headerCases = [
    { name: 'null details', input: null, expectedLength: 0 },
    { name: 'undefined details', input: undefined, expectedLength: 0 },
    { name: 'empty details object {}', input: {}, expectedLength: 0 },
    { name: 'null responseHeaders', input: { responseHeaders: null }, expectedLength: 0 },
    { name: 'undefined responseHeaders', input: { responseHeaders: undefined }, expectedLength: 0 },
    { name: 'empty array []', input: { responseHeaders: [] }, expectedLength: 1, expectAcao: true },
    { name: 'array with null and undefined headers', input: { responseHeaders: [null, undefined, {}] }, expectedLength: 4, expectAcao: true },
    { name: 'existing lowercase acao', input: { responseHeaders: [{ name: 'access-control-allow-origin', value: '*' }] }, expectedLength: 1, expectAcao: true },
    { name: 'existing uppercase acao', input: { responseHeaders: [{ name: 'ACCESS-CONTROL-ALLOW-ORIGIN', value: 'https://foo.com' }] }, expectedLength: 1, expectAcao: true },
    { name: 'existing mixed case acao with other headers', input: { responseHeaders: [{ name: 'Content-Type', value: 'text/html' }, { name: 'Access-Control-Allow-Origin', value: '*' }] }, expectedLength: 2, expectAcao: true },
    { name: 'header with missing name property', input: { responseHeaders: [{ value: 'no-name' }] }, expectedLength: 2, expectAcao: true }
  ];

  for (const tc of headerCases) {
    try {
      const res = headerCb(tc.input);
      const isArr = res && Array.isArray(res.responseHeaders);
      const lenMatch = isArr && res.responseHeaders.length === tc.expectedLength;
      let acaoOk = true;
      if (tc.expectAcao) {
        acaoOk = res.responseHeaders.some(h => (h?.name || '').toLowerCase() === 'access-control-allow-origin');
      }
      check(isArr && lenMatch && acaoOk, `Header case: ${tc.name}`);
    } catch (err) {
      check(false, `Header case: ${tc.name} threw ${err.message}`);
    }
  }

  console.log('\n🧪 2. Testing background.js onMessage with non-matching messages:');

  const nonMatchingMessages = [
    { name: 'null', val: null },
    { name: 'undefined', val: undefined },
    { name: 'false', val: false },
    { name: 'true', val: true },
    { name: '0', val: 0 },
    { name: '42', val: 42 },
    { name: 'NaN', val: NaN },
    { name: 'empty string', val: '' },
    { name: 'random string', val: 'FOOBAR' },
    { name: 'empty object {}', val: {} },
    { name: 'object without type', val: { payload: 'test' } },
    { name: 'object with wrong type', val: { type: 'NOT_PROXY_FETCH' } },
    { name: 'Object.create(null)', val: Object.create(null) },
    { name: 'array [1, 2, 3]', val: [1, 2, 3] }
  ];

  for (const tc of nonMatchingMessages) {
    try {
      let sendResponseInvoked = false;
      const ret = msgCb(tc.val, {}, () => { sendResponseInvoked = true; });
      check(ret !== true && !sendResponseInvoked, `Non-matching message: ${tc.name} does not open channel`);
    } catch (err) {
      check(false, `Non-matching message: ${tc.name} threw ${err.message}`);
    }
  }

  console.log('\n🧪 3. Testing background.js PROXY_FETCH operations:');

  const proxyScenarios = [
    {
      name: 'Standard JSON 200 response',
      msg: { type: 'PROXY_FETCH', url: 'https://api.test/data' },
      mock: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ item: 'value', count: 1 })
      }),
      validate: (r) => r.success === true && r.ok === true && r.json?.item === 'value' && r.status === 200
    },
    {
      name: '204 No Content with empty body and null options',
      msg: { type: 'PROXY_FETCH', url: 'https://api.test/empty', options: null },
      mock: async () => ({
        ok: true,
        status: 204,
        statusText: 'No Content',
        text: async () => ''
      }),
      validate: (r) => r.success === true && r.ok === true && r.json === null && r.text === ''
    },
    {
      name: '500 Server Error with HTML body',
      msg: { type: 'PROXY_FETCH', url: 'https://api.test/error500' },
      mock: async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Error',
        text: async () => '<html><body>Internal Server Error</body></html>'
      }),
      validate: (r) => r.success === true && r.ok === false && r.status === 500 && r.json === null && r.text.includes('Internal')
    },
    {
      name: 'Network offline TypeError',
      msg: { type: 'PROXY_FETCH', url: 'https://api.test/offline' },
      mock: async () => { throw new TypeError('Failed to fetch'); },
      validate: (r) => r.success === false && r.ok === false && r.error.includes('Failed to fetch')
    },
    {
      name: 'Text decode abort error',
      msg: { type: 'PROXY_FETCH', url: 'https://api.test/abort' },
      mock: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => { throw new Error('Stream reset by peer'); }
      }),
      validate: (r) => r.success === false && r.ok === false && r.error.includes('Stream reset')
    }
  ];

  for (const tc of proxyScenarios) {
    try {
      globalThis.fetch = tc.mock;
      const result = await new Promise((resolve) => {
        const ret = msgCb(tc.msg, {}, (res) => resolve({ ret, res }));
      });
      const retOk = result.ret === true;
      const valOk = tc.validate(result.res);
      check(retOk && valOk, `Proxy scenario: ${tc.name}`);
    } catch (err) {
      check(false, `Proxy scenario: ${tc.name} threw ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL PROBE TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runProbes().catch((err) => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});
