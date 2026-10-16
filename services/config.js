// Configuration par défaut et gestion du stockage local

const DEFAULT_CONFIG = {
  tmdbApiKey: '',
  notionApiKey: '',
  gamesDbApiKey: '',
  moviesDbId: '312aec4b87d98111b530d4af0c22d898',
  tvShowsDbId: '312aec4b87d9812882c4fa8ad991cf87',
  gamesDbId: '312aec4b87d9815bbf60d3fc5847d424',
  gamePlatformsDbId: '312aec4b87d98196b407fa955f4e967b',
  gameGenresDbId: '312aec4b87d9812f852ef5456e1a09b9',
  genresDbId: '312aec4b87d9814880f6f328c5638e77',
  platformsDbId: '312aec4b87d981dcb2fcf3203ac0541f',
  yearlyReviewDbId: '312aec4b87d98110a8e9df55e3abd7e4',
  language: 'fr-FR',
  defaultWatchStatus: '🔵 To Watch',
  useBackdropAsCover: true,
  usePageTemplate: true
};

// Genres Films / Séries pré-indexés de votre espace Notion
const NOTION_KNOWN_GENRES = {
  'action': '312aec4b-87d9-81dd-b8b7-c22b5505673f',
  'adventure': '312aec4b-87d9-81b1-8918-d01c61baffdf',
  'aventure': '312aec4b-87d9-81b1-8918-d01c61baffdf',
  'animation': '312aec4b-87d9-8121-9537-d244996f23bb',
  'anime': '312aec4b-87d9-81cb-821c-c870071c8bbd',
  'comedy': '312aec4b-87d9-8144-95c8-c75bac81acdf',
  'comédie': '312aec4b-87d9-8144-95c8-c75bac81acdf',
  'crime': '312aec4b-87d9-8194-ba77-cedee34e8da2',
  'documentary': '312aec4b-87d9-8169-9933-d3472e4c38b8',
  'documentaire': '312aec4b-87d9-8169-9933-d3472e4c38b8',
  'drama': '312aec4b-87d9-81ee-91f2-f21489904030',
  'drame': '312aec4b-87d9-81ee-91f2-f21489904030',
  'family': '312aec4b-87d9-8159-a108-e210011fb4d1',
  'familial': '312aec4b-87d9-8159-a108-e210011fb4d1',
  'fantasy': '312aec4b-87d9-8199-ad0c-fcef49b32301',
  'fantastique': '312aec4b-87d9-8199-ad0c-fcef49b32301',
  'history': '312aec4b-87d9-813d-b676-d9c536e49347',
  'histoire': '312aec4b-87d9-813d-b676-d9c536e49347',
  'historical': '312aec4b-87d9-8152-8be7-da58b6e77816',
  'historique': '312aec4b-87d9-8152-8be7-da58b6e77816',
  'horror': '312aec4b-87d9-818f-8b5d-c6c86200b0ef',
  'horreur': '312aec4b-87d9-818f-8b5d-c6c86200b0ef',
  'musical': '312aec4b-87d9-81cc-88a1-ea70484c6ff6',
  'musique': '312aec4b-87d9-81cc-88a1-ea70484c6ff6',
  'mystery': '312aec4b-87d9-81c1-b29e-ebbd5378f8b5',
  'mystère': '312aec4b-87d9-81c1-b29e-ebbd5378f8b5',
  'romance': '312aec4b-87d9-8190-a57e-e04232f8594b',
  'science fiction': '312aec4b-87d9-81eb-a6fb-f3215e8e075e',
  'science-fiction': '312aec4b-87d9-81eb-a6fb-f3215e8e075e',
  'thriller': '312aec4b-87d9-8179-bcb5-d93d97f79f65',
  'war': '312aec4b-87d9-8147-b6d6-f458a967e9c6',
  'guerre': '312aec4b-87d9-8147-b6d6-f458a967e9c6',
  'western': '312aec4b-87d9-811b-9a2d-cd895a4179e8',
  'superhero': '312aec4b-87d9-817c-8889-e9a33d458221',
  'super-héros': '312aec4b-87d9-817c-8889-e9a33d458221'
};

// Plateformes Films / Séries (Streaming, Cinéma, etc.)
const NOTION_KNOWN_PLATFORMS = [
  { id: '3f0aec4b-87d9-8020-948f-edbae158e251', name: 'Jellyfin' },
  { id: '312aec4b-87d9-818f-b45f-cc5428181bce', name: 'Netflix' },
  { id: '312aec4b-87d9-8180-b6ad-dc52e13fd195', name: 'Disney +' },
  { id: '312aec4b-87d9-8120-99d0-c8a9e9af3870', name: 'Apple TV' },
  { id: '312aec4b-87d9-81a4-b712-df64d3dfa6c5', name: 'Amazon Prime Video' },
  { id: '312aec4b-87d9-81c3-9cfa-f11ded75b635', name: 'Crunchyroll' },
  { id: '312aec4b-87d9-81c2-95e6-c4b437a69152', name: 'Canal +' },
  { id: '312aec4b-87d9-814f-9d24-df903e24eb3a', name: 'HBO' },
  { id: '312aec4b-87d9-819c-acdb-ffaa4f582217', name: 'Cinema' },
  { id: '312aec4b-87d9-81aa-984c-eb0ef30d36af', name: 'Physical Copy' },
  { id: '312aec4b-87d9-81f9-973b-fd29aa223db5', name: 'Digital Download' }
];

// Plateformes Jeux Vidéo (Base Game Platform de votre Notion)
const NOTION_KNOWN_GAME_PLATFORMS = [
  { id: '312aec4b-87d9-814f-a9bf-d51bffc3a973', name: 'Steam' },
  { id: '312aec4b-87d9-8153-876c-f5fa646624e1', name: 'Nintendo Switch' },
  { id: '312aec4b-87d9-810a-9434-ff8cfac6c09e', name: 'Playstation 5' },
  { id: '312aec4b-87d9-8109-8aea-f8c3601cc420', name: 'Playstation 4' },
  { id: '312aec4b-87d9-811f-879b-e0cc64eada4f', name: 'Xbox One' },
  { id: '312aec4b-87d9-815f-9fe6-c05533a7e036', name: 'Xbox 360' },
  { id: '312aec4b-87d9-81e6-b358-cef278a5b05f', name: 'PC - Xbox Game Pass' },
  { id: '312aec4b-87d9-815c-a528-e04aa40a310f', name: 'GOG' },
  { id: '312aec4b-87d9-81b4-881b-c55c53d905f4', name: 'Epic Games' },
  { id: '317aec4b-87d9-8088-b6bf-ea96b4cc0c5e', name: 'Ubisoft Connect' },
  { id: '312aec4b-87d9-815a-887b-dba28e6972ab', name: 'EA Play' },
  { id: '312aec4b-87d9-8190-aba6-fe958c14777b', name: 'Amazon Games' },
  { id: '312aec4b-87d9-81d6-8bc2-d282f3e4b7d5', name: 'Nintendo 3DS' },
  { id: '312aec4b-87d9-8115-b8b3-ddd7fe016333', name: 'Nintendo DS' },
  { id: '312aec4b-87d9-8179-a3c2-f28a7f14797e', name: 'Super Nintendo' },
  { id: '312aec4b-87d9-816f-ba65-d74cf2886a79', name: 'NES' },
  { id: '312aec4b-87d9-813f-846e-fa2e7e1b5f25', name: 'Game Boy' },
  { id: '312aec4b-87d9-81e1-b61d-e310ecc70246', name: 'Wii' },
  { id: '312aec4b-87d9-8183-ab53-caecd2a1240a', name: 'Wii U' },
  { id: '312aec4b-87d9-81c8-a1a8-d5c1f79b0be1', name: 'Apple Store' },
  { id: '312aec4b-87d9-81a0-b2c1-e5455989fc8a', name: 'Google Play' },
  { id: '312aec4b-87d9-8148-aaa3-fdebe5432894', name: 'Crack' }
];

// Genres Jeux Vidéo (Base Genres de jeux de votre Notion)
const NOTION_KNOWN_GAME_GENRES = {
  'action': '312aec4b-87d9-81b3-8d32-ff423331698e',
  'adventure': '312aec4b-87d9-8133-834e-f18f5b324325',
  'aventure': '312aec4b-87d9-8133-834e-f18f5b324325',
  'rpg': '312aec4b-87d9-8138-bbc3-c9a97b3c3732',
  'role-playing': '312aec4b-87d9-8138-bbc3-c9a97b3c3732',
  'jrpg': '312aec4b-87d9-81dc-a9c9-ee2289454319',
  'indie': '3ddaec4b-87d9-8128-a5e1-f78bc5412e40',
  'simulation': '3ddaec4b-87d9-81b0-9874-e0761c0a9022',
  'strategy': '312aec4b-87d9-8198-b08e-d2fed6999283',
  'stratégie': '312aec4b-87d9-8198-b08e-d2fed6999283',
  'puzzle': '312aec4b-87d9-81a0-a0b3-f85db14db688',
  'platform': '312aec4b-87d9-8139-87fb-e02c94db7b96',
  'platformer': '312aec4b-87d9-8139-87fb-e02c94db7b96',
  'plateforme': '312aec4b-87d9-8139-87fb-e02c94db7b96',
  'fps': '312aec4b-87d9-81bc-bc59-d8c12b39f8d6',
  'tps': '312aec4b-87d9-813b-a476-efdfc2ba6cab',
  'shooter': '312aec4b-87d9-81ed-9e4c-cbe9c874d225',
  'shooting': '312aec4b-87d9-81ed-9e4c-cbe9c874d225',
  'open world': '312aec4b-87d9-81c1-a577-c4737fde491c',
  'monde ouvert': '312aec4b-87d9-81c1-a577-c4737fde491c',
  'survival': '312aec4b-87d9-81d1-bc11-c4fc175e8bf9',
  'survie': '312aec4b-87d9-81d1-bc11-c4fc175e8bf9',
  'horror': '312aec4b-87d9-8112-95a2-dc0e82183f9a',
  'horreur': '312aec4b-87d9-8112-95a2-dc0e82183f9a',
  'roguelike': '312aec4b-87d9-8119-869c-cba0d1648e9d',
  'rogue-lite': '312aec4b-87d9-81d4-869b-e30bfca546a2',
  'metroidvania': '312aec4b-87d9-819c-bd51-d740555e265a',
  "hack'n'slash": '312aec4b-87d9-8165-b13d-c0350c2fbe5b',
  'deckbuilder': '312aec4b-87d9-8122-9afc-d4374d48c6a5',
  'bullet hell': '312aec4b-87d9-816e-8d0b-f14363d76630',
  "point'n'click": '312aec4b-87d9-8170-a4e6-d4fa41e3228d',
  'city builder': '312aec4b-87d9-819d-9f73-cd633827eb53',
  'racing': '312aec4b-87d9-810c-9c1c-f7e7e0593a88',
  'course': '312aec4b-87d9-810c-9c1c-f7e7e0593a88',
  'fighting': '312aec4b-87d9-811d-83b9-f1dd3e92f113',
  'combat': '312aec4b-87d9-811d-83b9-f1dd3e92f113',
  'sports': '312aec4b-87d9-818c-a3c6-feab8bd513bb',
  'sport': '312aec4b-87d9-818c-a3c6-feab8bd513bb',
  'stealth': '312aec4b-87d9-8184-b44f-fddeb0b9ecca',
  'infiltration': '312aec4b-87d9-81eb-beb1-d2bcddc4ca12',
  'sandbox': '312aec4b-87d9-815b-be9d-fca2b06bdcdd',
  'gestion': '312aec4b-87d9-81df-8c83-f6d2d6f24d38',
  'casual': '3ddaec4b-87d9-814b-8373-ea345b0be8fa',
  'free to play': '3ddaec4b-87d9-816f-920a-c3966c19dbed',
  'early access': '3ddaec4b-87d9-81f3-8c33-ed2d5b7bc2d9',
  'massively multiplayer': '3ddaec4b-87d9-81de-a395-d821b0968df9',
  'mmo': '3ddaec4b-87d9-81de-a395-d821b0968df9',
  'rhythm': '312aec4b-87d9-8181-8d54-dbc45130083c',
  'music': '312aec4b-87d9-8181-8d54-dbc45130083c',
  'narrative': '312aec4b-87d9-817f-81e6-e09b1c244bfd',
  'visual novel': '312aec4b-87d9-81c0-b91b-f577e701cbd3',
  'dungeon crawler': '312aec4b-87d9-81d3-8e40-ef29b2cbb525',
  'exploration': '312aec4b-87d9-813f-ba07-e85076b32d7f',
  'sci-fi': '312aec4b-87d9-81f2-9407-f307642f73bf',
  'fantasy': '312aec4b-87d9-811b-b9f0-dfc8df035401',
  'arcade': '312aec4b-87d9-8188-93e5-f22840d8fae8'
};

// Mapping des années de Yearly Review
const NOTION_KNOWN_YEARS = {
  '2026': '312aec4b-87d9-8135-bd16-d2b5f1fd2f6a',
  '2025': '312aec4b-87d9-818c-9fde-cb67ed71aad6',
  '2024': '312aec4b-87d9-81b9-86c6-ed902def8217',
  '2023': '312aec4b-87d9-814d-ad4c-e4eb4db69e03',
  '2022': '312aec4b-87d9-814a-a998-e91d6e42788f',
  '2021': '312aec4b-87d9-8120-b554-eec6518648cb'
};

// Options de statut pour les jeux vidéo
const NOTION_GAME_STATUSES = [
  'Want To Play',
  'Playing Now',
  'Game Complete',
  'Tested',
  'Stopped Playing',
  'Want To Replay',
  'Unreleased',
  'On Hold'
];

// Notations pour les jeux vidéo
const NOTION_GAME_RATINGS = [
  '5 Stars 💥 ',
  '4 Stars 💥 ',
  '3 Stars 💥 ',
  '2 Stars 💥 ',
  '1 Star 💥 '
];

async function getStorageAPI() {
  if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
    return browser.storage.local;
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return chrome.storage.local;
  }
  return null;
}

export async function getConfig() {
  const storage = await getStorageAPI();
  if (!storage) return { ...DEFAULT_CONFIG };

  try {
    const data = await storage.get('cultureTrackerConfig');
    if (data && data.cultureTrackerConfig) {
      const merged = { ...DEFAULT_CONFIG, ...data.cultureTrackerConfig };
      // Garantie de fallback si un champ texte est vide ou indéfini
      for (const [key, defaultVal] of Object.entries(DEFAULT_CONFIG)) {
        if (typeof defaultVal === 'string') {
          if (!merged[key] || typeof merged[key] !== 'string' || !merged[key].trim()) {
            merged[key] = defaultVal;
          }
        }
      }
      return merged;
    }
  } catch (err) {
    console.warn('Erreur lecture storage:', err);
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(newConfig) {
  const storage = await getStorageAPI();
  if (!storage) return false;
  try {
    await storage.set({ cultureTrackerConfig: newConfig });
    return true;
  } catch (err) {
    console.error('Erreur écriture storage:', err);
    return false;
  }
}

export {
  NOTION_KNOWN_GENRES,
  NOTION_KNOWN_PLATFORMS,
  NOTION_KNOWN_GAME_PLATFORMS,
  NOTION_KNOWN_GAME_GENRES,
  NOTION_KNOWN_YEARS,
  NOTION_GAME_STATUSES,
  NOTION_GAME_RATINGS,
  DEFAULT_CONFIG
};
