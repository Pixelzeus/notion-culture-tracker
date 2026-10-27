// test/challenger-gen3-adversarial.test.js
// EMPIRICAL ADVERSARIAL STRESS & FUZZING TEST HARNESS — Challenger 1 (Gen 3)
// Stress-tests resolveVariables, compileDeclarativeBlocks, inspectDatabase, generateSchemaRecommendation, and validateSchema

import assert from 'node:assert';
import {
  resolveVariables,
  compileDeclarativeBlock,
  compileDeclarativeBlocks,
  renderTemplateBlocks,
  NotionBlocks,
  BUILTIN_TEMPLATES,
  DECLARATIVE_PRESETS
} from '../services/template-engine.js';
import {
  formatDatabaseId,
  generateSchemaRecommendation,
  evaluatePropertyCompatibility,
  runDryRunDiagnostic
} from '../services/schema-discovery.js';
import {
  DEFAULT_SCHEMA,
  PERMITTED_NOTION_TYPES,
  validateSchema
} from '../services/schema.default.js';
import {
  buildNotionProperties,
  resolveLookupId,
  normalizeKey
} from '../services/notion-adapter.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    findings.push({ test: name, error: err.message, stack: err.stack });
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    findings.push({ test: name, error: err.message, stack: err.stack });
  }
}

console.log('======================================================================');
console.log('⚡ EMPIRICAL CHALLENGER ADVERSARIAL FUZZ & STRESS HARNESS (GEN 3)');
console.log('======================================================================\n');

// ============================================================================
// 1. ADVERSARIAL FUZZING: resolveVariables()
// ============================================================================
console.log('--- 1. Adversarial Fuzzing: resolveVariables() ---');

test('1.1: Handles non-string/primitive inputs gracefully without throwing', () => {
  assert.strictEqual(resolveVariables(null), '');
  assert.strictEqual(resolveVariables(undefined), '');
  assert.strictEqual(resolveVariables(42), '');
  assert.strictEqual(resolveVariables(true), '');
  assert.strictEqual(resolveVariables(false), '');
  assert.strictEqual(resolveVariables([]), '');
  assert.strictEqual(resolveVariables({}), '');
  assert.strictEqual(resolveVariables(Symbol('test')), '');
});

test('1.2: Pathological variable tokens and spacing', () => {
  const vars = { title: 'Dune', overview: 'Desert epic', year: '2021' };
  // Normal resolution
  assert.strictEqual(resolveVariables('{{title}}', vars), 'Dune');
  // Extra spaces inside brackets
  assert.strictEqual(resolveVariables('{{  title  }}', vars), 'Dune');
  assert.strictEqual(resolveVariables('{{\ttitle\t}}', vars), 'Dune');
  // Empty tokens
  assert.strictEqual(resolveVariables('{{}}', vars), '{{}}');
  assert.strictEqual(resolveVariables('{{   }}', vars), '{{   }}');
  // Unclosed brackets
  assert.strictEqual(resolveVariables('{{title', vars), '{{title');
  assert.strictEqual(resolveVariables('title}}', vars), 'title}}');
  assert.strictEqual(resolveVariables('{title}', vars), '{title}');
  assert.strictEqual(resolveVariables('{{{title', vars), '{{{title');
});

test('1.3: Nested curly braces fuzzing ({{{{title}}}}, {{{title}}})', () => {
  const vars = { title: 'Inception' };
  // {{{title}}} -> {Inception}
  assert.strictEqual(resolveVariables('{{{title}}}', vars), '{Inception}');
  // {{{{title}}}} -> {{Inception}}
  assert.strictEqual(resolveVariables('{{{{title}}}}', vars), '{{Inception}}');
  // Deeply nested brackets
  assert.strictEqual(resolveVariables('{{{{{{title}}}}}}', vars), '{{{{Inception}}}}');
  // Multiple sequential variables
  assert.strictEqual(
    resolveVariables('{{title}} - {{title}} : {{year}}', { title: 'Matrix', year: '1999' }),
    'Matrix - Matrix : 1999'
  );
});

test('1.4: Undefined, null, empty and missing properties', () => {
  const vars = { title: 'Avatar', emptyStr: '', nullProp: null, undefProp: undefined };
  assert.strictEqual(resolveVariables('{{nonExistent}}', vars), '');
  assert.strictEqual(resolveVariables('{{emptyStr}}', vars), '');
  assert.strictEqual(resolveVariables('{{nullProp}}', vars), '');
  assert.strictEqual(resolveVariables('{{undefProp}}', vars), '');
  assert.strictEqual(resolveVariables('Text {{missing}} more', {}), 'Text  more');
});

test('1.5: Alias fallbacks and array interpolation', () => {
  // Cast / Casts aliases
  assert.strictEqual(resolveVariables('Cast: {{cast}}', { casts: ['Neo', 'Trinity'] }), 'Cast: Neo, Trinity');
  assert.strictEqual(resolveVariables('Cast: {{casts}}', { cast: 'Keanu Reeves' }), 'Cast: Keanu Reeves');
  // Genres / Genre aliases
  assert.strictEqual(resolveVariables('Genres: {{genres}}', { genre: ['Sci-Fi', 'Action'] }), 'Genres: Sci-Fi, Action');
  assert.strictEqual(resolveVariables('Genres: {{genres}}', { genres: 'Sci-Fi' }), 'Genres: Sci-Fi');
  // Overview / Summary aliases
  assert.strictEqual(resolveVariables('Summary: {{overview}}', { summary: 'A great journey.' }), 'Summary: A great journey.');
  assert.strictEqual(resolveVariables('Summary: {{summary}}', { overview: 'Another journey.' }), 'Summary: Another journey.');
  // Year / releasedYear aliases
  assert.strictEqual(resolveVariables('Year: {{year}}', { releasedYear: 2024 }), 'Year: 2024');
  assert.strictEqual(resolveVariables('Year: {{releasedYear}}', { year: 2024 }), 'Year: 2024');
});

test('1.6: Circular object references and prototype behavior', () => {
  const circ = { title: 'Circular' };
  circ.self = circ;
  // Passing circular object as vars - should not throw or enter infinite loop
  const res = resolveVariables('{{title}}', circ);
  assert.strictEqual(res, 'Circular');

  // Passing circular object inside a property
  const resCirc = resolveVariables('{{self}}', circ);
  assert.strictEqual(resCirc, '[object Object]');

  // Object without prototype (Object.create(null)) as vars
  const nullProtoVars = Object.create(null);
  nullProtoVars.title = 'Clean Object';
  assert.strictEqual(resolveVariables('{{title}}', nullProtoVars), 'Clean Object');

  // Object without prototype as a property value
  const container = { title: Object.create(null) };
  try {
    resolveVariables('{{title}}', container);
    // If it doesn't throw, great
  } catch (err) {
    // String(Object.create(null)) throws in JS; note this finding
    assert.ok(err instanceof TypeError, 'Expected TypeError on String(Object.create(null))');
  }
});

test('1.7: Unicode, Emojis, Accents, RTL, and HTML/Injection characters', () => {
  const unicodeVars = {
    title: '🎬 Le Fabuleux Destin d\'Amélie Poulain 🍿',
    overview: 'Arabic: مرحبا | Hebrew: שלום | CJK: 千と千尋の神隠し | Symbols: 𝒳 𠜎',
    xss: '<script>alert("xss")</script>',
    sql: "'; DROP TABLE pages; --"
  };
  const text = 'Movie: {{title}} | Synopsis: {{overview}} | Safe: {{xss}} | SQL: {{sql}}';
  const out = resolveVariables(text, unicodeVars);
  assert.ok(out.includes('🎬 Le Fabuleux Destin d\'Amélie Poulain 🍿'));
  assert.ok(out.includes('Arabic: مرحبا'));
  assert.ok(out.includes('CJK: 千と千尋の神隠し'));
  assert.ok(out.includes('<script>alert("xss")</script>'));
  assert.ok(out.includes("'; DROP TABLE pages; --"));
});

test('1.8: Scale & ReDoS stress on resolveVariables()', () => {
  // Construct a 200KB string with 5,000 variable tokens
  let largeTemplate = '';
  const vars = { a: 'Alpha', b: 'Beta', c: 'Gamma' };
  for (let i = 0; i < 2000; i++) {
    largeTemplate += `Part ${i}: {{a}} and {{b}} with {{c}}. `;
  }
  const t0 = performance.now();
  const result = resolveVariables(largeTemplate, vars);
  const elapsed = performance.now() - t0;
  assert.ok(result.length > 50000, 'Result length is substantial');
  assert.ok(elapsed < 200, `Execution time was ${elapsed.toFixed(2)}ms (must be < 200ms)`);
});

// ============================================================================
// 2. STRESS TESTING: compileDeclarativeBlocks()
// ============================================================================
console.log('\n--- 2. Stress Testing: compileDeclarativeBlocks() ---');

test('2.1: Handles empty/null/primitive blueprint arrays gracefully', () => {
  assert.deepStrictEqual(compileDeclarativeBlocks(null), []);
  assert.deepStrictEqual(compileDeclarativeBlocks(undefined), []);
  assert.deepStrictEqual(compileDeclarativeBlocks(12345), []);
  assert.deepStrictEqual(compileDeclarativeBlocks('string'), []);
  assert.deepStrictEqual(compileDeclarativeBlocks({}), []);
  assert.deepStrictEqual(compileDeclarativeBlocks([]), []);
  assert.deepStrictEqual(compileDeclarativeBlocks([null, undefined, false, 42, 'invalid', {}]), []);
});

test('2.2: Column lists with empty, single, or invalid columns', () => {
  // Empty column_list columns array: Notion requires each column to have >= 1 child
  const emptyColsDef = {
    type: 'column_list',
    columns: []
  };
  const compiledEmpty = compileDeclarativeBlock(emptyColsDef, {});
  assert.ok(compiledEmpty, 'column_list produced');
  assert.strictEqual(compiledEmpty.type, 'column_list');
  assert.strictEqual(compiledEmpty.column_list.children.length, 2, 'Always outputs 2 columns');
  assert.strictEqual(compiledEmpty.column_list.children[0].column.children.length, 1, 'Column 1 has fallback paragraph');
  assert.strictEqual(compiledEmpty.column_list.children[1].column.children.length, 1, 'Column 2 has fallback paragraph');

  // Columns with empty children arrays
  const emptyChildrenDef = {
    type: 'columns',
    columns: [{ children: [] }, { children: [] }]
  };
  const compiledChildren = compileDeclarativeBlock(emptyChildrenDef, {});
  assert.strictEqual(compiledChildren.column_list.children[0].column.children.length, 1);
  assert.strictEqual(compiledChildren.column_list.children[1].column.children.length, 1);
  assert.strictEqual(compiledChildren.column_list.children[0].column.children[0].type, 'paragraph');

  // Columns using legacy col1 / col2 syntax
  const legacyColDef = {
    type: 'columns',
    col1: [{ type: 'paragraph', text: 'Left' }],
    col2: [{ type: 'paragraph', text: 'Right' }]
  };
  const compiledLegacy = compileDeclarativeBlock(legacyColDef, {});
  assert.strictEqual(compiledLegacy.column_list.children[0].column.children[0].paragraph.rich_text[0].text.content, 'Left');
  assert.strictEqual(compiledLegacy.column_list.children[1].column.children[0].paragraph.rich_text[0].text.content, 'Right');
});

test('2.3: Nested columns inside columns (architectural edge case)', () => {
  const nestedColDef = {
    type: 'column_list',
    columns: [
      {
        children: [
          {
            type: 'column_list',
            columns: [
              { children: [{ type: 'paragraph', text: 'Deep 1' }] },
              { children: [{ type: 'paragraph', text: 'Deep 2' }] }
            ]
          }
        ]
      },
      {
        children: [{ type: 'paragraph', text: 'Outer 2' }]
      }
    ]
  };
  const compiled = compileDeclarativeBlock(nestedColDef, {});
  assert.strictEqual(compiled.type, 'column_list');
  const innerColList = compiled.column_list.children[0].column.children[0];
  assert.strictEqual(innerColList.type, 'column_list');
  assert.strictEqual(innerColList.column_list.children[0].column.children[0].paragraph.rich_text[0].text.content, 'Deep 1');
});

test('2.4: Toggles with empty, null, or populated children', () => {
  // Empty toggle children: Notion API requires 'children' property to be OMITTED if empty
  const emptyToggle = {
    type: 'toggle',
    title: 'Empty Toggle',
    children: []
  };
  const compiledEmpty = compileDeclarativeBlock(emptyToggle, {});
  assert.strictEqual(compiledEmpty.type, 'toggle');
  assert.strictEqual(compiledEmpty.toggle.rich_text[0].text.content, 'Empty Toggle');
  assert.strictEqual(compiledEmpty.toggle.children, undefined, 'children key must be omitted when empty');

  // Toggle with null / invalid children only
  const nullChildrenToggle = {
    type: 'toggle',
    title: 'Null Children Toggle',
    children: [null, undefined, { type: 'invalid_xyz' }]
  };
  const compiledNull = compileDeclarativeBlock(nullChildrenToggle, {});
  assert.strictEqual(compiledNull.toggle.children, undefined, 'children key omitted when all children are invalid');

  // Toggle with populated children
  const populatedToggle = {
    type: 'toggle',
    title: 'Valid Toggle',
    children: [
      { type: 'paragraph', text: 'Child 1' },
      { type: 'bullet', text: 'Child 2' }
    ]
  };
  const compiledPop = compileDeclarativeBlock(populatedToggle, {});
  assert.ok(Array.isArray(compiledPop.toggle.children), 'children array present');
  assert.strictEqual(compiledPop.toggle.children.length, 2);
  assert.strictEqual(compiledPop.toggle.children[0].type, 'paragraph');
  assert.strictEqual(compiledPop.toggle.children[1].type, 'bulleted_list_item');
});

test('2.5: Image block URL validation and protocol restrictions', () => {
  // Valid http / https
  const validHttp = compileDeclarativeBlock({ type: 'image', url: 'http://example.com/pic.jpg' });
  assert.strictEqual(validHttp.type, 'image');
  assert.strictEqual(validHttp.image.external.url, 'http://example.com/pic.jpg');

  const validHttps = compileDeclarativeBlock({ type: 'image', url: 'https://images.unsplash.com/photo' });
  assert.strictEqual(validHttps.type, 'image');

  // Malicious / Invalid URL protocols
  assert.strictEqual(compileDeclarativeBlock({ type: 'image', url: 'javascript:alert(1)' }), null);
  assert.strictEqual(compileDeclarativeBlock({ type: 'image', url: 'data:image/png;base64,xxxx' }), null);
  assert.strictEqual(compileDeclarativeBlock({ type: 'image', url: 'file:///C:/secret.txt' }), null);
  assert.strictEqual(compileDeclarativeBlock({ type: 'image', url: 'ftp://ftp.server.com/img' }), null);
  assert.strictEqual(compileDeclarativeBlock({ type: 'image', url: '' }), null);
  assert.strictEqual(compileDeclarativeBlock({ type: 'image', url: null }), null);
  assert.strictEqual(compileDeclarativeBlock({ type: 'image' }), null);
});

test('2.6: Heading levels, colors, bolding and fallbacks', () => {
  // Normal headings H1, H2, H3
  const h1 = compileDeclarativeBlock({ type: 'heading_1', content: 'Title 1' });
  assert.strictEqual(h1.type, 'heading_1');
  assert.strictEqual(h1.heading_1.color, 'default');
  assert.strictEqual(h1.heading_1.rich_text[0].annotations.bold, false);

  const h2 = compileDeclarativeBlock({ type: 'heading', level: 2, content: 'Title 2', color: 'blue', bold: true });
  assert.strictEqual(h2.type, 'heading_2');
  assert.strictEqual(h2.heading_2.color, 'blue');
  assert.strictEqual(h2.heading_2.rich_text[0].annotations.bold, true);

  const h3 = compileDeclarativeBlock({ type: 'heading_3', content: 'Title 3' });
  assert.strictEqual(h3.type, 'heading_3');

  // Missing or non-numeric level fallback to 2
  const hFallback = compileDeclarativeBlock({ type: 'heading', level: 'not-a-number', content: 'Fallback' });
  assert.strictEqual(hFallback.type, 'heading_2');
});

test('2.7: Paragraph length truncation (Notion 2000 char rich_text limit)', () => {
  const hugeText = 'A'.repeat(5000);
  const p = compileDeclarativeBlock({ type: 'paragraph', content: hugeText });
  assert.strictEqual(p.type, 'paragraph');
  assert.strictEqual(p.paragraph.rich_text[0].text.content.length, 1900, 'Truncated to 1900 chars safety margin');
});

test('2.8: Compiling 1,000 blocks in a single template (scale test)', () => {
  const bigList = [];
  for (let i = 0; i < 1000; i++) {
    bigList.push({
      type: i % 2 === 0 ? 'paragraph' : 'heading_2',
      content: `Block ${i} with {{title}}`
    });
  }
  const t0 = performance.now();
  const compiled = compileDeclarativeBlocks(bigList, { title: 'ScaleMovie' });
  const elapsed = performance.now() - t0;
  assert.strictEqual(compiled.length, 1000);
  assert.ok(elapsed < 200, `1000 blocks compiled in ${elapsed.toFixed(2)}ms (must be < 200ms)`);
});

// ============================================================================
// 3. STRESS TESTING: inspectDatabase() & generateSchemaRecommendation()
// ============================================================================
console.log('\n--- 3. Stress Testing: inspectDatabase() & generateSchemaRecommendation() ---');

test('3.1: formatDatabaseId formats various UUID representations', () => {
  const rawClean = '312aec4b87d98111b530d4af0c22d898';
  const expected = '312aec4b-87d9-8111-b530-d4af0c22d898';
  assert.strictEqual(formatDatabaseId(rawClean), expected);
  assert.strictEqual(formatDatabaseId(expected), expected);
  assert.strictEqual(formatDatabaseId('  ' + rawClean + '  '), expected);
  assert.strictEqual(formatDatabaseId(''), '');
  assert.strictEqual(formatDatabaseId(null), '');
  assert.strictEqual(formatDatabaseId(undefined), '');
  assert.strictEqual(formatDatabaseId('short-id'), 'short-id');
});

test('3.2: generateSchemaRecommendation() with empty database (0 columns)', () => {
  const emptyDb = {
    id: 'db-empty',
    title: 'Empty Database',
    properties: {}
  };
  const rec = generateSchemaRecommendation(emptyDb, 'game');
  assert.strictEqual(rec.databaseId, 'db-empty');
  assert.strictEqual(rec.databaseTitle, 'Empty Database');
  assert.strictEqual(rec.mediaType, 'game');
  assert.deepStrictEqual(rec.recommendedProperties, {});
});

test('3.3: generateSchemaRecommendation() with null/undefined inputs', () => {
  assert.deepStrictEqual(generateSchemaRecommendation(null), {});
  assert.deepStrictEqual(generateSchemaRecommendation(undefined), {});
  assert.deepStrictEqual(generateSchemaRecommendation({}), {});
  assert.deepStrictEqual(generateSchemaRecommendation({ properties: null }), {});
});

test('3.4: generateSchemaRecommendation() with 500+ columns stress test', () => {
  const hugeProperties = {};
  for (let i = 0; i < 500; i++) {
    hugeProperties[`Custom_Field_${i}`] = {
      id: `prop-${i}`,
      name: `Custom_Field_${i}`,
      type: 'rich_text'
    };
  }
  // Inject target matches
  hugeProperties['Le Titre du Film'] = { id: 'p-title', name: 'Le Titre du Film', type: 'title' };
  hugeProperties['Note Finale'] = { id: 'p-rate', name: 'Note Finale', type: 'number' };
  hugeProperties['Plateforme de Jeu'] = { id: 'p-plat', name: 'Plateforme de Jeu', type: 'select', options: [{ name: 'PC' }] };
  hugeProperties['Année de Sortie'] = { id: 'p-year', name: 'Année de Sortie', type: 'number' };

  const meta = {
    id: 'db-500',
    title: 'Massive DB',
    properties: hugeProperties
  };

  const t0 = performance.now();
  const rec = generateSchemaRecommendation(meta, 'movie');
  const elapsed = performance.now() - t0;

  assert.ok(rec.recommendedProperties.title, 'Matched title');
  assert.strictEqual(rec.recommendedProperties.title.notionName, 'Le Titre du Film');
  assert.strictEqual(rec.recommendedProperties.rating.notionName, 'Note Finale');
  assert.strictEqual(rec.recommendedProperties.platform.notionName, 'Plateforme de Jeu');
  assert.ok(elapsed < 100, `Matched across 500 columns in ${elapsed.toFixed(2)}ms (must be < 100ms)`);
});

test('3.5: Unusual column names: accents, emojis, symbols, reserved keywords', () => {
  const exoticProps = {
    '🎬 Titre Principal 🍿': { id: '1', name: '🎬 Titre Principal 🍿', type: 'title' },
    'Plateforme 🎮 (Console)': { id: '2', name: 'Plateforme 🎮 (Console)', type: 'select' },
    'Statut d\'avancement': { id: '3', name: 'Statut d\'avancement', type: 'status' },
    '__proto__': { id: '4', name: '__proto__', type: 'rich_text' },
    'constructor': { id: '5', name: 'constructor', type: 'rich_text' },
    'toString': { id: '6', name: 'toString', type: 'rich_text' },
    'Épisodes Totaux #': { id: '7', name: 'Épisodes Totaux #', type: 'number' }
  };

  const rec = generateSchemaRecommendation({ id: 'db-exotic', title: 'Exotic DB', properties: exoticProps }, 'tv');
  assert.ok(rec.recommendedProperties.title, 'Matched emoji title');
  assert.strictEqual(rec.recommendedProperties.title.notionName, '🎬 Titre Principal 🍿');
  assert.ok(rec.recommendedProperties.platform, 'Matched platform with emoji & parens');
  assert.ok(rec.recommendedProperties.status, 'Matched status with apostrophe & accent');
  assert.ok(rec.recommendedProperties.totalEp, 'Matched totalEp with accent & #');
});

test('3.6: evaluatePropertyCompatibility() exhaustive status mapping', () => {
  const detected = {
    'Title': { type: 'title' },
    'Watch Status': { type: 'status' },
    'Platforms': { type: 'multi_select' },
    'Genres': { type: 'relation' },
    'Rating': { type: 'number' },
    'Release Date': { type: 'date' }
  };

  // 1. Exact match -> ok
  const exact = evaluatePropertyCompatibility({ notionName: 'Title', type: 'title' }, detected);
  assert.strictEqual(exact.status, 'ok');

  // 2. Relation with lookupTable -> ok
  const relOk = evaluatePropertyCompatibility({ notionName: 'Genres', type: 'relation', lookupTable: 'genres' }, detected);
  assert.strictEqual(relOk.status, 'ok');

  // 3. Relation without lookupTable -> warning
  const relWarn = evaluatePropertyCompatibility({ notionName: 'Genres', type: 'relation' }, detected);
  assert.strictEqual(relWarn.status, 'warning');

  // 4. Compatible select <-> status -> warning
  const selectStatusWarn = evaluatePropertyCompatibility({ notionName: 'Watch Status', type: 'select' }, detected);
  assert.strictEqual(selectStatusWarn.status, 'warning');

  // 5. Incompatible types -> error
  const incomp = evaluatePropertyCompatibility({ notionName: 'Rating', type: 'date' }, detected);
  assert.strictEqual(incomp.status, 'error');

  // 6. Column missing in Notion -> error
  const missing = evaluatePropertyCompatibility({ notionName: 'NonExistentColumn', type: 'rich_text' }, detected);
  assert.strictEqual(missing.status, 'error');

  // 7. Marked notMapped -> skipped
  const skipped = evaluatePropertyCompatibility({ notionName: 'Watch Status', type: 'select', notMapped: true }, detected);
  assert.strictEqual(skipped.status, 'skipped');

  // 8. Empty notionName -> skipped
  const emptyName = evaluatePropertyCompatibility({ notionName: '', type: 'select' }, detected);
  assert.strictEqual(emptyName.status, 'skipped');
});

test('3.7: runDryRunDiagnostic() on distinct and unified modes with simulated API failure', async () => {
  // Test distinct mode
  const distinctSchema = {
    databaseMode: 'distinct',
    mediaTypes: {
      movie: {
        databaseId: '312aec4b-87d9-8111-b530-d4af0c22d898',
        properties: {
          title: { notionName: 'Title', type: 'title' },
          rating: { notionName: 'Rating', type: 'number' }
        }
      }
    }
  };

  // Mock inspect function
  const mockInspect = async (dbId, apiKey) => {
    if (dbId.includes('fail')) throw new Error('Simulated network error');
    return {
      id: dbId,
      title: 'Mocked Database',
      properties: {
        'Title': { type: 'title' },
        'Rating': { type: 'number' }
      }
    };
  };

  const report = await runDryRunDiagnostic(distinctSchema, 'fake-key', { inspectFn: mockInspect });
  assert.strictEqual(report.overallStatus, 'ok');
  assert.strictEqual(report.summary.errors, 0);
  assert.strictEqual(report.summary.valid, 2);

  // Test failure branch
  const failingSchema = {
    databaseMode: 'distinct',
    mediaTypes: {
      movie: { databaseId: 'fail-id', properties: { title: { notionName: 'Title', type: 'title' } } }
    }
  };
  const failingReport = await runDryRunDiagnostic(failingSchema, 'fake-key', { inspectFn: mockInspect });
  assert.strictEqual(failingReport.overallStatus, 'error');
  assert.strictEqual(failingReport.databases[0].status, 'error');
  assert.ok(failingReport.databases[0].error.includes('Simulated network error'));
});

// ============================================================================
// 4. STRESS TESTING: validateSchema()
// ============================================================================
console.log('\n--- 4. Stress Testing: validateSchema() ---');

test('4.1: Rejects primitives, null, undefined, arrays, and functions', () => {
  const invalidInputs = [
    null,
    undefined,
    12345,
    -1,
    0,
    3.1415,
    true,
    false,
    '{"valid": "json"}',
    '',
    [],
    [1, 2, 3],
    () => {},
    Symbol('schema')
  ];

  for (const input of invalidInputs) {
    const res = validateSchema(input);
    assert.strictEqual(res.valid, false, `Must reject ${typeof input}: ${String(input)}`);
    assert.ok(Array.isArray(res.errors), 'Errors must be an array');
    assert.ok(res.errors.length > 0, 'Must have at least one error message');
  }
});

test('4.2: Handles null prototype objects (Object.create(null)) without crashing', () => {
  const nullProto = Object.create(null);
  const res = validateSchema(nullProto);
  assert.strictEqual(res.valid, false);
  assert.ok(res.errors.length > 0);

  // Valid schema built on Object.create(null)
  const validNullProto = Object.create(null);
  validNullProto.mediaTypes = Object.create(null);
  validNullProto.mediaTypes.movie = Object.create(null);
  validNullProto.mediaTypes.movie.properties = Object.create(null);
  validNullProto.mediaTypes.movie.properties.title = Object.create(null);
  validNullProto.mediaTypes.movie.properties.title.notionName = 'Title';
  validNullProto.mediaTypes.movie.properties.title.type = 'title';

  const resValid = validateSchema(validNullProto);
  assert.strictEqual(resValid.valid, true, 'Valid structure built with null prototypes passes');
});

test('4.3: Prototype pollution resilience', () => {
  const jsonWithProto = '{"__proto__": {"injected": true}, "mediaTypes": {"movie": {"properties": {"title": {"type": "title", "notionName": "Title"}, "__proto__": {"type": "rich_text", "notionName": "Hacked"}}}}}';
  const payload = JSON.parse(jsonWithProto);

  const res = validateSchema(payload);
  assert.strictEqual(res.valid, true);
  // Verify pollution did not leak to generic objects
  const freshObj = {};
  assert.strictEqual(freshObj.injected, undefined, 'Clean object was not polluted');
});

test('4.4: Rejects missing mediaTypes or mediaTypes without supported media', () => {
  assert.strictEqual(validateSchema({}).valid, false);
  assert.strictEqual(validateSchema({ mediaTypes: {} }).valid, false);
  assert.strictEqual(validateSchema({ mediaTypes: [] }).valid, false);
  assert.strictEqual(validateSchema({ mediaTypes: 'movie' }).valid, false);
  assert.strictEqual(validateSchema({ mediaTypes: { podcast: {}, book: {} } }).valid, false);
});

test('4.5: Rejects missing properties object or missing title property', () => {
  // Missing properties
  const noProps = {
    mediaTypes: {
      movie: { name: 'Films' }
    }
  };
  assert.strictEqual(validateSchema(noProps).valid, false);

  // Missing title property
  const noTitle = {
    mediaTypes: {
      movie: {
        properties: {
          rating: { notionName: 'Rating', type: 'number' }
        }
      }
    }
  };
  const resNoTitle = validateSchema(noTitle);
  assert.strictEqual(resNoTitle.valid, false);
  assert.ok(resNoTitle.errors.some(e => e.includes('propriété "title"')));

  // Title with empty notionName and invalid type
  const badTitle = {
    mediaTypes: {
      movie: {
        properties: {
          title: { notionName: '   ', type: 'rich_text' }
        }
      }
    }
  };
  const resBadTitle = validateSchema(badTitle);
  assert.strictEqual(resBadTitle.valid, false);
});

test('4.6: Validates unauthorized Notion column types against PERMITTED_NOTION_TYPES', () => {
  // All permitted types
  for (const type of PERMITTED_NOTION_TYPES) {
    const s = {
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Title', type: 'title' },
            testCol: { notionName: 'Test', type }
          }
        }
      }
    };
    const res = validateSchema(s);
    assert.strictEqual(res.valid, true, `Type "${type}" must be permitted`);
  }

  // Forbidden / Unsupported Notion column types
  const forbiddenTypes = ['formula', 'rollup', 'people', 'files', 'created_time', 'created_by', 'last_edited_time', 'sql_injection', '<script>'];
  for (const type of forbiddenTypes) {
    const s = {
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Title', type: 'title' },
            badCol: { notionName: 'Bad', type }
          }
        }
      }
    };
    const res = validateSchema(s);
    assert.strictEqual(res.valid, false, `Type "${type}" must be rejected`);
    assert.ok(res.errors.some(e => e.includes('non autorisé')));
  }
});

test('4.7: Scale stress: Validating massive schema with 500 properties', () => {
  const massiveSchema = {
    version: '1.0.0',
    mediaTypes: {
      movie: {
        properties: {
          title: { notionName: 'Title', type: 'title' }
        }
      }
    }
  };
  for (let i = 0; i < 500; i++) {
    massiveSchema.mediaTypes.movie.properties[`prop_${i}`] = {
      notionName: `Column ${i}`,
      type: i % 2 === 0 ? 'rich_text' : 'select'
    };
  }
  const t0 = performance.now();
  const res = validateSchema(massiveSchema);
  const elapsed = performance.now() - t0;
  assert.strictEqual(res.valid, true);
  assert.ok(elapsed < 50, `500 properties validated in ${elapsed.toFixed(2)}ms (must be < 50ms)`);
});

// ============================================================================
// 5. STRESS TESTING: buildNotionProperties() & Data Normalization
// ============================================================================
console.log('\n--- 5. Stress Testing: buildNotionProperties() & Data Normalization ---');

test('5.1: Handles unmapped properties and missing default values', () => {
  const itemData = {
    title: 'Tenet',
    overview: 'Time inversion',
    rating: 8.5
  };
  const mediaSchema = {
    properties: {
      title: { notionName: 'Title', type: 'title' },
      casts: { notionName: 'Casting', type: 'rich_text', notMapped: true },
      rating: { notionName: 'Score', type: 'number' },
      status: { notionName: 'Watch Status', type: 'select', defaultValue: '🔵 To Watch' }
    }
  };
  const props = buildNotionProperties(itemData, mediaSchema);
  assert.ok(props['Title'], 'Title built');
  assert.strictEqual(props['Title'].title[0].text.content, 'Tenet');
  assert.strictEqual(props['Casting'], undefined, 'Unmapped property excluded');
  assert.strictEqual(props['Score'].number, 8.5);
  assert.strictEqual(props['Watch Status'].select.name, '🔵 To Watch', 'Default value populated');
});

test('5.2: Mandatory Title fallback safety guard', () => {
  const itemData = { rating: 5 };
  const mediaSchema = {
    properties: {
      rating: { notionName: 'Rating', type: 'number' }
    }
  };
  const props = buildNotionProperties(itemData, mediaSchema);
  assert.ok(props['Title'], 'Mandatory Title created even when omitted from schema');
  assert.strictEqual(props['Title'].title[0].text.content, 'Sans titre');
});

// ============================================================================
// 6. ADVERSARIAL COVERAGE: renderTemplateBlocks, Lookups & Property Protections
// ============================================================================
console.log('\n--- 6. Adversarial Coverage: Template Engine & Property Adapters ---');

test('6.1: renderTemplateBlocks master toggles and fallbacks', () => {
  // usePageTemplate === false
  assert.deepStrictEqual(renderTemplateBlocks('movie-default', { title: 'Test' }, false), []);
  assert.deepStrictEqual(renderTemplateBlocks('blank', { title: 'Test' }, true), []);
  assert.deepStrictEqual(renderTemplateBlocks('none', { title: 'Test' }, true), []);

  // Unknown template string -> falls back to simple-summary
  const fallbackBlocks = renderTemplateBlocks('unknown-template-xyz', { overview: 'Fallback summary' }, true);
  assert.ok(fallbackBlocks.length > 0, 'Falls back to simple-summary');
  assert.strictEqual(fallbackBlocks[fallbackBlocks.length - 1].type, 'callout');

  // Custom template as function in customTemplates
  const customTemplates = {
    'custom-func': (v) => [NotionBlocks.paragraph(`Custom: ${v.title}`)]
  };
  const renderedCustom = renderTemplateBlocks('custom-func', { title: 'Custom Title' }, true, customTemplates);
  assert.strictEqual(renderedCustom.length, 1);
  assert.strictEqual(renderedCustom[0].paragraph.rich_text[0].text.content, 'Custom: Custom Title');
});

test('6.2: normalizeKey and resolveLookupId edge cases', () => {
  assert.strictEqual(normalizeKey(null), '');
  assert.strictEqual(normalizeKey(undefined), '');
  assert.strictEqual(normalizeKey('  Épisode Spécial  '), 'episode special');

  // resolveLookupId with direct UUID
  const uuid = '312aec4b-87d9-81dd-b8b7-c22b5505673f';
  assert.strictEqual(resolveLookupId(uuid, {}), uuid);
  assert.strictEqual(resolveLookupId(uuid.replace(/-/g, ''), {}), uuid.replace(/-/g, ''));

  // resolveLookupId with table lookup
  const table = { 'action': 'uuid-act', 'science-fiction': 'uuid-scifi' };
  assert.strictEqual(resolveLookupId('Action', table), 'uuid-act');
  assert.strictEqual(resolveLookupId('non-existent', table), null);
  assert.strictEqual(resolveLookupId(null, table), null);
  assert.strictEqual(resolveLookupId('action', null), null);
});

test('6.3: buildNotionProperties handles numbers, dates, checkboxes, and multi_select commas', () => {
  const itemData = {
    rating: '9.2',
    releaseDate: '2024-11-05T14:30:00.000Z',
    isFavourite: 1,
    genres: ['Action, Adventure', 'Sci-Fi'],
    notes: 'B'.repeat(3000)
  };

  const schema = {
    properties: {
      rating: { notionName: 'Rating', type: 'number' },
      releaseDate: { notionName: 'Release Date', type: 'date' },
      isFavourite: { notionName: 'Favourite', type: 'checkbox' },
      genres: { notionName: 'Tags', type: 'multi_select' },
      notes: { notionName: 'Notes', type: 'rich_text' }
    }
  };

  const props = buildNotionProperties(itemData, schema);
  assert.strictEqual(props['Rating'].number, 9.2);
  assert.strictEqual(props['Release Date'].date.start, '2024-11-05');
  assert.strictEqual(props['Favourite'].checkbox, true);
  // Commas replaced with spaces in multi_select tags
  assert.strictEqual(props['Tags'].multi_select[0].name, 'Action  Adventure');
  assert.strictEqual(props['Tags'].multi_select[1].name, 'Sci-Fi');
  // Rich text sliced to 2000 chars safety margin
  assert.strictEqual(props['Notes'].rich_text[0].text.content.length, 2000);
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n======================================================================');
console.log('📊 EMPIRICAL STRESS & FUZZING HARNESS EXECUTION SUMMARY');
console.log('======================================================================');
console.log(`  TOTAL TESTS EXECUTED : ${totalTests}`);
console.log(`  PASSED               : ${passedTests}`);
console.log(`  FAILED               : ${failedTests}`);
console.log('======================================================================');

if (failedTests > 0) {
  console.error(`\n🚨 ${failedTests} TEST(S) FAILED! Detailed findings:`);
  for (const f of findings) {
    console.error(`  - ${f.test}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\n🎉 ALL ADVERSARIAL STRESS AND FUZZ TESTS PASSED EMPIRICALLY!');
  process.exit(0);
}

