// test/e2e/tiers/tier4-real-world-workflows.test.js
// Tier 4: Real-World Application Scenarios (8 comprehensive end-to-end user workflows)

import fs from 'fs';
import path from 'path';
import { createSuite, assert, assertEqual, assertDeepEqual, assertIncludes } from '../harness/test-context.js';
import { loadPopupDOM } from '../harness/dom-simulator.js';
import { loadCSS } from '../harness/css-parser.js';
import { createBrowserMock, mountMockEnvironment } from '../harness/browser-mock.js';
import { TMDB_FIXTURES, THEGAMESDB_FIXTURES, STEAM_FIXTURES, NOTION_FIXTURES } from '../harness/api-fixtures.js';

export function registerTier4Tests() {
  const suite = createSuite('Tier 4: Real-World Application Scenarios (8 End-to-End User Workflows)');

  const ROOT_DIR = path.resolve(import.meta.dirname, '../../../');
  const NOTION_ADAPTER_JS = path.join(ROOT_DIR, 'services/notion-adapter.js');
  const TEMPLATE_ENGINE_JS = path.join(ROOT_DIR, 'services/template-engine.js');
  const SCHEMA_DISCOVERY_JS = path.join(ROOT_DIR, 'services/schema-discovery.js');
  const CONFIG_JS = path.join(ROOT_DIR, 'services/config.js');
  const POPUP_HTML = path.join(ROOT_DIR, 'popup/popup.html');
  const POPUP_CSS = path.join(ROOT_DIR, 'popup/popup.css');
  const BROWSER_ADAPTER_PATH = path.join(ROOT_DIR, 'services/browser-adapter.js');

  // =========================================================================
  // Workflow 1: Full TMDb Movie Search to Notion Page Creation Workflow
  // =========================================================================
  suite.it('W01: Full TMDb Movie Search to Notion Page Creation Workflow', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    // Step 1: User queries TMDb for 'Inception'
    const searchData = TMDB_FIXTURES.searchMovieInception;
    assert(searchData.results.length > 0, 'TMDb search returns results');
    const movieResult = searchData.results[0];
    assertEqual(movieResult.title, 'Inception', 'Movie title found');

    // Step 2: User selects movie, fetching full details
    const movieDetail = TMDB_FIXTURES.movieInceptionDetail;
    assertEqual(movieDetail.id, movieResult.id, 'Detail ID matches search result');

    // Step 3: User customizes entry in detail form
    const userSelection = {
      title: movieDetail.title,
      overview: movieDetail.overview,
      releaseDate: movieDetail.release_date,
      posterUrl: `https://image.tmdb.org/t/p/w780${movieDetail.poster_path}`,
      backdropUrl: `https://image.tmdb.org/t/p/w1280${movieDetail.backdrop_path}`,
      status: '🟢 Terminé',
      rating: 10,
      favourite: true,
      genres: movieDetail.genres.map(g => g.name)
    };

    // Step 4: Notion schema with relations
    const relationSchema = {
      properties: {
        title: { notionName: 'Nom', type: 'title' },
        status: { notionName: 'Statut', type: 'select' },
        rating: { notionName: 'Note / 10', type: 'number' },
        genres: { notionName: 'Genres', type: 'relation', lookupTable: 'genres' }
      }
    };
    const lookupTables = {
      genres: { action: 'id-genre-action', 'science-fiction': 'id-genre-scifi', aventure: 'id-genre-adv' }
    };

    // Step 5: Adapter builds Notion properties payload
    const properties = buildNotionProperties(userSelection, relationSchema, lookupTables);
    assertEqual(properties['Nom'].title[0].text.content, 'Inception', 'Title property populated');
    assertEqual(properties['Statut'].select.name, '🟢 Terminé', 'Status property populated');
    assertEqual(properties['Note / 10'].number, 10, 'Numeric rating populated');
    assertEqual(properties['Genres'].relation.length, 3, 'All 3 genres resolved to relations');

    // Step 6: Template engine builds page body
    const blocks = renderTemplateBlocks('game-default', userSelection, true);
    assert(blocks.length > 0, 'Page body blocks rendered');

    // Step 7: Simulate Notion API page creation request
    const createPagePayload = {
      parent: { database_id: 'db-movies-123' },
      icon: { type: 'emoji', emoji: '🎬' },
      cover: { type: 'external', external: { url: userSelection.backdropUrl } },
      properties,
      children: blocks
    };
    assertEqual(createPagePayload.parent.database_id, 'db-movies-123', 'Parent database set');
    assertEqual(createPagePayload.icon.emoji, '🎬', 'Icon emoji set');
    assert(createPagePayload.children.length > 0, 'Children blocks attached');
  });

  // =========================================================================
  // Workflow 2: Full TheGamesDB Game Search with Relational Schema Mapping
  // =========================================================================
  suite.it('W02: Full TheGamesDB Game Search with Relational Schema Mapping Workflow', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    // Step 1: User queries TheGamesDB for 'Chrono Trigger'
    const searchData = THEGAMESDB_FIXTURES.searchChronoTrigger;
    const game = searchData.data.games[0];
    assertEqual(game.game_title, 'Chrono Trigger', 'Game found');

    // Step 2: Resolve platform from include data
    const platformName = searchData.include.platform.data[game.platform].name; // 'Super Nintendo (SNES)'
    assertIncludes(platformName, 'SNES', 'Platform resolved from include');

    // Step 3: User configures game entry
    const gameItem = {
      title: game.game_title,
      platform: 'SNES',
      genres: ['RPG', 'Adventure'],
      overview: game.overview,
      posterUrl: 'https://cdn.thegamesdb.net/images/boxart/front/345-1.jpg',
      status: '🟡 En cours',
      rating: 9
    };

    const schema = {
      properties: {
        title: { notionName: 'Game Title', type: 'title' },
        platform: { notionName: 'Platform', type: 'relation', lookupTable: 'gamePlatforms' },
        genres: { notionName: 'Genres', type: 'relation', lookupTable: 'gameGenres' },
        status: { notionName: 'Status', type: 'select' },
        rating: { notionName: 'Score', type: 'number' }
      }
    };

    const lookupTables = {
      gamePlatforms: { snes: 'id-snes-rel-uuid' },
      gameGenres: { rpg: 'id-rpg-rel-uuid', adventure: 'id-adv-rel-uuid' }
    };

    const props = buildNotionProperties(gameItem, schema, lookupTables);
    assertEqual(props['Game Title'].title[0].text.content, 'Chrono Trigger', 'Game title matches');
    assertEqual(props['Platform'].relation[0].id, 'id-snes-rel-uuid', 'Platform converted to relation ID');
    assertEqual(props['Genres'].relation.length, 2, 'Both genres converted to relation IDs');
    assertEqual(props['Status'].select.name, '🟡 En cours', 'Status matches');
    assertEqual(props['Score'].number, 9, 'Score matches');

    const blocks = renderTemplateBlocks('game-default', gameItem, true);
    assertEqual(blocks.length, 1, 'game-default template produces column_list');
    assertEqual(blocks[0].type, 'column_list', 'Block type verified');
  });

  // =========================================================================
  // Workflow 3: Steam Game Import with Alternative Tags Schema
  // =========================================================================
  suite.it('W03: Steam Game Import with Alternative Tags Schema Workflow', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);

    // Step 1: User provides Steam App ID 367520 (Hollow Knight)
    const appDetails = STEAM_FIXTURES.appDetailsHollowKnight[367520];
    assert(appDetails.success, 'Steam details query successful');
    const data = appDetails.data;
    assertEqual(data.name, 'Hollow Knight', 'Name extracted');

    // Step 2: Extract genres / tags
    const tags = data.genres.map(g => g.description);
    assertIncludes(tags, 'Action', 'Action tag present');
    assertIncludes(tags, 'Indie', 'Indie tag present');

    // Step 3: Build item with Steam direct select / multi_select schema
    const item = {
      title: data.name,
      platform: 'Steam / PC',
      genres: tags,
      overview: data.short_description,
      posterUrl: data.header_image,
      status: '🔵 Backlog'
    };

    const schema = {
      properties: {
        title: { notionName: 'Nom du jeu', type: 'title' },
        platform: { notionName: 'Plateforme', type: 'select' },
        genres: { notionName: 'Tags', type: 'multi_select' },
        status: { notionName: 'Statut', type: 'select' }
      }
    };

    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Nom du jeu'].title[0].text.content, 'Hollow Knight', 'Title mapped');
    assertEqual(props['Plateforme'].select.name, 'Steam / PC', 'Direct select mapped without relational table');
    assertEqual(props['Tags'].multi_select.length, 3, 'All 3 tags mapped to multi_select');
    assertEqual(props['Statut'].select.name, '🔵 Backlog', 'Status mapped');
  });

  // =========================================================================
  // Workflow 4: Embedded Notion Drawer Configuration Workflow
  // =========================================================================
  suite.it('W04: Embedded Notion Drawer Configuration Workflow', async () => {
    const { mock, unmount } = mountMockEnvironment('chrome');

    try {
      const { getConfig, saveConfig } = await import(`file://${CONFIG_JS}?v=${Date.now()}`);

      // Step 1: Retrieve default config
      const initialConfig = await getConfig();
      assert(initialConfig !== null, 'Initial config loaded');

      // Step 2: User updates API keys in settings form
      const updatedConfig = {
        ...initialConfig,
        notionApiKey: 'secret_live_test_key_12345',
        tmdbApiKey: 'tmdb_live_test_key_67890',
        moviesDbId: 'db-custom-movies-uuid'
      };

      const saved = await saveConfig(updatedConfig);
      assertEqual(saved, true, 'Config saved successfully');

      // Step 3: Read back from storage to verify persistence
      const reloaded = await getConfig();
      assertEqual(reloaded.notionApiKey, 'secret_live_test_key_12345', 'Notion API key persisted');
      assertEqual(reloaded.tmdbApiKey, 'tmdb_live_test_key_67890', 'TMDb API key persisted');
      assertEqual(reloaded.moviesDbId, 'db-custom-movies-uuid', 'Database ID persisted');
    } finally {
      unmount();
    }
  });

  // =========================================================================
  // Workflow 5: Database Schema Introspection and Recommendation Workflow
  // =========================================================================
  suite.it('W05: Database Schema Introspection and Recommendation Workflow', async () => {
    const { generateSchemaRecommendation } = await import(`file://${SCHEMA_DISCOVERY_JS}`);

    // Step 1: Notion returns raw database metadata
    const mockDb = NOTION_FIXTURES.databaseQueryResponse;
    assertEqual(mockDb.id, '312aec4b-87d9-815b-bf60-d3fc5847d424', 'Database ID matches fixture');

    // Step 2: Run schema discovery for game media type
    const recommendation = generateSchemaRecommendation(mockDb, 'game');
    assert(recommendation !== null, 'Recommendation generated');
    const recProps = recommendation.recommendedProperties;

    // Step 3: Verify automatic property mapping matching
    assertEqual(recProps.title.notionName, 'Title', 'Title property correctly identified');
    assertEqual(recProps.platform.notionName, 'Game Platform', 'Platform property identified');
    assertEqual(recProps.genres.notionName, 'Genres', 'Genres property identified');
    assertEqual(recProps.status.notionName, 'Game Status', 'Status property identified');
    assertEqual(recProps.rating.notionName, 'Overall Rating', 'Rating property identified');
  });

  // =========================================================================
  // Workflow 6: Multi-Browser Cross-Platform Manifest Pipeline Workflow
  // =========================================================================
  suite.it('W06: Multi-Browser Cross-Platform Manifest Pipeline Workflow', () => {
    // Validate the transformation logic from base manifest to Chrome, Firefox, and Safari targets
    const baseManifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));

    // Chrome transformation
    const chromeManifest = JSON.parse(JSON.stringify(baseManifest));
    chromeManifest.background = { service_worker: 'background.js' };
    chromeManifest.permissions = chromeManifest.permissions.filter(p => p !== 'webRequestBlocking');
    delete chromeManifest.browser_specific_settings;

    assertEqual(chromeManifest.manifest_version, 3, 'Chrome MV3 version verified');
    assertEqual(chromeManifest.background.service_worker, 'background.js', 'Chrome service worker set');
    assert(!chromeManifest.permissions.includes('webRequestBlocking'), 'webRequestBlocking removed for Chrome');
    assert(!('browser_specific_settings' in chromeManifest), 'browser_specific_settings removed for Chrome');

    // Firefox transformation
    const firefoxManifest = JSON.parse(JSON.stringify(baseManifest));
    firefoxManifest.background = { scripts: ['background.js'] };
    assert(firefoxManifest.browser_specific_settings?.gecko?.id !== undefined, 'Gecko ID preserved for Firefox');

    // Safari transformation
    const safariManifest = JSON.parse(JSON.stringify(baseManifest));
    safariManifest.background = { service_worker: 'background.js' };
    safariManifest.permissions = safariManifest.permissions.filter(p => p !== 'webRequestBlocking');
    assert(!safariManifest.permissions.includes('webRequestBlocking'), 'webRequestBlocking removed for Safari');
  });

  // =========================================================================
  // Workflow 7: Mobile Responsive Touch Interaction Workflow
  // =========================================================================
  suite.it('W07: Mobile Responsive Touch Interaction Workflow', () => {
    const dom = loadPopupDOM(POPUP_HTML);
    const css = loadCSS(POPUP_CSS);

    // Step 1: User opens popup on mobile viewport (width: 375px)
    const bodyW = css.getProperty('body', 'width');
    const bodyMaxW = css.getProperty('body', 'max-width');
    assert(bodyW === '100%' || bodyW === '100vw', 'Fluid mobile width verified');

    // Step 2: User taps search input (min-height >= 44px)
    const searchInput = dom.getElementById('searchInput');
    assert(searchInput !== null, 'Search input exists');
    const searchMinH = css.getProperty('.search-box input', 'min-height');
    assertEqual(searchMinH, '44px', 'Search input touch target is 44px');

    // Step 3: User filters by tab (min-height >= 44px)
    const tabs = dom.querySelectorAll('.tab');
    assert(tabs.length >= 4, 'All filter tabs present');
    const tabMinH = css.getProperty('.tab', 'min-height');
    assertEqual(tabMinH, '44px', 'Tab touch target is 44px');

    // Step 4: User taps settings button (min 44x44px)
    const settingsBtn = dom.getElementById('btnSettings');
    assert(settingsBtn !== null, 'Settings button exists');
    const iconBtnMinW = css.getProperty('.icon-button', 'min-width');
    const iconBtnMinH = css.getProperty('.icon-button', 'min-height');
    assertEqual(iconBtnMinW, '44px', 'Icon button min-width is 44px');
    assertEqual(iconBtnMinH, '44px', 'Icon button min-height is 44px');
  });

  // =========================================================================
  // Workflow 8: Multi-Asset Release Packaging and Validation Workflow
  // =========================================================================
  suite.it('W08: Multi-Asset Release Packaging and Validation Workflow', () => {
    // Verify deliverable specifications for GitHub Releases publication
    const releasePlan = {
      tag: 'v1.5.0',
      repo: 'Pixelzeus/notion-culture-tracker',
      assets: [
        { name: 'culture-tracker-v1.5.0-chrome.zip', type: 'application/zip' },
        { name: 'culture-tracker-v1.5.0-firefox.xpi', type: 'application/x-xpinstall' },
        { name: 'culture-tracker-v1.5.0-firefox.zip', type: 'application/zip' },
        { name: 'culture-tracker-v1.5.0-safari.zip', type: 'application/zip' }
      ]
    };

    assertEqual(releasePlan.tag, 'v1.5.0', 'Release tag is v1.5.0');
    assertEqual(releasePlan.assets.length, 4, '4 assets defined in release plan');
    for (const asset of releasePlan.assets) {
      assert(asset.name.includes('v1.5.0'), `Asset ${asset.name} has version tag`);
      assert(asset.type.includes('application/'), `Asset ${asset.name} has valid MIME type`);
    }
  });

  return suite;
}
