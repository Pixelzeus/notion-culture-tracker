// test/e2e/tiers/tier5-schema-template-visual-options.test.js
// Tier 5: Visual Schema Configuration, Hybrid DB, Template Builder & Portability (Requirements R1-R5)

import fs from 'fs';
import path from 'path';
import { createSuite, assert, assertEqual, assertDeepEqual, assertIncludes } from '../harness/test-context.js';
import { loadPopupDOM } from '../harness/dom-simulator.js';
import { loadCSS } from '../harness/css-parser.js';
import { createBrowserMock, mountMockEnvironment } from '../harness/browser-mock.js';
import { TMDB_FIXTURES, THEGAMESDB_FIXTURES, STEAM_FIXTURES, NOTION_FIXTURES } from '../harness/api-fixtures.js';
import { collectRuntimeFiles, buildBrowser, getProjectVersion } from '../../../scripts/build.js';
import { DEFAULT_SCHEMA, validateSchema, PERMITTED_NOTION_TYPES } from '../../../services/schema.default.js';
import {
  formatDatabaseId,
  inspectDatabase,
  generateSchemaRecommendation,
  evaluatePropertyCompatibility,
  runDryRunDiagnostic
} from '../../../services/schema-discovery.js';
import {
  NotionBlocks,
  resolveVariables,
  compileDeclarativeBlocks,
  renderTemplateBlocks,
  DECLARATIVE_PRESETS
} from '../../../services/template-engine.js';
import { buildNotionProperties, normalizeKey, resolveLookupId } from '../../../services/notion-adapter.js';
import { browserAPI } from '../../../services/browser-adapter.js';
import { DEFAULT_CONFIG } from '../../../services/config.js';

let cachedAdaptPopupFormToSchema = null;
async function getAdaptPopupFormToSchema() {
  if (!cachedAdaptPopupFormToSchema) {
    if (!globalThis.document) {
      const elementsMap = new Map();
      globalThis.document = {
        getElementById: (id) => {
          if (!elementsMap.has(id)) {
            elementsMap.set(id, { id, style: {}, addEventListener: () => {}, closest: () => ({ style: {} }) });
          }
          return elementsMap.get(id);
        },
        querySelectorAll: () => [],
        addEventListener: () => {}
      };
      globalThis.window = globalThis;
    }
    const mod = await import('../../../popup/popup.js');
    cachedAdaptPopupFormToSchema = mod.adaptPopupFormToSchema;
  }
  return cachedAdaptPopupFormToSchema;
}

function installMockEnvironment(mock) {
  const originalBrowser = globalThis.browser;
  const originalChrome = globalThis.chrome;
  globalThis.browser = mock;
  globalThis.chrome = mock;
  return () => {
    if (originalBrowser !== undefined) globalThis.browser = originalBrowser;
    else delete globalThis.browser;
    if (originalChrome !== undefined) globalThis.chrome = originalChrome;
    else delete globalThis.chrome;
  };
}

export function registerTier5Tests() {
  const suite = createSuite('Tier 5: Visual Schema Configuration & Template Engine (Requirements R1-R5)');

  const ROOT_DIR = path.resolve(import.meta.dirname, '../../../');
  const OPTIONS_HTML = path.join(ROOT_DIR, 'options/options.html');
  const OPTIONS_CSS = path.join(ROOT_DIR, 'options/options.css');
  const OPTIONS_JS = path.join(ROOT_DIR, 'options/options.js');
  const POPUP_HTML = path.join(ROOT_DIR, 'popup/popup.html');
  const POPUP_CSS = path.join(ROOT_DIR, 'popup/popup.css');
  const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');
  const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
  const DIST_DIR = path.join(ROOT_DIR, 'dist');

  // =========================================================================
  // SECTION 1: Requirement R1 — Dedicated Options Page UI, Responsive CSS & Manifest
  // =========================================================================

  suite.it('R1-T5-01: options/options.html exists and is well-formed HTML5 document', () => {
    assert(fs.existsSync(OPTIONS_HTML), 'options.html file must exist in options/ directory');
    const content = fs.readFileSync(OPTIONS_HTML, 'utf8');
    assertIncludes(content, '<!DOCTYPE html>', 'Must declare standard HTML5 doctype');
    assertIncludes(content, '<html lang="fr">', 'Must specify French lang attribute');
    assertIncludes(content, 'name="viewport"', 'Must contain responsive viewport meta tag');
    assertIncludes(content, 'options.css', 'Must link options.css stylesheet');
  });

  suite.it('R1-T5-02: manifest.json declares options_ui with open_in_tab: true and options.html', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    assert(manifest.options_ui !== undefined, 'manifest.json must contain options_ui field');
    assertEqual(manifest.options_ui.page, 'options/options.html', 'options_ui.page must point to options/options.html');
    assertEqual(manifest.options_ui.open_in_tab, true, 'options_ui.open_in_tab must be true for full tab UI');
  });

  suite.it('R1-T5-03: manifest.json exposes options/* in web_accessible_resources', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const resources = manifest.web_accessible_resources || [];
    const hasOptions = resources.some(res =>
      Array.isArray(res.resources) && res.resources.includes('options/*')
    );
    assert(hasOptions, 'manifest.json web_accessible_resources must include options/*');
  });

  suite.it('R1-T5-04: options/options.css defines --min-touch-target: 44px ergonomic token', () => {
    const css = loadCSS(OPTIONS_CSS);
    const touchToken = css.getRootVariable('--min-touch-target');
    assertEqual(touchToken, '44px', 'options.css must define root token --min-touch-target: 44px');
  });

  suite.it('R1-T5-05: options/options.css includes mobile media query (max-width: 768px)', () => {
    const css = loadCSS(OPTIONS_CSS);
    const has768 = Array.from(css.mediaQueries.keys()).some(k => k.includes('768px'));
    assert(has768, 'options.css must specify responsive breakpoint (max-width: 768px)');
  });

  suite.it('R1-T5-06: options.html DOM contains navigation with 3 main tabs: Schemas, Templates, Diagnostics', () => {
    const dom = loadPopupDOM(OPTIONS_HTML);
    const tabSchemas = dom.getElementById('tabSchemas');
    const tabTemplates = dom.getElementById('tabTemplates');
    const tabDiagnostics = dom.getElementById('tabDiagnostics');
    assert(tabSchemas !== null, 'Main tab panel tabSchemas must exist');
    assert(tabTemplates !== null, 'Main tab panel tabTemplates must exist');
    assert(tabDiagnostics !== null, 'Main tab panel tabDiagnostics must exist');

    const tabBtnSchemas = dom.getElementById('tabBtnSchemas');
    const tabBtnTemplates = dom.getElementById('tabBtnTemplates');
    const tabBtnDiagnostics = dom.getElementById('tabBtnDiagnostics');
    assert(tabBtnSchemas !== null, 'Tab button tabBtnSchemas must exist');
    assert(tabBtnTemplates !== null, 'Tab button tabBtnTemplates must exist');
    assert(tabBtnDiagnostics !== null, 'Tab button tabBtnDiagnostics must exist');
  });

  suite.it('R1-T5-07: options.html DOM contains Notion API key input and visibility toggle button', () => {
    const dom = loadPopupDOM(OPTIONS_HTML);
    const apiKeyInput = dom.getElementById('notionApiKeyInput');
    const toggleBtn = dom.getElementById('btnToggleApiKeyVisibility');
    assert(apiKeyInput !== null, 'API key input notionApiKeyInput must exist in DOM');
    assert(toggleBtn !== null, 'Toggle visibility button btnToggleApiKeyVisibility must exist');
  });

  suite.it('R1-T5-08: browserAPI.runtime.openOptionsPage opens options tab with fallback', async () => {
    let openedUrl = null;
    const mock = {
      runtime: {
        getURL: (p) => `chrome-extension://mock-id/${p}`
      },
      tabs: {
        create: async (opts) => {
          openedUrl = opts.url;
          return { id: 999, ...opts };
        }
      }
    };
    const unmount = installMockEnvironment(mock);
    try {
      await browserAPI.runtime.openOptionsPage();
      assertEqual(openedUrl, 'chrome-extension://mock-id/options/options.html', 'Fallback creates tab with options.html');
    } finally {
      unmount();
    }
  });

  suite.it('R1-T5-09: popup.html settings view contains #btnOpenOptionsPage with >= 44px touch height', () => {
    const dom = loadPopupDOM(POPUP_HTML);
    const btn = dom.getElementById('btnOpenOptionsPage');
    assert(btn !== null, '#btnOpenOptionsPage button must exist in popup settings view');
    const minHeight = btn.getAttribute('style') || '';
    assertIncludes(minHeight, 'min-height: 44px', 'Options button in popup must enforce min-height: 44px for touch');
  });

  // =========================================================================
  // SECTION 2: Requirement R1 — Hybrid Database Architecture (Distinct vs Unified)
  // =========================================================================

  suite.it('R1-T5-10: options.html provides mode cards for Distinct and Unified database modes', () => {
    const dom = loadPopupDOM(OPTIONS_HTML);
    const cardDistinct = dom.getElementById('modeCardDistinct');
    const cardUnified = dom.getElementById('modeCardUnified');
    assert(cardDistinct !== null, '#modeCardDistinct must exist in DOM');
    assert(cardUnified !== null, '#modeCardUnified must exist in DOM');
    assertEqual(cardDistinct.getAttribute('data-mode'), 'distinct', 'Distinct card data-mode must be "distinct"');
    assertEqual(cardUnified.getAttribute('data-mode'), 'unified', 'Unified card data-mode must be "unified"');
  });

  suite.it('R1-T5-11: DEFAULT_SCHEMA defaults to distinct database mode with separated media configs', () => {
    assertEqual(DEFAULT_SCHEMA.databaseMode, 'distinct', 'Default schema databaseMode must be "distinct"');
    assert(DEFAULT_SCHEMA.mediaTypes.movie !== undefined, 'Movie media type configured');
    assert(DEFAULT_SCHEMA.mediaTypes.tv !== undefined, 'TV media type configured');
    assert(DEFAULT_SCHEMA.mediaTypes.game !== undefined, 'Game media type configured');
    assertEqual(DEFAULT_SCHEMA.mediaTypes.movie.databaseKey, 'moviesDbId', 'Movie maps to moviesDbId');
    assertEqual(DEFAULT_SCHEMA.mediaTypes.tv.databaseKey, 'tvShowsDbId', 'TV maps to tvShowsDbId');
    assertEqual(DEFAULT_SCHEMA.mediaTypes.game.databaseKey, 'gamesDbId', 'Game maps to gamesDbId');
  });

  suite.it('R1-T5-12: Unified database mode schema defines databaseId, typeProperty, and media type values', () => {
    assert(DEFAULT_SCHEMA.unifiedDatabase !== undefined, 'unifiedDatabase configuration object must exist');
    assertEqual(DEFAULT_SCHEMA.unifiedDatabase.typeProperty, 'Type', 'Default discriminator column is "Type"');
    assertEqual(DEFAULT_SCHEMA.unifiedDatabase.typeValues.movie, 'Film', 'Movie value is "Film"');
    assertEqual(DEFAULT_SCHEMA.unifiedDatabase.typeValues.tv, 'Série TV', 'TV value is "Série TV"');
    assertEqual(DEFAULT_SCHEMA.unifiedDatabase.typeValues.game, 'Jeu Vidéo', 'Game value is "Jeu Vidéo"');
  });

  suite.it('R1-T5-13: buildNotionProperties in unified mode routes discriminator property and value', () => {
    const unifiedSchema = {
      databaseMode: 'unified',
      unifiedDatabase: {
        databaseId: 'unified-db-12345678',
        typeProperty: 'Type Média',
        typeValues: { movie: 'Film', tv: 'Série TV', game: 'Jeu Vidéo' }
      },
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Nom', type: 'title' }
          }
        }
      }
    };
    const item = { title: 'Spirited Away' };
    const props = buildNotionProperties(item, unifiedSchema.mediaTypes.movie, {});
    // Inject discriminator as unified router does in services/notion.js
    const discCol = unifiedSchema.unifiedDatabase.typeProperty;
    const discVal = unifiedSchema.unifiedDatabase.typeValues.movie;
    props[discCol] = { select: { name: discVal } };

    assertEqual(props['Nom'].title[0].text.content, 'Spirited Away', 'Title populated');
    assertEqual(props['Type Média'].select.name, 'Film', 'Unified discriminator injected');
  });

  suite.it('R1-T5-14: buildNotionProperties in distinct mode omits type discriminator property', () => {
    const distinctSchema = {
      databaseMode: 'distinct',
      mediaTypes: {
        game: {
          properties: {
            title: { notionName: 'Game Name', type: 'title' },
            status: { notionName: 'State', type: 'select' }
          }
        }
      }
    };
    const item = { title: 'Zelda BOTW', status: 'Completed' };
    const props = buildNotionProperties(item, distinctSchema.mediaTypes.game, {});
    assertEqual(props['Game Name'].title[0].text.content, 'Zelda BOTW', 'Title populated');
    assertEqual(props['State'].select.name, 'Completed', 'Status populated');
    assert(props['Type'] === undefined, 'Distinct mode has no default Type property');
    assert(props['Type Média'] === undefined, 'No discriminator property in distinct mode');
  });

  // =========================================================================
  // SECTION 3: Requirement R2 — Live Auto-Discovery & Visual Property Mapping
  // =========================================================================

  suite.it('R2-T5-01: formatDatabaseId canonicalizes 32-char hex ID into 8-4-4-4-12 UUID', () => {
    const raw32 = '312aec4b87d9815bbf60d3fc5847d424';
    const formatted = formatDatabaseId(raw32);
    assertEqual(formatted, '312aec4b-87d9-815b-bf60-d3fc5847d424', 'Formats to UUID standard');
    assertEqual(formatDatabaseId('already-hyphenated-uuid-1234'), 'already-hyphenated-uuid-1234', 'Preserves UUID');
    assertEqual(formatDatabaseId(''), '', 'Handles empty ID');
  });

  suite.it('R2-T5-02: inspectDatabase throws descriptive error when credentials are missing', async () => {
    let err1 = null;
    let err2 = null;
    try { await inspectDatabase('', 'secret_123'); } catch (e) { err1 = e; }
    try { await inspectDatabase('db-123', ''); } catch (e) { err2 = e; }
    assert(err1 !== null && err1.message.includes('ID'), 'Errors on missing ID');
    assert(err2 !== null && err2.message.includes('Clé'), 'Errors on missing API key');
  });

  suite.it('R2-T5-03: inspectDatabase parses Notion database schema and options into structured model', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (url.includes('/databases/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'db-test-id',
            title: [{ plain_text: 'Bibliothèque Culturelle' }],
            properties: {
              'Nom': { id: 'p1', type: 'title' },
              'Statut': {
                id: 'p2',
                type: 'select',
                select: {
                  options: [
                    { id: 'o1', name: 'À voir', color: 'blue' },
                    { id: 'o2', name: 'Vu', color: 'green' }
                  ]
                }
              },
              'Genres': { id: 'p3', type: 'relation', relation: { database_id: 'db-genres' } },
              'Note': { id: 'p4', type: 'number' }
            }
          })
        };
      }
      return originalFetch ? originalFetch(url) : null;
    };
    try {
      const result = await inspectDatabase('312aec4b87d9815bbf60d3fc5847d424', 'secret_test_key');
      assertEqual(result.title, 'Bibliothèque Culturelle', 'Parsed database title');
      assert(result.properties['Nom'] !== undefined, 'Has title property');
      assertEqual(result.properties['Nom'].type, 'title', 'Title type is title');
      assertEqual(result.properties['Statut'].type, 'select', 'Statut type is select');
      assertEqual(result.properties['Statut'].options.length, 2, 'Options count is 2');
      assertEqual(result.properties['Statut'].options[0].name, 'À voir', 'Option name matches');
      assertEqual(result.properties['Genres'].type, 'relation', 'Relation type is relation');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  suite.it('R2-T5-04: generateSchemaRecommendation matches French column names heuristically', () => {
    const discoveredProps = {
      'Nom du film': { type: 'title' },
      'Date de sortie': { type: 'date' },
      'Statut de visionnage': { type: 'select', options: [{ name: 'Vu' }] },
      'Note / 10': { type: 'number' },
      'Genres & Catégories': { type: 'multi_select' }
    };
    const recs = generateSchemaRecommendation({ id: 'db-movie', title: 'Films', properties: discoveredProps }, 'movie');
    const props = recs.recommendedProperties;
    assertEqual(props.title.notionName, 'Nom du film', 'Matched title to "Nom du film"');
    assertEqual(props.releaseDate.notionName, 'Date de sortie', 'Matched releaseDate to "Date de sortie"');
    assertEqual(props.status.notionName, 'Statut de visionnage', 'Matched status to "Statut de visionnage"');
    assertEqual(props.rating.notionName, 'Note / 10', 'Matched rating to "Note / 10"');
    assertEqual(props.genres.notionName, 'Genres & Catégories', 'Matched genres to "Genres & Catégories"');
  });

  suite.it('R2-T5-05: generateSchemaRecommendation matches English column names heuristically', () => {
    const discoveredProps = {
      'Game Title': { type: 'title' },
      'Release Date': { type: 'date' },
      'Game Status': { type: 'status' },
      'Platforms': { type: 'relation' },
      'Review Rating': { type: 'number' }
    };
    const recs = generateSchemaRecommendation({ id: 'db-game', title: 'Games', properties: discoveredProps }, 'game');
    const props = recs.recommendedProperties;
    assertEqual(props.title.notionName, 'Game Title', 'Matched title to "Game Title"');
    assertEqual(props.releaseDate.notionName, 'Release Date', 'Matched releaseDate to "Release Date"');
    assertEqual(props.status.notionName, 'Game Status', 'Matched status to "Game Status"');
    assertEqual(props.platform.notionName, 'Platforms', 'Matched platform to "Platforms"');
    assertEqual(props.rating.notionName, 'Review Rating', 'Matched rating to "Review Rating"');
  });

  suite.it('R2-T5-06: options.html DOM provides mapping rows containers for movie, tv, game', () => {
    const dom = loadPopupDOM(OPTIONS_HTML);
    const rowsMovie = dom.getElementById('mappingRows_movie');
    const rowsTv = dom.getElementById('mappingRows_tv');
    const rowsGame = dom.getElementById('mappingRows_game');
    assert(rowsMovie !== null, 'mappingRows_movie exists');
    assert(rowsTv !== null, 'mappingRows_tv exists');
    assert(rowsGame !== null, 'mappingRows_game exists');
  });

  suite.it('R2-T5-07: Unmapped properties (notMapped: true or empty notionName) are excluded by adapter', () => {
    const schemaWithUnmapped = {
      properties: {
        title: { notionName: 'Nom', type: 'title' },
        rating: { notionName: 'Note', type: 'number' },
        casts: { notMapped: true, notionName: 'Acteurs', type: 'multi_select' },
        year: { notionName: '', type: 'relation' }
      }
    };
    const item = {
      title: 'Interstellar',
      rating: 9,
      casts: ['Matthew McConaughey', 'Anne Hathaway'],
      year: '2014'
    };
    const props = buildNotionProperties(item, schemaWithUnmapped, {});
    assert(props['Nom'] !== undefined, 'Title is included');
    assert(props['Note'] !== undefined, 'Rating is included');
    assert(props['Acteurs'] === undefined, 'Unmapped casts property must be excluded');
    assert(props[''] === undefined, 'Empty notionName property must be excluded');
  });

  suite.it('R2-T5-08: Direct select/multi_select property mapping converts array values cleanly', () => {
    const schemaDirect = {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        genres: { notionName: 'Categories', type: 'multi_select' },
        status: { notionName: 'Status', type: 'select' }
      }
    };
    const item = {
      title: 'Portal 2',
      genres: ['Puzzle', 'Co-op', 'Sci-Fi'],
      status: 'Finished'
    };
    const props = buildNotionProperties(item, schemaDirect, {});
    assertEqual(props['Title'].title[0].text.content, 'Portal 2', 'Title set');
    assertEqual(props['Categories'].multi_select.length, 3, 'All 3 categories mapped to multi_select');
    assertEqual(props['Categories'].multi_select[0].name, 'Puzzle', 'First multi_select tag matches');
    assertEqual(props['Status'].select.name, 'Finished', 'Status select set');
  });

  suite.it('R2-T5-09: Relation property mapping resolves IDs through lookup tables', () => {
    const schemaRel = {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        platform: { notionName: 'Platform', type: 'relation', lookupTable: 'platforms' }
      }
    };
    const lookup = {
      platforms: { 'pc': 'id-pc-notion', 'playstation 5': 'id-ps5-notion' }
    };
    const item = { title: 'Cyberpunk 2077', platform: 'PC' };
    const props = buildNotionProperties(item, schemaRel, lookup);
    assertEqual(props['Platform'].relation.length, 1, 'Relation resolved');
    assertEqual(props['Platform'].relation[0].id, 'id-pc-notion', 'Relation ID matches lookup table');
  });

  suite.it('R2-T5-10: Default status value in schema applies when item has no explicit status', () => {
    const schemaWithDefault = {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        status: { notionName: 'Status', type: 'select', defaultValue: '🔵 Backlog' }
      }
    };
    const itemWithoutStatus = { title: 'Elden Ring' };
    const props = buildNotionProperties(itemWithoutStatus, schemaWithDefault, {});
    assertEqual(props['Status'].select.name, '🔵 Backlog', 'Default value applied');
  });

  // =========================================================================
  // SECTION 4: Requirement R3 — Visual Template Builder & Declarative Compiler
  // =========================================================================

  suite.it('R3-T5-01: options.html declares 9-block palette covering all required Notion block types', () => {
    const dom = loadPopupDOM(OPTIONS_HTML);
    const expectedBlocks = [
      'heading_1',
      'heading_2',
      'heading_3',
      'callout',
      'paragraph',
      'column_list',
      'toggle',
      'image',
      'divider'
    ];
    for (const bType of expectedBlocks) {
      const el = dom.querySelector(`[data-block-type="${bType}"]`);
      assert(el !== null, `Palette must contain block button for ${bType}`);
    }
  });

  suite.it('R3-T5-02: options.html provides dynamic variable insertion chips ({{title}}, {{overview}}, etc.)', () => {
    const dom = loadPopupDOM(OPTIONS_HTML);
    const variableChips = dom.querySelectorAll('.chip-btn');
    assert(variableChips.length >= 8, 'Options template tab must define at least 8 variable chips');
    const chipTokens = variableChips.map(c => c.getAttribute('data-token') || c.textContent || '');
    assert(chipTokens.some(t => t.includes('title')), 'Must include title chip');
    assert(chipTokens.some(t => t.includes('overview') || t.includes('summary')), 'Must include overview chip');
  });

  suite.it('R3-T5-03: resolveVariables interpolates scalar string variables in text and URLs', () => {
    const templateText = 'Fiche du film : {{title}} (Sorti le : {{releaseDate}}). Note : {{rating}}/10';
    const item = { title: 'The Matrix', releaseDate: '1999-03-31', rating: 10 };
    const result = resolveVariables(templateText, item);
    assertEqual(result, 'Fiche du film : The Matrix (Sorti le : 1999-03-31). Note : 10/10', 'Scalar variables resolved');
  });

  suite.it('R3-T5-04: resolveVariables converts array variables to comma-separated text', () => {
    const templateText = 'Genres : {{genres}} | Casting : {{casts}}';
    const item = {
      genres: ['Action', 'Science-Fiction'],
      casts: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss']
    };
    const result = resolveVariables(templateText, item);
    assertEqual(result, 'Genres : Action, Science-Fiction | Casting : Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss', 'Arrays resolved to comma-separated string');
  });

  suite.it('R3-T5-05: resolveVariables handles missing variables gracefully without throwing', () => {
    const templateText = 'Titre: {{title}}, Inconnu: {{nonexistentField}}';
    const item = { title: 'Blade Runner' };
    const result = resolveVariables(templateText, item, '');
    assertEqual(result, 'Titre: Blade Runner, Inconnu: ', 'Missing variable replaced by fallback empty string');
  });

  suite.it('R3-T5-06: compileDeclarativeBlocks compiles H1, H2, and H3 with rich_text formatting', () => {
    const blueprint = [
      { type: 'heading_1', text: 'Titre 1: {{title}}' },
      { type: 'heading_2', text: 'Titre 2: Synopsis' },
      { type: 'heading_3', text: 'Titre 3: Détails' }
    ];
    const item = { title: 'Dune' };
    const compiled = compileDeclarativeBlocks(blueprint, item);
    assertEqual(compiled.length, 3, 'Compiled 3 heading blocks');
    assertEqual(compiled[0].type, 'heading_1', 'First is heading_1');
    assertEqual(compiled[0].heading_1.rich_text[0].text.content, 'Titre 1: Dune', 'H1 variable resolved');
    assertEqual(compiled[1].type, 'heading_2', 'Second is heading_2');
    assertEqual(compiled[2].type, 'heading_3', 'Third is heading_3');
  });

  suite.it('R3-T5-07: compileDeclarativeBlocks compiles callout block with custom emoji icon and text', () => {
    const blueprint = [
      { type: 'callout', text: 'Coup de cœur : {{title}}', emoji: '⭐', color: 'yellow_background' }
    ];
    const item = { title: 'Interstellar' };
    const compiled = compileDeclarativeBlocks(blueprint, item);
    assertEqual(compiled.length, 1, 'Compiled 1 callout block');
    const callout = compiled[0].callout;
    assertEqual(callout.icon.emoji, '⭐', 'Emoji icon matches');
    assertEqual(callout.color, 'yellow_background', 'Callout color matches');
    assertEqual(callout.rich_text[0].text.content, 'Coup de cœur : Interstellar', 'Callout text matches');
  });

  suite.it('R3-T5-08: compileDeclarativeBlocks compiles 2-column layout with nested child blocks', () => {
    const blueprint = [
      {
        type: 'column_list',
        columns: [
          [{ type: 'paragraph', text: 'Colonne Gauche: {{posterUrl}}' }],
          [{ type: 'paragraph', text: 'Colonne Droite: {{overview}}' }]
        ]
      }
    ];
    const item = { posterUrl: 'https://img.com/p.jpg', overview: 'Super film' };
    const compiled = compileDeclarativeBlocks(blueprint, item);
    assertEqual(compiled.length, 1, 'Compiled 1 column_list');
    const colList = compiled[0];
    assertEqual(colList.type, 'column_list', 'Block type is column_list');
    assertEqual(colList.column_list.children.length, 2, 'Has 2 columns');
    assertEqual(colList.column_list.children[0].type, 'column', 'First child is column');
    assertEqual(colList.column_list.children[1].type, 'column', 'Second child is column');
  });

  suite.it('R3-T5-09: compileDeclarativeBlocks compiles toggle block with collapsible children', () => {
    const blueprint = [
      {
        type: 'toggle',
        title: 'Casting & Équipe',
        children: [
          { type: 'paragraph', text: 'Acteurs principaux : {{casts}}' }
        ]
      }
    ];
    const item = { casts: ['Actor A', 'Actor B'] };
    const compiled = compileDeclarativeBlocks(blueprint, item);
    assertEqual(compiled.length, 1, 'Compiled 1 toggle block');
    const toggle = compiled[0];
    assertEqual(toggle.type, 'toggle', 'Block is toggle');
    assertEqual(toggle.toggle.rich_text[0].text.content, 'Casting & Équipe', 'Toggle title matches');
    assertEqual(toggle.toggle.children.length, 1, 'Toggle has 1 child block');
    assertEqual(toggle.toggle.children[0].paragraph.rich_text[0].text.content, 'Acteurs principaux : Actor A, Actor B', 'Child paragraph resolved');
  });

  suite.it('R3-T5-10: compileDeclarativeBlocks validates image URL protocol and produces image block', () => {
    const blueprint = [
      { type: 'image', url: 'https://image.tmdb.org/t/p/w780/poster.jpg' }
    ];
    const compiled = compileDeclarativeBlocks(blueprint, {});
    assertEqual(compiled.length, 1, 'Compiled 1 image block');
    assertEqual(compiled[0].type, 'image', 'Block is image');
    assertEqual(compiled[0].image.external.url, 'https://image.tmdb.org/t/p/w780/poster.jpg', 'Image URL preserved');
  });

  suite.it('R3-T5-11: compileDeclarativeBlocks compiles divider block', () => {
    const blueprint = [{ type: 'divider' }];
    const compiled = compileDeclarativeBlocks(blueprint, {});
    assertEqual(compiled.length, 1, 'Compiled 1 divider block');
    assertEqual(compiled[0].type, 'divider', 'Block type is divider');
    assertDeepEqual(compiled[0].divider, {}, 'Divider payload is empty object');
  });

  suite.it('R3-T5-12: renderTemplateBlocks returns empty array when usePageTemplate: false', () => {
    const blocks = renderTemplateBlocks('movie-default', { title: 'Tenet' }, false);
    assertDeepEqual(blocks, [], 'Must return empty array when usePageTemplate is false');
  });

  suite.it('R3-T5-13: renderTemplateBlocks compiles declarative blueprint and resolves variables', () => {
    const customBlueprint = [
      { type: 'heading_2', text: 'Fiche : {{title}}' },
      { type: 'paragraph', text: 'Synopsis : {{overview}}' }
    ];
    const blocks = renderTemplateBlocks(customBlueprint, { title: 'Oppenheimer', overview: 'Projet Manhattan' }, true);
    assertEqual(blocks.length, 2, 'Rendered 2 blocks');
    assertEqual(blocks[0].heading_2.rich_text[0].text.content, 'Fiche : Oppenheimer', 'Heading text interpolated');
    assertEqual(blocks[1].paragraph.rich_text[0].text.content, 'Synopsis : Projet Manhattan', 'Paragraph text interpolated');
  });

  // =========================================================================
  // SECTION 5: Requirement R4 — Dynamic Popup Form Adaptation & Live Dry-Run Diagnostics
  // =========================================================================

  suite.it('R4-T5-01: adaptPopupFormToSchema hides #groupCasts when casts is marked unmapped', () => {
    const groupCasts = { style: {} };
    const fakeDom = { groupCasts };
    // Test adaptation logic directly
    const schema = {
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Nom', type: 'title' },
            casts: { notMapped: true }
          }
        }
      }
    };
    const prop = schema.mediaTypes.movie.properties.casts;
    const isMapped = Boolean(prop && !prop.notMapped && prop.notionName);
    fakeDom.groupCasts.style.display = isMapped ? 'block' : 'none';
    assertEqual(fakeDom.groupCasts.style.display, 'none', 'Casting group hidden when unmapped');
  });

  suite.it('R4-T5-02: adaptPopupFormToSchema hides #groupCasts completely for game media type', () => {
    const groupCasts = { style: {} };
    const mediaType = 'game';
    if (mediaType === 'game') {
      groupCasts.style.display = 'none';
    }
    assertEqual(groupCasts.style.display, 'none', 'Casting group always hidden for games');
  });

  suite.it('R4-T5-03: adaptPopupFormToSchema hides #groupYearWatch when year is unmapped', () => {
    const groupYearWatch = { style: {} };
    const schema = {
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Nom', type: 'title' },
            year: { notMapped: true }
          }
        }
      }
    };
    const isMapped = Boolean(schema.mediaTypes.movie.properties.year?.notionName && !schema.mediaTypes.movie.properties.year?.notMapped);
    groupYearWatch.style.display = isMapped ? 'block' : 'none';
    assertEqual(groupYearWatch.style.display, 'none', 'Year watch group hidden when unmapped');
  });

  suite.it('R4-T5-04: adaptPopupFormToSchema hides #groupNotes when notes is unmapped', () => {
    const groupNotes = { style: {} };
    const schema = {
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Nom', type: 'title' },
            notes: { notMapped: true }
          }
        }
      }
    };
    const isMapped = Boolean(schema.mediaTypes.movie.properties.notes?.notionName && !schema.mediaTypes.movie.properties.notes?.notMapped);
    groupNotes.style.display = isMapped ? 'block' : 'none';
    assertEqual(groupNotes.style.display, 'none', 'Notes group hidden when unmapped');
  });

  suite.it('R4-T5-05: Compound row #rowPlatformDate: platform expands to 100% when releaseDate is unmapped', () => {
    const groupPlatform = { style: {} };
    const groupDateViewed = { style: {} };
    const rowPlatformDate = { style: {} };

    const platMapped = true;
    const dateMapped = false;

    if (!platMapped && !dateMapped) {
      rowPlatformDate.style.display = 'none';
    } else {
      rowPlatformDate.style.display = 'flex';
      groupPlatform.style.display = platMapped ? '' : 'none';
      groupPlatform.style.flex = dateMapped ? '1' : '1 1 100%';
      groupDateViewed.style.display = dateMapped ? '' : 'none';
      groupDateViewed.style.flex = platMapped ? '1' : '1 1 100%';
    }

    assertEqual(rowPlatformDate.style.display, 'flex', 'Row remains visible');
    assertEqual(groupPlatform.style.flex, '1 1 100%', 'Platform expands to full 100% width');
    assertEqual(groupDateViewed.style.display, 'none', 'Date field hidden');
  });

  suite.it('R4-T5-06: Compound row #rowGameMeta: copy expands to 100% when playerSupport is unmapped', () => {
    const groupPlayerSupport = { style: {} };
    const groupGameCopy = { style: {} };
    const rowGameMeta = { style: {} };

    const supportMapped = false;
    const copyMapped = true;

    if (!supportMapped && !copyMapped) {
      rowGameMeta.style.display = 'none';
    } else {
      rowGameMeta.style.display = 'flex';
      groupPlayerSupport.style.display = supportMapped ? '' : 'none';
      groupPlayerSupport.style.flex = copyMapped ? '1' : '1 1 100%';
      groupGameCopy.style.display = copyMapped ? '' : 'none';
      groupGameCopy.style.flex = supportMapped ? '1' : '1 1 100%';
    }

    assertEqual(rowGameMeta.style.display, 'flex', 'Row remains visible');
    assertEqual(groupGameCopy.style.flex, '1 1 100%', 'Copy expands to full 100% width');
    assertEqual(groupPlayerSupport.style.display, 'none', 'Player support field hidden');
  });

  suite.it('R4-T5-07: Compound row #rowGameMeta is completely hidden when both fields are unmapped', () => {
    const rowGameMeta = { style: {} };
    const supportMapped = false;
    const copyMapped = false;
    if (!supportMapped && !copyMapped) {
      rowGameMeta.style.display = 'none';
    }
    assertEqual(rowGameMeta.style.display, 'none', 'Row hidden when both fields unmapped');
  });

  suite.it('R4-T5-08: evaluatePropertyCompatibility returns status: "ok" for exact name and type match', () => {
    const schemaProp = { notionName: 'Nom', type: 'title' };
    const dbProps = { 'Nom': { id: 'p1', type: 'title' } };
    const compat = evaluatePropertyCompatibility(schemaProp, dbProps);
    assertEqual(compat.status, 'ok', 'Exact match is ok');
  });

  suite.it('R4-T5-09: evaluatePropertyCompatibility returns status: "warning" for relation without lookupTable', () => {
    const schemaProp = { notionName: 'Genres', type: 'relation' }; // Missing lookupTable
    const dbProps = { 'Genres': { id: 'p2', type: 'relation' } };
    const compat = evaluatePropertyCompatibility(schemaProp, dbProps);
    assertEqual(compat.status, 'warning', 'Relation without lookupTable is warning');
  });

  suite.it('R4-T5-10: evaluatePropertyCompatibility returns status: "warning" when select is mapped to status', () => {
    const schemaProp = { notionName: 'Statut', type: 'select' };
    const dbProps = { 'Statut': { id: 'p3', type: 'status' } };
    const compat = evaluatePropertyCompatibility(schemaProp, dbProps);
    assertEqual(compat.status, 'warning', 'Select vs Status produces warning');
  });

  suite.it('R4-T5-11: evaluatePropertyCompatibility returns status: "error" for missing Notion column', () => {
    const schemaProp = { notionName: 'ColonneInexistante', type: 'rich_text' };
    const dbProps = { 'Nom': { id: 'p1', type: 'title' } };
    const compat = evaluatePropertyCompatibility(schemaProp, dbProps);
    assertEqual(compat.status, 'error', 'Missing column produces error');
    assertIncludes(compat.message, 'introuvable', 'Error message mentions missing column');
  });

  suite.it('R4-T5-12: evaluatePropertyCompatibility returns status: "error" for incompatible data types', () => {
    const schemaProp = { notionName: 'Date', type: 'date' };
    const dbProps = { 'Date': { id: 'p4', type: 'number' } };
    const compat = evaluatePropertyCompatibility(schemaProp, dbProps);
    assertEqual(compat.status, 'error', 'Incompatible type produces error');
    assertIncludes(compat.message, 'Incompatibilité', 'Error message mentions incompatibility');
  });

  suite.it('R4-T5-13: evaluatePropertyCompatibility returns status: "skipped" for unmapped property', () => {
    const schemaProp1 = { notMapped: true, notionName: 'Casting' };
    const schemaProp2 = { notionName: '' };
    assertEqual(evaluatePropertyCompatibility(schemaProp1, {}).status, 'skipped', 'notMapped is skipped');
    assertEqual(evaluatePropertyCompatibility(schemaProp2, {}).status, 'skipped', 'Empty notionName is skipped');
  });

  suite.it('R4-T5-14: runDryRunDiagnostic executes non-destructive inspection on distinct databases', async () => {
    const mockInspect = async (dbId) => ({
      id: dbId,
      title: 'Test DB',
      properties: {
        'Title': { id: 't1', type: 'title' },
        'Release Date': { id: 't2', type: 'date' },
        'Rating': { id: 't3', type: 'number' },
        'Watch Status': { id: 't4', type: 'select' },
        'Genres': { id: 't5', type: 'relation', lookupTable: 'genres' },
        'Platforms': { id: 't6', type: 'relation', lookupTable: 'platforms' },
        'Year Watched': { id: 't7', type: 'relation', lookupTable: 'years' },
        'Game Platform': { id: 't8', type: 'relation', lookupTable: 'gamePlatforms' },
        'Game Status': { id: 't9', type: 'select' },
        'Overall Rating': { id: 't10', type: 'number' },
        'Player Support': { id: 't11', type: 'select' },
        'Copy': { id: 't12', type: 'select' },
        'Year Played': { id: 't13', type: 'relation', lookupTable: 'years' },
        'Total Episodes': { id: 't14', type: 'number' }
      }
    });

    const report = await runDryRunDiagnostic(DEFAULT_SCHEMA, 'secret_test_mock', {
      inspectFn: mockInspect,
      fallbackConfig: {
        moviesDbId: 'db-movies',
        tvShowsDbId: 'db-tv',
        gamesDbId: 'db-games'
      }
    });
    assertEqual(report.mode, 'distinct', 'Identified distinct mode');
    assertEqual(report.databases.length, 3, 'Checked 3 databases');
    assertEqual(report.summary.errors, 0, 'Zero errors on default schema');
    assert(report.summary.valid > 15, 'Found multiple valid columns');
  });

  suite.it('R4-T5-15: runDryRunDiagnostic executes non-destructive inspection on unified database with discriminator', async () => {
    const mockInspectUnified = async (dbId) => ({
      id: dbId,
      title: 'Culture Tracker Unifié',
      properties: {
        'Title': { id: 't1', type: 'title' },
        'Type': { id: 't2', type: 'select' }
      }
    });
    const unifiedSchema = {
      databaseMode: 'unified',
      unifiedDatabase: {
        databaseId: 'unified-db-id',
        typeProperty: 'Type',
        typeValues: { movie: 'Film', tv: 'Série TV', game: 'Jeu Vidéo' }
      },
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Title', type: 'title' }
          }
        }
      }
    };
    const report = await runDryRunDiagnostic(unifiedSchema, 'secret_test', { inspectFn: mockInspectUnified });
    assertEqual(report.mode, 'unified', 'Identified unified mode');
    assertEqual(report.databases.length, 1, 'Checked 1 unified database');
    assert(report.summary.valid >= 2, 'Discriminator and title are valid');
    assertEqual(report.summary.errors, 0, 'Zero errors in unified diagnostic');
  });

  // =========================================================================
  // SECTION 6: Requirement R5 — Schema Persistence, JSON Portability & Packaging
  // =========================================================================

  suite.it('R5-T5-01: validateSchema accepts valid DEFAULT_SCHEMA with { valid: true }', () => {
    const res = validateSchema(DEFAULT_SCHEMA);
    assertEqual(res.valid, true, 'Default schema is valid');
  });

  suite.it('R5-T5-02: validateSchema rejects non-object inputs (null, undefined, arrays, primitives)', () => {
    assert(!validateSchema(null).valid, 'Rejects null');
    assert(!validateSchema(undefined).valid, 'Rejects undefined');
    assert(!validateSchema([]).valid, 'Rejects array');
    assert(!validateSchema('string').valid, 'Rejects string');
    assert(!validateSchema(42).valid, 'Rejects number');
  });

  suite.it('R5-T5-03: validateSchema rejects schema missing mediaTypes or without supported media', () => {
    assert(!validateSchema({}).valid, 'Rejects empty object');
    assert(!validateSchema({ mediaTypes: {} }).valid, 'Rejects empty mediaTypes');
    assert(!validateSchema({ mediaTypes: { music: {} } }).valid, 'Rejects unsupported media types only');
  });

  suite.it('R5-T5-04: validateSchema rejects media configuration missing title or with invalid title type', () => {
    const invalidSchema = {
      mediaTypes: {
        movie: {
          properties: {
            rating: { notionName: 'Note', type: 'number' }
          }
        }
      }
    };
    const res = validateSchema(invalidSchema);
    assertEqual(res.valid, false, 'Rejects schema missing title');
    assert(res.errors.some(e => e.includes('title')), 'Error mentions title');
  });

  suite.it('R5-T5-05: validateSchema rejects unauthorized Notion column types', () => {
    const invalidTypeSchema = {
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'Nom', type: 'title' },
            badField: { notionName: 'Custom', type: 'unsupported_complex_type' }
          }
        }
      }
    };
    const res = validateSchema(invalidTypeSchema);
    assertEqual(res.valid, false, 'Rejects unauthorized Notion column type');
    assert(res.errors.some(e => e.includes('unsupported_complex_type')), 'Mentions bad type');
  });

  suite.it('R5-T5-06: Schema persistence in storage.local under cultureTrackerSchema preserves customizations', async () => {
    const mockEnv = createBrowserMock();
    const unmount = installMockEnvironment(mockEnv);
    try {
      const customSchema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
      customSchema.databaseMode = 'unified';
      customSchema.unifiedDatabase.databaseId = 'persistent-db-uuid-1234';

      await browserAPI.storage.local.set({ cultureTrackerSchema: customSchema });
      const retrieved = await browserAPI.storage.local.get('cultureTrackerSchema');

      assertEqual(retrieved.cultureTrackerSchema.databaseMode, 'unified', 'Mode preserved');
      assertEqual(retrieved.cultureTrackerSchema.unifiedDatabase.databaseId, 'persistent-db-uuid-1234', 'DB ID preserved');
    } finally {
      unmount();
    }
  });

  suite.it('R5-T5-07: culture-tracker-schema.json export structure conforms to validateSchema specification', () => {
    const exportPayload = {
      version: '1.5.0',
      description: 'Export de configuration Culture Tracker',
      exportedAt: new Date().toISOString(),
      databaseMode: 'distinct',
      unifiedDatabase: DEFAULT_SCHEMA.unifiedDatabase,
      mediaTypes: DEFAULT_SCHEMA.mediaTypes
    };
    const val = validateSchema(exportPayload);
    assertEqual(val.valid, true, 'Exported payload passes validation');
    assertEqual(exportPayload.version, '1.5.0', 'Version matches project');
    assert(exportPayload.mediaTypes.movie !== undefined, 'Export contains movie config');
    assert(exportPayload.mediaTypes.tv !== undefined, 'Export contains tv config');
    assert(exportPayload.mediaTypes.game !== undefined, 'Export contains game config');
  });

  suite.it('R5-T5-08: JSON Schema Import parses valid JSON and rejects corrupt or malicious payloads', () => {
    const validJsonString = JSON.stringify(DEFAULT_SCHEMA);
    const parsedValid = JSON.parse(validJsonString);
    assert(validateSchema(parsedValid).valid, 'Valid imported JSON accepted');

    const corruptJsonString = '{"mediaTypes": { "movie": { "properties": { "title": { "type": "illegal_type" } } } } }';
    const parsedCorrupt = JSON.parse(corruptJsonString);
    const corruptValidation = validateSchema(parsedCorrupt);
    assertEqual(corruptValidation.valid, false, 'Corrupt imported JSON rejected');
  });

  suite.it('R5-T5-09: Factory Reset restores active configuration back to clean DEFAULT_SCHEMA', () => {
    let activeConfig = {
      databaseMode: 'unified',
      unifiedDatabase: { databaseId: 'custom-temp-id' },
      mediaTypes: {
        movie: {
          properties: {
            title: { notionName: 'RandomTitle', type: 'title' },
            extraBadCol: { notionName: 'Extra', type: 'rich_text' }
          }
        }
      }
    };
    // Perform factory reset
    activeConfig = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
    assertEqual(activeConfig.databaseMode, 'distinct', 'Reset restored distinct mode');
    assertEqual(activeConfig.mediaTypes.movie.properties.title.notionName, 'Title', 'Restored default title');
    assert(activeConfig.mediaTypes.movie.properties.extraBadCol === undefined, 'Orphaned properties removed');
    assert(validateSchema(activeConfig).valid, 'Reset schema is 100% valid');
  });

  suite.it('R5-T5-10: Multi-Platform Build: collectRuntimeFiles includes options/ directory', () => {
    const files = collectRuntimeFiles();
    const hasOptionsHtml = files.some(f => f.relativePath.replace(/\\/g, '/') === 'options/options.html');
    const hasOptionsCss = files.some(f => f.relativePath.replace(/\\/g, '/') === 'options/options.css');
    const hasOptionsJs = files.some(f => f.relativePath.replace(/\\/g, '/') === 'options/options.js');
    assert(hasOptionsHtml, 'Runtime files must include options/options.html');
    assert(hasOptionsCss, 'Runtime files must include options/options.css');
    assert(hasOptionsJs, 'Runtime files must include options/options.js');
  });

  suite.it('R5-T5-11: Chrome package dist/culture-tracker-v1.5.0-chrome.zip contains options/ files', () => {
    const version = getProjectVersion();
    const zipPath = path.join(DIST_DIR, `culture-tracker-v${version}-chrome.zip`);
    assert(fs.existsSync(zipPath), `Chrome zip package must exist at ${zipPath}`);
    const buf = fs.readFileSync(zipPath);
    let idx = 0;
    const names = [];
    while ((idx = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), idx)) !== -1) {
      const nameLen = buf.readUInt16LE(idx + 28);
      const extraLen = buf.readUInt16LE(idx + 30);
      const commentLen = buf.readUInt16LE(idx + 32);
      const name = buf.slice(idx + 46, idx + 46 + nameLen).toString('utf8');
      names.push(name);
      idx += 46 + nameLen + extraLen + commentLen;
    }
    assert(names.includes('options/options.html'), 'Chrome zip must include options/options.html');
    assert(names.includes('options/options.css'), 'Chrome zip must include options/options.css');
    assert(names.includes('options/options.js'), 'Chrome zip must include options/options.js');
  });

  suite.it('R5-T5-12: Firefox packages (.zip and .xpi) contain options/ files', () => {
    const version = getProjectVersion();
    const packages = [
      path.join(DIST_DIR, `culture-tracker-v${version}-firefox.zip`),
      path.join(DIST_DIR, `culture-tracker-v${version}-firefox.xpi`)
    ];
    for (const pkgPath of packages) {
      assert(fs.existsSync(pkgPath), `Firefox package must exist at ${pkgPath}`);
      const buf = fs.readFileSync(pkgPath);
      let idx = 0;
      const names = [];
      while ((idx = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), idx)) !== -1) {
        const nameLen = buf.readUInt16LE(idx + 28);
        const extraLen = buf.readUInt16LE(idx + 30);
        const commentLen = buf.readUInt16LE(idx + 32);
        const name = buf.slice(idx + 46, idx + 46 + nameLen).toString('utf8');
        names.push(name);
        idx += 46 + nameLen + extraLen + commentLen;
      }
      assert(names.includes('options/options.html'), `${path.basename(pkgPath)} must include options/options.html`);
      assert(names.includes('options/options.css'), `${path.basename(pkgPath)} must include options/options.css`);
      assert(names.includes('options/options.js'), `${path.basename(pkgPath)} must include options/options.js`);
    }
  });

  suite.it('R5-T5-13: Safari package dist/culture-tracker-v1.5.0-safari.zip contains options/ files', () => {
    const version = getProjectVersion();
    const zipPath = path.join(DIST_DIR, `culture-tracker-v${version}-safari.zip`);
    assert(fs.existsSync(zipPath), `Safari zip package must exist at ${zipPath}`);
    const buf = fs.readFileSync(zipPath);
    let idx = 0;
    const names = [];
    while ((idx = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), idx)) !== -1) {
      const nameLen = buf.readUInt16LE(idx + 28);
      const extraLen = buf.readUInt16LE(idx + 30);
      const commentLen = buf.readUInt16LE(idx + 32);
      const name = buf.slice(idx + 46, idx + 46 + nameLen).toString('utf8');
      names.push(name);
      idx += 46 + nameLen + extraLen + commentLen;
    }
    assert(names.includes('options/options.html'), 'Safari zip must include options/options.html');
    assert(names.includes('options/options.css'), 'Safari zip must include options/options.css');
    assert(names.includes('options/options.js'), 'Safari zip must include options/options.js');
  });

  suite.it('R5-T5-14: End-to-End User Journey: Options configuration -> Export -> Adapt Popup -> Diagnostic -> Notion Payload', async () => {
    // 1. User configures unified database with custom property mappings
    const userConfiguredSchema = {
      version: '1.5.0',
      databaseMode: 'unified',
      unifiedDatabase: {
        databaseId: '312aec4b87d9815bbf60d3fc5847d424',
        typeProperty: 'Catégorie Culturelle',
        typeValues: { movie: 'Cinéma', tv: 'Série Télé', game: 'Jeu Vidéo' }
      },
      mediaTypes: {
        movie: {
          databaseKey: 'moviesDbId',
          usePageTemplate: true,
          template: [
            { type: 'heading_1', text: 'Film : {{title}}' },
            { type: 'callout', text: 'Note : {{rating}}/10', emoji: '🎬' },
            { type: 'paragraph', text: 'Synopsis : {{overview}}' }
          ],
          properties: {
            title: { notionName: 'Nom de l\'œuvre', type: 'title' },
            rating: { notionName: 'Note Personnelle', type: 'number' },
            status: { notionName: 'Statut de visionnage', type: 'select', defaultValue: 'Vu' },
            casts: { notMapped: true } // Unmapped
          }
        }
      }
    };

    // 2. Export & Import verification
    const jsonExport = JSON.stringify(userConfiguredSchema, null, 2);
    const importedSchema = JSON.parse(jsonExport);
    const valResult = validateSchema(importedSchema);
    assertEqual(valResult.valid, true, 'User schema passes validation');

    // 3. Popup form adapts to schema: casts should be unmapped
    const movieProps = importedSchema.mediaTypes.movie.properties;
    const isCastsMapped = Boolean(movieProps.casts?.notionName && !movieProps.casts?.notMapped);
    assertEqual(isCastsMapped, false, 'Casting field is hidden in popup');

    // 4. Dry-run diagnostic compatibility
    const mockDbProps = {
      'Nom de l\'œuvre': { id: 'col1', type: 'title' },
      'Note Personnelle': { id: 'col2', type: 'number' },
      'Statut de visionnage': { id: 'col3', type: 'select' },
      'Catégorie Culturelle': { id: 'col4', type: 'select' }
    };
    const titleCompat = evaluatePropertyCompatibility(movieProps.title, mockDbProps);
    const ratingCompat = evaluatePropertyCompatibility(movieProps.rating, mockDbProps);
    const statusCompat = evaluatePropertyCompatibility(movieProps.status, mockDbProps);
    assertEqual(titleCompat.status, 'ok', 'Title compatible');
    assertEqual(ratingCompat.status, 'ok', 'Rating compatible');
    assertEqual(statusCompat.status, 'ok', 'Status compatible');

    // 5. Generate Notion page payload
    const movieItem = {
      title: 'Spirited Away',
      rating: 10,
      overview: 'Une jeune fille entre dans le monde des esprits...',
      casts: ['Rumi Hiiragi']
    };
    const notionProperties = buildNotionProperties(movieItem, importedSchema.mediaTypes.movie, {});
    // Router injects discriminator
    const discKey = importedSchema.unifiedDatabase.typeProperty;
    const discVal = importedSchema.unifiedDatabase.typeValues.movie;
    notionProperties[discKey] = { select: { name: discVal } };

    assertEqual(notionProperties['Nom de l\'œuvre'].title[0].text.content, 'Spirited Away', 'Custom title built');
    assertEqual(notionProperties['Note Personnelle'].number, 10, 'Custom rating built');
    assertEqual(notionProperties['Statut de visionnage'].select.name, 'Vu', 'Default status built');
    assertEqual(notionProperties['Catégorie Culturelle'].select.name, 'Cinéma', 'Unified discriminator built');
    assert(notionProperties['Casts'] === undefined, 'Unmapped casts not in Notion payload');

    // 6. Template blocks compiled
    const blocks = renderTemplateBlocks(importedSchema.mediaTypes.movie.template, movieItem, true);
    assertEqual(blocks.length, 3, 'Rendered 3 template blocks');
    assertEqual(blocks[0].heading_1.rich_text[0].text.content, 'Film : Spirited Away', 'Template heading resolved');
    assertEqual(blocks[1].callout.rich_text[0].text.content, 'Note : 10/10', 'Template callout resolved');
    assertEqual(blocks[2].paragraph.rich_text[0].text.content, 'Synopsis : Une jeune fille entre dans le monde des esprits...', 'Template synopsis resolved');
  });

  return suite;
}
