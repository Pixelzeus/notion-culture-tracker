// Service d'auto-découverte et d'inspection du schéma Notion
// Permet à un agent IA ou à l'utilisateur d'analyser la structure d'une base Notion en temps réel.

import { safeFetch } from './fetch-proxy.js';
import { normalizeKey } from './notion-adapter.js';

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/**
 * Nettoie et formate un ID de base Notion (avec ou sans tirets, URL complète ou query params)
 * Extrait les 32 caractères hexadécimaux et retourne le format UUID standard 8-4-4-4-12.
 * @param {string} rawId ID brut ou URL Notion
 * @returns {string} UUID formaté 8-4-4-4-12 ou chaîne nettoyée
 */
export function formatDatabaseId(rawId) {
  if (!rawId) return '';
  let str = String(rawId).trim();
  if (!str) return '';

  // 1. Supprime les query parameters (?v=...) et les ancres (#...)
  str = str.split(/[?#]/)[0].trim();

  // 2. Si c'est une URL ou un chemin, on isole le dernier segment
  if (str.includes('/')) {
    const segments = str.split('/').filter(Boolean);
    str = segments.length > 0 ? segments[segments.length - 1] : str;
  }

  // 3. Cas UUID standard 8-4-4-4-12 (36 chars avec tirets)
  const uuidMatch = str.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  if (uuidMatch) {
    const clean = uuidMatch[1].replace(/-/g, '').toLowerCase();
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }

  // 4. Cas 32 caractères hexadécimaux consécutifs (ex: fin de slug ou chaîne brute)
  const hex32Matches = str.match(/([0-9a-fA-F]{32})/g);
  if (hex32Matches && hex32Matches.length > 0) {
    const clean = hex32Matches[hex32Matches.length - 1].toLowerCase();
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }

  // 5. Cas où des tirets existent : on retire les tirets et vérifie si 32 hex
  const cleanHex = str.replace(/-/g, '');
  if (cleanHex.length === 32 && /^[0-9a-fA-F]{32}$/.test(cleanHex)) {
    const clean = cleanHex.toLowerCase();
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }

  return str;
}

/**
 * Interroge l'API Notion Search pour lister toutes les bases de données accessibles par l'intégration
 * @param {string} apiKey Clé secrète Notion
 * @param {Object} [options] Options optionnelles (ex: fetchFn pour injection de mock)
 * @returns {Promise<Array<{ id: string, cleanId: string, title: string, icon: string|null, url: string }>>} Liste des bases découvertes
 */
export async function listSharedDatabases(apiKey, options = {}) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('Clé API Notion manquante.');
  }

  const fetcher = options.fetchFn || safeFetch;
  const res = await fetcher(`${NOTION_API_URL}/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        value: 'database',
        property: 'object'
      },
      page_size: 100
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`Échec de la recherche Notion (${res.status}): ${err.message || 'Impossible de lister les bases de données.'}`);
  }

  const data = await res.json().catch(() => ({ results: [] }));
  const results = Array.isArray(data?.results) ? data.results : [];

  return results
    .filter(item => !item.object || item.object === 'database')
    .map(item => {
      let icon = null;
      if (item.icon) {
        if (typeof item.icon === 'string') {
          icon = item.icon;
        } else if (item.icon.type === 'emoji') {
          icon = item.icon.emoji || null;
        } else if (item.icon.type === 'external') {
          icon = item.icon.external?.url || null;
        } else if (item.icon.type === 'file') {
          icon = item.icon.file?.url || null;
        } else if (item.icon.emoji) {
          icon = item.icon.emoji;
        } else if (item.icon.url) {
          icon = item.icon.url;
        }
      }

      let plainTextTitle = '';
      if (Array.isArray(item.title) && item.title.length > 0) {
        plainTextTitle = item.title.map(t => t.plain_text || t.text?.content || '').join('').trim();
      } else if (typeof item.title === 'string' && item.title.trim()) {
        plainTextTitle = item.title.trim();
      }

      return {
        id: item.id,
        cleanId: formatDatabaseId(item.id),
        title: plainTextTitle || 'Base sans titre',
        icon,
        url: item.url || (item.id ? `https://www.notion.so/${formatDatabaseId(item.id).replace(/-/g, '')}` : '')
      };
    });
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

/**
 * Évalue la compatibilité d'une propriété de schéma vis-à-vis d'une colonne réelle Notion
 * @param {Object} schemaProp Définition dans le schéma actif { notionName, type, lookupTable, notMapped }
 * @param {Object} detectedProps Dictionnaire des propriétés réelles de la base Notion
 * @returns {Object} Résultat { status: 'ok'|'warning'|'error'|'skipped', message, actualType, actualName }
 */
export function evaluatePropertyCompatibility(schemaProp, detectedProps = {}) {
  if (!schemaProp || schemaProp.notMapped === true || !schemaProp.notionName || !String(schemaProp.notionName).trim()) {
    return {
      status: 'skipped',
      message: 'Non mappé — cette propriété est ignorée et ne sera pas envoyée à Notion.',
      actualType: null,
      actualName: null
    };
  }

  const requestedName = String(schemaProp.notionName).trim();
  const expectedType = (schemaProp.type || '').toLowerCase();

  // Recherche directe ou insensible à la casse / accents
  let actualProp = detectedProps[requestedName];
  let actualName = requestedName;

  if (!actualProp) {
    const normalizedTarget = normalizeKey(requestedName);
    for (const [colName, colDef] of Object.entries(detectedProps)) {
      if (normalizeKey(colName) === normalizedTarget) {
        actualProp = colDef;
        actualName = colName;
        break;
      }
    }
  }

  if (!actualProp) {
    return {
      status: 'error',
      message: `Colonne "${requestedName}" introuvable dans la base Notion.`,
      actualType: null,
      actualName: null
    };
  }

  const actualType = (actualProp.type || '').toLowerCase();

  // Même type exact
  if (actualType === expectedType) {
    if (expectedType === 'relation' && !schemaProp.lookupTable) {
      return {
        status: 'warning',
        message: `Relation valide, mais aucune table de correspondance (lookupTable) n'est spécifiée.`,
        actualType,
        actualName
      };
    }
    return {
      status: 'ok',
      message: `Conforme (${actualType}).`,
      actualType,
      actualName
    };
  }

  // Compatibilités tolérées avec avertissement (Orange)
  const isCompatibleSelectStatus = (expectedType === 'select' && (actualType === 'status' || actualType === 'multi_select')) ||
                                   (expectedType === 'status' && (actualType === 'select' || actualType === 'multi_select'));
  const isCompatibleMultiSelect = (expectedType === 'multi_select' && (actualType === 'select' || actualType === 'relation'));
  const isCompatibleText = (expectedType === 'rich_text' && actualType === 'title') ||
                           (expectedType === 'url' && (actualType === 'rich_text' || actualType === 'title'));
  const isCompatibleNumber = (expectedType === 'number' && (actualType === 'select' || actualType === 'status'));

  if (isCompatibleSelectStatus || isCompatibleMultiSelect || isCompatibleText || isCompatibleNumber) {
    return {
      status: 'warning',
      message: `Type compatible avec adaptation : attendu "${expectedType}", réel "${actualType}".`,
      actualType,
      actualName
    };
  }

  // Incompatibilité bloquante (Rouge)
  return {
    status: 'error',
    message: `Incompatibilité de type : attendu "${expectedType}", mais la colonne Notion est de type "${actualType}".`,
    actualType,
    actualName
  };
}

/**
 * Exécute un diagnostic dry-run non-destructif complet sur le schéma actif
 * @param {Object} activeSchema Configuration du schéma Notion
 * @param {string} apiKey Clé API Notion
 * @param {Object} options { inspectFn, fallbackConfig }
 * @returns {Promise<Object>} Rapport de diagnostic complet
 */
export async function runDryRunDiagnostic(activeSchema, apiKey, options = {}) {
  const inspect = options.inspectFn || inspectDatabase;
  const fallback = options.fallbackConfig || {};
  const isUnified = activeSchema?.databaseMode === 'unified';

  const report = {
    timestamp: new Date().toISOString(),
    overallStatus: 'ok',
    mode: isUnified ? 'unified' : 'distinct',
    databases: [],
    summary: {
      totalChecked: 0,
      valid: 0,
      warnings: 0,
      errors: 0,
      skipped: 0
    }
  };

  const registerResult = (propResult) => {
    report.summary.totalChecked++;
    if (propResult.status === 'ok') {
      report.summary.valid++;
    } else if (propResult.status === 'warning') {
      report.summary.warnings++;
      if (report.overallStatus === 'ok') report.overallStatus = 'warning';
    } else if (propResult.status === 'error') {
      report.summary.errors++;
      report.overallStatus = 'error';
    } else if (propResult.status === 'skipped') {
      report.summary.skipped++;
    }
  };

  if (isUnified) {
    const rawDbId = activeSchema?.unifiedDatabase?.databaseId || fallback.unifiedDbId;
    const dbReport = {
      key: 'unified',
      name: 'Base Unifiée (Culture Tracker)',
      databaseId: rawDbId || '',
      databaseTitle: '',
      status: 'ok',
      error: null,
      properties: []
    };

    if (!rawDbId || !String(rawDbId).trim()) {
      dbReport.status = 'error';
      dbReport.error = 'Identifiant de base unifiée non configuré.';
      report.overallStatus = 'error';
      report.summary.errors++;
    } else if (!apiKey || !String(apiKey).trim()) {
      dbReport.status = 'error';
      dbReport.error = 'Clé API Notion manquante.';
      report.overallStatus = 'error';
      report.summary.errors++;
    } else {
      try {
        const metadata = await inspect(rawDbId, apiKey);
        dbReport.databaseTitle = metadata.title || 'Base Unifiée';

        // 1. Colonne discriminante
        const typeProp = activeSchema.unifiedDatabase?.typeProperty;
        const typePropName = (typeof typeProp === 'object' ? typeProp?.notionName : typeProp) || 'Type';
        const typeComp = evaluatePropertyCompatibility(
          { notionName: typePropName, type: 'select' },
          metadata.properties
        );
        const discResult = {
          key: '__typeDiscriminator',
          label: `Type de Média (Discriminant: "${typePropName}")`,
          notionName: typePropName,
          expectedType: 'select',
          actualType: typeComp.actualType,
          status: typeComp.status,
          message: typeComp.message
        };
        dbReport.properties.push(discResult);
        registerResult(discResult);

        // 2. Propriétés de chaque médiaType sur la base unifiée
        const mediaTypes = ['movie', 'tv', 'game'];
        for (const media of mediaTypes) {
          const mediaCfg = activeSchema.mediaTypes?.[media];
          if (!mediaCfg || !mediaCfg.properties) continue;

          for (const [propKey, propDef] of Object.entries(mediaCfg.properties)) {
            const comp = evaluatePropertyCompatibility(propDef, metadata.properties);
            const res = {
              key: `${media}.${propKey}`,
              media,
              propKey,
              label: `[${media.toUpperCase()}] ${propKey}`,
              notionName: propDef.notionName || '(non défini)',
              expectedType: propDef.type || '',
              actualType: comp.actualType,
              status: comp.status,
              message: comp.message
            };
            dbReport.properties.push(res);
            registerResult(res);
          }
        }
      } catch (err) {
        dbReport.status = 'error';
        dbReport.error = err.message || 'Impossible d\'inspecter la base unifiée.';
        report.overallStatus = 'error';
        report.summary.errors++;
      }
    }

    report.databases.push(dbReport);
  } else {
    const mediaDefs = [
      { key: 'movie', name: 'Films', fallbackKey: 'moviesDbId' },
      { key: 'tv', name: 'Séries TV', fallbackKey: 'tvShowsDbId' },
      { key: 'game', name: 'Jeux Vidéo', fallbackKey: 'gamesDbId' }
    ];

    for (const item of mediaDefs) {
      const mediaCfg = activeSchema?.mediaTypes?.[item.key] || {};
      const rawDbId = mediaCfg.databaseId || fallback[item.fallbackKey] || (fallback.schema?.mediaTypes?.[item.key]?.databaseId);

      const dbReport = {
        key: item.key,
        name: item.name,
        databaseId: rawDbId || '',
        databaseTitle: '',
        status: 'ok',
        error: null,
        properties: []
      };

      if (!rawDbId || !String(rawDbId).trim()) {
        dbReport.status = 'error';
        dbReport.error = `Identifiant de base "${item.name}" non configuré.`;
        report.overallStatus = 'error';
        report.summary.errors++;
        report.databases.push(dbReport);
        continue;
      }

      if (!apiKey || !String(apiKey).trim()) {
        dbReport.status = 'error';
        dbReport.error = 'Clé API Notion manquante.';
        report.overallStatus = 'error';
        report.summary.errors++;
        report.databases.push(dbReport);
        continue;
      }

      try {
        const metadata = await inspect(rawDbId, apiKey);
        dbReport.databaseTitle = metadata.title || item.name;

        const props = mediaCfg.properties || {};
        for (const [propKey, propDef] of Object.entries(props)) {
          const comp = evaluatePropertyCompatibility(propDef, metadata.properties);
          const res = {
            key: propKey,
            media: item.key,
            label: propKey,
            notionName: propDef.notionName || '(non défini)',
            expectedType: propDef.type || '',
            actualType: comp.actualType,
            status: comp.status,
            message: comp.message
          };
          dbReport.properties.push(res);
          registerResult(res);
        }
      } catch (err) {
        dbReport.status = 'error';
        dbReport.error = err.message || `Impossible d'inspecter la base "${item.name}".`;
        report.overallStatus = 'error';
        report.summary.errors++;
      }

      report.databases.push(dbReport);
    }
  }

  return report;
}

