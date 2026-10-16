// Tests unitaires pour l'adaptateur de propriétés et le moteur de templates
import { normalizeKey, resolveLookupId, buildNotionProperties } from '../services/notion-adapter.js';
import { renderTemplateBlocks, BUILTIN_TEMPLATES } from '../services/template-engine.js';
import { generateSchemaRecommendation } from '../services/schema-discovery.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('🧪 1. Tests normalizeKey & resolveLookupId');
assert(normalizeKey('  Action & Aventure  ') === 'action & aventure', 'Normalise espaces et casse');
assert(normalizeKey('Comédie') === 'comedie', 'Supprime les accents');
assert(resolveLookupId('312aec4b-87d9-81dd-b8b7-c22b5505673f', {}) === '312aec4b-87d9-81dd-b8b7-c22b5505673f', 'Préserve un UUID');
assert(resolveLookupId('Switch', { switch: 'id-switch-123' }) === 'id-switch-123', 'Lookup par clé normalisée');

console.log('\n🧪 2. Tests buildNotionProperties avec schéma relationnel (votre setup actuel)');
const relationSchema = {
  properties: {
    title: { notionName: 'Title', type: 'title' },
    platform: { notionName: 'Game Platform', type: 'relation', lookupTable: 'gamePlatforms' },
    genres: { notionName: 'Genres', type: 'relation', lookupTable: 'gameGenres' },
    status: { notionName: 'Game Status', type: 'select', defaultValue: '🔵 Backlog' },
    rating: { notionName: 'Overall Rating', type: 'number' }
  }
};

const lookupTables = {
  gamePlatforms: { switch: 'id-plat-switch', pc: 'id-plat-pc' },
  gameGenres: { rpg: 'id-genre-rpg', action: 'id-genre-action' }
};

const gameItem = {
  title: 'Chrono Trigger',
  platform: 'Switch',
  genres: ['RPG', 'Action'],
  status: 'Finished',
  rating: 10
};

const props1 = buildNotionProperties(gameItem, relationSchema, lookupTables);
assert(props1['Title'].title[0].text.content === 'Chrono Trigger', 'Titre correctement extrait');
assert(props1['Game Platform'].relation[0].id === 'id-plat-switch', 'Plateforme convertie en relation');
assert(props1['Genres'].relation.length === 2, 'Genres convertis en relations multiples');
assert(props1['Game Status'].select.name === 'Finished', 'Statut select valorisé');
assert(props1['Overall Rating'].number === 10, 'Note numérique valorisée');

console.log('\n🧪 3. Tests buildNotionProperties avec schéma alternatif (select / multi_select)');
const tagsSchema = {
  properties: {
    title: { notionName: 'Nom', type: 'title' },
    platform: { notionName: 'Console', type: 'select' },
    genres: { notionName: 'Tags', type: 'multi_select' },
    status: { notionName: 'État', type: 'select', defaultValue: 'À faire' }
  }
};

const props2 = buildNotionProperties({
  title: 'Hollow Knight',
  platform: 'Steam',
  genres: ['Metroidvania', 'Souls-like']
}, tagsSchema, {});

assert(props2['Nom'].title[0].text.content === 'Hollow Knight', 'Nom alternatif valorisé');
assert(props2['Console'].select.name === 'Steam', 'Console en select direct sans table relationnelle');
assert(props2['Tags'].multi_select.length === 2, 'Tags en multi_select direct');
assert(props2['Tags'].multi_select[0].name === 'Metroidvania', 'Premier tag conforme');
assert(props2['État'].select.name === 'À faire', 'Valeur par défaut appliquée');

console.log('\n🧪 4. Tests tolérance aux colonnes manquantes');
const partialProps = buildNotionProperties({ title: 'Mario' }, relationSchema, {});
assert(partialProps['Title'] !== undefined, 'Titre toujours présent');
assert(partialProps['Game Platform'] === undefined, 'Propriété absente omise sans crash');
assert(partialProps['Genres'] === undefined, 'Relations absentes omises sans crash');

console.log('\n🧪 5. Tests template-engine');
const blocksGame = renderTemplateBlocks('game-default', { title: 'Zelda', overview: 'Aventure épique', posterUrl: 'https://example.com/art.jpg' }, true);
assert(blocksGame.length === 1, 'game-default produit une column_list');
assert(blocksGame[0].type === 'column_list', 'Type de bloc conforme');

const blocksBlank = renderTemplateBlocks('blank', { title: 'Zelda' }, true);
assert(blocksBlank.length === 0, 'blank produit un tableau vide');

const blocksDisabled = renderTemplateBlocks('game-default', { title: 'Zelda' }, false);
assert(blocksDisabled.length === 0, 'usePageTemplate=false désactive le corps de page');

console.log('\n🧪 6. Tests generateSchemaRecommendation');
const mockDb = {
  id: '312aec4b-87d9-815b-bf60-d3fc5847d424',
  title: 'Jeux Vidéo',
  properties: {
    'Nom du jeu': { type: 'title' },
    'Plateforme': { type: 'select', options: [{ name: 'PC' }] },
    'Genres': { type: 'multi_select', options: [{ name: 'RPG' }] },
    'Statut': { type: 'select', options: [{ name: 'En cours' }] }
  }
};

const rec = generateSchemaRecommendation(mockDb, 'game');
assert(rec.recommendedProperties.title.notionName === 'Nom du jeu', 'Recommande Nom du jeu pour title');
assert(rec.recommendedProperties.platform.notionName === 'Plateforme', 'Recommande Plateforme pour platform');
assert(rec.recommendedProperties.genres.notionName === 'Genres', 'Recommande Genres pour genres');
assert(rec.recommendedProperties.status.notionName === 'Statut', 'Recommande Statut pour status');

console.log(`\n========================================`);
console.log(`RÉSULTAT GLOBAL: ${passed} PASSÉS, ${failed} ÉCHECS`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TOUS LES TESTS SONT AU VERT !');
}
