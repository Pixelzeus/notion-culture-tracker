// test/e2e/tiers/tier3-pairwise-combinations.test.js
// Tier 3: Cross-Feature Pairwise Combinations (16 pairwise test scenarios across UI modes, API providers, templates, and storage sync)

import path from 'path';
import { createSuite, assert, assertEqual, assertDeepEqual, assertIncludes } from '../harness/test-context.js';
import { createBrowserMock, mountMockEnvironment } from '../harness/browser-mock.js';
import { TMDB_FIXTURES, THEGAMESDB_FIXTURES, STEAM_FIXTURES, NOTION_FIXTURES } from '../harness/api-fixtures.js';

export function registerTier3Tests() {
  const suite = createSuite('Tier 3: Pairwise Combinations (16 Cross-Feature Scenarios)');

  const ROOT_DIR = path.resolve(import.meta.dirname, '../../../');
  const NOTION_ADAPTER_JS = path.join(ROOT_DIR, 'services/notion-adapter.js');
  const TEMPLATE_ENGINE_JS = path.join(ROOT_DIR, 'services/template-engine.js');
  const CONFIG_JS = path.join(ROOT_DIR, 'services/config.js');
  const SCHEMA_DISCOVERY_JS = path.join(ROOT_DIR, 'services/schema-discovery.js');

  // Scenario 1: Standard Popup + TMDb Movie + Default Template + Default Config Storage
  suite.it('P01: Standard Popup + TMDb Movie + Default Template + Default Config Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);
    const { DEFAULT_CONFIG } = await import(`file://${CONFIG_JS}`);

    const movie = TMDB_FIXTURES.movieInceptionDetail;
    const item = {
      title: movie.title,
      overview: movie.overview,
      posterUrl: `https://image.tmdb.org/t/p/w780${movie.poster_path}`,
      releaseDate: movie.release_date,
      rating: 9,
      status: DEFAULT_CONFIG.defaultWatchStatus
    };

    const schema = {
      properties: {
        title: { notionName: 'Nom', type: 'title' },
        status: { notionName: 'Statut', type: 'select' },
        rating: { notionName: 'Note', type: 'number' }
      }
    };

    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Nom'].title[0].text.content, 'Inception', 'Movie title parsed in Notion properties');
    assertEqual(props['Statut'].select.name, '🔵 To Watch', 'Default watch status assigned');
    assertEqual(props['Note'].number, 9, 'Numeric rating assigned');

    const blocks = renderTemplateBlocks('game-default', item, true);
    assert(blocks.length > 0, 'Default template generates page blocks');
  });

  // Scenario 2: Embedded Drawer + TheGamesDB Game + game-default Template + Relational Lookup Storage
  suite.it('P02: Embedded Drawer + TheGamesDB Game + game-default Template + Relational Lookup Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const game = THEGAMESDB_FIXTURES.searchChronoTrigger.data.games[0];
    const lookupTables = {
      gamePlatforms: { snes: 'id-snes-1995', switch: 'id-switch-2017' },
      gameGenres: { rpg: 'id-rpg-genre', adventure: 'id-adv-genre' }
    };

    const schema = {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        platform: { notionName: 'Platform', type: 'relation', lookupTable: 'gamePlatforms' },
        genres: { notionName: 'Genres', type: 'relation', lookupTable: 'gameGenres' },
        status: { notionName: 'Status', type: 'select', defaultValue: '🔵 Backlog' }
      }
    };

    const item = {
      title: game.game_title,
      platform: 'SNES',
      genres: ['RPG', 'Adventure'],
      overview: game.overview,
      posterUrl: 'https://cdn.thegamesdb.net/images/boxart/front/345-1.jpg'
    };

    const props = buildNotionProperties(item, schema, lookupTables);
    assertEqual(props['Title'].title[0].text.content, 'Chrono Trigger', 'Game title assigned');
    assertEqual(props['Platform'].relation[0].id, 'id-snes-1995', 'Platform relation mapped');
    assertEqual(props['Genres'].relation.length, 2, 'Two genre relations mapped');
    assertEqual(props['Status'].select.name, '🔵 Backlog', 'Default status assigned');

    const blocks = renderTemplateBlocks('game-default', item, true);
    assertEqual(blocks.length, 1, 'game-default returns column_list');
    assertEqual(blocks[0].type, 'column_list', 'Block type is column_list');
  });

  // Scenario 3: Mobile Viewport (420px) + Steam Game + blank Template + Alternative Tags Schema
  suite.it('P03: Mobile Viewport (420px) + Steam Game + blank Template + Alternative Tags Schema', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const steamData = STEAM_FIXTURES.appDetailsHollowKnight[367520].data;
    const item = {
      title: steamData.name,
      platform: 'Steam',
      genres: steamData.genres.map(g => g.description),
      overview: steamData.short_description,
      posterUrl: steamData.header_image,
      status: 'Terminé'
    };

    const tagsSchema = {
      properties: {
        title: { notionName: 'Nom du jeu', type: 'title' },
        platform: { notionName: 'Plateforme', type: 'select' },
        genres: { notionName: 'Tags', type: 'multi_select' },
        status: { notionName: 'Statut', type: 'select' }
      }
    };

    const props = buildNotionProperties(item, tagsSchema, {});
    assertEqual(props['Nom du jeu'].title[0].text.content, 'Hollow Knight', 'Title mapped');
    assertEqual(props['Plateforme'].select.name, 'Steam', 'Platform mapped as direct select');
    assertEqual(props['Tags'].multi_select.length, 3, 'All 3 steam tags mapped to multi_select');
    assertEqual(props['Statut'].select.name, 'Terminé', 'Status mapped');

    const blocks = renderTemplateBlocks('blank', item, true);
    assertEqual(blocks.length, 0, 'blank template returns 0 page body blocks');
  });

  // Scenario 4: Narrow Mobile (360px) + TMDb TV Series + Disabled Template + Default Config
  suite.it('P04: Narrow Mobile (360px) + TMDb TV Series + Disabled Template + Default Config', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const tv = TMDB_FIXTURES.searchTvBreakingBad.results[0];
    const item = {
      title: tv.name,
      overview: tv.overview,
      releaseDate: tv.first_air_date,
      status: 'En cours',
      rating: 10
    };

    const schema = {
      properties: {
        title: { notionName: 'Titre Série', type: 'title' },
        status: { notionName: 'Progression', type: 'select' },
        rating: { notionName: 'Note / 10', type: 'number' }
      }
    };

    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Titre Série'].title[0].text.content, 'Breaking Bad', 'TV show title mapped');
    assertEqual(props['Progression'].select.name, 'En cours', 'Progression mapped');
    assertEqual(props['Note / 10'].number, 10, 'Rating mapped');

    const blocks = renderTemplateBlocks('game-default', item, false); // usePageTemplate: false
    assertEqual(blocks.length, 0, 'Disabled page template produces 0 blocks');
  });

  // Scenario 5: Standard Popup + TheGamesDB Game + blank Template + Relational Lookup Storage
  suite.it('P05: Standard Popup + TheGamesDB Game + blank Template + Relational Lookup Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const item = {
      title: 'Super Mario World',
      platform: 'SNES',
      genres: ['Platformer'],
      status: 'Terminé'
    };
    const lookupTables = { gamePlatforms: { snes: 'id-snes-mario' } };
    const schema = {
      properties: {
        title: { notionName: 'Titre', type: 'title' },
        platform: { notionName: 'Console', type: 'relation', lookupTable: 'gamePlatforms' }
      }
    };

    const props = buildNotionProperties(item, schema, lookupTables);
    assertEqual(props['Console'].relation[0].id, 'id-snes-mario', 'Platform relation verified');
    const blocks = renderTemplateBlocks('blank', item, true);
    assertEqual(blocks.length, 0, 'blank template produces 0 blocks');
  });

  // Scenario 6: Embedded Drawer + TMDb Movie + game-default Template + Custom Schema Storage
  suite.it('P06: Embedded Drawer + TMDb Movie + game-default Template + Custom Schema Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const item = {
      title: 'Interstellar',
      overview: 'Une équipe d\'explorateurs voyage à travers un trou de ver...',
      posterUrl: 'https://image.tmdb.org/t/p/w780/interstellar.jpg'
    };

    const customSchema = {
      properties: {
        title: { notionName: 'Film', type: 'title' }
      }
    };

    const props = buildNotionProperties(item, customSchema, {});
    assertEqual(props['Film'].title[0].text.content, 'Interstellar', 'Custom title property populated');
    const blocks = renderTemplateBlocks('game-default', item, true);
    assertEqual(blocks.length, 1, 'game-default template generates blocks');
  });

  // Scenario 7: Mobile Viewport (420px) + TMDb Movie + Disabled Template + Default Config
  suite.it('P07: Mobile Viewport (420px) + TMDb Movie + Disabled Template + Default Config', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const item = { title: 'Parasite', status: '🔵 To Watch' };
    const schema = {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        status: { notionName: 'Status', type: 'select' }
      }
    };

    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Title'].title[0].text.content, 'Parasite', 'Title set');
    const blocks = renderTemplateBlocks('game-default', item, false);
    assertEqual(blocks.length, 0, 'No blocks when disabled');
  });

  // Scenario 8: Narrow Mobile (360px) + Steam Game + game-default Template + Relational Lookup Storage
  suite.it('P08: Narrow Mobile (360px) + Steam Game + game-default Template + Relational Lookup Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const item = {
      title: 'Celeste',
      platform: 'PC',
      overview: 'Aide Madeline à gravir le Mont Celeste...',
      posterUrl: 'https://cdn.steam.com/celeste.jpg'
    };
    const lookupTables = { gamePlatforms: { pc: 'id-plat-pc-1' } };
    const schema = {
      properties: {
        title: { notionName: 'Game', type: 'title' },
        platform: { notionName: 'Platform', type: 'relation', lookupTable: 'gamePlatforms' }
      }
    };

    const props = buildNotionProperties(item, schema, lookupTables);
    assertEqual(props['Platform'].relation[0].id, 'id-plat-pc-1', 'Relation resolved');
    const blocks = renderTemplateBlocks('game-default', item, true);
    assertEqual(blocks[0].type, 'column_list', 'column_list produced');
  });

  // Scenario 9: Standard Popup + Steam Game + Default Template + Custom Schema Storage
  suite.it('P09: Standard Popup + Steam Game + Default Template + Custom Schema Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const item = { title: 'Portal 2', rating: 10 };
    const schema = {
      properties: {
        title: { notionName: 'Titre', type: 'title' },
        rating: { notionName: 'Note / 10', type: 'number' }
      }
    };
    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Note / 10'].number, 10, 'Rating number matched');
  });

  // Scenario 10: Embedded Drawer + TMDb TV Series + blank Template + Default Config
  suite.it('P10: Embedded Drawer + TMDb TV Series + blank Template + Default Config', async () => {
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);
    const blocks = renderTemplateBlocks('blank', { title: 'Dark' }, true);
    assertEqual(blocks.length, 0, 'blank produces 0 blocks');
  });

  // Scenario 11: Mobile Viewport (420px) + TheGamesDB Game + Disabled Template + Relational Lookup Storage
  suite.it('P11: Mobile Viewport (420px) + TheGamesDB Game + Disabled Template + Relational Lookup Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);

    const item = { title: 'Metroid Prime', platform: 'GameCube' };
    const lookupTables = { gamePlatforms: { gamecube: 'id-gc-1' } };
    const schema = {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        platform: { notionName: 'Console', type: 'relation', lookupTable: 'gamePlatforms' }
      }
    };

    const props = buildNotionProperties(item, schema, lookupTables);
    assertEqual(props['Console'].relation[0].id, 'id-gc-1', 'Relation matched');
    const blocks = renderTemplateBlocks('game-default', item, false);
    assertEqual(blocks.length, 0, 'Disabled produces 0 blocks');
  });

  // Scenario 12: Narrow Mobile (360px) + TMDb Movie + game-default Template + Alternative Tags Schema
  suite.it('P12: Narrow Mobile (360px) + TMDb Movie + game-default Template + Alternative Tags Schema', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const item = { title: 'Spirited Away', genres: ['Animation', 'Fantasy'] };
    const schema = {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        genres: { notionName: 'Tags', type: 'multi_select' }
      }
    };
    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Tags'].multi_select.length, 2, 'Tags multi_select populated');
  });

  // Scenario 13: Standard Popup + TMDb TV Series + game-default Template + Relational Lookup Storage
  suite.it('P13: Standard Popup + TMDb TV Series + game-default Template + Relational Lookup Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const item = { title: 'Succession', status: 'Terminé' };
    const schema = {
      properties: {
        title: { notionName: 'Nom', type: 'title' },
        status: { notionName: 'Statut', type: 'select' }
      }
    };
    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Statut'].select.name, 'Terminé', 'Status select populated');
  });

  // Scenario 14: Embedded Drawer + Steam Game + Disabled Template + Default Config
  suite.it('P14: Embedded Drawer + Steam Game + Disabled Template + Default Config', async () => {
    const { renderTemplateBlocks } = await import(`file://${TEMPLATE_ENGINE_JS}`);
    const blocks = renderTemplateBlocks('game-default', { title: 'Hades' }, false);
    assertEqual(blocks.length, 0, 'Disabled template returns 0 blocks');
  });

  // Scenario 15: Mobile Viewport (420px) + TMDb TV Series + blank Template + Custom Schema Storage
  suite.it('P15: Mobile Viewport (420px) + TMDb TV Series + blank Template + Custom Schema Storage', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const item = { title: 'Arcane', rating: 10 };
    const schema = {
      properties: {
        title: { notionName: 'Show', type: 'title' },
        rating: { notionName: 'Score', type: 'number' }
      }
    };
    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['Show'].title[0].text.content, 'Arcane', 'Show title populated');
    assertEqual(props['Score'].number, 10, 'Score populated');
  });

  // Scenario 16: Narrow Mobile (360px) + TheGamesDB Game + blank Template + Alternative Tags Schema
  suite.it('P16: Narrow Mobile (360px) + TheGamesDB Game + blank Template + Alternative Tags Schema', async () => {
    const { buildNotionProperties } = await import(`file://${NOTION_ADAPTER_JS}`);
    const item = { title: 'Elden Ring', platform: 'PC' };
    const schema = {
      properties: {
        title: { notionName: 'Game', type: 'title' },
        platform: { notionName: 'System', type: 'select' }
      }
    };
    const props = buildNotionProperties(item, schema, {});
    assertEqual(props['System'].select.name, 'PC', 'System select populated');
  });

  return suite;
}
