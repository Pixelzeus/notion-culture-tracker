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
  const res = await fetch(`${NOTION_API_URL}/databases/${dbId}`, {
    method: 'GET',
    headers: getHeaders(apiKey)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Échec connexion Notion (${res.status}): ${err.message || 'Vérifiez la clé et le partage de la base.'}`);
  }
  return true;
}

import { safeFetch } from './fetch-proxy.js';

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

  // 1. Image de couverture (Cover)
  let coverUrl = null;
  if (config.useBackdropAsCover && itemData.backdropUrl) {
    coverUrl = itemData.backdropUrl;
  } else if (itemData.posterUrl) {
    coverUrl = itemData.posterUrl;
  } else if (itemData.backdropUrl) {
    coverUrl = itemData.backdropUrl;
  }

  // Validation URL HTTP/HTTPS
  if (coverUrl && !coverUrl.startsWith('http://') && !coverUrl.startsWith('https://')) {
    coverUrl = null;
  }

  let body = null;

  // CAS A : JEU VIDÉO (All Games Database avec template "Game Title Here")
  if (isGame) {
    const databaseId = config.gamesDbId || DEFAULT_CONFIG.gamesDbId;
    const properties = {
      'Name': {
        title: [{ text: { content: itemData.title || 'Sans titre' } }]
      }
    };

    if (itemData.storeUrl) {
      properties['URL'] = { url: itemData.storeUrl };
    }

    // Validation date
    if (itemData.releaseDate && typeof itemData.releaseDate === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(itemData.releaseDate.trim())) {
      properties['Release Date'] = { date: { start: itemData.releaseDate.trim() } };
    }

    if (itemData.gameStatus) {
      properties['Game Status'] = { select: { name: itemData.gameStatus } };
    }
    if (itemData.gameRating) {
      properties['Overall Rating'] = { select: { name: itemData.gameRating } };
    }
    if (itemData.copy) {
      properties['Copy'] = { select: { name: itemData.copy } };
    }
    if (itemData.playerSupport && itemData.playerSupport.length > 0) {
      properties['Player Support'] = {
        multi_select: itemData.playerSupport.map(name => ({ name }))
      };
    }
    if (itemData.platformId) {
      properties['Game Platform'] = {
        relation: [{ id: itemData.platformId }]
      };
    }
    if (itemData.genreIds && itemData.genreIds.length > 0) {
      properties['Genres'] = {
        relation: itemData.genreIds.map(id => ({ id }))
      };
    }
    if (itemData.yearWatchId) {
      properties['Year Played'] = {
        relation: [{ id: itemData.yearWatchId }]
      };
    }
    if (itemData.isFavourite) {
      properties['Favourite?'] = { select: { name: '♥ Favourite ♥' } };
    }
    // IMPORTANT: Le résumé du jeu ne doit PAS être mis dans la propriété 'Notes' de la base Notion.
    // 'Notes' est réservé uniquement aux notes personnelles de l'utilisateur (si renseignées).
    if (itemData.notes && itemData.notes.trim() && itemData.notes.trim() !== (itemData.summary || '').trim()) {
      properties['Notes'] = {
        rich_text: [{ text: { content: itemData.notes.slice(0, 1900) } }]
      };
    }

    // Blocs de page du template "Game Title Here"
    const validPosterUrl = (itemData.posterUrl && itemData.posterUrl.startsWith('http'))
      ? itemData.posterUrl
      : ((itemData.backdropUrl && itemData.backdropUrl.startsWith('http')) ? itemData.backdropUrl : null);

    // Le résumé du jeu est inséré UNIQUEMENT dans le corps de la page dans la section droite ("Game Summary")
    const pageGameSummary = itemData.summary || itemData.overview || '';
    const children = config.usePageTemplate
      ? buildGameTemplateBlocks(validPosterUrl, pageGameSummary)
      : [];

    body = {
      parent: { database_id: databaseId },
      icon: { type: 'icon', icon: { name: 'video-game', color: 'blue' } },
      properties,
      children
    };
  }
  // CAS B : FILMS OU SÉRIES TV (All Movies / All TV Shows)
  else {
    const databaseId = isMovie
      ? (config.moviesDbId || DEFAULT_CONFIG.moviesDbId)
      : (config.tvShowsDbId || DEFAULT_CONFIG.tvShowsDbId);

    let iconEmoji = '🎥';
    if (!isMovie) {
      iconEmoji = itemData.type === '🎨 Anime' ? '🎨' : '📺';
    }

    const properties = {
      'Name': {
        title: [{ text: { content: itemData.title || 'Sans titre' } }]
      },
      'Type': {
        select: { name: isMovie ? '🎥 Movie' : (itemData.type || '📺 TV show') }
      },
      'Watch Status': {
        select: { name: itemData.status || '🔵 To Watch' }
      }
    };

    if (itemData.releasedYear && !isNaN(itemData.releasedYear)) {
      properties['Released Year'] = { number: Number(itemData.releasedYear) };
    }
    if (itemData.releaseDate && typeof itemData.releaseDate === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(itemData.releaseDate.trim())) {
      properties['Release Date'] = { date: { start: itemData.releaseDate.trim() } };
    }
    if (itemData.dateViewed && typeof itemData.dateViewed === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(itemData.dateViewed.trim())) {
      properties['Date viewed'] = { date: { start: itemData.dateViewed.trim() } };
    }
    if (itemData.rating) {
      properties['My Rating'] = { select: { name: itemData.rating } };
    }
    if (itemData.isFavourite) {
      properties['Favourite?'] = { select: { name: '♥ Favourite ♥' } };
    }

    if (itemData.casts && itemData.casts.length > 0) {
      const validCasts = itemData.casts
        .map(name => ({ name: name.replace(/,/g, '').trim() }))
        .filter(c => c.name.length > 0)
        .slice(0, 10);
      if (validCasts.length > 0) {
        properties['Casts'] = { multi_select: validCasts };
      }
    }

    if (itemData.genreIds && itemData.genreIds.length > 0) {
      properties['Genre'] = {
        relation: itemData.genreIds.map(id => ({ id }))
      };
    }

    if (itemData.platformId) {
      properties['Platform'] = {
        relation: [{ id: itemData.platformId }]
      };
    }

    if (itemData.yearWatchId) {
      properties['Year Watch'] = {
        relation: [{ id: itemData.yearWatchId }]
      };
    }

    if (itemData.notes && itemData.notes.trim()) {
      properties['Notes'] = {
        rich_text: [{ text: { content: itemData.notes.slice(0, 1900) } }]
      };
    }

    if (!isMovie) {
      if (itemData.totalEp !== undefined && itemData.totalEp !== null) {
        properties['Total Ep'] = { number: Number(itemData.totalEp) };
      }
      if (itemData.currentEp !== undefined && itemData.currentEp !== null) {
        properties['Current Ep'] = { number: Number(itemData.currentEp) };
      }
    }

    // Blocs de page selon le template Notion (TV Title ou Movie Title)
    let children = [];
    if (config.usePageTemplate) {
      const verticalPoster = (itemData.posterUrl && itemData.posterUrl.startsWith('http'))
        ? itemData.posterUrl
        : ((itemData.backdropUrl && itemData.backdropUrl.startsWith('http')) ? itemData.backdropUrl : null);

      if (isMovie) {
        children = buildMovieTemplateBlocks(verticalPoster, itemData.notes);
      } else {
        children = buildTvTemplateBlocks(verticalPoster, itemData.notes);
      }
    }

    body = {
      parent: { database_id: databaseId },
      icon: { type: 'emoji', emoji: iconEmoji },
      properties,
      children
    };
  }

  if (coverUrl) {
    body.cover = {
      type: 'external',
      external: { url: coverUrl }
    };
  }

  let res = await fetch(`${NOTION_API_URL}/pages`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify(body)
  });

  // Si l'icône { type: 'icon' } échoue (fallback vers emoji 🎮)
  if (!res.ok && isGame && body.icon?.type === 'icon') {
    body.icon = { type: 'emoji', emoji: '🎮' };
    res = await fetch(`${NOTION_API_URL}/pages`, {
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
