// Client API TheGamesDB (thegamesdb.net) pour la recherche de jeux vidéo
import { safeFetch } from './fetch-proxy.js';

const TGDB_BASE_URL = 'https://api.thegamesdb.net/v1';

const TGDB_GENRE_MAP = {
  1: 'Action',
  2: 'Adventure',
  3: 'Simulation',
  4: 'Role-Playing',
  5: 'Puzzle',
  6: 'Strategy',
  7: 'Racing',
  8: 'Shooter',
  9: 'Simulation',
  10: 'Fighting',
  11: 'Sports',
  12: 'Sandbox',
  13: 'Simulation',
  14: 'MMO',
  15: 'Platform',
  16: 'Stealth',
  17: 'Music',
  18: 'Horror',
  19: 'Simulation',
  20: 'Board',
  22: 'Family'
};

export async function searchTheGamesDb(query, config) {
  if (!query || !query.trim()) return [];
  const apiKey = (config && config.gamesDbApiKey)?.trim();
  if (!apiKey) {
    throw new Error('Clé API TheGamesDB manquante. Veuillez la configurer dans les paramètres.');
  }

  const url = `${TGDB_BASE_URL}/Games/ByGameName?apikey=${encodeURIComponent(apiKey)}&name=${encodeURIComponent(query.trim())}&fields=overview,genres,players,publishers,developers&include=boxart,platform`;

  const res = await safeFetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`TheGamesDB (${res.status}): ${errText || res.statusText}`);
  }

  const json = await res.json();
  const rawGames = json.data?.games || [];
  const boxarts = json.include?.boxart?.data || {};
  const platforms = json.include?.platform || {};
  const baseUrlMedium = json.include?.boxart?.base_url?.medium || 'https://cdn.thegamesdb.net/images/medium/';

  return rawGames.map(game => {
    const gameBoxarts = Array.isArray(boxarts[game.id]) ? boxarts[game.id] : [];
    const frontArt = gameBoxarts.find(b => b.side === 'front') || gameBoxarts[0];
    const posterUrl = frontArt && frontArt.filename ? `${baseUrlMedium}${frontArt.filename}` : null;
    const platformName = platforms[game.platform]?.name || '';
    const year = game.release_date ? parseInt(game.release_date.slice(0, 4), 10) : null;

    return {
      id: game.id,
      mediaType: 'game',
      source: 'tgdb',
      isGame: true,
      title: game.game_title,
      originalTitle: platformName ? `Plateforme : ${platformName}` : null,
      releaseDate: game.release_date || null,
      year: !isNaN(year) ? year : null,
      posterUrl,
      backdropUrl: null,
      overview: game.overview || 'Jeu vidéo référencé sur TheGamesDB.',
      voteAverage: null,
      platform: platformName
    };
  });
}

export async function getTheGamesDbDetails(gameId, config) {
  const apiKey = (config && config.gamesDbApiKey)?.trim();
  if (!apiKey) {
    throw new Error('Clé API TheGamesDB manquante. Veuillez la configurer dans les paramètres.');
  }

  // Requêtes en parallèle pour les données du jeu et les images
  const [gameRes, imagesRes] = await Promise.all([
    safeFetch(`${TGDB_BASE_URL}/Games/ByGameID?apikey=${encodeURIComponent(apiKey)}&id=${gameId}&fields=overview,genres,players,publishers,developers&include=boxart,platform`),
    safeFetch(`${TGDB_BASE_URL}/Games/Images?apikey=${encodeURIComponent(apiKey)}&games_id=${gameId}`)
  ]);

  if (!gameRes.ok) {
    throw new Error(`Détails TheGamesDB introuvables (${gameRes.status})`);
  }

  const gameJson = await gameRes.json();
  const game = gameJson.data?.games?.[0];
  if (!game) throw new Error('Jeu non trouvé sur TheGamesDB.');

  // TheGamesDB structure platform soit sous platform.data, soit directement platform
  const platforms = gameJson.include?.platform?.data || gameJson.include?.platform || {};
  const platformName = platforms[game.platform]?.name || '';

  // Images
  let posterUrl = null;
  let backdropUrl = null;

  if (imagesRes.ok) {
    const imgJson = await imagesRes.json().catch(() => null);
    if (imgJson && imgJson.data?.images?.[String(gameId)]) {
      const list = imgJson.data.images[String(gameId)];
      const baseOriginal = imgJson.data.base_url?.original || 'https://cdn.thegamesdb.net/images/original/';
      const baseMedium = imgJson.data.base_url?.medium || 'https://cdn.thegamesdb.net/images/medium/';

      // Pochette avant
      const front = list.find(i => i.type === 'boxart' && i.side === 'front') || list.find(i => i.type === 'boxart');
      if (front && front.filename) posterUrl = `${baseMedium}${front.filename}`;

      // Bannière paysage (fanart ou screenshot)
      const fanart = list.find(i => i.type === 'fanart') || list.find(i => i.type === 'screenshot');
      if (fanart && fanart.filename) backdropUrl = `${baseOriginal}${fanart.filename}`;
    }
  }

  // Si pas d'image trouvée dans l'API Images, on regarde dans l'include boxart
  if (!posterUrl && gameJson.include?.boxart?.data?.[gameId]) {
    const list = Array.isArray(gameJson.include.boxart.data[gameId]) ? gameJson.include.boxart.data[gameId] : [];
    const front = list.find(b => b.side === 'front') || list[0];
    const baseMedium = gameJson.include.boxart.base_url?.medium || 'https://cdn.thegamesdb.net/images/medium/';
    if (front && front.filename) posterUrl = `${baseMedium}${front.filename}`;
  }

  // Mode de jeu (Player Support)
  const playerSupport = [];
  if (game.players === 1) {
    playerSupport.push('Singleplayer');
  } else if (game.players > 1) {
    playerSupport.push('Singleplayer', 'Multiplayer');
  } else {
    playerSupport.push('Singleplayer');
  }

  // Genres (supporte string '4 22' ou tableau [4, 22])
  let genreIds = [];
  if (typeof game.genres === 'string') {
    genreIds = game.genres.split(/\s+/).map(n => parseInt(n, 10)).filter(Boolean);
  } else if (Array.isArray(game.genres)) {
    genreIds = game.genres;
  }
  const genres = genreIds
    .map(id => TGDB_GENRE_MAP[id] || `Genre ${id}`)
    .filter(Boolean);

  const year = game.release_date ? parseInt(game.release_date.slice(0, 4), 10) : null;

  return {
    id: game.id,
    appId: game.id,
    mediaType: 'game',
    source: 'tgdb',
    isGame: true,
    isMovie: false,
    title: game.game_title,
    originalTitle: platformName ? `Plateforme : ${platformName}` : null,
    gamePlatformName: platformName,
    storeUrl: `https://thegamesdb.net/game.php?id=${game.id}`,
    releaseDate: game.release_date || null,
    releasedYear: !isNaN(year) ? year : null,
    developers: [],
    genres,
    playerSupport,
    posterUrl: posterUrl || backdropUrl,
    backdropUrl: backdropUrl || posterUrl,
    overview: game.overview || ''
  };
}
