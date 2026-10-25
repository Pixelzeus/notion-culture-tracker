// test/e2e/harness/api-fixtures.js
// Authoritative API mock fixtures for TMDb, TheGamesDB, Steam, and Notion

export const TMDB_FIXTURES = {
  searchMovieInception: {
    page: 1,
    results: [
      {
        id: 27205,
        title: 'Inception',
        original_title: 'Inception',
        media_type: 'movie',
        overview: 'Cobb, voleur expérimenté, est le meilleur dans l\'art périlleux de l\'extraction...',
        release_date: '2010-07-15',
        poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
        backdrop_path: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
        vote_average: 8.4,
        genre_ids: [28, 878, 12]
      }
    ],
    total_results: 1
  },

  searchTvBreakingBad: {
    page: 1,
    results: [
      {
        id: 1396,
        name: 'Breaking Bad',
        original_name: 'Breaking Bad',
        media_type: 'tv',
        overview: 'Walter White, professeur de chimie, apprend qu\'il a un cancer en phase terminale...',
        first_air_date: '2008-01-20',
        poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        backdrop_path: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
        vote_average: 8.9,
        genre_ids: [18, 80]
      }
    ],
    total_results: 1
  },

  movieInceptionDetail: {
    id: 27205,
    title: 'Inception',
    original_title: 'Inception',
    overview: 'Cobb, voleur expérimenté, est le meilleur dans l\'art périlleux de l\'extraction...',
    release_date: '2010-07-15',
    runtime: 148,
    genres: [
      { id: 28, name: 'Action' },
      { id: 878, name: 'Science-Fiction' },
      { id: 12, name: 'Aventure' }
    ],
    poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
    backdrop_path: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    vote_average: 8.4
  }
};

export const THEGAMESDB_FIXTURES = {
  searchChronoTrigger: {
    code: 200,
    status: 'Success',
    data: {
      count: 1,
      games: [
        {
          id: 345,
          game_title: 'Chrono Trigger',
          release_date: '1995-03-11',
          platform: 6, // Super Nintendo
          overview: 'Lors de la foire du millénaire, Chrono rencontre une jeune fille nommée Marle...',
          rating: 'Everyone',
          developers: [56],
          genres: [1, 2] // RPG, Adventure
        }
      ]
    },
    include: {
      boxart: {
        data: {
          345: [
            {
              side: 'front',
              filename: 'boxart/front/345-1.jpg'
            }
          ]
        }
      },
      platform: {
        data: {
          6: { id: 6, name: 'Super Nintendo (SNES)' }
        }
      }
    }
  }
};

export const STEAM_FIXTURES = {
  appDetailsHollowKnight: {
    367520: {
      success: true,
      data: {
        type: 'game',
        name: 'Hollow Knight',
        steam_appid: 367520,
        required_age: 0,
        is_free: false,
        detailed_description: 'Forge your own path in Hollow Knight! An epic action adventure...',
        short_description: 'Forge your own path in Hollow Knight! An epic action adventure through a vast ruined kingdom.',
        header_image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/367520/header.jpg',
        developers: ['Team Cherry'],
        publishers: ['Team Cherry'],
        release_date: {
          coming_soon: false,
          date: '24 Feb, 2017'
        },
        genres: [
          { id: '1', description: 'Action' },
          { id: '25', description: 'Adventure' },
          { id: '23', description: 'Indie' }
        ]
      }
    }
  }
};

export const NOTION_FIXTURES = {
  databaseQueryResponse: {
    id: '312aec4b-87d9-815b-bf60-d3fc5847d424',
    title: [{ text: { content: 'Jeux Vidéo' } }],
    properties: {
      'Title': { id: 'title', name: 'Title', type: 'title' },
      'Game Platform': { id: 'plat', name: 'Game Platform', type: 'relation', relation: { database_id: 'db-plat' } },
      'Genres': { id: 'gen', name: 'Genres', type: 'relation', relation: { database_id: 'db-gen' } },
      'Game Status': {
        id: 'stat',
        name: 'Game Status',
        type: 'select',
        select: {
          options: [
            { id: 'opt1', name: '🔵 Backlog' },
            { id: 'opt2', name: '🟡 En cours' },
            { id: 'opt3', name: '🟢 Terminé' }
          ]
        }
      },
      'Overall Rating': { id: 'rat', name: 'Overall Rating', type: 'number' }
    }
  },

  pageCreateSuccessResponse: {
    object: 'page',
    id: 'c827361a-e7c6-4b2a-8c8f-283f51a437f1',
    created_time: '2026-10-25T12:00:00.000Z',
    archived: false,
    url: 'https://www.notion.so/Inception-c827361ae7c64b2a8c8f283f51a437f1'
  }
};
