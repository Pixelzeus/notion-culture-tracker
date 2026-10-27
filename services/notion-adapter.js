// Adaptateur Universel de Propriétés Notion
// Convertit les données média vers le schéma Notion cible (relation, select, multi_select, etc.)
// Conçu pour être tolérant aux pannes et personnalisable par n'importe quel agent IA.

/**
 * Normalise une chaîne pour la recherche dans une table de correspondance
 */
export function normalizeKey(val) {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Recherche d'un ID dans une table de lookup
 */
export function resolveLookupId(value, table) {
  if (!value || !table) return null;
  // Si c'est déjà un UUID Notion
  if (typeof value === 'string' && /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  const normalized = normalizeKey(value);
  return table[normalized] || table[value] || null;
}

/**
 * Construit l'objet properties pour l'API Notion en fonction de la définition du schéma
 * @param {Object} itemData Données normalisées du média
 * @param {Object} mediaSchema Définition du schéma pour ce mediaType (issu de schema.default.json)
 * @param {Object} lookupTables Dictionnaires de lookup { genres, gameGenres, platforms, gamePlatforms, years }
 * @returns {Object} Payload "properties" conforme à l'API Notion
 */
export function buildNotionProperties(itemData, mediaSchema, lookupTables = {}) {
  if (!itemData || !mediaSchema || !mediaSchema.properties) {
    throw new Error('Données ou schéma média invalide pour l\'adaptateur Notion');
  }

  const properties = {};
  const schemaProps = mediaSchema.properties;

  for (const [propKey, propDef] of Object.entries(schemaProps)) {
    if (propDef.notMapped === true) continue;
    const notionName = propDef.notionName;
    if (!notionName || !String(notionName).trim()) continue;

    const propType = (propDef.type || '').toLowerCase();
    const rawVal = (itemData[propKey] !== undefined && itemData[propKey] !== null && itemData[propKey] !== '')
      ? itemData[propKey]
      : propDef.defaultValue;

    // Si aucune valeur n'est disponible
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      continue;
    }

    switch (propType) {
      case 'title':
        properties[notionName] = {
          title: [{ text: { content: String(rawVal) } }]
        };
        break;

      case 'relation': {
        const table = propDef.lookupTable ? lookupTables[propDef.lookupTable] || {} : {};
        const relations = [];

        if (Array.isArray(rawVal)) {
          for (const item of rawVal) {
            const id = resolveLookupId(item, table);
            if (id) relations.push({ id });
          }
        } else {
          const id = resolveLookupId(rawVal, table);
          if (id) relations.push({ id });
        }

        if (relations.length > 0) {
          properties[notionName] = { relation: relations };
        }
        break;
      }

      case 'select':
        properties[notionName] = {
          select: { name: String(rawVal).slice(0, 100) }
        };
        break;

      case 'status':
        properties[notionName] = {
          status: { name: String(rawVal).slice(0, 100) }
        };
        break;

      case 'multi_select': {
        const items = Array.isArray(rawVal) ? rawVal : [rawVal];
        const tags = items
          .filter(v => Boolean(v))
          .map(v => ({ name: String(v).replace(/,/g, ' ').trim().slice(0, 100) }))
          .filter(t => t.name.length > 0);

        if (tags.length > 0) {
          properties[notionName] = { multi_select: tags };
        }
        break;
      }

      case 'number': {
        const num = parseFloat(rawVal);
        if (!isNaN(num)) {
          properties[notionName] = { number: num };
        }
        break;
      }

      case 'date':
        // Format YYYY-MM-DD
        if (typeof rawVal === 'string' && /^\d{4}/.test(rawVal)) {
          properties[notionName] = { date: { start: rawVal.slice(0, 10) } };
        }
        break;

      case 'rich_text':
        properties[notionName] = {
          rich_text: [{ text: { content: String(rawVal).slice(0, 2000) } }]
        };
        break;

      case 'url':
        properties[notionName] = { url: String(rawVal) };
        break;

      case 'checkbox':
        properties[notionName] = { checkbox: Boolean(rawVal) };
        break;

      default:
        // Type inconnu : omis silencieusement pour éviter les erreurs Notion
        break;
    }
  }

  // Vérification de sécurité obligatoire : le titre doit exister
  const titlePropName = Object.values(schemaProps).find(p => p.type === 'title')?.notionName || 'Title';
  if (!properties[titlePropName]) {
    properties[titlePropName] = {
      title: [{ text: { content: itemData.title || 'Sans titre' } }]
    };
  }

  return properties;
}
