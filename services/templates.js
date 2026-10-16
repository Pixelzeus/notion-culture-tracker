function isValidHttpUrl(str) {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Template pour les Séries TV (modèle "TV Title")
 * 2 colonnes :
 * - Col 0 : "TV Show Cover" + Image de l'affiche + "Screenshots"
 * - Col 1 : "TV Show Summary" + Paragraphe du résumé + "Thoughts" + "Standouts"
 */
export function buildTvTemplateBlocks(posterUrl, summary) {
  const col0Children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'TV Show Cover' } }],
        color: 'default'
      }
    }
  ];

  if (isValidHttpUrl(posterUrl)) {
    col0Children.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url: posterUrl }
      }
    });
  }

  col0Children.push({
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: 'Screenshots' }, annotations: { bold: true } }],
      color: 'default'
    }
  });

  const col1Children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'TV Show Summary' } }],
        color: 'default'
      }
    }
  ];

  if (summary && summary.trim()) {
    col1Children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: summary.slice(0, 1900) } }],
        color: 'default'
      }
    });
  } else {
    col1Children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'default' }
    });
  }

  col1Children.push(
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Thoughts' }, annotations: { bold: true } }],
        color: 'default'
      }
    },
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Standouts' }, annotations: { bold: true } }],
        color: 'default'
      }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'default' }
    }
  );

  return [
    {
      object: 'block',
      type: 'column_list',
      column_list: {
        children: [
          {
            object: 'block',
            type: 'column',
            column: { children: col0Children }
          },
          {
            object: 'block',
            type: 'column',
            column: { children: col1Children }
          }
        ]
      }
    }
  ];
}

/**
 * Template pour les Films (modèle "Movie Title")
 * 2 colonnes :
 * - Col 0 : "Movie Cover" + Image de l'affiche + "Screenshots"
 * - Col 1 : "Movie Summary" + Paragraphe du résumé + "Thoughts" + "Standouts"
 */
export function buildMovieTemplateBlocks(posterUrl, summary) {
  const col0Children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Movie Cover' } }],
        color: 'default'
      }
    }
  ];

  if (isValidHttpUrl(posterUrl)) {
    col0Children.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url: posterUrl }
      }
    });
  }

  col0Children.push({
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: 'Screenshots' }, annotations: { bold: true } }],
      color: 'default'
    }
  });

  const col1Children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Movie Summary' } }],
        color: 'default'
      }
    }
  ];

  if (summary && summary.trim()) {
    col1Children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: summary.slice(0, 1900) } }],
        color: 'default'
      }
    });
  } else {
    col1Children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'default' }
    });
  }

  col1Children.push(
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Thoughts' }, annotations: { bold: true } }],
        color: 'default'
      }
    },
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Standouts' }, annotations: { bold: true } }],
        color: 'default'
      }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'default' }
    }
  );

  return [
    {
      object: 'block',
      type: 'column_list',
      column_list: {
        children: [
          {
            object: 'block',
            type: 'column',
            column: { children: col0Children }
          },
          {
            object: 'block',
            type: 'column',
            column: { children: col1Children }
          }
        ]
      }
    }
  ];
}

/**
 * Template pour les Jeux Vidéo (modèle "Game Title Here")
 * 2 colonnes avec titres bleus :
 * - Col 0 : "Game Cover Image" + Image + "DLC" + liens déroulants
 * - Col 1 : "Game Summary" + Résumé + "Game Reflection" + "Pros" (3 puces) + "Cons" (3 puces)
 */
export function buildGameTemplateBlocks(coverUrl, summary) {
  const col0Children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Game Cover Image' } }],
        color: 'blue'
      }
    }
  ];

  if (isValidHttpUrl(coverUrl)) {
    col0Children.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'external',
        external: { url: coverUrl }
      }
    });
  }

  col0Children.push(
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'DLC' } }],
        color: 'blue'
      }
    },
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Walkthrough Link' } }],
        is_toggleable: true,
        color: 'blue'
      }
    },
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Useful Guides ' } }],
        is_toggleable: true,
        color: 'blue'
      }
    },
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Favorite Soundtracks' } }],
        is_toggleable: true,
        color: 'blue'
      }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'default' }
    }
  );

  const col1Children = [
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Game Summary' } }],
        color: 'blue'
      }
    }
  ];

  if (summary && summary.trim()) {
    col1Children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: summary.slice(0, 1900) } }],
        color: 'default'
      }
    });
  } else {
    col1Children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [], color: 'default' }
    });
  }

  col1Children.push(
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'Game Reflection' } }],
        color: 'blue'
      }
    },
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Pros' } }],
        is_toggleable: true,
        color: 'blue',
        children: [
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [], color: 'default' } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [], color: 'default' } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [], color: 'default' } }
        ]
      }
    },
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Cons' } }],
        is_toggleable: true,
        color: 'blue',
        children: [
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [], color: 'default' } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [], color: 'default' } },
          { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [], color: 'default' } }
        ]
      }
    }
  );

  return [
    {
      object: 'block',
      type: 'column_list',
      column_list: {
        children: [
          {
            object: 'block',
            type: 'column',
            column: { children: col0Children }
          },
          {
            object: 'block',
            type: 'column',
            column: { children: col1Children }
          }
        ]
      }
    },
    {
      object: 'block',
      type: 'divider',
      divider: {}
    }
  ];
}
