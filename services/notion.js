// Client API Notion pour Tracking Culture avec application des templates de page

import {
  NOTION_KNOWN_GENRES,
  NOTION_KNOWN_PLATFORMS,
  NOTION_KNOWN_GAME_PLATFORMS,
  NOTION_KNOWN_GAME_GENRES,
  NOTION_KNOWN_YEARS,
  DEFAULT_CONFIG
} from './config.js';
import { buildTvTemplateBlocks, buildMovieTemplateBlocks, buildGameTemplateBlocks } from './templates.js';
import { renderTemplateBlocks } from './template-engine.js';
import { DEFAULT_SCHEMA } from './schema.default.js';
import { safeFetch } from './fetch-proxy.js';
import { browserAPI } from './browser-adapter.js';
import { buildNotionProperties } from './notion-adapter.js';
import { formatDatabaseId } from './schema-discovery.js';

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function getHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey.trim()}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };
}

export async function testNotionConnection(config) {
  const apiKey = config.notionApiKey || DEFAULT_CONFIG.notionApiKey;
  if (!apiKey) throw new Error('Clé API Notion manquante.');
  const dbId = config.moviesDbId || DEFAULT_CONFIG.moviesDbId;
  const res = await safeFetch(`${NOTION_API_URL}/databases/${dbId}`, {
    method: 'GET',
    headers: getHeaders(apiKey)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Échec connexion Notion (${res.status}): ${err.message || 'Vérifiez la clé et le partage de la base.'}`);
  }
  return true;
}

export async function testGamesDbConnection(config) {
  const apiKey = config.gamesDbApiKey || DEFAULT_CONFIG.gamesDbApiKey;
  if (!apiKey) throw new Error('Clé API TheGamesDB manquante.');
  const res = await safeFetch(`https://api.thegamesdb.net/v1/Games/ByGameName?apikey=${encodeURIComponent(apiKey)}&name=Zelda&fields=overview`);
  if (!res.ok) {
    throw new Error(`TheGamesDB (${res.status}): ${res.statusText}`);
  }
  return true;
}

// Matching genres Films / Séries
export function matchGenresToNotion(tmdbGenres) {
  if (!Array.isArray(tmdbGenres)) return [];
  const matchedIds = new Set();

  for (const g of tmdbGenres) {
    const normalized = g.trim().toLowerCase();
    if (NOTION_KNOWN_GENRES[normalized]) {
      matchedIds.add(NOTION_KNOWN_GENRES[normalized]);
      continue;
    }
    for (const [key, id] of Object.entries(NOTION_KNOWN_GENRES)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        matchedIds.add(id);
        break;
      }
    }
  }

  return Array.from(matchedIds);
}

// Matching genres Jeux Vidéo
export function matchGameGenresToNotion(gameGenres) {
  if (!Array.isArray(gameGenres)) return [];
  const matchedIds = new Set();

  for (const g of gameGenres) {
    const normalized = g.trim().toLowerCase();
    if (NOTION_KNOWN_GAME_GENRES[normalized]) {
      matchedIds.add(NOTION_KNOWN_GAME_GENRES[normalized]);
      continue;
    }
    for (const [key, id] of Object.entries(NOTION_KNOWN_GAME_GENRES)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        matchedIds.add(id);
        break;
      }
    }
  }

  return Array.from(matchedIds);
}

// Matching plateformes Films / Séries
export function matchPlatformToNotion(suggestedProviders) {
  if (!Array.isArray(suggestedProviders) || suggestedProviders.length === 0) return null;

  for (const prov of suggestedProviders) {
    const pNorm = prov.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = NOTION_KNOWN_PLATFORMS.find(p => {
      const targetNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return targetNorm.includes(pNorm) || pNorm.includes(targetNorm);
    });
    if (found) return found.id;
  }
  return null;
}

// Matching plateformes Jeux Vidéo
export function matchGamePlatformToNotion(rawPlatformName) {
  if (!rawPlatformName) return null;
  const pNorm = rawPlatformName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Chercher correspondance directe
  for (const p of NOTION_KNOWN_GAME_PLATFORMS) {
    const targetNorm = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (targetNorm === pNorm || pNorm.includes(targetNorm) || targetNorm.includes(pNorm)) {
      return p.id;
    }
  }

  // Règles spécifiques
  if (pNorm.includes('steam') || pNorm.includes('windows') || pNorm === 'pc') {
    const steam = NOTION_KNOWN_GAME_PLATFORMS.find(p => p.name === 'Steam');
    if (steam) return steam.id;
  }
  if (pNorm.includes('switch')) {
    const sw = NOTION_KNOWN_GAME_PLATFORMS.find(p => p.name === 'Nintendo Switch');
    if (sw) return sw.id;
  }
  if (pNorm.includes('playstation5') || pNorm.includes('ps5')) {
    const ps5 = NOTION_KNOWN_GAME_PLATFORMS.find(p => p.name === 'Playstation 5');
    if (ps5) return ps5.id;
  }
  if (pNorm.includes('playstation4') || pNorm.includes('ps4')) {
    const ps4 = NOTION_KNOWN_GAME_PLATFORMS.find(p => p.name === 'Playstation 4');
    if (ps4) return ps4.id;
  }
  if (pNorm.includes('snes') || pNorm.includes('supernintendo')) {
    const snes = NOTION_KNOWN_GAME_PLATFORMS.find(p => p.name === 'Super Nintendo');
    if (snes) return snes.id;
  }

  return null;
}

export async function createMediaPage(itemData, config) {
  const apiKey = config.notionApiKey || DEFAULT_CONFIG.notionApiKey;
  if (!apiKey) throw new Error('Clé API Notion manquante.');

  const isGame = itemData.isGame === true;
  const isMovie = itemData.isMovie === true;
  const mediaType = isGame ? 'game' : (isMovie ? 'movie' : 'tv');

  // 1. Charger le schéma actif (storage local ou DEFAULT_SCHEMA)
  let activeSchema = config.schema || config.cultureTrackerSchema || null;
  if (!activeSchema && browserAPI?.storage?.local) {
    try {
      const storage = await browserAPI.storage.local.get('cultureTrackerSchema');
      if (storage && storage.cultureTrackerSchema) {
        activeSchema = storage.cultureTrackerSchema;
      }
    } catch (e) {
      console.warn('Erreur lecture storage local pour le schéma Notion:', e);
    }
  }
  if (!activeSchema) {
    activeSchema = DEFAULT_SCHEMA;
  }

  const mediaSchema = activeSchema.mediaTypes?.[mediaType] || DEFAULT_SCHEMA.mediaTypes[mediaType];

  // 2. Préparation des tables de correspondance pour relations
  const lookupTables = {
    genres: NOTION_KNOWN_GENRES,
    gameGenres: NOTION_KNOWN_GAME_GENRES,
    platforms: Object.fromEntries(NOTION_KNOWN_PLATFORMS.map(p => [p.name, p.id])),
    gamePlatforms: Object.fromEntries(NOTION_KNOWN_GAME_PLATFORMS.map(p => [p.name, p.id])),
    years: NOTION_KNOWN_YEARS
  };

  // 3. Normalisation des données média pour l'adaptateur
  let parsedRating = itemData.rating !== undefined ? itemData.rating : itemData.gameRating;
  if (typeof parsedRating === 'string') {
    if (parsedRating.startsWith('⭐')) {
      parsedRating = (parsedRating.match(/⭐/g) || []).length;
    } else if (!isNaN(parseFloat(parsedRating))) {
      parsedRating = parseFloat(parsedRating);
    }
  }

  const normalizedItemData = {
    ...itemData,
    title: itemData.title || 'Sans titre',
    releaseDate: itemData.releaseDate || itemData.dateViewed,
    dateViewed: itemData.dateViewed || itemData.releaseDate,
    rating: parsedRating,
    status: itemData.status || itemData.gameStatus,
    genres: (itemData.genreIds && itemData.genreIds.length > 0) ? itemData.genreIds : itemData.genres,
    platform: itemData.platformId || itemData.platform || itemData.gamePlatformName,
    year: itemData.yearWatchId || itemData.year,
    casts: itemData.casts,
    playerSupport: itemData.playerSupport,
    copy: itemData.copy,
    totalEp: itemData.totalEp,
    currentEp: itemData.currentEp,
    url: itemData.storeUrl || itemData.url,
    favourite: itemData.isFavourite ? '♥ Favourite ♥' : undefined,
    isFavourite: itemData.isFavourite,
    notes: (itemData.notes && itemData.notes.trim() && itemData.notes.trim() !== (itemData.summary || '').trim())
      ? itemData.notes.slice(0, 1900)
      : undefined
  };

  // 4. Construction dynamique des propriétés Notion via l'adaptateur
  const properties = buildNotionProperties(normalizedItemData, mediaSchema, lookupTables);

  // 5. Routage de la base cible & injection du discriminant en mode unifié
  let targetDatabaseId;
  const isUnifiedMode = activeSchema.databaseMode === 'unified' && Boolean(activeSchema.unifiedDatabase?.databaseId);

  if (isUnifiedMode) {
    targetDatabaseId = formatDatabaseId(activeSchema.unifiedDatabase.databaseId);
    const typeProp = activeSchema.unifiedDatabase.typeProperty;
    const typePropName = (typeof typeProp === 'object' ? typeProp?.notionName : typeProp) || 'Type';
    const typeValue = activeSchema.unifiedDatabase.typeValues?.[mediaType] || (isGame ? 'Jeu Vidéo' : (isMovie ? 'Film' : 'Série TV'));
    properties[typePropName] = {
      select: { name: String(typeValue).slice(0, 100) }
    };
  } else {
    if (isGame) {
      targetDatabaseId = formatDatabaseId(mediaSchema.databaseId || config.gamesDbId || DEFAULT_CONFIG.gamesDbId);
    } else if (isMovie) {
      targetDatabaseId = formatDatabaseId(mediaSchema.databaseId || config.moviesDbId || DEFAULT_CONFIG.moviesDbId);
    } else {
      targetDatabaseId = formatDatabaseId(mediaSchema.databaseId || config.tvShowsDbId || DEFAULT_CONFIG.tvShowsDbId);
    }
  }

  // 6. Image de couverture (Cover)
  let coverUrl = null;
  if (config.useBackdropAsCover && itemData.backdropUrl) {
    coverUrl = itemData.backdropUrl;
  } else if (itemData.posterUrl) {
    coverUrl = itemData.posterUrl;
  } else if (itemData.backdropUrl) {
    coverUrl = itemData.backdropUrl;
  }

  if (coverUrl && !coverUrl.startsWith('http://') && !coverUrl.startsWith('https://')) {
    coverUrl = null;
  }

  // 7. Icône de page Notion
  let iconPayload;
  if (isGame) {
    iconPayload = { type: 'icon', icon: { name: 'video-game', color: 'blue' } };
  } else if (isMovie) {
    iconPayload = { type: 'emoji', emoji: '🎥' };
  } else {
    iconPayload = { type: 'emoji', emoji: itemData.type === '🎨 Anime' ? '🎨' : '📺' };
  }

  // 8. Génération des blocs de corps de page (Template)
  const isTemplateEnabled = config.usePageTemplate !== false && mediaSchema.usePageTemplate !== false;
  const templateDef = mediaSchema.templateBlocks || mediaSchema.template || (isGame ? 'game-default' : (isMovie ? 'movie-default' : 'tv-default'));
  const validPosterUrl = (itemData.posterUrl && itemData.posterUrl.startsWith('http'))
    ? itemData.posterUrl
    : ((itemData.backdropUrl && itemData.backdropUrl.startsWith('http')) ? itemData.backdropUrl : null);
  const pageSummary = itemData.summary || itemData.overview || itemData.notes || '';

  const vars = {
    title: itemData.title || '',
    overview: pageSummary,
    summary: pageSummary,
    releaseDate: itemData.releaseDate || '',
    year: itemData.releasedYear || '',
    rating: itemData.rating || itemData.gameRating || '',
    genres: Array.isArray(itemData.genres) ? itemData.genres.join(', ') : (itemData.genres || ''),
    cast: Array.isArray(itemData.casts) ? itemData.casts.join(', ') : (itemData.casts || ''),
    posterUrl: validPosterUrl,
    backdropUrl: itemData.backdropUrl || '',
    platform: itemData.platform || '',
    notes: itemData.notes || '',
    storeUrl: itemData.storeUrl || '',
    totalEp: itemData.totalEp !== undefined && itemData.totalEp !== null ? String(itemData.totalEp) : '',
    currentEp: itemData.currentEp !== undefined && itemData.currentEp !== null ? String(itemData.currentEp) : ''
  };

  const children = isTemplateEnabled
    ? renderTemplateBlocks(templateDef, vars, true, activeSchema.customTemplates)
    : [];

  const body = {
    parent: { database_id: targetDatabaseId },
    icon: iconPayload,
    properties,
    children
  };

  if (coverUrl) {
    body.cover = {
      type: 'external',
      external: { url: coverUrl }
    };
  }

  let res = await safeFetch(`${NOTION_API_URL}/pages`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify(body)
  });

  // Si l'icône { type: 'icon' } échoue (fallback vers emoji 🎮)
  if (!res.ok && isGame && body.icon?.type === 'icon') {
    body.icon = { type: 'emoji', emoji: '🎮' };
    res = await safeFetch(`${NOTION_API_URL}/pages`, {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify(body)
    });
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Erreur création Notion (${res.status}): ${errData.message || 'Vérifiez les propriétés de la base.'}`);
  }

  const createdPage = await res.json();
  return {
    id: createdPage.id,
    url: createdPage.url || `https://notion.so/${createdPage.id.replace(/-/g, '')}`
  };
}

// Ré-exports des modules d'architecture universelle pour compatibilité globale
export { buildNotionProperties, resolveLookupId, normalizeKey } from './notion-adapter.js';
export { renderTemplateBlocks, NotionBlocks, BUILTIN_TEMPLATES } from './template-engine.js';
export { inspectDatabase, generateSchemaRecommendation, formatDatabaseId, runDryRunDiagnostic, evaluatePropertyCompatibility } from './schema-discovery.js';
export { DEFAULT_SCHEMA } from './schema.default.js';

