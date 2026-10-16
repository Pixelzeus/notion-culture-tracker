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

  toggle: (title = '', children = [], color = 'default') => ({
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: [{ type: 'text', text: { content: title } }],
      color,
      children: children.filter(Boolean)
    }
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
 * Génère la liste des blocs Notion pour une page selon le template et les variables
 * @param {string} templateId Identifiant du template ('game-default', 'movie-default', 'blank', etc.)
 * @param {Object} vars Variables injectées (title, overview, posterUrl, backdropUrl, etc.)
 * @param {boolean} usePageTemplate Interrupteur global pour activer/désactiver le corps de page
 * @returns {Array} Liste des blocs enfants Notion
 */
export function renderTemplateBlocks(templateId, vars = {}, usePageTemplate = true) {
  if (!usePageTemplate || templateId === 'blank' || templateId === 'none') {
    return [];
  }

  const generator = BUILTIN_TEMPLATES[templateId] || BUILTIN_TEMPLATES['simple-summary'];
  return generator(vars).filter(Boolean);
}
