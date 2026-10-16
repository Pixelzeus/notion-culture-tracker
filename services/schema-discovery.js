// Service d'auto-découverte et d'inspection du schéma Notion
// Permet à un agent IA ou à l'utilisateur d'analyser la structure d'une base Notion en temps réel.

import { safeFetch } from './fetch-proxy.js';
import { normalizeKey } from './notion-adapter.js';

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/**
 * Nettoie et formate un ID de base Notion (avec ou sans tirets)
 */
export function formatDatabaseId(rawId) {
  if (!rawId) return '';
  const clean = String(rawId).trim().replace(/-/g, '');
  if (clean.length === 32) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  return rawId.trim();
}

/**
 * Interroge l'API Notion pour extraire la structure exacte d'une base de données
 * @param {string} databaseId Identifiant de la base Notion
 * @param {string} apiKey Clé secrète Notion
 * @returns {Promise<Object>} Métadonnées complètes de la base
 */
export async function inspectDatabase(databaseId, apiKey) {
  if (!databaseId) throw new Error('ID de base Notion manquant.');
  if (!apiKey) throw new Error('Clé API Notion manquante.');

  const dbId = formatDatabaseId(databaseId);
  const res = await safeFetch(`${NOTION_API_URL}/databases/${dbId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Échec inspection Notion (${res.status}): ${err.message || 'Vérifiez l\'ID de la base et son partage avec l\'intégration.'}`);
  }

  const data = await res.json();
  const rawProps = data.properties || {};

  const properties = {};
  for (const [propName, propDef] of Object.entries(rawProps)) {
    const type = propDef.type;
    const options = (propDef.select?.options || propDef.multi_select?.options || propDef.status?.options || []).map(o => ({
      id: o.id,
      name: o.name,
      color: o.color
    }));

    properties[propName] = {
      id: propDef.id,
      name: propName,
      type,
      options: options.length > 0 ? options : undefined,
      relationDatabaseId: propDef.relation?.database_id || undefined
    };
  }

  const titleText = (data.title || []).map(t => t.plain_text).join('') || 'Base sans titre';

  return {
    id: data.id,
    title: titleText,
    url: data.url,
    propertiesCount: Object.keys(properties).length,
    properties
  };
}

/**
 * Recommande automatiquement un mapping pour un type de média en fonction des colonnes existantes
 * @param {Object} dbMetadata Métadonnées issues de inspectDatabase
 * @param {string} mediaType 'game' | 'movie' | 'tv'
 * @returns {Object} Schéma de propriétés recommandé
 */
export function generateSchemaRecommendation(dbMetadata, mediaType = 'game') {
  if (!dbMetadata || !dbMetadata.properties) return {};

  const detectedProps = dbMetadata.properties;
  const recommendedProps = {};

  // Dictionnaire de correspondances heuristiques courantes
  const patterns = {
    title: ['titre', 'title', 'nom', 'name', 'jeu', 'film', 'serie', 'série'],
    platform: ['platform', 'plateforme', 'support', 'console', 'device'],
    genres: ['genres', 'genre', 'tags', 'catégorie', 'categories', 'type'],
    status: ['status', 'statut', 'état', 'etat', 'progress', 'avancement'],
    rating: ['rating', 'note', 'score', 'avis', 'étoiles'],
    releaseDate: ['release date', 'date de sortie', 'sortie', 'date', 'release'],
    playerSupport: ['player support', 'joueurs', 'players', 'mode'],
    copy: ['copy', 'format', 'support physique', 'version'],
    year: ['year', 'année', 'annee', 'year watched', 'year played', 'vu en'],
    totalEp: ['total episodes', 'episodes', 'épisodes', 'nb episodes']
  };

  for (const [fieldName, aliases] of Object.entries(patterns)) {
    for (const [propName, propDef] of Object.entries(detectedProps)) {
      const normalizedPropName = normalizeKey(propName);
      const isMatch = aliases.some(alias => normalizedPropName.includes(normalizeKey(alias)));

      if (isMatch && !recommendedProps[fieldName]) {
        recommendedProps[fieldName] = {
          notionName: propName,
          type: propDef.type,
          optionsAvailable: propDef.options ? propDef.options.map(o => o.name) : undefined
        };
        break;
      }
    }
  }

  return {
    databaseId: dbMetadata.id,
    databaseTitle: dbMetadata.title,
    mediaType,
    recommendedProperties: recommendedProps
  };
}
