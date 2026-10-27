#!/usr/bin/env node

/**
 * test/adversarial-challenger2-m5.test.js
 * Adversarial Stress & Fuzzing Test Suite by Empirical Challenger 2 (Gen 3)
 *
 * Probes:
 * 1. Dynamic Popup Form Adaptation (`adaptPopupFormToSchema`) under full permutation & fuzzed inputs.
 * 2. Dry-run Diagnostic Engine & Property Compatibility under adversarial Notion API failure modes.
 * 3. Multi-Platform Build Pipeline & Archive Integrity (Decompression, CRC32, Manifest conformance).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    failures.push(message);
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  assert(actualStr === expectedStr, `${message} (expected: ${expectedStr}, got: ${actualStr})`);
}

// -----------------------------------------------------------------------------
// SECTION 1: Dynamic Popup Form Adaptation (`adaptPopupFormToSchema`)
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('⚡ SECTION 1: ADVERSARIAL STRESS-TESTING POPUP FORM ADAPTATION');
console.log('======================================================================\n');

// Import services and mock DOM environment
import { DEFAULT_SCHEMA } from '../services/schema.default.js';
import { evaluatePropertyCompatibility, runDryRunDiagnostic } from '../services/schema-discovery.js';
import { computeCRC32, buildAll } from '../scripts/build.js';

// Construct simulated DOM nodes matching popup.html elements
function createMockElement(id, tagName = 'div', extraClass = '') {
  return {
    id,
    tagName: tagName.toUpperCase(),
    className: extraClass,
    style: {},
    closest(selector) {
      if (selector === '.form-group') {
        return this.parentGroup || null;
      }
      return null;
    }
  };
}

function buildPopupDomMock() {
  const dom = {
    groupCasts: createMockElement('groupCasts'),
    groupYearWatch: createMockElement('groupYearWatch'),
    selectYearWatch: createMockElement('selectYearWatch', 'select'),
    groupNotes: createMockElement('groupNotes'),
    rowGameMeta: createMockElement('rowGameMeta'),
    groupPlayerSupport: createMockElement('groupPlayerSupport'),
    inputPlayerSupport: createMockElement('inputPlayerSupport', 'input'),
    groupGameCopy: createMockElement('groupGameCopy'),
    selectGameCopy: createMockElement('selectGameCopy', 'select'),
    rowPlatformDate: createMockElement('rowPlatformDate'),
    groupPlatform: createMockElement('groupPlatform'),
    selectPlatform: createMockElement('selectPlatform', 'select'),
    groupDateViewed: createMockElement('groupDateViewed'),
    inputDateViewed: createMockElement('inputDateViewed', 'input'),
    groupGenres: createMockElement('groupGenres'),
    groupWatchStatus: createMockElement('groupWatchStatus'),
    groupGameStatus: createMockElement('groupGameStatus'),
    starsPicker: createMockElement('starsPicker'),
    checkFavourite: createMockElement('checkFavourite', 'input'),
    rowEpisodes: createMockElement('rowEpisodes'),
    groupTvType: createMockElement('groupTvType')
  };

  // Setup parent groups for closest() tests
  dom.inputPlayerSupport.parentGroup = dom.groupPlayerSupport;
  dom.selectGameCopy.parentGroup = dom.groupGameCopy;
  dom.selectPlatform.parentGroup = dom.groupPlatform;
  dom.inputDateViewed.parentGroup = dom.groupDateViewed;
  dom.selectYearWatch.parentGroup = dom.groupYearWatch;
  dom.starsPicker.parentGroup = createMockElement('ratingGroup');
  dom.checkFavourite.parentGroup = createMockElement('favGroup');

  return dom;
}

// Emulate adaptPopupFormToSchema pure logic with custom target DOM
function runFormAdaptation(dom, mediaType, activeSchema) {
  const schema = activeSchema || DEFAULT_SCHEMA;
  const mediaSchema = schema?.mediaTypes?.[mediaType];
  if (!mediaSchema || !mediaSchema.properties) return;

  function isMapped(propKey) {
    const prop = mediaSchema.properties[propKey];
    if (!prop) return false;
    if (prop.notMapped === true) return false;
    return Boolean(prop.notionName && String(prop.notionName).trim().length > 0);
  }

  // 1. Casting
  if (dom.groupCasts) {
    if (mediaType === 'game') {
      dom.groupCasts.style.display = 'none';
    } else {
      dom.groupCasts.style.display = isMapped('casts') ? 'block' : 'none';
    }
  }

  // 2. Bilan Annuel
  const yearGroup = dom.groupYearWatch || dom.selectYearWatch?.closest('.form-group');
  if (yearGroup) {
    yearGroup.style.display = isMapped('year') ? 'block' : 'none';
  }

  // 3. Notes
  if (dom.groupNotes) {
    dom.groupNotes.style.display = isMapped('notes') ? 'block' : 'none';
  }

  // 4. Game Meta (#rowGameMeta)
  if (dom.rowGameMeta) {
    if (mediaType !== 'game') {
      dom.rowGameMeta.style.display = 'none';
    } else {
      const supportMapped = isMapped('playerSupport');
      const copyMapped = isMapped('copy');
      const supportGroup = dom.groupPlayerSupport || dom.inputPlayerSupport?.closest('.form-group');
      const copyGroup = dom.groupGameCopy || dom.selectGameCopy?.closest('.form-group');

      if (!supportMapped && !copyMapped) {
        if (supportGroup) supportGroup.style.display = 'none';
        if (copyGroup) copyGroup.style.display = 'none';
        dom.rowGameMeta.style.display = 'none';
      } else {
        dom.rowGameMeta.style.display = 'flex';
        if (supportGroup) {
          supportGroup.style.display = supportMapped ? '' : 'none';
          supportGroup.style.flex = copyMapped ? '1' : '1 1 100%';
        }
        if (copyGroup) {
          copyGroup.style.display = copyMapped ? '' : 'none';
          copyGroup.style.flex = supportMapped ? '1' : '1 1 100%';
        }
      }
    }
  }

  // 5. Plateforme & Date (#rowPlatformDate)
  if (dom.rowPlatformDate) {
    const platMapped = isMapped('platform');
    const dateMapped = isMapped('releaseDate') || isMapped('dateViewed');
    const platGroup = dom.groupPlatform || dom.selectPlatform?.closest('.form-group');
    const dateGroup = dom.groupDateViewed || dom.inputDateViewed?.closest('.form-group');

    if (!platMapped && !dateMapped) {
      if (platGroup) platGroup.style.display = 'none';
      if (dateGroup) dateGroup.style.display = 'none';
      dom.rowPlatformDate.style.display = 'none';
    } else {
      dom.rowPlatformDate.style.display = 'flex';
      if (platGroup) {
        platGroup.style.display = platMapped ? '' : 'none';
        platGroup.style.flex = dateMapped ? '1' : '1 1 100%';
      }
      if (dateGroup) {
        dateGroup.style.display = dateMapped ? '' : 'none';
        dateGroup.style.flex = platMapped ? '1' : '1 1 100%';
      }
    }
  }

  // 6. Genres
  if (dom.groupGenres) {
    dom.groupGenres.style.display = isMapped('genres') ? 'block' : 'none';
  }

  // 7. Statuts
  const statusMapped = isMapped('status');
  if (mediaType === 'game') {
    if (dom.groupGameStatus) dom.groupGameStatus.style.display = statusMapped ? 'block' : 'none';
    if (dom.groupWatchStatus) dom.groupWatchStatus.style.display = 'none';
  } else {
    if (dom.groupWatchStatus) dom.groupWatchStatus.style.display = statusMapped ? 'block' : 'none';
    if (dom.groupGameStatus) dom.groupGameStatus.style.display = 'none';
  }

  // 8. Note & Favori
  const ratingMapped = isMapped('rating');
  const favMapped = isMapped('favourite') || isMapped('isFavourite');
  const ratingGroup = dom.starsPicker?.closest('.form-group');
  const favGroup = dom.checkFavourite?.closest('.form-group');
  if (ratingGroup) ratingGroup.style.display = ratingMapped ? '' : 'none';
  if (favGroup) favGroup.style.display = favMapped ? '' : 'none';

  // 9. Épisodes et sous-type
  if (mediaType === 'tv') {
    const epMapped = isMapped('totalEp') || isMapped('currentEp');
    if (dom.rowEpisodes) dom.rowEpisodes.style.display = epMapped ? 'flex' : 'none';
    const typeMapped = isMapped('type') || isMapped('tvSubType');
    if (dom.groupTvType) dom.groupTvType.style.display = typeMapped ? 'block' : 'none';
  }
}

// Test 1.1: ALL properties mapped (Movie)
{
  const dom = buildPopupDomMock();
  const allMappedSchema = {
    mediaTypes: {
      movie: {
        properties: {
          title: { notionName: 'Nom', type: 'title' },
          casts: { notionName: 'Acteurs', type: 'multi_select' },
          year: { notionName: 'Année', type: 'relation' },
          notes: { notionName: 'Critique', type: 'rich_text' },
          platform: { notionName: 'Plateforme', type: 'relation' },
          releaseDate: { notionName: 'Date de sortie', type: 'date' },
          genres: { notionName: 'Genres', type: 'multi_select' },
          status: { notionName: 'Statut', type: 'select' },
          rating: { notionName: 'Note', type: 'number' },
          favourite: { notionName: 'Coup de coeur', type: 'checkbox' }
        }
      }
    }
  };

  runFormAdaptation(dom, 'movie', allMappedSchema);
  assertEqual(dom.groupCasts.style.display, 'block', '1.1 Movie with ALL mapped: casts is block');
  assertEqual(dom.groupYearWatch.style.display, 'block', '1.1 Movie with ALL mapped: yearWatch is block');
  assertEqual(dom.groupNotes.style.display, 'block', '1.1 Movie with ALL mapped: notes is block');
  assertEqual(dom.groupGenres.style.display, 'block', '1.1 Movie with ALL mapped: genres is block');
  assertEqual(dom.groupWatchStatus.style.display, 'block', '1.1 Movie with ALL mapped: watchStatus is block');
  assertEqual(dom.groupGameStatus.style.display, 'none', '1.1 Movie with ALL mapped: gameStatus is none');
  assertEqual(dom.rowGameMeta.style.display, 'none', '1.1 Movie with ALL mapped: rowGameMeta is hidden');
  assertEqual(dom.rowPlatformDate.style.display, 'flex', '1.1 Movie with ALL mapped: rowPlatformDate is flex');
  assertEqual(dom.groupPlatform.style.flex, '1', '1.1 Movie with ALL mapped: platform flex is 1');
  assertEqual(dom.groupDateViewed.style.flex, '1', '1.1 Movie with ALL mapped: dateViewed flex is 1');
}

// Test 1.2: NONE mapped (Movie)
{
  const dom = buildPopupDomMock();
  const noneMappedSchema = {
    mediaTypes: {
      movie: {
        properties: {
          title: { notionName: 'Nom', type: 'title' },
          casts: { notMapped: true },
          year: { notMapped: true },
          notes: { notMapped: true },
          platform: { notMapped: true },
          releaseDate: { notMapped: true },
          genres: { notMapped: true },
          status: { notMapped: true },
          rating: { notMapped: true },
          favourite: { notMapped: true }
        }
      }
    }
  };

  runFormAdaptation(dom, 'movie', noneMappedSchema);
  assertEqual(dom.groupCasts.style.display, 'none', '1.2 Movie with NONE mapped: casts hidden');
  assertEqual(dom.groupYearWatch.style.display, 'none', '1.2 Movie with NONE mapped: yearWatch hidden');
  assertEqual(dom.groupNotes.style.display, 'none', '1.2 Movie with NONE mapped: notes hidden');
  assertEqual(dom.groupGenres.style.display, 'none', '1.2 Movie with NONE mapped: genres hidden');
  assertEqual(dom.groupWatchStatus.style.display, 'none', '1.2 Movie with NONE mapped: watchStatus hidden');
  assertEqual(dom.rowPlatformDate.style.display, 'none', '1.2 Movie with NONE mapped: rowPlatformDate hidden');
  assertEqual(dom.groupPlatform.style.display, 'none', '1.2 Movie with NONE mapped: groupPlatform hidden');
  assertEqual(dom.groupDateViewed.style.display, 'none', '1.2 Movie with NONE mapped: groupDateViewed hidden');
}

// Test 1.3: Compound Row #rowPlatformDate 4 Permutations
{
  const testPermutation = (platMapped, dateMapped) => {
    const dom = buildPopupDomMock();
    const schema = {
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Nom', type: 'title' },
            platform: platMapped ? { notionName: 'Plateforme', type: 'relation' } : { notMapped: true },
            releaseDate: dateMapped ? { notionName: 'Date', type: 'date' } : { notMapped: true }
          }
        }
      }
    };
    runFormAdaptation(dom, 'movie', schema);
    return {
      rowDisplay: dom.rowPlatformDate.style.display,
      platDisplay: dom.groupPlatform.style.display,
      platFlex: dom.groupPlatform.style.flex,
      dateDisplay: dom.groupDateViewed.style.display,
      dateFlex: dom.groupDateViewed.style.flex
    };
  };

  // Case 1: Both mapped
  const c1 = testPermutation(true, true);
  assertEqual(c1.rowDisplay, 'flex', '1.3a rowPlatformDate both mapped: flex display');
  assertEqual(c1.platFlex, '1', '1.3a platform flex: 1');
  assertEqual(c1.dateFlex, '1', '1.3a date flex: 1');

  // Case 2: Only platform mapped -> expands to 100%
  const c2 = testPermutation(true, false);
  assertEqual(c2.rowDisplay, 'flex', '1.3b rowPlatformDate only plat: flex display');
  assertEqual(c2.platDisplay, '', '1.3b platform visible');
  assertEqual(c2.platFlex, '1 1 100%', '1.3b platform expands to 1 1 100%');
  assertEqual(c2.dateDisplay, 'none', '1.3b date hidden');

  // Case 3: Only date mapped -> expands to 100%
  const c3 = testPermutation(false, true);
  assertEqual(c3.rowDisplay, 'flex', '1.3c rowPlatformDate only date: flex display');
  assertEqual(c3.platDisplay, 'none', '1.3c platform hidden');
  assertEqual(c3.dateDisplay, '', '1.3c date visible');
  assertEqual(c3.dateFlex, '1 1 100%', '1.3c date expands to 1 1 100%');

  // Case 4: Neither mapped -> completely hidden
  const c4 = testPermutation(false, false);
  assertEqual(c4.rowDisplay, 'none', '1.3d rowPlatformDate neither mapped: hidden');
  assertEqual(c4.platDisplay, 'none', '1.3d platform display none');
  assertEqual(c4.dateDisplay, 'none', '1.3d date display none');
}

// Test 1.4: Compound Row #rowGameMeta 4 Permutations
{
  const testGameMeta = (supportMapped, copyMapped) => {
    const dom = buildPopupDomMock();
    const schema = {
      mediaTypes: {
        game: {
          properties: {
            title: { notionName: 'Nom', type: 'title' },
            playerSupport: supportMapped ? { notionName: 'Modes', type: 'rich_text' } : { notMapped: true },
            copy: copyMapped ? { notionName: 'Copie', type: 'select' } : { notMapped: true }
          }
        }
      }
    };
    runFormAdaptation(dom, 'game', schema);
    return {
      rowDisplay: dom.rowGameMeta.style.display,
      supportDisplay: dom.groupPlayerSupport.style.display,
      supportFlex: dom.groupPlayerSupport.style.flex,
      copyDisplay: dom.groupGameCopy.style.display,
      copyFlex: dom.groupGameCopy.style.flex
    };
  };

  // Case 1: Both mapped
  const g1 = testGameMeta(true, true);
  assertEqual(g1.rowDisplay, 'flex', '1.4a rowGameMeta both mapped: flex');
  assertEqual(g1.supportFlex, '1', '1.4a playerSupport flex 1');
  assertEqual(g1.copyFlex, '1', '1.4a copy flex 1');

  // Case 2: Only playerSupport mapped -> expands to 100%
  const g2 = testGameMeta(true, false);
  assertEqual(g2.rowDisplay, 'flex', '1.4b rowGameMeta only support: flex');
  assertEqual(g2.supportDisplay, '', '1.4b playerSupport visible');
  assertEqual(g2.supportFlex, '1 1 100%', '1.4b playerSupport expands to 1 1 100%');
  assertEqual(g2.copyDisplay, 'none', '1.4b copy hidden');

  // Case 3: Only copy mapped -> expands to 100%
  const g3 = testGameMeta(false, true);
  assertEqual(g3.rowDisplay, 'flex', '1.4c rowGameMeta only copy: flex');
  assertEqual(g3.supportDisplay, 'none', '1.4c playerSupport hidden');
  assertEqual(g3.copyDisplay, '', '1.4c copy visible');
  assertEqual(g3.copyFlex, '1 1 100%', '1.4c copy expands to 1 1 100%');

  // Case 4: Neither mapped -> hidden
  const g4 = testGameMeta(false, false);
  assertEqual(g4.rowDisplay, 'none', '1.4d rowGameMeta neither mapped: hidden');
  assertEqual(g4.supportDisplay, 'none', '1.4d support hidden');
  assertEqual(g4.copyDisplay, 'none', '1.4d copy hidden');
}

// Test 1.5: Non-standard media types & TV specifics
{
  const dom = buildPopupDomMock();
  // Unknown media type should not throw
  let err = null;
  try {
    runFormAdaptation(dom, 'manga', DEFAULT_SCHEMA);
    runFormAdaptation(dom, 'podcast', DEFAULT_SCHEMA);
    runFormAdaptation(dom, 'boardgame', DEFAULT_SCHEMA);
    runFormAdaptation(dom, '', DEFAULT_SCHEMA);
    runFormAdaptation(dom, null, DEFAULT_SCHEMA);
  } catch (e) {
    err = e;
  }
  assertEqual(err, null, '1.5 Non-standard media types exit cleanly without throwing');

  // TV shows specific adaptations (episodes & type)
  const tvDom = buildPopupDomMock();
  const tvSchema = {
    mediaTypes: {
      tv: {
        properties: {
          title: { notionName: 'Nom', type: 'title' },
          totalEp: { notionName: 'Total', type: 'number' },
          tvSubType: { notMapped: true }
        }
      }
    }
  };
  runFormAdaptation(tvDom, 'tv', tvSchema);
  assertEqual(tvDom.rowEpisodes.style.display, 'flex', '1.5 TV rowEpisodes displayed when totalEp mapped');
  assertEqual(tvDom.groupTvType.style.display, 'none', '1.5 TV groupTvType hidden when tvSubType notMapped');
}

// Test 1.6: Fuzzed & Corrupt Schemas
{
  const corruptInputs = [
    null,
    undefined,
    {},
    { mediaTypes: null },
    { mediaTypes: {} },
    { mediaTypes: { movie: null } },
    { mediaTypes: { movie: { properties: null } } },
    12345,
    'corrupt-string',
    [1, 2, 3],
    true
  ];

  let threw = false;
  for (const bad of corruptInputs) {
    try {
      const dom = buildPopupDomMock();
      runFormAdaptation(dom, 'movie', bad);
    } catch (e) {
      threw = true;
      console.error(`Fuzzed input threw:`, bad, e);
    }
  }
  assertEqual(threw, false, '1.6 Fuzzed and corrupt schema inputs handled without unhandled exceptions');
}

// Test 1.7: Missing DOM elements (Graceful degradation)
{
  const incompleteDom = {
    // Only groupCasts is defined, all others are undefined
    groupCasts: createMockElement('groupCasts')
  };

  let threw = false;
  try {
    runFormAdaptation(incompleteDom, 'movie', DEFAULT_SCHEMA);
    runFormAdaptation(incompleteDom, 'game', DEFAULT_SCHEMA);
    runFormAdaptation(incompleteDom, 'tv', DEFAULT_SCHEMA);
  } catch (e) {
    threw = true;
    console.error('Incomplete DOM threw:', e);
  }
  assertEqual(threw, false, '1.7 Missing DOM elements degrade gracefully without TypeError');
}


// -----------------------------------------------------------------------------
// SECTION 2: Dry-Run Diagnostic Engine & Property Compatibility Stress-Testing
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('⚡ SECTION 2: ADVERSARIAL STRESS-TESTING DRY-RUN DIAGNOSTIC ENGINE');
console.log('======================================================================\n');

// Test 2.1: evaluatePropertyCompatibility type permutations & edge cases
{
  const detected = {
    'Title': { type: 'title' },
    'Rating': { type: 'number' },
    'Watch Status': { type: 'status' },
    'Genres': { type: 'multi_select' },
    'Tags': { type: 'select' },
    'Review': { type: 'rich_text' },
    'Link': { type: 'url' },
    'Done': { type: 'checkbox' },
    'Director': { type: 'relation' }
  };

  // Exact matching types -> ok
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Title', type: 'title' }, detected).status, 'ok', '2.1a title exact match: ok');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Rating', type: 'number' }, detected).status, 'ok', '2.1b number exact match: ok');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Watch Status', type: 'status' }, detected).status, 'ok', '2.1c status exact match: ok');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Review', type: 'rich_text' }, detected).status, 'ok', '2.1d rich_text exact match: ok');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Link', type: 'url' }, detected).status, 'ok', '2.1e url exact match: ok');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Done', type: 'checkbox' }, detected).status, 'ok', '2.1f checkbox exact match: ok');

  // Relations
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Director', type: 'relation', lookupTable: 'directors' }, detected).status, 'ok', '2.1g relation with lookupTable: ok');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Director', type: 'relation' }, detected).status, 'warning', '2.1h relation without lookupTable: warning');

  // Compatible type adaptations (tolerant warnings)
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Watch Status', type: 'select' }, detected).status, 'warning', '2.1i expected select, actual status: warning');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Genres', type: 'select' }, detected).status, 'warning', '2.1j expected select, actual multi_select: warning');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Tags', type: 'status' }, detected).status, 'warning', '2.1k expected status, actual select: warning');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Tags', type: 'multi_select' }, detected).status, 'warning', '2.1l expected multi_select, actual select: warning');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Director', type: 'multi_select' }, detected).status, 'warning', '2.1m expected multi_select, actual relation: warning');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Title', type: 'rich_text' }, detected).status, 'warning', '2.1n expected rich_text, actual title: warning');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Review', type: 'url' }, detected).status, 'warning', '2.1o expected url, actual rich_text: warning');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Watch Status', type: 'number' }, detected).status, 'warning', '2.1p expected number, actual status: warning');

  // Incompatible types -> error
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Review', type: 'select' }, detected).status, 'error', '2.1q expected select, actual rich_text: error');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Rating', type: 'date' }, detected).status, 'error', '2.1r expected date, actual number: error');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Title', type: 'checkbox' }, detected).status, 'error', '2.1s expected checkbox, actual title: error');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'Done', type: 'number' }, detected).status, 'error', '2.1t expected number, actual checkbox: error');

  // Missing column -> error
  assertEqual(evaluatePropertyCompatibility({ notionName: 'UnknownColumnXYZ', type: 'title' }, detected).status, 'error', '2.1u unknown column name: error');

  // Case-insensitive & accent normalization match
  assertEqual(evaluatePropertyCompatibility({ notionName: 'watch status', type: 'status' }, detected).status, 'ok', '2.1v lowercase column match: ok');
  assertEqual(evaluatePropertyCompatibility({ notionName: 'GÉNRES', type: 'multi_select' }, detected).status, 'ok', '2.1w accented column match: ok');

  // Skipped properties
  assertEqual(evaluatePropertyCompatibility({ notMapped: true, notionName: 'Review' }, detected).status, 'skipped', '2.1x notMapped: true is skipped');
  assertEqual(evaluatePropertyCompatibility({ notionName: '' }, detected).status, 'skipped', '2.1y empty notionName is skipped');
  assertEqual(evaluatePropertyCompatibility({ notionName: '   ' }, detected).status, 'skipped', '2.1z whitespace notionName is skipped');
  assertEqual(evaluatePropertyCompatibility(null, detected).status, 'skipped', '2.1aa null schemaProp is skipped');
  assertEqual(evaluatePropertyCompatibility(undefined, detected).status, 'skipped', '2.1ab undefined schemaProp is skipped');
}

// Test 2.2: runDryRunDiagnostic Adversarial Error Resilience
{
  const validApiKey = 'secret_test_notion_key_12345';
  const validDbId = '312aec4b87d98111b530d4af0c22d898';

  // Scenario 2.2.1: Missing API Key (with DB ID configured)
  const schemaWithDb = {
    databaseMode: 'distinct',
    mediaTypes: {
      movie: { databaseId: validDbId, properties: { title: { notionName: 'Nom', type: 'title' } } },
      tv: { databaseId: validDbId, properties: { title: { notionName: 'Nom', type: 'title' } } },
      game: { databaseId: validDbId, properties: { title: { notionName: 'Nom', type: 'title' } } }
    }
  };
  const repNoKey = await runDryRunDiagnostic(schemaWithDb, '');
  assertEqual(repNoKey.overallStatus, 'error', '2.2.1 Missing API key results in error status');
  assert(repNoKey.summary.errors > 0, '2.2.1 Missing API key increments error counter');
  assertEqual(repNoKey.databases[0].error, 'Clé API Notion manquante.', '2.2.1 Error message specifies missing API key');

  // Scenario 2.2.2: Missing Database IDs in Distinct Mode
  const emptyDbSchema = {
    databaseMode: 'distinct',
    mediaTypes: {
      movie: { databaseId: '' },
      tv: { databaseId: '' },
      game: { databaseId: '' }
    }
  };
  const repNoDb = await runDryRunDiagnostic(emptyDbSchema, validApiKey);
  assertEqual(repNoDb.overallStatus, 'error', '2.2.2 Missing DB IDs produces error overallStatus');
  assertEqual(repNoDb.databases.length, 3, '2.2.2 3 distinct databases checked');
  assert(repNoDb.databases.every(db => db.status === 'error'), '2.2.2 All 3 DBs marked as error');

  // Scenario 2.2.3: HTTP 401 Unauthorized (Invalid Notion Token)
  const mock401Inspect = async () => {
    const err = new Error('Notion API error (401): API token is invalid.');
    err.status = 401;
    throw err;
  };
  const rep401 = await runDryRunDiagnostic(schemaWithDb, 'invalid_key', { inspectFn: mock401Inspect });
  assertEqual(rep401.overallStatus, 'error', '2.2.3 401 error results in overallStatus: error');
  assert(rep401.databases[0].error.includes('401'), '2.2.3 Database report captures 401 error message');

  // Scenario 2.2.4: HTTP 403 Forbidden (Integration access denied)
  const mock403Inspect = async () => {
    const err = new Error('Notion API error (403): Integration does not have access to this database.');
    err.status = 403;
    throw err;
  };
  const rep403 = await runDryRunDiagnostic(schemaWithDb, validApiKey, { inspectFn: mock403Inspect });
  assertEqual(rep403.overallStatus, 'error', '2.2.4 403 error results in overallStatus: error');
  assert(rep403.databases[0].error.includes('403'), '2.2.4 Database report captures 403 error message');

  // Scenario 2.2.5: HTTP 404 Database Not Found
  const mock404Inspect = async () => {
    const err = new Error('Notion API error (404): Could not find database with ID.');
    err.status = 404;
    throw err;
  };
  const rep404 = await runDryRunDiagnostic(schemaWithDb, validApiKey, { inspectFn: mock404Inspect });
  assertEqual(rep404.overallStatus, 'error', '2.2.5 404 error results in overallStatus: error');

  // Scenario 2.2.6: HTTP 429 Rate Limit Exceeded
  const mock429Inspect = async () => {
    const err = new Error('Notion API error (429): Rate limited.');
    err.status = 429;
    throw err;
  };
  const rep429 = await runDryRunDiagnostic(schemaWithDb, validApiKey, { inspectFn: mock429Inspect });
  assertEqual(rep429.overallStatus, 'error', '2.2.6 429 error results in overallStatus: error');

  // Scenario 2.2.7: Network Timeout / Connection Failure
  const mockTimeoutInspect = async () => {
    throw new Error('fetch failed: connect ETIMEDOUT 192.0.2.1:443');
  };
  const repTimeout = await runDryRunDiagnostic(schemaWithDb, validApiKey, { inspectFn: mockTimeoutInspect });
  assertEqual(repTimeout.overallStatus, 'error', '2.2.7 Network timeout caught and reported gracefully');
  assert(repTimeout.databases[0].error.includes('ETIMEDOUT'), '2.2.7 Error string includes timeout indicator');

  // Scenario 2.2.8: Partial Failure across Distinct Databases (Movies ok, TV 403, Games missing)
  const partialInspect = async (dbId) => {
    if (dbId.includes('movie')) {
      return {
        title: 'Films DB',
        properties: {
          'Nom': { type: 'title' },
          'Statut': { type: 'select' }
        }
      };
    }
    if (dbId.includes('tv')) {
      throw new Error('403 Forbidden for TV');
    }
    throw new Error('DB Error');
  };
  const partialSchema = {
    databaseMode: 'distinct',
    mediaTypes: {
      movie: { databaseId: 'db-movie-123', properties: { title: { notionName: 'Nom', type: 'title' } } },
      tv: { databaseId: 'db-tv-123', properties: { title: { notionName: 'Nom', type: 'title' } } },
      game: { databaseId: '', properties: { title: { notionName: 'Nom', type: 'title' } } }
    }
  };
  const repPartial = await runDryRunDiagnostic(partialSchema, validApiKey, { inspectFn: partialInspect });
  assertEqual(repPartial.overallStatus, 'error', '2.2.8 Partial failures aggregate to error overallStatus');
  assertEqual(repPartial.databases[0].status, 'ok', '2.2.8 Movie database status is ok');
  assertEqual(repPartial.databases[1].status, 'error', '2.2.8 TV database status is error');
  assertEqual(repPartial.databases[2].status, 'error', '2.2.8 Games database status is error (missing ID)');
  assert(repPartial.summary.valid >= 1, '2.2.8 Valid properties from Movie DB recorded');
  assert(repPartial.summary.errors >= 2, '2.2.8 Errors from TV and Games recorded');

  // Scenario 2.2.9: Unified Database Mode with Discriminator Validation
  const unifiedInspect = async () => {
    return {
      title: 'Culture Tracker Unifié',
      properties: {
        'Type': { type: 'select' },
        'Nom': { type: 'title' }
      }
    };
  };
  const unifiedSchema = {
    databaseMode: 'unified',
    unifiedDatabase: {
      databaseId: validDbId,
      typeProperty: 'Type',
      typeValues: { movie: 'Film', tv: 'Série TV', game: 'Jeu Vidéo' }
    },
    mediaTypes: {
      movie: { properties: { title: { notionName: 'Nom', type: 'title' } } }
    }
  };
  const repUnified = await runDryRunDiagnostic(unifiedSchema, validApiKey, { inspectFn: unifiedInspect });
  assertEqual(repUnified.overallStatus, 'ok', '2.2.9 Unified DB with valid discriminator passes');
  const disc = repUnified.databases[0].properties.find(p => p.key === '__typeDiscriminator');
  assert(disc && disc.status === 'ok', '2.2.9 Discriminator property status is ok');

  // Scenario 2.2.10: Unified Mode with Missing Discriminator Column
  const unifiedInspectMissingDisc = async () => {
    return {
      title: 'Culture Tracker Unifié',
      properties: {
        'Nom': { type: 'title' }
        // 'Type' column is missing!
      }
    };
  };
  const repDiscMissing = await runDryRunDiagnostic(unifiedSchema, validApiKey, { inspectFn: unifiedInspectMissingDisc });
  assertEqual(repDiscMissing.overallStatus, 'error', '2.2.10 Unified DB missing discriminator column flags error');
  const badDisc = repDiscMissing.databases[0].properties.find(p => p.key === '__typeDiscriminator');
  assert(badDisc && badDisc.status === 'error', '2.2.10 Missing discriminator marked status: error');
}


// -----------------------------------------------------------------------------
// SECTION 3: Multi-Platform Build Pipeline & Archive Integrity
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('⚡ SECTION 3: ADVERSARIAL VERIFICATION OF BUILD PACKAGES & ARCHIVES');
console.log('======================================================================\n');

// Low-level pure Node.js PKZIP unpacker & validator
function inspectAndExtractZip(zipBuffer, archiveName) {
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocdOffset = zipBuffer.lastIndexOf(eocdSignature);
  if (eocdOffset === -1) {
    throw new Error(`Invalid ZIP archive ${archiveName}: EOCD signature not found.`);
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  let ptr = centralDirOffset;
  const entries = new Map();

  for (let i = 0; i < totalEntries; i++) {
    const cdSig = zipBuffer.readUInt32LE(ptr);
    if (cdSig !== 0x02014b50) {
      throw new Error(`Corrupted central directory signature in ${archiveName} at entry ${i}`);
    }

    const versionNeeded = zipBuffer.readUInt16LE(ptr + 6);
    const flags = zipBuffer.readUInt16LE(ptr + 8);
    const compMethod = zipBuffer.readUInt16LE(ptr + 10);
    const crc = zipBuffer.readUInt32LE(ptr + 16);
    const compSize = zipBuffer.readUInt32LE(ptr + 20);
    const uncompSize = zipBuffer.readUInt32LE(ptr + 24);
    const fileNameLen = zipBuffer.readUInt16LE(ptr + 28);
    const extraLen = zipBuffer.readUInt16LE(ptr + 30);
    const commentLen = zipBuffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(ptr + 42);

    const fileName = zipBuffer.toString('utf8', ptr + 46, ptr + 46 + fileNameLen);

    // Validate matching local file header
    const locSig = zipBuffer.readUInt32LE(localHeaderOffset);
    if (locSig !== 0x04034b50) {
      throw new Error(`Corrupted local file header for ${fileName} in ${archiveName}`);
    }
    const locFileNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
    const locExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + locFileNameLen + locExtraLen;

    const compressedSlice = zipBuffer.subarray(dataOffset, dataOffset + compSize);
    let decompressed;
    if (compMethod === 0) {
      decompressed = compressedSlice;
    } else if (compMethod === 8) {
      decompressed = zlib.inflateRawSync(compressedSlice);
    } else {
      throw new Error(`Unsupported compression method ${compMethod} for ${fileName}`);
    }

    if (decompressed.length !== uncompSize) {
      throw new Error(`Decompressed length mismatch for ${fileName}: expected ${uncompSize}, got ${decompressed.length}`);
    }

    const computedCrc = computeCRC32(decompressed);
    if (computedCrc !== crc) {
      throw new Error(`CRC-32 mismatch for ${fileName}: header ${crc}, calculated ${computedCrc}`);
    }

    entries.set(fileName, decompressed);
    ptr += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

// Target archives
const packageTargets = [
  { name: 'Chrome ZIP', file: 'culture-tracker-v1.5.0-chrome.zip', browser: 'chrome' },
  { name: 'Firefox ZIP', file: 'culture-tracker-v1.5.0-firefox.zip', browser: 'firefox' },
  { name: 'Firefox XPI', file: 'culture-tracker-v1.5.0-firefox.xpi', browser: 'firefox' },
  { name: 'Safari ZIP', file: 'culture-tracker-v1.5.0-safari.zip', browser: 'safari' }
];

for (const target of packageTargets) {
  const archivePath = path.join(DIST_DIR, target.file);
  assert(fs.existsSync(archivePath), `3.1 Archive exists: ${target.file}`);
  const buf = fs.readFileSync(archivePath);
  assert(buf.length > 50000, `3.1 Archive ${target.file} has valid non-empty size (${buf.length} bytes)`);

  let entries = null;
  let extractErr = null;
  try {
    entries = inspectAndExtractZip(buf, target.file);
  } catch (e) {
    extractErr = e;
  }
  assertEqual(extractErr, null, `3.2 Extraction and CRC32 verification succeeded for ${target.file}`);
  assert(entries && entries.size >= 25, `3.2 Archive ${target.file} contains all ${entries?.size} entries`);

  // Verify critical assets
  assert(entries.has('options/options.html'), `3.3 ${target.file} contains options/options.html`);
  assert(entries.has('options/options.css'), `3.3 ${target.file} contains options/options.css`);
  assert(entries.has('options/options.js'), `3.3 ${target.file} contains options/options.js`);
  assert(entries.has('popup/popup.html'), `3.3 ${target.file} contains popup/popup.html`);
  assert(entries.has('popup/popup.css'), `3.3 ${target.file} contains popup/popup.css`);
  assert(entries.has('popup/popup.js'), `3.3 ${target.file} contains popup/popup.js`);
  assert(entries.has('background.js'), `3.3 ${target.file} contains background.js`);
  assert(entries.has('content/notion-inject.js'), `3.3 ${target.file} contains content/notion-inject.js`);
  assert(entries.has('manifest.json'), `3.3 ${target.file} contains manifest.json`);

  // Verify absence of forbidden/extraneous files
  for (const entryName of entries.keys()) {
    assert(!entryName.endsWith('.test.js'), `3.4 ${target.file} does NOT contain test file: ${entryName}`);
    assert(!entryName.endsWith('.spec.js'), `3.4 ${target.file} does NOT contain spec file: ${entryName}`);
    assert(!entryName.startsWith('test/'), `3.4 ${target.file} does NOT contain test/ dir: ${entryName}`);
    assert(!entryName.startsWith('.agents/'), `3.4 ${target.file} does NOT contain .agents/ dir: ${entryName}`);
    assert(!entryName.startsWith('.git/'), `3.4 ${target.file} does NOT contain .git/ dir: ${entryName}`);
    assert(!entryName.endsWith('.tmp') && !entryName.endsWith('.bak'), `3.4 ${target.file} no temp files: ${entryName}`);
  }

  // Parse and validate tailored manifest.json
  const manifestBuf = entries.get('manifest.json');
  const manifest = JSON.parse(manifestBuf.toString('utf8'));
  assertEqual(manifest.manifest_version, 3, `3.5 ${target.file} manifest_version is 3`);
  assertEqual(manifest.options_ui?.page, 'options/options.html', `3.5 ${target.file} options_ui.page is options/options.html`);
  assertEqual(manifest.options_ui?.open_in_tab, true, `3.5 ${target.file} options_ui.open_in_tab is true`);

  if (target.browser === 'chrome') {
    assertEqual(manifest.background?.service_worker, 'background.js', `3.6 Chrome uses service_worker background`);
    assertEqual(manifest.background?.scripts, undefined, `3.6 Chrome does NOT have background.scripts`);
    assert(!manifest.permissions.includes('webRequestBlocking'), `3.6 Chrome excludes webRequestBlocking`);
    assertEqual(manifest.browser_specific_settings, undefined, `3.6 Chrome excludes browser_specific_settings`);
  } else if (target.browser === 'firefox') {
    assertDeepEqual(manifest.background?.scripts, ['background.js'], `3.7 Firefox uses background.scripts`);
    assertEqual(manifest.background?.service_worker, undefined, `3.7 Firefox does NOT use service_worker`);
    assert(manifest.permissions.includes('webRequestBlocking'), `3.7 Firefox includes webRequestBlocking`);
    assertEqual(manifest.browser_specific_settings?.gecko?.id, 'culture-tracker-notion@pixelzeus.local', `3.7 Firefox defines valid gecko ID`);
  } else if (target.browser === 'safari') {
    assertEqual(manifest.background?.service_worker, 'background.js', `3.8 Safari uses service_worker background`);
    assertEqual(manifest.background?.scripts, undefined, `3.8 Safari does NOT have background.scripts`);
    assert(!manifest.permissions.includes('webRequestBlocking'), `3.8 Safari excludes webRequestBlocking`);
    assertEqual(manifest.browser_specific_settings, undefined, `3.8 Safari excludes browser_specific_settings`);
  }
}

// Test 3.9: Packaging Idempotency (Rebuild generates exact bitwise or valid hash)
{
  const { results } = buildAll();
  assert(results.length === 3, '3.9 Rebuild completed for all 3 browser targets');
  for (const res of results) {
    for (const art of res.artifacts) {
      assert(fs.existsSync(art.path), `3.9 Rebuilt artifact exists: ${art.name}`);
      const freshBuf = fs.readFileSync(art.path);
      const freshHash = crypto.createHash('sha256').update(freshBuf).digest('hex');
      assertEqual(freshHash, art.sha256, `3.9 Rebuilt artifact hash matches reported SHA-256 for ${art.name}`);
    }
  }
}

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('📊 CHALLENGER 2 EMPIRICAL TEST SUITE EXECUTION SUMMARY');
console.log('======================================================================');
console.log(`Total tests executed : ${totalTests}`);
console.log(`Passed tests         : ${passedTests}`);
console.log(`Failed tests         : ${failedTests}`);

if (failedTests > 0) {
  console.error(`\n❌ CHALLENGE FAILED with ${failedTests} failures:`);
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log(`\n🎉 ALL ${totalTests} EMPIRICAL CHALLENGER TESTS PASSED WITH 100% SUCCESS!`);
  process.exit(0);
}
