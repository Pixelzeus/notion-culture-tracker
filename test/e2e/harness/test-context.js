// test/e2e/harness/test-context.js
// Lightweight, zero-dependency test harness and assertion library for E2E testing

class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.beforeEachFns = [];
    this.afterEachFns = [];
  }

  beforeEach(fn) {
    this.beforeEachFns.push(fn);
  }

  afterEach(fn) {
    this.afterEachFns.push(fn);
  }

  it(description, testFn) {
    this.tests.push({ description, testFn });
  }

  async run(verbose = true) {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failures = [];
    const startTime = Date.now();

    if (verbose) {
      console.log(`\n📦 Suite: ${this.name}`);
    }

    for (const test of this.tests) {
      const testStart = Date.now();
      try {
        for (const hook of this.beforeEachFns) {
          await hook();
        }

        let result = test.testFn();
        if (result && typeof result.then === 'function') {
          result = await result;
        }

        if (result && result.skipped) {
          skipped++;
          if (verbose) {
            console.log(`  🟡 SKIP: ${test.description} (${result.reason || 'Pending'})`);
          }
        } else {
          passed++;
          const duration = Date.now() - testStart;
          if (verbose) {
            console.log(`  ✅ PASS: ${test.description} (${duration}ms)`);
          }
        }
      } catch (err) {
        failed++;
        const duration = Date.now() - testStart;
        failures.push({ description: test.description, error: err });
        if (verbose) {
          console.error(`  ❌ FAIL: ${test.description} (${duration}ms)`);
          console.error(`     Error: ${err.message}`);
          if (err.stack) {
            const firstStack = err.stack.split('\n').slice(1, 3).join('\n');
            console.error(`     ${firstStack}`);
          }
        }
      } finally {
        for (const hook of this.afterEachFns) {
          try {
            await hook();
          } catch (e) {
            console.error(`     Error in afterEach hook: ${e.message}`);
          }
        }
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      name: this.name,
      total: this.tests.length,
      passed,
      failed,
      skipped,
      durationMs,
      failures
    };
  }
}

export function createSuite(name) {
  return new TestSuite(name);
}

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

export function assertNotEqual(actual, expected, message = '') {
  if (actual === expected) {
    throw new Error(`${message ? message + ': ' : ''}Expected value to NOT equal ${JSON.stringify(expected)}`);
  }
}

export function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message ? message + ': ' : ''}Deep equality mismatch:\nActual:   ${actualStr}\nExpected: ${expectedStr}`);
  }
}

export function assertIncludes(haystack, needle, message = '') {
  if (typeof haystack === 'string') {
    if (!haystack.includes(needle)) {
      throw new Error(`${message ? message + ': ' : ''}Expected string to contain "${needle}"`);
    }
  } else if (Array.isArray(haystack)) {
    if (!haystack.includes(needle)) {
      throw new Error(`${message ? message + ': ' : ''}Expected array to contain item ${JSON.stringify(needle)}`);
    }
  } else if (haystack && typeof haystack === 'object') {
    if (!(needle in haystack)) {
      throw new Error(`${message ? message + ': ' : ''}Expected object to contain property "${needle}"`);
    }
  } else {
    throw new Error(`${message ? message + ': ' : ''}Cannot check includes on non-collection`);
  }
}

export function assertMatches(str, regex, message = '') {
  if (!regex.test(str)) {
    throw new Error(`${message ? message + ': ' : ''}Expected "${str}" to match ${regex}`);
  }
}

export async function assertThrows(fn, message = 'Expected function to throw') {
  let threw = false;
  let caughtError = null;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
  } catch (err) {
    threw = true;
    caughtError = err;
  }
  if (!threw) {
    throw new Error(message);
  }
  return caughtError;
}

export function skip(reason = '') {
  return { skipped: true, reason };
}
