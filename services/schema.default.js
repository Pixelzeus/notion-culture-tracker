// Schéma déclaratif exporté en module ES pour compatibilité directe avec les extensions
export const DEFAULT_SCHEMA = {
  version: '1.0.0',
  description: 'Configuration déclarative du schéma Notion pour Culture Tracker. Modifiable par n\'importe quel agent IA.',
  databaseMode: 'distinct',
  unifiedDatabase: {
    databaseId: '',
    typeProperty: 'Type',
    typeValues: {
      movie: 'Film',
      tv: 'Série TV',
      game: 'Jeu Vidéo'
    }
  },
  mediaTypes: {
    movie: {
      name: 'Films',
      databaseKey: 'moviesDbId',
      template: 'movie-default',
      usePageTemplate: true,
      properties: {
        title: { notionName: 'Title', type: 'title' },
        releaseDate: { notionName: 'Release Date', type: 'date' },
        rating: { notionName: 'Rating', type: 'number' },
        status: { notionName: 'Watch Status', type: 'select', defaultValue: '🔵 To Watch' },
        genres: { notionName: 'Genres', type: 'relation', lookupTable: 'genres' },
        platform: { notionName: 'Platforms', type: 'relation', lookupTable: 'platforms' },
        year: { notionName: 'Year Watched', type: 'relation', lookupTable: 'years' }
      }
    },
    tv: {
      name: 'Séries TV',
      databaseKey: 'tvShowsDbId',
      template: 'tv-default',
      usePageTemplate: true,
      properties: {
        title: { notionName: 'Title', type: 'title' },
        releaseDate: { notionName: 'Release Date', type: 'date' },
        totalEp: { notionName: 'Total Episodes', type: 'number' },
        rating: { notionName: 'Rating', type: 'number' },
        status: { notionName: 'Watch Status', type: 'select', defaultValue: '🔵 To Watch' },
        genres: { notionName: 'Genres', type: 'relation', lookupTable: 'genres' },
        platform: { notionName: 'Platforms', type: 'relation', lookupTable: 'platforms' },
        year: { notionName: 'Year Watched', type: 'relation', lookupTable: 'years' }
      }
    },
    game: {
      name: 'Jeux Vidéo',
      databaseKey: 'gamesDbId',
      template: 'game-default',
      usePageTemplate: true,
      properties: {
        title: { notionName: 'Title', type: 'title' },
        platform: { notionName: 'Game Platform', type: 'relation', lookupTable: 'gamePlatforms' },
        genres: { notionName: 'Genres', type: 'relation', lookupTable: 'gameGenres' },
        status: { notionName: 'Game Status', type: 'select', defaultValue: '🔵 Backlog' },
        rating: { notionName: 'Overall Rating', type: 'number' },
        playerSupport: { notionName: 'Player Support', type: 'select' },
        copy: { notionName: 'Copy', type: 'select', defaultValue: 'Digital' },
        year: { notionName: 'Year Played', type: 'relation', lookupTable: 'years' }
      }
    }
  }
};

// Types de colonnes Notion autorisés dans Culture Tracker
export const PERMITTED_NOTION_TYPES = [
  'title',
  'select',
  'multi_select',
  'status',
  'relation',
  'number',
  'date',
  'rich_text',
  'url',
  'checkbox'
];

/**
 * Valide rigoureusement la structure d'un schéma Notion Culture Tracker.
 * Vérifie :
 * - Que l'entrée est un objet JSON non-nul
 * - Que 'mediaTypes' existe et contient au moins un média supporté ('movie', 'tv', 'game')
 * - Que chaque média contient un objet 'properties' et une propriété 'title' valide (type 'title' ou notionName non-vide)
 * - Que tous les types de propriétés définis figurent dans PERMITTED_NOTION_TYPES
 *
 * @param {any} schemaObject - Objet JSON représentant le schéma à valider.
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validateSchema(schemaObject) {
  if (!schemaObject || typeof schemaObject !== 'object' || Array.isArray(schemaObject)) {
    return {
      valid: false,
      errors: ['Le schéma doit être un objet JSON valide.']
    };
  }

  const errors = [];

  if (!schemaObject.mediaTypes || typeof schemaObject.mediaTypes !== 'object' || Array.isArray(schemaObject.mediaTypes)) {
    return {
      valid: false,
      errors: ["La section 'mediaTypes' est requise et doit être un objet."]
    };
  }

  const supportedMedia = ['movie', 'tv', 'game'];
  const hasSupportedMedia = supportedMedia.some(m => {
    const val = schemaObject.mediaTypes[m];
    return val && typeof val === 'object' && !Array.isArray(val);
  });

  if (!hasSupportedMedia) {
    errors.push("Le schéma doit contenir au moins un type de média parmi 'movie', 'tv', ou 'game'.");
  }

  const permittedTypesSet = new Set(PERMITTED_NOTION_TYPES);

  for (const [mediaKey, mediaConfig] of Object.entries(schemaObject.mediaTypes)) {
    if (!mediaConfig || typeof mediaConfig !== 'object' || Array.isArray(mediaConfig)) {
      errors.push(`La configuration du média "${mediaKey}" doit être un objet.`);
      continue;
    }

    if (!mediaConfig.properties || typeof mediaConfig.properties !== 'object' || Array.isArray(mediaConfig.properties)) {
      errors.push(`Le type de média "${mediaKey}" doit contenir un objet 'properties'.`);
      continue;
    }

    const titleProp = mediaConfig.properties.title;
    if (!titleProp || typeof titleProp !== 'object' || Array.isArray(titleProp)) {
      errors.push(`Le type de média "${mediaKey}" doit définir une propriété "title".`);
    } else {
      const hasValidTitleType = titleProp.type === 'title';
      const hasValidNotionName = typeof titleProp.notionName === 'string' && titleProp.notionName.trim().length > 0;
      if (!hasValidTitleType && !hasValidNotionName) {
        errors.push(`La propriété "title" du média "${mediaKey}" doit avoir le type "title" ou un "notionName" non vide.`);
      }
    }

    for (const [propKey, propVal] of Object.entries(mediaConfig.properties)) {
      if (!propVal || typeof propVal !== 'object' || Array.isArray(propVal)) {
        errors.push(`La propriété "${mediaKey}.${propKey}" doit être un objet.`);
        continue;
      }
      if (propVal.type !== undefined && propVal.type !== null && propVal.type !== '') {
        if (!permittedTypesSet.has(propVal.type)) {
          errors.push(`Type de colonne Notion non autorisé "${propVal.type}" pour "${mediaKey}.${propKey}". Types autorisés : ${PERMITTED_NOTION_TYPES.join(', ')}.`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
