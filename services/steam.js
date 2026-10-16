// Client API Steam Store pour la recherche de jeux vidéo
import { safeFetch } from './fetch-proxy.js';

export async function searchSteamGames(query) {
  if (!query || !query.trim()) return [];

  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query.trim())}&l=french&cc=FR`;
  const res = await safeFetch(url);
  if (!res.ok) {
    throw new Error(`Erreur recherche Steam (${res.status})`);
  }

  const data = await res.json();
  const items = data.items || [];

  return items.map(item => {
    const appId = item.id;
    return {
      id: appId,
      mediaType: 'game',
      source: 'steam',
      isGame: true,
      title: item.name,
      originalTitle: 'Plateforme : Steam (PC)',
      releaseDate: null,
      year: null,
      posterUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
      backdropUrl: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
      overview: 'Jeu vidéo disponible sur Steam.',
      voteAverage: null,
      platform: 'Steam'
    };
  });
}

export async function getSteamGameDetails(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=french`;
  const res = await safeFetch(url);
  if (!res.ok) {
    throw new Error(`Erreur détails Steam (${res.status})`);
  }

  const json = await res.json();
  const raw = json[String(appId)];
  if (!raw || !raw.success || !raw.data) {
    throw new Error('Détails du jeu introuvables sur Steam.');
  }

  const data = raw.data;

  // Détection du mode de jeu (Player Support)
  const cats = data.categories || [];
  const playerSupport = [];
  if (cats.some(c => c.id === 2 || c.description.toLowerCase().includes('solo') || c.description.toLowerCase().includes('single-player'))) {
    playerSupport.push('Singleplayer');
  }
  if (cats.some(c => c.id === 1 || c.id === 36 || c.description.toLowerCase().includes('multi'))) {
    playerSupport.push('Multiplayer');
  }
  if (cats.some(c => c.id === 9 || c.id === 38 || c.description.toLowerCase().includes('co-op') || c.description.toLowerCase().includes('coop'))) {
    playerSupport.push('Co-op');
  }
  if (cats.some(c => c.id === 49 || c.description.toLowerCase().includes('pvp') || c.description.toLowerCase().includes('compétitif'))) {
    playerSupport.push('Online Competitive');
  }
  if (playerSupport.length === 0) {
    playerSupport.push('Singleplayer');
  }

  // Année & Date
  let year = null;
  let isoDate = null;
  if (data.release_date && data.release_date.date) {
    const rawDate = data.release_date.date;
    const matchYear = rawDate.match(/\b(19\d\d|20\d\d)\b/);
    if (matchYear) year = parseInt(matchYear[1], 10);
    const parsed = Date.parse(rawDate);
    if (!isNaN(parsed)) {
      isoDate = new Date(parsed).toISOString().split('T')[0];
    }
  }

  return {
    id: appId,
    appId: appId,
    mediaType: 'game',
    source: 'steam',
    isGame: true,
    isMovie: false,
    title: data.name,
    originalTitle: 'Plateforme : Steam (PC)',
    gamePlatformName: 'Steam',
    storeUrl: `https://store.steampowered.com/app/${appId}`,
    releaseDate: isoDate,
    releasedYear: year,
    developers: data.developers || [],
    genres: (data.genres || []).map(g => g.description),
    playerSupport,
    posterUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
    backdropUrl: data.header_image || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
    overview: data.short_description || data.detailed_description || ''
  };
}
