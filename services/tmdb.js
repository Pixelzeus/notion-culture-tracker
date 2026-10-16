// Client API The Movie Database (TMDb)
import { safeFetch } from './fetch-proxy.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_W780 = 'https://image.tmdb.org/t/p/w780';
const IMAGE_BASE_W1280 = 'https://image.tmdb.org/t/p/w1280';

export async function searchMedia(query, type = 'all', config) {
  if (!query || !query.trim()) return [];
  const apiKey = config.tmdbApiKey;
  if (!apiKey) throw new Error('Clé API TMDb manquante.');

  let endpoint = '/search/multi';
  if (type === 'movie') endpoint = '/search/movie';
  if (type === 'tv') endpoint = '/search/tv';

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query.trim());
  url.searchParams.set('language', config.language || 'fr-FR');
  url.searchParams.set('include_adult', 'false');

  const res = await safeFetch(url.toString());
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erreur TMDb (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const rawResults = data.results || [];

  return rawResults
    .filter(item => {
      if (type === 'all') return item.media_type === 'movie' || item.media_type === 'tv';
      return true;
    })
    .map(item => {
      const mediaType = item.media_type || type;
      const isMovie = mediaType === 'movie';
      const title = isMovie ? item.title : item.name;
      const originalTitle = isMovie ? item.original_title : item.original_name;
      const releaseDate = isMovie ? item.release_date : item.first_air_date;
      const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

      return {
        id: item.id,
        mediaType,
        title: title || 'Sans titre',
        originalTitle: originalTitle !== title ? originalTitle : null,
        releaseDate: releaseDate || null,
        year: !isNaN(year) ? year : null,
        posterUrl: item.poster_path ? `${IMAGE_BASE_W780}${item.poster_path}` : null,
        backdropUrl: item.backdrop_path ? `${IMAGE_BASE_W1280}${item.backdrop_path}` : null,
        overview: item.overview || 'Aucun résumé disponible.',
        voteAverage: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null
      };
    });
}

export async function getMediaDetails(id, mediaType, config) {
  const apiKey = config.tmdbApiKey;
  if (!apiKey) throw new Error('Clé API TMDb manquante.');

  const endpoint = mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`;
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', config.language || 'fr-FR');
  url.searchParams.set('append_to_response', 'credits,watch/providers');

  const res = await safeFetch(url.toString());
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erreur détails TMDb (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const isMovie = mediaType === 'movie';
  const title = isMovie ? data.title : data.name;
  const originalTitle = isMovie ? data.original_title : data.original_name;
  const releaseDate = isMovie ? data.release_date : data.first_air_date;
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;

  // Extraction acteurs (top 5)
  const castList = (data.credits && data.credits.cast) ? data.credits.cast.slice(0, 5).map(c => c.name) : [];

  // Extraction genres
  const genres = (data.genres || []).map(g => g.name);

  // Détection Anime
  const isAnime = !isMovie && (data.original_language === 'ja' || genres.some(g => g.toLowerCase() === 'animation'));

  // Extraction fournisseurs FR
  const frProviders = data['watch/providers']?.results?.FR?.flatrate || [];
  const suggestedProviders = frProviders.map(p => p.provider_name);

  return {
    id: data.id,
    mediaType,
    isMovie,
    isAnime,
    title,
    originalTitle,
    releaseDate: releaseDate || null,
    releasedYear: !isNaN(year) ? year : null,
    totalEp: isMovie ? null : (data.number_of_episodes || (data.seasons ? data.seasons.reduce((acc, s) => acc + (s.episode_count || 0), 0) : 0)),
    posterUrl: data.poster_path ? `${IMAGE_BASE_W780}${data.poster_path}` : null,
    backdropUrl: data.backdrop_path ? `${IMAGE_BASE_W1280}${data.backdrop_path}` : null,
    overview: data.overview || '',
    genres,
    casts: castList,
    suggestedProviders
  };
}
