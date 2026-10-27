// Moteur de Templates de Blocs Déclaratif pour Pages Notion
// Permet de générer des structures de pages riches (colonnes, toggles, images, callouts)
// à partir de blueprints JSON simples ou personnalisés par un agent IA.

function isValidHttpUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Utilitaires pour construire des blocs Notion propres
 */
export const NotionBlocks = {
  heading: (level = 2, text = '', color = 'default', bold = false) => {
    const type = `heading_${level}`;
    return {
      object: 'block',
      type,
      [type]: {
        rich_text: [{ type: 'text', text: { content: text }, annotations: { bold } }],
        color
      }
    };
  },

  paragraph: (text = '') => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: String(text).slice(0, 1900) } }]
    }
  }),

  image: (url) => {
    if (!isValidHttpUrl(url)) return null;
    return {
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url }
      }
    };
  },

  callout: (text = '', emoji = '📌', color = 'default') => ({
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{ type: 'text', text: { content: text } }],
      icon: { type: 'emoji', emoji },
      color
    }
  }),

  toggle: (title = '', children = [], color = 'default') => {
    const validChildren = Array.isArray(children) ? children.filter(Boolean) : [];
    const block = {
      object: 'block',
      type: 'toggle',
      toggle: {
        rich_text: [{ type: 'text', text: { content: title } }],
        color
      }
    };
    if (validChildren.length > 0) {
      block.toggle.children = validChildren;
    }
    return block;
  },

  divider: () => ({
    object: 'block',
    type: 'divider',
    divider: {}
  }),

  bullet: (text = '') => ({
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }]
    }
  }),

  columns: (col1Children = [], col2Children = []) => ({
    object: 'block',
    type: 'column_list',
    column_list: {
      children: [
        {
          object: 'block',
          type: 'column',
          column: { children: col1Children.filter(Boolean) }
        },
        {
          object: 'block',
          type: 'column',
          column: { children: col2Children.filter(Boolean) }
        }
      ]
    }
  })
};

/**
 * Blueprints intégrés
 */
export const BUILTIN_TEMPLATES = {
  // Modèle Jeux Vidéo complet (style "Game Title Here")
  'game-default': (vars) => {
    const leftCol = [
      NotionBlocks.heading(2, 'Game Cover Image', 'blue', false),
      vars.posterUrl ? NotionBlocks.image(vars.posterUrl) : null,
      NotionBlocks.toggle('DLC', [], 'blue'),
      NotionBlocks.toggle('Walkthrough Link', [], 'blue'),
      NotionBlocks.toggle('Useful Guides ', [], 'blue'),
      NotionBlocks.toggle('Favorite Soundtracks', [], 'blue')
    ];

    const rightCol = [
      NotionBlocks.heading(2, 'Game Summary', 'blue', false),
      NotionBlocks.paragraph(vars.overview || 'Aucun résumé disponible.'),
      NotionBlocks.heading(2, 'Game Reflection', 'blue', false),
      NotionBlocks.toggle('Pros', [
        NotionBlocks.bullet(''),
        NotionBlocks.bullet(''),
        NotionBlocks.bullet('')
      ], 'default'),
      NotionBlocks.toggle('Cons', [
        NotionBlocks.bullet(''),
        NotionBlocks.bullet(''),
        NotionBlocks.bullet('')
      ], 'default')
    ];

    return [NotionBlocks.columns(leftCol, rightCol)];
  },

  // Modèle Films complet (style "Movie Title")
  'movie-default': (vars) => {
    const leftCol = [
      NotionBlocks.heading(2, 'Movie Cover', 'default', false),
      vars.posterUrl ? NotionBlocks.image(vars.posterUrl) : null,
      NotionBlocks.heading(2, 'Screenshots', 'default', true)
    ];

    const rightCol = [
      NotionBlocks.heading(2, 'Movie Summary', 'default', false),
      NotionBlocks.paragraph(vars.overview || 'Aucun synopsis disponible.'),
      NotionBlocks.heading(2, 'Thoughts', 'default', true),
      NotionBlocks.heading(2, 'Standouts', 'default', true)
    ];

    return [NotionBlocks.columns(leftCol, rightCol)];
  },

  // Modèle Séries TV complet (style "TV Title")
  'tv-default': (vars) => {
    const leftCol = [
      NotionBlocks.heading(2, 'TV Show Cover', 'default', false),
      vars.posterUrl ? NotionBlocks.image(vars.posterUrl) : null,
      NotionBlocks.heading(2, 'Screenshots', 'default', true)
    ];

    const rightCol = [
      NotionBlocks.heading(2, 'TV Show Summary', 'default', false),
      NotionBlocks.paragraph(vars.overview || 'Aucun synopsis disponible.'),
      NotionBlocks.heading(2, 'Thoughts', 'default', true),
      NotionBlocks.heading(2, 'Standouts', 'default', true)
    ];

    return [NotionBlocks.columns(leftCol, rightCol)];
  },

  // Modèle simple (1 colonne avec Callout et Résumé)
  'simple-summary': (vars) => [
    vars.posterUrl ? NotionBlocks.image(vars.posterUrl) : null,
    NotionBlocks.callout(vars.overview || 'Aucun résumé.', '🎬', 'gray_background')
  ],

  // Aucun corps de page (uniquement les propriétés de base de données)
  'blank': () => []
};

/**
 * Résout les variables dynamiques ({{title}}, {{overview}}, etc.) dans une chaîne de texte
 * @param {string} text Chaîne contenant des jetons {{variable}}
 * @param {Object} vars Dictionnaire des valeurs
 * @returns {string} Chaîne avec variables substituées
 */
export function resolveVariables(text, vars = {}) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (vars[key] !== undefined && vars[key] !== null) {
      const val = vars[key];
      return Array.isArray(val) ? val.join(', ') : String(val);
    }
    // Aliases courants
    if ((key === 'cast' || key === 'casts') && (vars.cast !== undefined || vars.casts !== undefined)) {
      const c = vars.cast !== undefined ? vars.cast : vars.casts;
      return Array.isArray(c) ? c.join(', ') : String(c);
    }
    if ((key === 'overview' || key === 'summary') && (vars.overview !== undefined || vars.summary !== undefined)) {
      const s = vars.overview !== undefined ? vars.overview : vars.summary;
      return String(s || '');
    }
    if (key === 'genres' && (vars.genres !== undefined || vars.genre !== undefined)) {
      const g = vars.genres !== undefined ? vars.genres : vars.genre;
      return Array.isArray(g) ? g.join(', ') : String(g);
    }
    if ((key === 'year' || key === 'releasedYear') && (vars.year !== undefined || vars.releasedYear !== undefined)) {
      const y = vars.year !== undefined ? vars.year : vars.releasedYear;
      return String(y || '');
    }
    return '';
  });
}

export const interpolateVariables = resolveVariables;

/**
 * Compile un bloc déclaratif JSON en objet de bloc authentique pour l'API Notion
 * @param {Object} blockDef Objet déclaratif (type, content/text, level, color, bold, url, children, columns...)
 * @param {Object} vars Variables à injecter
 * @returns {Object|null} Bloc Notion API ou null si omis
 */
export function compileDeclarativeBlock(blockDef, vars = {}) {
  if (!blockDef || !blockDef.type) return null;
  const type = blockDef.type;

  // 1. Titres (heading, heading_1, heading_2, heading_3)
  if (type === 'heading' || type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
    let level = Number(blockDef.level);
    if (!level || isNaN(level)) {
      if (type === 'heading_1') level = 1;
      else if (type === 'heading_3') level = 3;
      else level = 2;
    }
    const rawText = blockDef.content ?? blockDef.text ?? '';
    const text = resolveVariables(rawText, vars);
    return NotionBlocks.heading(level, text, blockDef.color || 'default', Boolean(blockDef.bold));
  }

  // 2. Paragraphe
  if (type === 'paragraph') {
    const rawText = blockDef.content ?? blockDef.text ?? '';
    const text = resolveVariables(rawText, vars);
    return NotionBlocks.paragraph(text);
  }

  // 3. Callout avec icône et couleur
  if (type === 'callout') {
    const rawText = blockDef.content ?? blockDef.text ?? '';
    const text = resolveVariables(rawText, vars);
    return NotionBlocks.callout(text, blockDef.emoji || blockDef.icon || '📌', blockDef.color || 'default');
  }

  // 4. Image
  if (type === 'image') {
    const rawUrl = blockDef.url ?? blockDef.content ?? '';
    const resolvedUrl = resolveVariables(rawUrl, vars).trim();
    return NotionBlocks.image(resolvedUrl);
  }

  // 5. Séparateur horizontal
  if (type === 'divider') {
    return NotionBlocks.divider();
  }

  // 6. Liste à puces
  if (type === 'bullet' || type === 'bulleted_list_item') {
    const rawText = blockDef.content ?? blockDef.text ?? '';
    const text = resolveVariables(rawText, vars);
    return NotionBlocks.bullet(text);
  }

  // 7. Toggle déroulant avec sous-blocs
  if (type === 'toggle') {
    const rawTitle = blockDef.title ?? blockDef.content ?? blockDef.text ?? '';
    const title = resolveVariables(rawTitle, vars);
    const childBlocks = Array.isArray(blockDef.children)
      ? compileDeclarativeBlocks(blockDef.children, vars)
      : [];
    const block = NotionBlocks.toggle(title, childBlocks, blockDef.color || 'default');
    // Règle Notion API : si aucun enfant, la clé children ne doit PAS être présente
    if (childBlocks.length === 0) {
      delete block.toggle.children;
    }
    return block;
  }

  // 8. Colonnes (column_list)
  if (type === 'columns' || type === 'column_list') {
    const col1Raw = (blockDef.columns?.[0]?.children || blockDef.col1 || blockDef.leftCol || []);
    const col2Raw = (blockDef.columns?.[1]?.children || blockDef.col2 || blockDef.rightCol || []);

    const col1Compiled = compileDeclarativeBlocks(col1Raw, vars);
    const col2Compiled = compileDeclarativeBlocks(col2Raw, vars);

    // Notion API impose children.length >= 1 pour chaque colonne
    const col1Children = col1Compiled.length > 0 ? col1Compiled : [NotionBlocks.paragraph('')];
    const col2Children = col2Compiled.length > 0 ? col2Compiled : [NotionBlocks.paragraph('')];

    return NotionBlocks.columns(col1Children, col2Children);
  }

  return null;
}

/**
 * Compile un tableau de blocs déclaratifs JSON en blocs Notion API
 * @param {Array} blocks Tableau d'objets déclaratifs
 * @param {Object} vars Variables dynamiques
 * @returns {Array} Liste des blocs Notion API
 */
export function compileDeclarativeBlocks(blocks, vars = {}) {
  if (!Array.isArray(blocks)) return [];
  return blocks.map(b => compileDeclarativeBlock(b, vars)).filter(Boolean);
}

/**
 * Modèles déclaratifs par défaut équivalents en JSON sérialisable
 */
export const DECLARATIVE_PRESETS = {
  'movie-default': [
    {
      id: 'blk-col-movie',
      type: 'column_list',
      columns: [
        {
          children: [
            { id: 'm-cov-h', type: 'heading_2', content: 'Movie Cover', color: 'default', bold: false },
            { id: 'm-cov-img', type: 'image', url: '{{posterUrl}}' },
            { id: 'm-screen-h', type: 'heading_2', content: 'Screenshots', color: 'default', bold: true }
          ]
        },
        {
          children: [
            { id: 'm-sum-h', type: 'heading_2', content: 'Movie Summary', color: 'default', bold: false },
            { id: 'm-sum-p', type: 'paragraph', content: '{{overview}}' },
            { id: 'm-th-h', type: 'heading_2', content: 'Thoughts', color: 'default', bold: true },
            { id: 'm-st-h', type: 'heading_2', content: 'Standouts', color: 'default', bold: true }
          ]
        }
      ]
    }
  ],

  'tv-default': [
    {
      id: 'blk-col-tv',
      type: 'column_list',
      columns: [
        {
          children: [
            { id: 't-cov-h', type: 'heading_2', content: 'TV Show Cover', color: 'default', bold: false },
            { id: 't-cov-img', type: 'image', url: '{{posterUrl}}' },
            { id: 't-screen-h', type: 'heading_2', content: 'Screenshots', color: 'default', bold: true }
          ]
        },
        {
          children: [
            { id: 't-sum-h', type: 'heading_2', content: 'TV Show Summary', color: 'default', bold: false },
            { id: 't-sum-p', type: 'paragraph', content: '{{overview}}' },
            { id: 't-th-h', type: 'heading_2', content: 'Thoughts', color: 'default', bold: true },
            { id: 't-st-h', type: 'heading_2', content: 'Standouts', color: 'default', bold: true }
          ]
        }
      ]
    }
  ],

  'game-default': [
    {
      id: 'blk-col-game',
      type: 'column_list',
      columns: [
        {
          children: [
            { id: 'g-cov-h', type: 'heading_2', content: 'Game Cover Image', color: 'blue', bold: false },
            { id: 'g-cov-img', type: 'image', url: '{{posterUrl}}' },
            { id: 'g-dlc', type: 'toggle', title: 'DLC', color: 'blue', children: [] },
            { id: 'g-walk', type: 'toggle', title: 'Walkthrough Link', color: 'blue', children: [] },
            { id: 'g-guide', type: 'toggle', title: 'Useful Guides', color: 'blue', children: [] },
            { id: 'g-ost', type: 'toggle', title: 'Favorite Soundtracks', color: 'blue', children: [] }
          ]
        },
        {
          children: [
            { id: 'g-sum-h', type: 'heading_2', content: 'Game Summary', color: 'blue', bold: false },
            { id: 'g-sum-p', type: 'paragraph', content: '{{overview}}' },
            { id: 'g-ref-h', type: 'heading_2', content: 'Game Reflection', color: 'blue', bold: false },
            {
              id: 'g-pros',
              type: 'toggle',
              title: 'Pros',
              color: 'default',
              children: [
                { id: 'g-p1', type: 'bullet', content: '' },
                { id: 'g-p2', type: 'bullet', content: '' },
                { id: 'g-p3', type: 'bullet', content: '' }
              ]
            },
            {
              id: 'g-cons',
              type: 'toggle',
              title: 'Cons',
              color: 'default',
              children: [
                { id: 'g-c1', type: 'bullet', content: '' },
                { id: 'g-c2', type: 'bullet', content: '' },
                { id: 'g-c3', type: 'bullet', content: '' }
              ]
            }
          ]
        }
      ]
    }
  ],

  'simple-summary': [
    { id: 's-img', type: 'image', url: '{{posterUrl}}' },
    { id: 's-callout', type: 'callout', content: '{{overview}}', emoji: '🎬', color: 'gray_background' }
  ],

  'blank': []
};

/**
 * Génère la liste des blocs Notion pour une page selon le template et les variables
 * @param {string|Array} templateDef Identifiant du template ou tableau de blueprints déclaratifs
 * @param {Object} vars Variables injectées (title, overview, posterUrl, backdropUrl, etc.)
 * @param {boolean} usePageTemplate Interrupteur global pour activer/désactiver le corps de page
 * @param {Object} [customTemplates={}] Dictionnaire optionnel de templates personnalisés
 * @returns {Array} Liste des blocs enfants Notion
 */
export function renderTemplateBlocks(templateDef, vars = {}, usePageTemplate = true, customTemplates = {}) {
  if (!usePageTemplate || templateDef === 'blank' || templateDef === 'none') {
    return [];
  }

  // 1. Blueprint déclaratif direct (tableau de blocs)
  if (Array.isArray(templateDef)) {
    return compileDeclarativeBlocks(templateDef, vars);
  }

  // 2. Modèle personnalisé enregistré dans customTemplates
  if (typeof templateDef === 'string' && customTemplates && customTemplates[templateDef]) {
    const custom = customTemplates[templateDef];
    if (Array.isArray(custom)) {
      return compileDeclarativeBlocks(custom, vars);
    }
    if (typeof custom === 'function') {
      return custom(vars).filter(Boolean);
    }
  }

  // 3. Modèle prédéfini dans BUILTIN_TEMPLATES
  if (typeof templateDef === 'string' && BUILTIN_TEMPLATES[templateDef]) {
    return BUILTIN_TEMPLATES[templateDef](vars).filter(Boolean);
  }

  // 4. Fallback gracieux si templateDef inconnu
  const fallback = BUILTIN_TEMPLATES['simple-summary'];
  return fallback ? fallback(vars).filter(Boolean) : [];
}

