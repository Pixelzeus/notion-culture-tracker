// test/e2e/e2e-runner.js
// Master test runner for Notion Culture Tracker E2E Test Suite (Tiers 1-4)

import { registerTier1Tests } from './tiers/tier1-feature-coverage.test.js';
import { registerTier2Tests } from './tiers/tier2-boundary-corner.test.js';
import { registerTier3Tests } from './tiers/tier3-pairwise-combinations.test.js';
import { registerTier4Tests } from './tiers/tier4-real-world-workflows.test.js';

async function main() {
  console.log('======================================================================');
  console.log('🚀 NOTION CULTURE TRACKER — E2E TEST SUITE RUNNER');
  console.log('   Methodology: 4-Tier Opaque-Box Coverage (Tiers 1-4)');
  console.log('   Target: 13 Core Features across Chrome, Firefox & Safari');
  console.log('======================================================================');

  const suite1 = registerTier1Tests();
  const suite2 = registerTier2Tests();
  const suite3 = registerTier3Tests();
  const suite4 = registerTier4Tests();

  const suites = [suite1, suite2, suite3, suite4];
  const results = [];
  const globalStart = Date.now();

  for (const suite of suites) {
    const res = await suite.run(true);
    results.push(res);
  }

  const globalDuration = Date.now() - globalStart;
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

  console.log('\n======================================================================');
  console.log('📊 E2E TEST EXECUTION SUMMARY');
  console.log('======================================================================');
  for (const r of results) {
    const icon = r.failed === 0 ? '✅' : '❌';
    console.log(`  ${icon} ${r.name.padEnd(65)} : ${String(r.passed).padStart(3)} passed, ${String(r.failed).padStart(2)} failed, ${String(r.skipped).padStart(2)} skipped (${r.durationMs}ms)`);
  }
  console.log('----------------------------------------------------------------------');
  console.log(`TOTALS: ${totalTests} tests executed in ${globalDuration}ms`);
  console.log(`PASSED: ${totalPassed} | FAILED: ${totalFailed} | SKIPPED: ${totalSkipped}`);
  console.log('======================================================================');

  if (totalFailed > 0) {
    console.error('\n❌ TEST RUN FAILED with failures:');
    for (const r of results) {
      if (r.failures.length > 0) {
        console.error(`\nSuite: ${r.name}`);
        for (const f of r.failures) {
          console.error(`  - ${f.description}: ${f.error.message}`);
        }
      }
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL E2E TESTS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
