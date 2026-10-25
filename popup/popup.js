// Culture Tracker - Popup Controller

import {
  getConfig,
  saveConfig,
  NOTION_KNOWN_GENRES,
  NOTION_KNOWN_PLATFORMS,
  NOTION_KNOWN_GAME_PLATFORMS,
  NOTION_KNOWN_GAME_GENRES,
  NOTION_KNOWN_YEARS,
  DEFAULT_CONFIG
} from '../services/config.js';
import { searchMedia, getMediaDetails, testTmdbConnection } from '../services/tmdb.js';
import { searchTheGamesDb, getTheGamesDbDetails } from '../services/thegamesdb.js';
import { searchSteamGames, getSteamGameDetails, testSteamConnection } from '../services/steam.js';
import {
  createMediaPage,
  testNotionConnection,
  testGamesDbConnection,
  matchGenresToNotion,
  matchGameGenresToNotion,
  matchPlatformToNotion,
  matchGamePlatformToNotion
} from '../services/notion.js';
import { browserAPI } from '../services/browser-adapter.js';

// État de l'application
const state = {
  config: null,
  activeFilter: 'all',
  currentSearchQuery: '',
  selectedItem: null,
  selectedRating: '',
  selectedGenreIds: new Set(),
  isGameMode: false
};

// Éléments du DOM
const dom = {
  // Vues
  viewSearch: document.getElementById('viewSearch'),
  viewDetail: document.getElementById('viewDetail'),
  viewSettings: document.getElementById('viewSettings'),
  btnSettings: document.getElementById('btnSettings'),
  btnBackToSearch: document.getElementById('btnBackToSearch'),
  btnBackFromSettings: document.getElementById('btnBackFromSettings'),

  // Recherche
  searchInput: document.getElementById('searchInput'),
  btnClearSearch: document.getElementById('btnClearSearch'),
  filterTabs: document.querySelectorAll('.filter-tabs .tab'),
  resultsList: document.getElementById('resultsList'),
  statusAlert: document.getElementById('statusAlert'),

  // Détails
  bannerPreview: document.getElementById('bannerPreview'),
  detailPoster: document.getElementById('detailPoster'),
  detailTitle: document.getElementById('detailTitle'),
  detailOriginalTitle: document.getElementById('detailOriginalTitle'),
  detailBadgeType: document.getElementById('detailBadgeType'),
  detailYear: document.getElementById('detailYear'),
  detailVote: document.getElementById('detailVote'),
  importForm: document.getElementById('importForm'),
  checkUseTemplate: document.getElementById('checkUseTemplate'),
  templateDescription: document.getElementById('templateDescription'),

  // Groupes spécifiques
  groupTvType: document.getElementById('groupTvType'),
  groupWatchStatus: document.getElementById('groupWatchStatus'),
  groupGameStatus: document.getElementById('groupGameStatus'),
  rowGameMeta: document.getElementById('rowGameMeta'),
  inputPlayerSupport: document.getElementById('inputPlayerSupport'),
  selectGameCopy: document.getElementById('selectGameCopy'),
  rowEpisodes: document.getElementById('rowEpisodes'),
  selectStatus: document.getElementById('selectStatus'),
  selectGameStatus: document.getElementById('selectGameStatus'),
  inputCurrentEp: document.getElementById('inputCurrentEp'),
  inputTotalEp: document.getElementById('inputTotalEp'),
  btnAllCaughtUp: document.getElementById('btnAllCaughtUp'),
  starsPicker: document.getElementById('starsPicker'),
  stars: document.querySelectorAll('.stars-picker .star'),
  btnClearRating: document.getElementById('btnClearRating'),
  checkFavourite: document.getElementById('checkFavourite'),
  rowPlatformDate: document.getElementById('rowPlatformDate'),
  selectPlatform: document.getElementById('selectPlatform'),
  inputDateViewed: document.getElementById('inputDateViewed'),
  selectYearWatch: document.getElementById('selectYearWatch'),
  groupGenres: document.getElementById('groupGenres'),
  genresTagsList: document.getElementById('genresTagsList'),
  groupCasts: document.getElementById('groupCasts'),
  inputCasts: document.getElementById('inputCasts'),
  groupGameSummary: document.getElementById('groupGameSummary'),
  textGameSummary: document.getElementById('textGameSummary'),
  labelNotes: document.getElementById('labelNotes'),
  textNotes: document.getElementById('textNotes'),
  btnSubmitImport: document.getElementById('btnSubmitImport'),
  successCard: document.getElementById('successCard'),
  linkOpenInNotion: document.getElementById('linkOpenInNotion'),

  // Paramètres
  settingsForm: document.getElementById('settingsForm'),
  settingTmdbKey: document.getElementById('settingTmdbKey'),
  settingNotionKey: document.getElementById('settingNotionKey'),
  settingGamesDbKey: document.getElementById('settingGamesDbKey'),
  settingMoviesDb: document.getElementById('settingMoviesDb'),
  settingTvShowsDb: document.getElementById('settingTvShowsDb'),
  settingGamesDb: document.getElementById('settingGamesDb'),
  settingGamePlatformsDb: document.getElementById('settingGamePlatformsDb'),
  settingGameGenresDb: document.getElementById('settingGameGenresDb'),
  settingGenresDb: document.getElementById('settingGenresDb'),
  settingPlatformsDb: document.getElementById('settingPlatformsDb'),
  settingYearlyReviewDb: document.getElementById('settingYearlyReviewDb'),
  settingsFeedback: document.getElementById('settingsFeedback'),
  btnTestAllApis: document.getElementById('btnTestAllApis'),
  bannerPerms: document.getElementById('bannerPerms')
};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isEmbedded = urlParams.get('mode') === 'embedded' || window.self !== window.top;
  if (isEmbedded) {
    document.body.classList.add('embedded');
    const btnEmbeddedClose = document.getElementById('btnEmbeddedClose');
    if (btnEmbeddedClose) {
      btnEmbeddedClose.addEventListener('click', () => {
        if (window.parent) {
          window.parent.postMessage({ type: 'CULTURE_TRACKER_CLOSE' }, '*');
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (window.parent) {
          window.parent.postMessage({ type: 'CULTURE_TRACKER_CLOSE' }, '*');
        }
      }
    });
  }

  if (!isEmbedded && browserAPI?.tabs?.query) {
    try {
      const [activeTab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.url && (activeTab.url.includes('notion.so') || activeTab.url.includes('notion.com'))) {
        const btnOpenInNotion = document.getElementById('btnOpenInNotion');
        if (btnOpenInNotion) {
          btnOpenInNotion.style.display = 'inline-flex';
          btnOpenInNotion.addEventListener('click', async () => {
            try {
              await browserAPI.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_NOTION_PANEL' });
            } catch {
              // si pas encore injecté
            }
            window.close();
          });
        }
      }
    } catch {
      // Ignorer
    }
  }

  state.config = await getConfig();
  setupYearDropdown();
  setupEventListeners();
  checkAndPromptHostPermissions();
});

// Configuration du dropdown Bilan Annuel
function setupYearDropdown() {
  dom.selectYearWatch.innerHTML = '<option value="">(Ne pas lier)</option>';
  const currentYear = new Date().getFullYear().toString();
  Object.keys(NOTION_KNOWN_YEARS).forEach(year => {
    const opt = document.createElement('option');
    opt.value = NOTION_KNOWN_YEARS[year];
    opt.textContent = `Année ${year}`;
    if (year === currentYear) opt.selected = true;
    dom.selectYearWatch.appendChild(opt);
  });
}

// Configuration dynamique du dropdown Plateformes selon le type de média
function setupPlatformDropdown(isGame) {
  dom.selectPlatform.innerHTML = '<option value="">(Aucune)</option>';
  const list = isGame ? NOTION_KNOWN_GAME_PLATFORMS : NOTION_KNOWN_PLATFORMS;
  list.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    dom.selectPlatform.appendChild(opt);
  });
}

// Navigation entre les vues
function switchView(viewName) {
  dom.viewSearch.classList.remove('active');
  dom.viewDetail.classList.remove('active');
  dom.viewSettings.classList.remove('active');

  if (viewName === 'search') {
    dom.viewSearch.classList.add('active');
    dom.searchInput.focus();
  } else if (viewName === 'detail') {
    dom.viewDetail.classList.add('active');
    dom.viewDetail.scrollTop = 0;
  } else if (viewName === 'settings') {
    dom.viewSettings.classList.add('active');
    loadSettingsIntoForm();
  }
}

// Écouteurs d'événements
function setupEventListeners() {
  dom.btnSettings.addEventListener('click', () => switchView('settings'));
  dom.btnBackToSearch.addEventListener('click', () => switchView('search'));
  dom.btnBackFromSettings.addEventListener('click', () => switchView('search'));

  // Recherche avec debounce
  let searchTimer = null;
  dom.searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    dom.btnClearSearch.style.display = val ? 'block' : 'none';
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      performSearch(val);
    }, 300);
  });

  dom.btnClearSearch.addEventListener('click', () => {
    dom.searchInput.value = '';
    dom.btnClearSearch.style.display = 'none';
    dom.resultsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">🍿</span>
        <p>Tapez le nom d'un film, d'une série ou d'un jeu vidéo pour l'importer dans Notion avec son template de page.</p>
      </div>`;
    dom.statusAlert.style.display = 'none';
  });

  // Filtres
  dom.filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dom.filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeFilter = tab.dataset.type;
      const query = dom.searchInput.value.trim();
      if (query) performSearch(query);
    });
  });

  // Étoiles de notation
  dom.stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = star.dataset.rating;
      setRating(rating);
    });
  });

  dom.btnClearRating.addEventListener('click', () => {
    setRating('');
  });

  // Statut de visionnage (Films / Séries)
  dom.selectStatus.addEventListener('change', () => {
    const status = dom.selectStatus.value;
    if (status === '🟤 Watched') {
      if (!dom.inputDateViewed.value) {
        dom.inputDateViewed.value = new Date().toISOString().split('T')[0];
      }
      if (state.selectedItem && !state.selectedItem.isMovie && !state.selectedItem.isGame) {
        const total = parseInt(dom.inputTotalEp.value, 10);
        if (total > 0) dom.inputCurrentEp.value = total;
      }
    }
  });

  // Statut du jeu (Jeux vidéo)
  dom.selectGameStatus.addEventListener('change', () => {
    const status = dom.selectGameStatus.value;
    if (status === 'Game Complete' || status === 'Playing Now') {
      if (!dom.inputDateViewed.value) {
        dom.inputDateViewed.value = new Date().toISOString().split('T')[0];
      }
    }
  });

  // Bouton "Tout vu" pour les séries
  dom.btnAllCaughtUp.addEventListener('click', () => {
    const total = parseInt(dom.inputTotalEp.value, 10) || 0;
    dom.inputCurrentEp.value = total;
    dom.selectStatus.value = '🟤 Watched';
    if (!dom.inputDateViewed.value) {
      dom.inputDateViewed.value = new Date().toISOString().split('T')[0];
    }
  });

  dom.importForm.addEventListener('submit', handleImportSubmit);
  dom.settingsForm.addEventListener('submit', handleSaveSettings);
  if (dom.btnTestAllApis) {
    dom.btnTestAllApis.addEventListener('click', handleTestAllApis);
  }
  if (dom.bannerPerms) {
    dom.bannerPerms.addEventListener('click', async () => {
      await requestAllHostPermissions();
    });
  }
}

// Recherche multi-médias
async function performSearch(query) {
  if (!query) return;
  state.currentSearchQuery = query;

  dom.statusAlert.style.display = 'none';
  dom.resultsList.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <p>Recherche en cours...</p>
    </div>`;

  try {
    let combinedResults = [];

    // Recherche selon filtre actif
    if (state.activeFilter === 'game') {
      // Pour les jeux : TheGamesDB en priorité + Steam en parallèle
      const [tgdbRes, steamRes] = await Promise.allSettled([
        searchTheGamesDb(query, state.config),
        searchSteamGames(query)
      ]);
      const tgdbItems = tgdbRes.status === 'fulfilled' ? tgdbRes.value : [];
      const steamItems = steamRes.status === 'fulfilled' ? steamRes.value : [];

      // Fusionner : résultats TheGamesDB d'abord, puis compléments Steam non dupliqués
      const seenTitles = new Set(tgdbItems.map(g => g.title.toLowerCase().replace(/[^a-z0-9]/g, '')));
      const uniqueSteam = steamItems.filter(s => !seenTitles.has(s.title.toLowerCase().replace(/[^a-z0-9]/g, '')));

      combinedResults = [...tgdbItems, ...uniqueSteam];
    } else if (state.activeFilter === 'movie' || state.activeFilter === 'tv') {
      combinedResults = await searchMedia(query, state.activeFilter, state.config);
    } else {
      // Filtre 'Tous' : TMDb (Films + Séries) + TheGamesDB en parallèle
      const [tmdbList, tgdbList] = await Promise.allSettled([
        searchMedia(query, 'all', state.config),
        searchTheGamesDb(query, state.config)
      ]);
      const tmdbItems = tmdbList.status === 'fulfilled' ? tmdbList.value : [];
      let tgdbItems = tgdbList.status === 'fulfilled' ? tgdbList.value : [];

      // Si TheGamesDB n'a rien trouvé, tenter un coup d'œil sur Steam
      if (tgdbItems.length === 0) {
        try {
          const steamItems = await searchSteamGames(query);
          tgdbItems = steamItems.slice(0, 4);
        } catch {
          // ignorer erreur steam en mode tous
        }
      }

      combinedResults = [...tmdbItems.slice(0, 8), ...tgdbItems.slice(0, 6)];
    }

    renderSearchResults(combinedResults);
  } catch (err) {
    dom.resultsList.innerHTML = '';
    showErrorAlert(`Erreur de recherche: ${err.message}`);
  }
}

// Affichage des résultats
function renderSearchResults(results) {
  if (!results || results.length === 0) {
    dom.resultsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-emoji">🔍</span>
        <p>Aucun résultat trouvé pour "<strong>${escapeHtml(state.currentSearchQuery)}</strong>".</p>
      </div>`;
    return;
  }

  dom.resultsList.innerHTML = '';
  results.forEach(item => {
    const card = document.createElement('div');
    card.className = 'result-card';

    const isGame = item.mediaType === 'game';
    const isMovie = item.mediaType === 'movie';
    let badgeClass = 'badge-tv';
    let badgeText = 'SÉRIE';

    if (isGame) {
      badgeClass = 'badge-game';
      badgeText = item.platform ? `JEU (${item.platform})` : 'JEU';
    } else if (isMovie) {
      badgeClass = 'badge-movie';
      badgeText = 'FILM';
    }

    const posterSrc = item.posterUrl || '../icons/icon-48.png';
    const yearText = item.year ? `(${item.year})` : '';
    const ratingText = item.voteAverage ? `★ ${item.voteAverage}` : '';

    card.innerHTML = `
      <img class="result-poster" src="${escapeHtml(posterSrc)}" alt="Affiche" loading="lazy">
      <div class="result-info">
        <div class="result-title-row">
          <span class="result-title">${escapeHtml(item.title)}</span>
          <span class="result-year">${escapeHtml(yearText)}</span>
        </div>
        <div class="result-meta">
          <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
          ${ratingText ? `<span class="badge-rating">${escapeHtml(ratingText)}</span>` : ''}
        </div>
        <p class="result-overview">${escapeHtml(item.overview)}</p>
      </div>
    `;

    card.addEventListener('click', () => openDetailView(item));
    dom.resultsList.appendChild(card);
  });
}

// Ouverture de la fiche détaillée
async function openDetailView(basicItem) {
  switchView('detail');
  dom.successCard.style.display = 'none';
  dom.importForm.style.display = 'flex';
  dom.btnSubmitImport.disabled = true;
  dom.btnSubmitImport.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> Chargement des détails...';

  try {
    let details;
    const isGame = basicItem.mediaType === 'game';
    state.isGameMode = isGame;

    if (isGame) {
      // Routage selon la source (Steam vs TheGamesDB)
      if (basicItem.source === 'steam') {
        details = await getSteamGameDetails(basicItem.id);
      } else {
        details = await getTheGamesDbDetails(basicItem.id, state.config);
      }
    } else {
      details = await getMediaDetails(basicItem.id, basicItem.mediaType, state.config);
    }

    state.selectedItem = details;

    // Titres & Métadonnées
    dom.detailTitle.textContent = details.title;
    dom.detailOriginalTitle.textContent = details.originalTitle || '';
    dom.detailYear.textContent = details.releasedYear ? details.releasedYear : '';
    dom.detailVote.textContent = basicItem.voteAverage ? `⭐ TMDb ${basicItem.voteAverage}/10` : '';

    // Bannières & Affiches
    const bgUrl = details.backdropUrl || details.posterUrl || '';
    dom.bannerPreview.style.backgroundImage = bgUrl ? `url('${bgUrl}')` : 'none';
    dom.detailPoster.src = details.posterUrl || '../icons/icon-128.png';

    // Configuration des plateformes selon le type
    setupPlatformDropdown(isGame);

    // Configuration selon le type (JEU vs SÉRIE vs FILM)
    if (isGame) {
      dom.detailBadgeType.className = 'badge badge-game';
      const platLabel = details.gamePlatformName || basicItem.platform || '';
      dom.detailBadgeType.textContent = platLabel ? `JEU (${platLabel})` : 'JEU VIDÉO';

      dom.templateDescription.textContent = 'Crée le template "Game Title Here" (Colonnes, affiche, DLC, guides, Pros & Cons).';

      dom.groupTvType.style.display = 'none';
      dom.rowEpisodes.style.display = 'none';
      dom.groupWatchStatus.style.display = 'none';
      dom.groupCasts.style.display = 'none';

      dom.groupGameStatus.style.display = 'block';
      dom.rowGameMeta.style.display = 'flex';
      dom.rowPlatformDate.style.display = 'flex';
      dom.groupGenres.style.display = 'block';

      dom.inputPlayerSupport.value = (details.playerSupport || []).join(', ');
      dom.selectGameStatus.value = 'Want To Play';
      dom.selectGameCopy.value = 'Digital Copy';
      dom.inputDateViewed.value = '';

      // Plateforme de jeu pré-sélectionnée
      const matchedPlatformId = matchGamePlatformToNotion(details.gamePlatformName || basicItem.platform);
      dom.selectPlatform.value = matchedPlatformId || '';

      // Genres de jeu pré-cochés
      const matchedGenreIds = matchGameGenresToNotion(details.genres);
      state.selectedGenreIds = new Set(matchedGenreIds);
      renderGenreTags(true);

      // Résumé de jeu dans la page VS Notes personnelles
      if (dom.groupGameSummary) {
        dom.groupGameSummary.style.display = 'block';
        dom.textGameSummary.value = details.overview || '';
      }
      if (dom.labelNotes) {
        dom.labelNotes.textContent = 'Notes personnelles (optionnel)';
      }
      dom.textNotes.placeholder = 'Vos notes personnelles dans Notion (laissez vide pour aucune note)...';
      dom.textNotes.value = '';
    } else {
      const isMovie = details.isMovie;
      dom.detailBadgeType.className = `badge ${isMovie ? 'badge-movie' : 'badge-tv'}`;
      dom.detailBadgeType.textContent = isMovie ? 'FILM' : 'SÉRIE TV';

      if (isMovie) {
        dom.templateDescription.textContent = 'Crée le template "Movie Title" (Colonnes, affiche de film, Screenshots, résumé TMDb, Thoughts & Standouts).';
        dom.groupTvType.style.display = 'none';
        dom.rowEpisodes.style.display = 'none';
      } else {
        dom.templateDescription.textContent = 'Crée le template "TV Title" (Colonnes, affiche de série, Screenshots, résumé TMDb, Thoughts & Standouts).';
        dom.groupTvType.style.display = 'block';
        dom.rowEpisodes.style.display = 'flex';
        dom.inputTotalEp.value = details.totalEp || 0;
        dom.inputCurrentEp.value = 0;

        const radioAnime = document.querySelector('input[name="tvSubType"][value="🎨 Anime"]');
        const radioTv = document.querySelector('input[name="tvSubType"][value="📺 TV show"]');
        if (details.isAnime && radioAnime) radioAnime.checked = true;
        else if (radioTv) radioTv.checked = true;
      }

      dom.groupGameStatus.style.display = 'none';
      dom.rowGameMeta.style.display = 'none';

      dom.groupWatchStatus.style.display = 'block';
      dom.groupGenres.style.display = 'block';
      dom.groupCasts.style.display = 'block';
      dom.rowPlatformDate.style.display = 'flex';

      dom.selectStatus.value = state.config.defaultWatchStatus || '🔵 To Watch';
      dom.inputDateViewed.value = '';

      // Genres Films/Séries pré-cochés
      const matchedGenreIds = matchGenresToNotion(details.genres);
      state.selectedGenreIds = new Set(matchedGenreIds);
      renderGenreTags(false);

      // Plateforme suggérée
      const matchedPlatformId = matchPlatformToNotion(details.suggestedProviders);
      dom.selectPlatform.value = matchedPlatformId || '';

      // Casting
      dom.inputCasts.value = details.casts ? details.casts.join(', ') : '';

      if (dom.groupGameSummary) {
        dom.groupGameSummary.style.display = 'none';
      }
      if (dom.labelNotes) {
        dom.labelNotes.textContent = 'Synopsis / Description';
      }
      dom.textNotes.placeholder = 'Résumé...';
      dom.textNotes.value = details.overview || '';
    }

    setRating('');
    dom.checkFavourite.checked = false;
    dom.checkUseTemplate.checked = state.config.usePageTemplate !== false;

    dom.btnSubmitImport.disabled = false;
    dom.btnSubmitImport.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Ajouter dans Notion`;
  } catch (err) {
    showErrorAlert(`Impossible de charger les détails: ${err.message}`);
    dom.btnSubmitImport.disabled = false;
    dom.btnSubmitImport.textContent = 'Réessayer';
  }
}

// Rendu des tags de genres selon le mode (Jeux vs Films/Séries)
function renderGenreTags(isGame = false) {
  dom.genresTagsList.innerHTML = '';
  const sourceDict = isGame ? NOTION_KNOWN_GAME_GENRES : NOTION_KNOWN_GENRES;
  const uniqueGenres = [];
  const seenIds = new Set();

  for (const [name, id] of Object.entries(sourceDict)) {
    if (!seenIds.has(id)) {
      seenIds.add(id);
      uniqueGenres.push({ name: capitalize(name), id });
    }
  }

  uniqueGenres.sort((a, b) => {
    const aSel = state.selectedGenreIds.has(a.id);
    const bSel = state.selectedGenreIds.has(b.id);
    if (aSel && !bSel) return -1;
    if (!aSel && bSel) return 1;
    return a.name.localeCompare(b.name);
  });

  uniqueGenres.forEach(g => {
    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = `genre-tag ${state.selectedGenreIds.has(g.id) ? 'selected' : ''}`;
    tag.textContent = g.name;
    tag.addEventListener('click', () => {
      if (state.selectedGenreIds.has(g.id)) {
        state.selectedGenreIds.delete(g.id);
        tag.classList.remove('selected');
      } else {
        state.selectedGenreIds.add(g.id);
        tag.classList.add('selected');
      }
    });
    dom.genresTagsList.appendChild(tag);
  });
}

// Notation par étoiles
function setRating(ratingValue) {
  state.selectedRating = ratingValue;
  const starCount = ratingValue ? (ratingValue.match(/⭐/g) || []).length : 0;
  dom.stars.forEach((star, index) => {
    if (index < starCount) star.classList.add('active');
    else star.classList.remove('active');
  });
}

// Soumission de l'import
async function handleImportSubmit(e) {
  e.preventDefault();
  if (!state.selectedItem) return;

  const item = state.selectedItem;
  const isGame = item.isGame === true;
  const isMovie = item.isMovie === true;

  const coverRadio = document.querySelector('input[name="coverChoice"]:checked');
  const preferBackdrop = coverRadio ? coverRadio.value === 'backdrop' : true;

  let importPayload;

  if (isGame) {
    const starCount = state.selectedRating ? (state.selectedRating.match(/⭐/g) || []).length : 0;
    const gameRating = starCount > 0 ? (starCount === 1 ? '1 Star 💥 ' : `${starCount} Stars 💥 `) : null;
    const rawPlayerSupport = dom.inputPlayerSupport.value.split(',').map(s => s.trim()).filter(Boolean);

    const gameSummaryText = (dom.textGameSummary && dom.textGameSummary.value.trim()) || item.overview || '';

    importPayload = {
      isGame: true,
      title: item.title,
      summary: gameSummaryText,
      storeUrl: item.storeUrl,
      releaseDate: item.releaseDate,
      gameStatus: dom.selectGameStatus.value,
      gameRating,
      copy: dom.selectGameCopy.value,
      playerSupport: rawPlayerSupport,
      platformId: dom.selectPlatform.value || null,
      genreIds: Array.from(state.selectedGenreIds),
      yearWatchId: dom.selectYearWatch.value || null,
      isFavourite: dom.checkFavourite.checked,
      notes: dom.textNotes.value.trim(),
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl
    };
  } else {
    let selectedTvType = '📺 TV show';
    if (!isMovie) {
      const checkedRadio = document.querySelector('input[name="tvSubType"]:checked');
      if (checkedRadio) selectedTvType = checkedRadio.value;
    }

    const rawCasts = dom.inputCasts.value.split(',').map(s => s.trim()).filter(Boolean);

    importPayload = {
      isGame: false,
      isMovie,
      type: isMovie ? '🎥 Movie' : selectedTvType,
      title: item.title,
      status: dom.selectStatus.value,
      releasedYear: item.releasedYear,
      releaseDate: item.releaseDate,
      dateViewed: dom.inputDateViewed.value || null,
      rating: state.selectedRating || null,
      isFavourite: dom.checkFavourite.checked,
      totalEp: !isMovie ? parseInt(dom.inputTotalEp.value, 10) || 0 : null,
      currentEp: !isMovie ? parseInt(dom.inputCurrentEp.value, 10) || 0 : null,
      platformId: dom.selectPlatform.value || null,
      yearWatchId: dom.selectYearWatch.value || null,
      genreIds: Array.from(state.selectedGenreIds),
      casts: rawCasts,
      notes: dom.textNotes.value.trim(),
      posterUrl: item.posterUrl,
      backdropUrl: item.backdropUrl
    };
  }

  const activeConfig = {
    ...state.config,
    useBackdropAsCover: preferBackdrop,
    usePageTemplate: dom.checkUseTemplate.checked
  };

  dom.btnSubmitImport.disabled = true;
  dom.btnSubmitImport.innerHTML = `
    <div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
    Création dans Notion avec template...`;

  try {
    const result = await createMediaPage(importPayload, activeConfig);

    dom.importForm.style.display = 'none';
    dom.successCard.style.display = 'flex';
    dom.linkOpenInNotion.href = result.url;
  } catch (err) {
    showErrorAlert(`Erreur lors de l'ajout dans Notion: ${err.message}`);
    dom.btnSubmitImport.disabled = false;
    dom.btnSubmitImport.textContent = 'Réessayer';
  }
}

// Paramètres : chargement
function loadSettingsIntoForm() {
  dom.settingTmdbKey.value = state.config.tmdbApiKey || '';
  dom.settingNotionKey.value = state.config.notionApiKey || '';
  dom.settingGamesDbKey.value = state.config.gamesDbApiKey || '';
  dom.settingMoviesDb.value = state.config.moviesDbId || '';
  dom.settingTvShowsDb.value = state.config.tvShowsDbId || '';
  dom.settingGamesDb.value = state.config.gamesDbId || '';
  if (dom.settingGamePlatformsDb) dom.settingGamePlatformsDb.value = state.config.gamePlatformsDbId || '';
  if (dom.settingGameGenresDb) dom.settingGameGenresDb.value = state.config.gameGenresDbId || '';
  dom.settingGenresDb.value = state.config.genresDbId || '';
  dom.settingPlatformsDb.value = state.config.platformsDbId || '';
  dom.settingYearlyReviewDb.value = state.config.yearlyReviewDbId || '';
  dom.settingsFeedback.style.display = 'none';
}

// Paramètres : sauvegarde
async function handleSaveSettings(e) {
  e.preventDefault();
  const newConfig = {
    ...state.config,
    tmdbApiKey: dom.settingTmdbKey.value.trim() || DEFAULT_CONFIG.tmdbApiKey,
    notionApiKey: dom.settingNotionKey.value.trim() || DEFAULT_CONFIG.notionApiKey,
    gamesDbApiKey: dom.settingGamesDbKey.value.trim() || DEFAULT_CONFIG.gamesDbApiKey,
    moviesDbId: dom.settingMoviesDb.value.trim() || DEFAULT_CONFIG.moviesDbId,
    tvShowsDbId: dom.settingTvShowsDb.value.trim() || DEFAULT_CONFIG.tvShowsDbId,
    gamesDbId: dom.settingGamesDb.value.trim() || DEFAULT_CONFIG.gamesDbId,
    gamePlatformsDbId: (dom.settingGamePlatformsDb && dom.settingGamePlatformsDb.value.trim()) || DEFAULT_CONFIG.gamePlatformsDbId,
    gameGenresDbId: (dom.settingGameGenresDb && dom.settingGameGenresDb.value.trim()) || DEFAULT_CONFIG.gameGenresDbId,
    genresDbId: dom.settingGenresDb.value.trim() || DEFAULT_CONFIG.genresDbId,
    platformsDbId: dom.settingPlatformsDb.value.trim() || DEFAULT_CONFIG.platformsDbId,
    yearlyReviewDbId: dom.settingYearlyReviewDb.value.trim() || DEFAULT_CONFIG.yearlyReviewDbId
  };

  const ok = await saveConfig(newConfig);
  if (ok) {
    state.config = newConfig;
    showSettingsFeedback('Paramètres enregistrés avec succès !', 'success');
    setTimeout(() => switchView('search'), 900);
  } else {
    showSettingsFeedback('Erreur lors de la sauvegarde.', 'error');
  }
}

// Test de toutes les connexions d'APIs en une seule fois
async function handleTestAllApis() {
  const tempConfig = {
    ...state.config,
    tmdbApiKey: dom.settingTmdbKey.value.trim() || DEFAULT_CONFIG.tmdbApiKey,
    notionApiKey: dom.settingNotionKey.value.trim() || DEFAULT_CONFIG.notionApiKey,
    gamesDbApiKey: dom.settingGamesDbKey.value.trim() || DEFAULT_CONFIG.gamesDbApiKey,
    moviesDbId: dom.settingMoviesDb.value.trim() || DEFAULT_CONFIG.moviesDbId
  };

  dom.btnTestAllApis.disabled = true;
  dom.btnTestAllApis.textContent = '⏳ Tests en cours...';
  showSettingsFeedback('Vérification de toutes les APIs...', 'warning');

  const [tmdbRes, notionRes, gamesDbRes, steamRes] = await Promise.allSettled([
    testTmdbConnection(tempConfig),
    testNotionConnection(tempConfig),
    testGamesDbConnection(tempConfig),
    testSteamConnection()
  ]);

  const items = [
    { name: 'TMDb (Films & Séries)', res: tmdbRes, okText: 'Clé valide & API accessible' },
    { name: 'Notion (Bases de données)', res: notionRes, okText: 'Clé valide & bases accessibles' },
    { name: 'TheGamesDB (Jeux vidéo)', res: gamesDbRes, okText: 'Clé valide & catalogue accessible' },
    { name: 'Steam (Storefront PC)', res: steamRes, okText: 'Store accessible (aucune clé requise)' }
  ];

  let successCount = 0;
  const lines = items.map(item => {
    if (item.res.status === 'fulfilled') {
      successCount++;
      return `<div style="margin: 3px 0;"><strong>${item.name}</strong> : <span style="color: #10b981; font-weight: 600;">✅ Connecté</span> <span style="color: var(--text-secondary); font-size: 11px;">(${item.okText})</span></div>`;
    } else {
      const errMsg = escapeHtml(item.res.reason?.message || 'Erreur inconnue');
      return `<div style="margin: 3px 0;"><strong>${item.name}</strong> : <span style="color: #ef4444; font-weight: 600;">❌ Échec</span> <span style="color: #fca5a5; font-size: 11px;">(${errMsg})</span></div>`;
    }
  });

  const allOk = successCount === items.length;
  const anyOk = successCount > 0;
  const feedbackType = allOk ? 'success' : anyOk ? 'warning' : 'error';

  const html = `
    <div style="font-size: 12px; line-height: 1.5;">
      <div style="font-weight: 700; margin-bottom: 6px; font-size: 13px;">
        ${allOk ? '🎉 Toutes les APIs sont opérationnelles !' : `⚠️ ${successCount}/${items.length} APIs opérationnelles :`}
      </div>
      ${lines.join('')}
    </div>
  `;

  showSettingsFeedback(html, feedbackType, true);

  dom.btnTestAllApis.disabled = false;
  dom.btnTestAllApis.textContent = '🔍 Tester toutes les APIs';
}

// Vérification proactive des autorisations d'hôtes cross-navigateur
async function checkAndPromptHostPermissions() {
  if (browserAPI?.permissions?.contains) {
    try {
      const hasPerms = await browserAPI.permissions.contains({
        origins: [
          'https://api.thegamesdb.net/*',
          'https://api.themoviedb.org/*',
          'https://api.notion.com/*'
        ]
      });
      if (!hasPerms && dom.bannerPerms) {
        dom.bannerPerms.style.display = 'block';
      }
    } catch {
      // Ignorer si non supporté
    }
  }
}

// Demande interactive des autorisations d'accès aux APIs
async function requestAllHostPermissions() {
  if (browserAPI?.permissions?.request) {
    try {
      const granted = await browserAPI.permissions.request({
        origins: [
          'https://api.themoviedb.org/*',
          'https://api.notion.com/*',
          'https://image.tmdb.org/*',
          'https://api.thegamesdb.net/*',
          'https://cdn.thegamesdb.net/*',
          'https://store.steampowered.com/*',
          'https://cdn.akamai.steamstatic.com/*',
          'https://shared.fastly.steamstatic.com/*'
        ]
      });
      if (granted && dom.bannerPerms) {
        dom.bannerPerms.style.display = 'none';
        showSettingsFeedback('Autorisations accordées avec succès !', 'success');
      }
      return granted;
    } catch (err) {
      console.warn('Erreur demande permissions:', err);
    }
  }
  return false;
}

function showErrorAlert(msg) {
  dom.statusAlert.className = 'alert-box alert-error';
  dom.statusAlert.textContent = msg;
  dom.statusAlert.style.display = 'block';
}

function showSettingsFeedback(msg, type, isHtml = false) {
  dom.settingsFeedback.className = `alert-box alert-${type}`;
  if (isHtml) {
    dom.settingsFeedback.innerHTML = msg;
  } else {
    dom.settingsFeedback.textContent = msg;
  }
  dom.settingsFeedback.style.display = 'block';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
