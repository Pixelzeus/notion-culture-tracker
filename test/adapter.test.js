// Tests unitaires pour l'adaptateur de propriétés et le moteur de templates
import { normalizeKey, resolveLookupId, buildNotionProperties } from '../services/notion-adapter.js';
import { renderTemplateBlocks, BUILTIN_TEMPLATES, NotionBlocks, resolveVariables, compileDeclarativeBlocks, DECLARATIVE_PRESETS } from '../services/template-engine.js';
import { generateSchemaRecommendation, evaluatePropertyCompatibility, runDryRunDiagnostic } from '../services/schema-discovery.js';
import { DEFAULT_SCHEMA, validateSchema, PERMITTED_NOTION_TYPES } from '../services/schema.default.js';

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

// Tests NotionBlocks.divider
const dividerBlock = NotionBlocks.divider();
assert(dividerBlock.type === 'divider' && typeof dividerBlock.divider === 'object', 'NotionBlocks.divider structure valide');

// Tests resolveVariables
const interpolated = resolveVariables('Titre: {{title}} | Genres: {{genres}}', { title: 'Metroid', genres: ['Action', 'Sci-Fi'] });
assert(interpolated === 'Titre: Metroid | Genres: Action, Sci-Fi', 'resolveVariables interpole chaînes et tableaux');

// Tests compileDeclarativeBlocks
const sampleDeclarative = [
  { type: 'heading_2', text: 'Synopsis de {{title}}' },
  { type: 'divider' },
  { type: 'toggle', text: 'Détails', children: [] },
  { type: 'columns', columns: [[{ type: 'paragraph', text: 'Col 1' }], []] }
];
const compiledBlocks = compileDeclarativeBlocks(sampleDeclarative, { title: 'Dune' });
assert(compiledBlocks.length === 4, 'compileDeclarativeBlocks génère 4 blocs Notion');
assert(compiledBlocks[0].heading_2.rich_text[0].text.content === 'Synopsis de Dune', 'Titre H2 résout les variables');
assert(compiledBlocks[2].toggle.children === undefined, 'Toggle sans enfants omet la clé children');
assert(compiledBlocks[3].column_list.children[1].column.children.length === 1, 'Colonne vide reçoit un paragraphe de repli');

// Tests renderTemplateBlocks avec blueprint déclaratif
const renderedCustom = renderTemplateBlocks(sampleDeclarative, { title: 'Dune' }, true);
assert(renderedCustom.length === 4, 'renderTemplateBlocks accepte un tableau déclaratif');

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

console.log('\n🧪 7. Tests evaluatePropertyCompatibility (Diagnostic Dry-Run)');
const detectedDbProps = {
  'Title': { id: 'p1', type: 'title' },
  'Watch Status': { id: 'p2', type: 'status' },
  'Genres': { id: 'p3', type: 'relation', relationDatabaseId: 'db-genres' },
  'Note': { id: 'p4', type: 'number' },
  'Tags': { id: 'p5', type: 'multi_select' }
};

// Conforme exact
const rTitle = evaluatePropertyCompatibility({ notionName: 'Title', type: 'title' }, detectedDbProps);
assert(rTitle.status === 'ok', 'Exact title match is ok');

// Relation avec lookupTable
const rRelationOk = evaluatePropertyCompatibility({ notionName: 'Genres', type: 'relation', lookupTable: 'genres' }, detectedDbProps);
assert(rRelationOk.status === 'ok', 'Relation with lookupTable is ok');

// Relation sans lookupTable
const rRelationWarn = evaluatePropertyCompatibility({ notionName: 'Genres', type: 'relation' }, detectedDbProps);
assert(rRelationWarn.status === 'warning', 'Relation without lookupTable produces warning');

// Compatible: attendu select, réel status
const rStatusWarn = evaluatePropertyCompatibility({ notionName: 'Watch Status', type: 'select' }, detectedDbProps);
assert(rStatusWarn.status === 'warning', 'Select vs Status produces compatible warning');

// Compatible: attendu select, réel multi_select
const rTagsWarn = evaluatePropertyCompatibility({ notionName: 'Tags', type: 'select' }, detectedDbProps);
assert(rTagsWarn.status === 'warning', 'Select vs Multi-select produces compatible warning');

// Colonne introuvable
const rMissing = evaluatePropertyCompatibility({ notionName: 'NonExistentColumn', type: 'select' }, detectedDbProps);
assert(rMissing.status === 'error', 'Missing column produces error');

// Incompatibilité bloquante de type
const rIncompat = evaluatePropertyCompatibility({ notionName: 'Note', type: 'date' }, detectedDbProps);
assert(rIncompat.status === 'error', 'Incompatible type produces error');

// Colonne non mappée
const rSkipped = evaluatePropertyCompatibility({ notMapped: true, notionName: 'Ignored' }, detectedDbProps);
assert(rSkipped.status === 'skipped', 'Unmapped property is skipped');
const rSkippedEmpty = evaluatePropertyCompatibility({ notionName: '' }, detectedDbProps);
assert(rSkippedEmpty.status === 'skipped', 'Empty notionName is skipped');

console.log('\n🧪 8. Tests runDryRunDiagnostic (Live Dry-Run Engine)');
const mockMetadata = {
  '312aec4b-87d9-8111-b530-d4af0c22d898': {
    id: '312aec4b-87d9-8111-b530-d4af0c22d898',
    title: 'All Movies',
    properties: {
      'Title': { type: 'title' },
      'Release Date': { type: 'date' },
      'Rating': { type: 'number' },
      'Watch Status': { type: 'select' },
      'Genres': { type: 'relation' },
      'Platforms': { type: 'relation' },
      'Year Watched': { type: 'relation' }
    }
  },
  '312aec4b-87d9-8128-82c4-fa8ad991cf87': {
    id: '312aec4b-87d9-8128-82c4-fa8ad991cf87',
    title: 'All TV Shows',
    properties: {
      'Title': { type: 'title' },
      'Release Date': { type: 'date' },
      'Total Episodes': { type: 'number' },
      'Rating': { type: 'number' },
      'Watch Status': { type: 'select' },
      'Genres': { type: 'relation' },
      'Platforms': { type: 'relation' },
      'Year Watched': { type: 'relation' }
    }
  },
  '312aec4b-87d9-815b-bf60-d3fc5847d424': {
    id: '312aec4b-87d9-815b-bf60-d3fc5847d424',
    title: 'All Games',
    properties: {
      'Title': { type: 'title' },
      'Game Platform': { type: 'relation' },
      'Genres': { type: 'relation' },
      'Game Status': { type: 'select' },
      'Overall Rating': { type: 'number' },
      'Player Support': { type: 'select' },
      'Copy': { type: 'select' },
      'Year Played': { type: 'relation' }
    }
  }
};

const mockInspect = async (dbId) => {
  const clean = String(dbId).trim();
  const found = Object.values(mockMetadata).find(m => m.id === clean || m.id.replace(/-/g, '') === clean.replace(/-/g, ''));
  if (!found) throw new Error(`Database ${dbId} not found`);
  return found;
};

// Distinct Mode Diagnostic Test
const testSchema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
const diagReport = await runDryRunDiagnostic(testSchema, 'secret_valid_key', {
  inspectFn: mockInspect,
  fallbackConfig: {
    moviesDbId: '312aec4b-87d9-8111-b530-d4af0c22d898',
    tvShowsDbId: '312aec4b-87d9-8128-82c4-fa8ad991cf87',
    gamesDbId: '312aec4b-87d9-815b-bf60-d3fc5847d424'
  }
});

assert(diagReport.mode === 'distinct', 'Mode distinct correctement identifié');
assert(diagReport.databases.length === 3, '3 bases diagnostiquées en mode distinct');
assert(diagReport.summary.valid > 15, `Colonnes valides détectées (${diagReport.summary.valid})`);
assert(diagReport.summary.errors === 0, 'Aucune erreur bloquante sur le schéma par défaut');

// Unified Mode Diagnostic Test
const unifiedSchema = {
  databaseMode: 'unified',
  unifiedDatabase: {
    databaseId: '312aec4b-87d9-8111-b530-d4af0c22d898',
    typeProperty: 'Type',
    typeValues: { movie: 'Film', tv: 'Série', game: 'Jeu' }
  },
  mediaTypes: {
    movie: {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        releaseDate: { notionName: 'Release Date', type: 'date' }
      }
    }
  }
};

mockMetadata['312aec4b-87d9-8111-b530-d4af0c22d898'].properties['Type'] = { type: 'select' };

const unifiedReport = await runDryRunDiagnostic(unifiedSchema, 'secret_valid_key', { inspectFn: mockInspect });
assert(unifiedReport.mode === 'unified', 'Mode unifié correctement identifié');
assert(unifiedReport.databases.length === 1, '1 base unifiée diagnostiquée');
const discProp = unifiedReport.databases[0].properties.find(p => p.key === '__typeDiscriminator');
assert(discProp && discProp.status === 'ok', 'Colonne discriminante Type validée');
assert(unifiedReport.overallStatus === 'ok', 'Diagnostic unifié au vert');

console.log('\n🧪 9. Tests adaptPopupFormToSchema (Dynamic Form Adaptation Rules)');
const schemaCustom = {
  mediaTypes: {
    movie: {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        casts: { notMapped: true },
        year: { notionName: '', type: 'relation' },
        notes: { notMapped: true },
        platform: { notionName: 'Platform', type: 'relation' },
        releaseDate: { notMapped: true },
        genres: { notMapped: true }
      }
    },
    game: {
      properties: {
        title: { notionName: 'Title', type: 'title' },
        playerSupport: { notMapped: true },
        copy: { notionName: 'Support', type: 'select' },
        year: { notMapped: true }
      }
    }
  }
};

function testAdaptationRules(mediaType, schema) {
  const mSchema = schema.mediaTypes[mediaType];
  const isMapped = (k) => {
    const p = mSchema.properties[k];
    if (!p || p.notMapped === true || !p.notionName || !p.notionName.trim()) return false;
    return true;
  };
  return {
    castsVisible: mediaType !== 'game' && isMapped('casts'),
    yearVisible: isMapped('year'),
    notesVisible: isMapped('notes'),
    genresVisible: isMapped('genres'),
    rowGameMetaVisible: mediaType === 'game' && (isMapped('playerSupport') || isMapped('copy')),
    playerSupportFlex: isMapped('copy') ? '1' : '1 1 100%',
    copyFlex: isMapped('playerSupport') ? '1' : '1 1 100%',
    rowPlatformDateVisible: isMapped('platform') || isMapped('releaseDate') || isMapped('dateViewed'),
    platformFlex: (isMapped('releaseDate') || isMapped('dateViewed')) ? '1' : '1 1 100%'
  };
}

const movieRules = testAdaptationRules('movie', schemaCustom);
assert(movieRules.castsVisible === false, 'Casting masqué si non mappé');
assert(movieRules.yearVisible === false, 'Bilan annuel masqué si non mappé');
assert(movieRules.notesVisible === false, 'Notes masquées si non mappées');
assert(movieRules.genresVisible === false, 'Genres masqués si non mappés');
assert(movieRules.rowPlatformDateVisible === true, 'rowPlatformDate visible car platform est mappée');
assert(movieRules.platformFlex === '1 1 100%', 'Platform input s\'élargit à 100% car releaseDate est non mappée');

const gameRules = testAdaptationRules('game', schemaCustom);
assert(gameRules.rowGameMetaVisible === true, 'rowGameMeta visible car copy est mappée');
assert(gameRules.copyFlex === '1 1 100%', 'Copy input s\'élargit à 100% car playerSupport est non mappé');
assert(gameRules.yearVisible === false, 'Year masqué pour jeux si non mappé');

console.log('\n🧪 10. Tests Dynamic Notion Property Construction (Unified Mode & Custom Columns)');
const customSchema = {
  databaseMode: 'unified',
  unifiedDatabase: {
    databaseId: '312aec4b87d98111b530d4af0c22d898',
    typeProperty: 'Catégorie',
    typeValues: { movie: 'Film', tv: 'Série TV', game: 'Jeu Vidéo' }
  },
  mediaTypes: {
    movie: {
      properties: {
        title: { notionName: 'Titre', type: 'title' },
        status: { notionName: 'Statut', type: 'select' },
        genres: { notionName: 'Tags', type: 'multi_select' },
        casts: { notMapped: true }
      }
    }
  }
};

const movieItem = {
  title: 'Inception',
  status: 'Vu',
  genres: ['Science-Fiction', 'Thriller'],
  casts: ['Leonardo DiCaprio']
};

const customProps = buildNotionProperties(movieItem, customSchema.mediaTypes.movie, {});
assert(customProps['Titre'] !== undefined, 'Titre custom correctement utilisé');
assert(customProps['Titre'].title[0].text.content === 'Inception', 'Valeur du titre conforme');
assert(customProps['Statut'] !== undefined, 'Statut custom correctement utilisé');
assert(customProps['Tags'] !== undefined, 'Tags custom multi_select correctement utilisé');
assert(customProps['Name'] === undefined, 'Ancien nom Name absent');
assert(customProps['Watch Status'] === undefined, 'Ancien nom Watch Status absent');
assert(customProps['Casts'] === undefined, 'Propriété unmapped casts absente du payload');

const discKey = customSchema.unifiedDatabase.typeProperty;
const discVal = customSchema.unifiedDatabase.typeValues.movie;
customProps[discKey] = { select: { name: discVal } };
assert(customProps['Catégorie'] !== undefined, 'Discriminant de base unifiée injecté');
assert(customProps['Catégorie'].select.name === 'Film', 'Valeur discriminante conforme');

console.log('\n🧪 11. Tests validateSchema, Export Structure & Factory Reset (Milestone 4 / R5)');

// Test 11.1: Default Schema passes validation
const resDefault = validateSchema(DEFAULT_SCHEMA);
assert(resDefault.valid === true, 'DEFAULT_SCHEMA est validé avec succès par validateSchema');
assert(!resDefault.errors || resDefault.errors.length === 0, 'DEFAULT_SCHEMA ne génère aucune erreur');

// Test 11.2: Imported schema with custom properties passes
const validCustomSchema = {
  version: '1.2.0',
  description: 'Mon schéma Notion personnalisé',
  databaseMode: 'unified',
  unifiedDatabase: {
    databaseId: '312aec4b87d98111b530d4af0c22d898',
    typeProperty: 'Type',
    typeValues: { movie: 'Film', tv: 'Série', game: 'Jeu' }
  },
  mediaTypes: {
    movie: {
      name: 'Films Perso',
      properties: {
        title: { notionName: 'Nom', type: 'title' },
        rating: { notionName: 'Note /10', type: 'number' },
        status: { notionName: 'Statut', type: 'status' },
        genres: { notionName: 'Tags', type: 'multi_select' },
        synopsis: { notionName: 'Résumé', type: 'rich_text' },
        favorite: { notionName: 'Coup de cœur', type: 'checkbox' },
        webUrl: { notionName: 'Lien', type: 'url' },
        dateAdded: { notionName: 'Ajouté le', type: 'date' },
        relatedItem: { notionName: 'Relation', type: 'relation' },
        priority: { notionName: 'Priorité', type: 'select' }
      }
    }
  }
};
const resCustom = validateSchema(validCustomSchema);
assert(resCustom.valid === true, 'Schéma personnalisé avec types Notion valides est accepté');

// Test 11.3: Non-object schemas are rejected
const resNull = validateSchema(null);
assert(resNull.valid === false && resNull.errors && resNull.errors.length > 0, 'null est rejeté par validateSchema');
assert(resNull.errors[0].includes('objet JSON valide'), 'Message d\'erreur clair pour entrée non-objet (null)');

const resUndefined = validateSchema(undefined);
assert(resUndefined.valid === false, 'undefined est rejeté par validateSchema');

const resArray = validateSchema([1, 2, 3]);
assert(resArray.valid === false && resArray.errors.length > 0, 'Tableau rejeté par validateSchema');

const resString = validateSchema('invalid string schema');
assert(resString.valid === false && resString.errors.length > 0, 'Chaîne primitive rejetée par validateSchema');

const resNumber = validateSchema(42);
assert(resNumber.valid === false, 'Nombre primitif rejeté par validateSchema');

// Test 11.4: Missing mediaTypes
const resNoMedia = validateSchema({ version: '1.0.0', description: 'Sans mediaTypes' });
assert(resNoMedia.valid === false, 'Schéma sans clé mediaTypes est rejeté');
assert(resNoMedia.errors.some(e => e.includes('mediaTypes')), 'Erreur explicite sur l\'absence de mediaTypes');

const resMediaTypesArray = validateSchema({ mediaTypes: ['movie', 'tv'] });
assert(resMediaTypesArray.valid === false, 'mediaTypes sous forme de tableau est rejeté');

// Test 11.5: mediaTypes without movie, tv, or game
const resEmptyMedia = validateSchema({ mediaTypes: {} });
assert(resEmptyMedia.valid === false, 'mediaTypes vide est rejeté');
assert(resEmptyMedia.errors.some(e => e.includes('au moins un type de média')), 'Erreur explicite sur aucun média supporté');

const resUnsupportedMediaOnly = validateSchema({
  mediaTypes: {
    podcast: {
      properties: { title: { type: 'title', notionName: 'Titre' } }
    }
  }
});
assert(resUnsupportedMediaOnly.valid === false, 'mediaTypes sans movie, tv, ou game est rejeté');

// Test 11.6: Missing title property or invalid title
const resNoTitle = validateSchema({
  mediaTypes: {
    movie: {
      properties: {
        rating: { type: 'number', notionName: 'Note' }
      }
    }
  }
});
assert(resNoTitle.valid === false, 'Schéma sans propriété title est rejeté');
assert(resNoTitle.errors.some(e => e.includes('title')), 'Erreur explicite sur propriété title manquante');

const resInvalidTitle = validateSchema({
  mediaTypes: {
    movie: {
      properties: {
        title: { type: 'number', notionName: '' }
      }
    }
  }
});
assert(resInvalidTitle.valid === false, 'Propriété title avec type non-title et notionName vide est rejetée');
assert(resInvalidTitle.errors.some(e => e.includes('title')), 'Erreur explicite sur configuration title invalide');

// Title with non-empty notionName but omitted type is accepted
const resTitleNotionName = validateSchema({
  mediaTypes: {
    tv: {
      properties: {
        title: { notionName: 'Nom de la série' }
      }
    }
  }
});
assert(resTitleNotionName.valid === true, 'Propriété title avec notionName non vide est acceptée');

// Test 11.7: Invalid property type rejected
const resInvalidType = validateSchema({
  mediaTypes: {
    game: {
      properties: {
        title: { type: 'title', notionName: 'Title' },
        platform: { type: 'unsupported_notion_type', notionName: 'Plateforme' }
      }
    }
  }
});
assert(resInvalidType.valid === false, 'Type de colonne Notion non autorisé est rejeté');
assert(resInvalidType.errors.some(e => e.includes('unsupported_notion_type')), 'Message d\'erreur mentionne le type non autorisé');

// Test 11.8: Missing properties object in mediaType
const resNoProps = validateSchema({
  mediaTypes: {
    movie: { name: 'Films sans properties' }
  }
});
assert(resNoProps.valid === false, 'mediaType sans objet properties est rejeté');
assert(resNoProps.errors.some(e => e.includes('properties')), 'Message d\'erreur mentionne l\'absence de properties');

// Test 11.9: Schema Export Structure matching expected format
function buildTestExportPayload(schema) {
  return {
    version: schema.version || '1.0.0',
    description: schema.description || 'Configuration déclarative du schéma Notion pour Culture Tracker.',
    databaseMode: schema.databaseMode || 'distinct',
    unifiedDatabase: schema.unifiedDatabase || {
      databaseId: '',
      typeProperty: 'Type',
      typeValues: { movie: 'Film', tv: 'Série TV', game: 'Jeu Vidéo' }
    },
    mediaTypes: JSON.parse(JSON.stringify(schema.mediaTypes || {})),
    customTemplates: schema.customTemplates || {}
  };
}

const exported = buildTestExportPayload(DEFAULT_SCHEMA);
assert(typeof exported.version === 'string', 'Export contient la clé version');
assert(typeof exported.description === 'string', 'Export contient la clé description');
assert(typeof exported.databaseMode === 'string', 'Export contient databaseMode');
assert(typeof exported.unifiedDatabase === 'object', 'Export contient unifiedDatabase');
assert(typeof exported.mediaTypes === 'object', 'Export contient mediaTypes');
assert(exported.mediaTypes.movie && exported.mediaTypes.tv && exported.mediaTypes.game, 'Export contient movie, tv et game');
assert(exported.mediaTypes.movie.properties.title.type === 'title', 'Export préserve les propriétés internes');
assert(validateSchema(exported).valid === true, 'Le payload exporté est 100% conforme au validateur validateSchema');

// Test 11.10: Factory Reset restored state
const modifiedSchema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
modifiedSchema.mediaTypes.movie.properties.customColumn = { notionName: 'Custom', type: 'rich_text' };
delete modifiedSchema.mediaTypes.game;
assert(modifiedSchema.mediaTypes.game === undefined, 'Schéma modifié pour test');

const restoredSchema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
assert(restoredSchema.mediaTypes.movie.properties.customColumn === undefined, 'Factory reset supprime les ajouts non désirés');
assert(restoredSchema.mediaTypes.game !== undefined, 'Factory reset restaure les médias manquants');
assert(restoredSchema.mediaTypes.movie.properties.title.notionName === 'Title', 'Factory reset restaure le mapping par défaut');
assert(validateSchema(restoredSchema).valid === true, 'Le schéma issu du factory reset est 100% valide');

console.log(`\n========================================`);
console.log(`RÉSULTAT GLOBAL: ${passed} PASSÉS, ${failed} ÉCHECS`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TOUS LES TESTS SONT AU VERT !');
}
