// options/options.js - Culture Tracker Options Page Controller

import { browserAPI } from '../services/browser-adapter.js';
import { getConfig, saveConfig, DEFAULT_CONFIG } from '../services/config.js';
import { DEFAULT_SCHEMA, validateSchema } from '../services/schema.default.js';
import { inspectDatabase, generateSchemaRecommendation, formatDatabaseId, runDryRunDiagnostic } from '../services/schema-discovery.js';
import { DECLARATIVE_PRESETS, resolveVariables } from '../services/template-engine.js';

// Schema logical fields definition per media type
const MEDIA_FIELD_DEFINITIONS = {
  movie: [
    { key: 'title', label: 'Titre du film', required: true, defaultType: 'title' },
    { key: 'releaseDate', label: 'Date de sortie', defaultType: 'date' },
    { key: 'rating', label: 'Note personnelle', defaultType: 'number' },
    { key: 'status', label: 'Statut de visionnage', defaultType: 'select', isOptionField: true },
    { key: 'genres', label: 'Genres', defaultType: 'relation' },
    { key: 'platform', label: 'Plateforme / Support', defaultType: 'relation' },
    { key: 'year', label: 'Année de visionnage', defaultType: 'relation' },
    { key: 'casts', label: 'Casting / Acteurs', defaultType: 'multi_select' },
    { key: 'notes', label: 'Notes & Commentaires', defaultType: 'rich_text' }
  ],
  tv: [
    { key: 'title', label: 'Titre de la série', required: true, defaultType: 'title' },
    { key: 'releaseDate', label: 'Date de sortie', defaultType: 'date' },
    { key: 'totalEp', label: 'Nombre total d\'épisodes', defaultType: 'number' },
    { key: 'rating', label: 'Note personnelle', defaultType: 'number' },
    { key: 'status', label: 'Statut de visionnage', defaultType: 'select', isOptionField: true },
    { key: 'genres', label: 'Genres', defaultType: 'relation' },
    { key: 'platform', label: 'Plateforme / Support', defaultType: 'relation' },
    { key: 'year', label: 'Année de visionnage', defaultType: 'relation' },
    { key: 'casts', label: 'Casting / Acteurs', defaultType: 'multi_select' },
    { key: 'notes', label: 'Notes & Commentaires', defaultType: 'rich_text' }
  ],
  game: [
    { key: 'title', label: 'Titre du jeu', required: true, defaultType: 'title' },
    { key: 'platform', label: 'Plateforme de jeu', defaultType: 'relation' },
    { key: 'genres', label: 'Genres', defaultType: 'relation' },
    { key: 'status', label: 'Statut de jeu', defaultType: 'select', isOptionField: true },
    { key: 'rating', label: 'Note globale', defaultType: 'number' },
    { key: 'releaseDate', label: 'Date de sortie', defaultType: 'date' },
    { key: 'playerSupport', label: 'Support Joueur / Modes', defaultType: 'select', isOptionField: true },
    { key: 'copy', label: 'Type de Copie / Format', defaultType: 'select', isOptionField: true },
    { key: 'year', label: 'Année joué', defaultType: 'relation' },
    { key: 'notes', label: 'Notes & Commentaires', defaultType: 'rich_text' }
  ]
};

// Application state
const state = {
  config: null,
  schema: null,
  activeTab: 'tabSchemas',
  activeMediaSubtab: 'movie',
  discoveredDbs: {}, // [dbId]: inspectDatabase result
  isDirty: false,
  // Milestone 2: Template Builder State
  activeTemplateMedia: 'movie',
  previewMode: 'data', // 'data' | 'tokens'
  lastFocusedInput: null
};

// DOM references cache
const dom = {};

document.addEventListener('DOMContentLoaded', async () => {
  cacheDomElements();
  setupEventListeners();
  await loadState();
  renderAll();
});

function cacheDomElements() {
  dom.notionApiKeyInput = document.getElementById('notionApiKeyInput');
  dom.btnToggleApiKeyVisibility = document.getElementById('btnToggleApiKeyVisibility');

  // Navigation
  dom.tabBtns = document.querySelectorAll('.tab-btn');
  dom.tabContents = document.querySelectorAll('.tab-content');
  dom.subtabBtns = document.querySelectorAll('.subtab-btn');
  dom.mediaPanels = {
    movie: document.getElementById('mediaPanelMovie'),
    tv: document.getElementById('mediaPanelTv'),
    game: document.getElementById('mediaPanelGame')
  };

  // Mode switcher
  dom.modeCardDistinct = document.getElementById('modeCardDistinct');
  dom.modeCardUnified = document.getElementById('modeCardUnified');
  dom.unifiedDbConfigCard = document.getElementById('unifiedDbConfigCard');

  // Unified mode inputs
  dom.unifiedDbIdInput = document.getElementById('unifiedDbIdInput');
  dom.btnInspectUnifiedDb = document.getElementById('btnInspectUnifiedDb');
  dom.unifiedDbStatusBanner = document.getElementById('unifiedDbStatusBanner');
  dom.unifiedTypePropertySelect = document.getElementById('unifiedTypePropertySelect');
  dom.unifiedMovieValueInput = document.getElementById('unifiedMovieValueInput');
  dom.unifiedTvValueInput = document.getElementById('unifiedTvValueInput');
  dom.unifiedGameValueInput = document.getElementById('unifiedGameValueInput');

  // Distinct database inputs
  dom.dbInputs = {
    movie: document.getElementById('dbIdInput_movie'),
    tv: document.getElementById('dbIdInput_tv'),
    game: document.getElementById('dbIdInput_game')
  };
  dom.inspectBtns = {
    movie: document.getElementById('btnInspect_movie'),
    tv: document.getElementById('btnInspect_tv'),
    game: document.getElementById('btnInspect_game')
  };
  dom.statusBanners = {
    movie: document.getElementById('statusBanner_movie'),
    tv: document.getElementById('statusBanner_tv'),
    game: document.getElementById('statusBanner_game')
  };
  dom.mappingRows = {
    movie: document.getElementById('mappingRows_movie'),
    tv: document.getElementById('mappingRows_tv'),
    game: document.getElementById('mappingRows_game')
  };
  dom.distinctControls = {
    movie: document.getElementById('distinctControls_movie'),
    tv: document.getElementById('distinctControls_tv'),
    game: document.getElementById('distinctControls_game')
  };

  // Actions
  dom.btnHeaderSave = document.getElementById('btnHeaderSave');
  dom.btnFooterSave = document.getElementById('btnFooterSave');
  dom.btnCancelChanges = document.getElementById('btnCancelChanges');
  dom.footerStatusText = document.getElementById('footerStatusText');
  dom.toastContainer = document.getElementById('toastContainer');

  // Tab 2: Template Builder
  dom.tplSubtabBtns = {
    movie: document.getElementById('tplSubtabBtnMovie'),
    tv: document.getElementById('tplSubtabBtnTv'),
    game: document.getElementById('tplSubtabBtnGame')
  };
  dom.tplMasterToggle = document.getElementById('tplMasterToggle');
  dom.templatePresetSelector = document.getElementById('templatePresetSelector');
  dom.btnResetTemplatePreset = document.getElementById('btnResetTemplatePreset');
  dom.paletteBtns = document.querySelectorAll('.btn-palette');
  dom.variableChipsBar = document.getElementById('variableChipsBar');
  dom.templateBlocksContainer = document.getElementById('templateBlocksContainer');
  dom.tplBlockCount = document.getElementById('tplBlockCount');
  dom.previewMediaBadge = document.getElementById('previewMediaBadge');
  dom.btnPreviewData = document.getElementById('btnPreviewData');
  dom.btnPreviewTokens = document.getElementById('btnPreviewTokens');
  dom.notionPreviewCanvas = document.getElementById('notionPreviewCanvas');

  // Tab 3: Diagnostics & Import/Export (Milestone 4)
  dom.btnRunDiagnostic = document.getElementById('btnRunDiagnostic') || document.getElementById('btnRunDiagnostics');
  dom.btnRunDiagnostics = dom.btnRunDiagnostic;
  dom.diagnosticResultsBox = document.getElementById('diagnosticResultsBox');
  dom.btnExportSchema = document.getElementById('btnExportSchema') || document.getElementById('btnExportJson');
  dom.btnExportJson = dom.btnExportSchema;
  dom.inputImportSchema = document.getElementById('inputImportSchema') || document.getElementById('importJsonFileInput');
  dom.importJsonFileInput = dom.inputImportSchema;
  dom.btnTriggerImport = document.getElementById('btnTriggerImport');
  dom.btnResetFactorySchema = document.getElementById('btnResetFactorySchema') || document.getElementById('btnResetDefault');
  dom.btnResetDefault = dom.btnResetFactorySchema;
}

function setupEventListeners() {
  // Main Tab Navigation
  dom.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  // Media Subtab Navigation
  dom.subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const media = btn.dataset.media;
      switchMediaSubtab(media);
    });
  });

  // API Key Visibility Toggle
  if (dom.btnToggleApiKeyVisibility && dom.notionApiKeyInput) {
    dom.btnToggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = dom.notionApiKeyInput.type === 'password';
      dom.notionApiKeyInput.type = isPassword ? 'text' : 'password';
      dom.btnToggleApiKeyVisibility.textContent = isPassword ? '🙈' : '👁️';
    });
  }

  // Database Mode Switcher
  if (dom.modeCardDistinct) {
    dom.modeCardDistinct.addEventListener('click', () => setDatabaseMode('distinct'));
  }
  if (dom.modeCardUnified) {
    dom.modeCardUnified.addEventListener('click', () => setDatabaseMode('unified'));
  }

  // Auto-Discovery: Unified Database
  if (dom.btnInspectUnifiedDb) {
    dom.btnInspectUnifiedDb.addEventListener('click', () => handleInspectUnifiedDatabase());
  }

  // Auto-Discovery: Distinct Databases
  ['movie', 'tv', 'game'].forEach(media => {
    const btn = dom.inspectBtns[media];
    if (btn) {
      btn.addEventListener('click', () => handleInspectDistinctDatabase(media));
    }
  });

  // Unified Mode Controls
  if (dom.unifiedTypePropertySelect) {
    dom.unifiedTypePropertySelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (state.schema.unifiedDatabase) {
        state.schema.unifiedDatabase.typeProperty = val;
        markDirty();
      }
    });
  }

  if (dom.unifiedMovieValueInput) {
    dom.unifiedMovieValueInput.addEventListener('input', (e) => {
      if (state.schema.unifiedDatabase?.typeValues) {
        state.schema.unifiedDatabase.typeValues.movie = e.target.value;
        markDirty();
      }
    });
  }
  if (dom.unifiedTvValueInput) {
    dom.unifiedTvValueInput.addEventListener('input', (e) => {
      if (state.schema.unifiedDatabase?.typeValues) {
        state.schema.unifiedDatabase.typeValues.tv = e.target.value;
        markDirty();
      }
    });
  }
  if (dom.unifiedGameValueInput) {
    dom.unifiedGameValueInput.addEventListener('input', (e) => {
      if (state.schema.unifiedDatabase?.typeValues) {
        state.schema.unifiedDatabase.typeValues.game = e.target.value;
        markDirty();
      }
    });
  }

  // Tab 2: Template Builder Events
  if (dom.tplSubtabBtns) {
    Object.entries(dom.tplSubtabBtns).forEach(([media, btn]) => {
      if (btn) {
        btn.addEventListener('click', () => {
          switchTemplateMedia(media);
        });
      }
    });
  }

  if (dom.tplMasterToggle) {
    dom.tplMasterToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      const media = state.activeTemplateMedia;
      if (state.schema.mediaTypes?.[media]) {
        state.schema.mediaTypes[media].usePageTemplate = isEnabled;
      }
      state.config.usePageTemplate = isEnabled;
      markDirty();
      renderLivePreview();
    });
  }

  if (dom.templatePresetSelector) {
    dom.templatePresetSelector.addEventListener('change', (e) => {
      handlePresetSelection(e.target.value);
    });
  }

  if (dom.btnResetTemplatePreset) {
    dom.btnResetTemplatePreset.addEventListener('click', () => {
      const defaultPreset = `${state.activeTemplateMedia}-default`;
      handlePresetSelection(defaultPreset);
      showToast(`Modèle "${defaultPreset}" restauré pour ce média.`, 'info');
    });
  }

  if (dom.paletteBtns) {
    dom.paletteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        addBlockFromPalette(btn.dataset.blockType);
      });
    });
  }

  if (dom.variableChipsBar) {
    dom.variableChipsBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip-btn');
      if (chip && chip.dataset.token) {
        insertVariableToken(chip.dataset.token);
      }
    });
  }

  if (dom.templateBlocksContainer) {
    dom.templateBlocksContainer.addEventListener('focusin', (e) => {
      if (e.target.matches('input[type="text"], textarea')) {
        state.lastFocusedInput = e.target;
      }
    });
    dom.templateBlocksContainer.addEventListener('input', handleBlockFieldInput);
    dom.templateBlocksContainer.addEventListener('change', handleBlockFieldInput);
    dom.templateBlocksContainer.addEventListener('click', handleBlockActionClick);
  }

  if (dom.btnPreviewData) {
    dom.btnPreviewData.addEventListener('click', () => {
      state.previewMode = 'data';
      dom.btnPreviewData.classList.add('active');
      if (dom.btnPreviewTokens) dom.btnPreviewTokens.classList.remove('active');
      renderLivePreview();
    });
  }
  if (dom.btnPreviewTokens) {
    dom.btnPreviewTokens.addEventListener('click', () => {
      state.previewMode = 'tokens';
      dom.btnPreviewTokens.classList.add('active');
      if (dom.btnPreviewData) dom.btnPreviewData.classList.remove('active');
      renderLivePreview();
    });
  }

  // Save Buttons
  if (dom.btnHeaderSave) dom.btnHeaderSave.addEventListener('click', handleSave);
  if (dom.btnFooterSave) dom.btnFooterSave.addEventListener('click', handleSave);
  if (dom.btnCancelChanges) dom.btnCancelChanges.addEventListener('click', handleCancel);

  // Diagnostics & Backup (Milestone 4: Export / Import / Reset)
  if (dom.btnRunDiagnostics) dom.btnRunDiagnostics.addEventListener('click', handleRunDiagnostics);
  if (dom.btnExportSchema) dom.btnExportSchema.addEventListener('click', handleExportSchema);
  if (dom.btnTriggerImport && dom.inputImportSchema) {
    dom.btnTriggerImport.addEventListener('click', () => {
      dom.inputImportSchema.click();
    });
  }
  if (dom.inputImportSchema) {
    dom.inputImportSchema.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImportSchema(file);
      }
    });
  }
  if (dom.btnResetFactorySchema) dom.btnResetFactorySchema.addEventListener('click', handleResetFactorySchema);
}

// State Loading & Initialization
async function loadState() {
  state.config = await getConfig();

  // Load active schema from browser.storage.local
  try {
    const storage = await browserAPI.storage.local.get('cultureTrackerSchema');
    if (storage && storage.cultureTrackerSchema) {
      state.schema = JSON.parse(JSON.stringify(storage.cultureTrackerSchema));
    }
  } catch (err) {
    console.warn('Erreur lecture schema stocké:', err);
  }

  if (!state.schema) {
    state.schema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
  }

  // Ensure databaseMode and unifiedDatabase exist
  if (!state.schema.databaseMode) {
    state.schema.databaseMode = 'distinct';
  }
  if (!state.schema.unifiedDatabase) {
    state.schema.unifiedDatabase = {
      databaseId: '',
      typeProperty: 'Type',
      typeValues: {
        movie: 'Film',
        tv: 'Série TV',
        game: 'Jeu Vidéo'
      }
    };
  }

  // Pre-fill Notion API key
  if (dom.notionApiKeyInput) {
    dom.notionApiKeyInput.value = state.config.notionApiKey || '';
  }

  // Pre-fill database IDs
  if (dom.unifiedDbIdInput) {
    dom.unifiedDbIdInput.value = state.schema.unifiedDatabase?.databaseId || '';
  }
  if (dom.dbInputs.movie) {
    dom.dbInputs.movie.value = state.schema.mediaTypes?.movie?.databaseId || state.config.moviesDbId || '';
  }
  if (dom.dbInputs.tv) {
    dom.dbInputs.tv.value = state.schema.mediaTypes?.tv?.databaseId || state.config.tvShowsDbId || '';
  }
  if (dom.dbInputs.game) {
    dom.dbInputs.game.value = state.schema.mediaTypes?.game?.databaseId || state.config.gamesDbId || '';
  }

  // Pre-fill unified discriminator values
  const typeProp = state.schema.unifiedDatabase?.typeProperty;
  const typePropName = typeof typeProp === 'object' ? typeProp?.notionName : typeProp;
  if (dom.unifiedMovieValueInput) dom.unifiedMovieValueInput.value = state.schema.unifiedDatabase?.typeValues?.movie || 'Film';
  if (dom.unifiedTvValueInput) dom.unifiedTvValueInput.value = state.schema.unifiedDatabase?.typeValues?.tv || 'Série TV';
  if (dom.unifiedGameValueInput) dom.unifiedGameValueInput.value = state.schema.unifiedDatabase?.typeValues?.game || 'Jeu Vidéo';

  // Ensure templateBlocks exist for each media type
  ['movie', 'tv', 'game'].forEach(media => {
    if (state.schema.mediaTypes?.[media]) {
      const mediaCfg = state.schema.mediaTypes[media];
      if (!mediaCfg.templateBlocks || !Array.isArray(mediaCfg.templateBlocks)) {
        const presetKey = mediaCfg.template || `${media}-default`;
        const preset = DECLARATIVE_PRESETS[presetKey] || DECLARATIVE_PRESETS[`${media}-default`] || DECLARATIVE_PRESETS['simple-summary'];
        mediaCfg.templateBlocks = JSON.parse(JSON.stringify(preset));
      }
      if (mediaCfg.usePageTemplate === undefined) {
        mediaCfg.usePageTemplate = true;
      }
    }
  });
}

// UI Navigation Handlers
function switchTab(tabId) {
  state.activeTab = tabId;
  dom.tabBtns.forEach(btn => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  dom.tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });
}

function switchMediaSubtab(media) {
  state.activeMediaSubtab = media;
  dom.subtabBtns.forEach(btn => {
    const isActive = btn.dataset.media === media;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  ['movie', 'tv', 'game'].forEach(m => {
    if (dom.mediaPanels[m]) {
      dom.mediaPanels[m].style.display = m === media ? 'block' : 'none';
    }
  });
}

function setDatabaseMode(mode) {
  state.schema.databaseMode = mode;
  markDirty();
  renderModeSelection();
}

function renderModeSelection() {
  const isUnified = state.schema.databaseMode === 'unified';

  if (dom.modeCardDistinct) dom.modeCardDistinct.classList.toggle('selected', !isUnified);
  if (dom.modeCardUnified) dom.modeCardUnified.classList.toggle('selected', isUnified);

  if (dom.unifiedDbConfigCard) {
    dom.unifiedDbConfigCard.style.display = isUnified ? 'block' : 'none';
  }

  // Toggle distinct db inputs visibility
  ['movie', 'tv', 'game'].forEach(media => {
    if (dom.distinctControls[media]) {
      dom.distinctControls[media].style.display = isUnified ? 'none' : 'block';
    }
  });

  // Re-render mapping rows based on available columns
  ['movie', 'tv', 'game'].forEach(media => {
    renderMappingTable(media);
  });
}

// Auto-Discovery: Inspection Handlers
async function handleInspectDistinctDatabase(media) {
  const apiKey = dom.notionApiKeyInput.value.trim();
  if (!apiKey) {
    showToast('Veuillez renseigner votre clé API Notion ci-dessus.', 'error');
    dom.notionApiKeyInput.focus();
    return;
  }

  const rawId = dom.dbInputs[media].value.trim();
  if (!rawId) {
    showToast(`Veuillez renseigner l'identifiant de la base Notion pour ${media === 'movie' ? 'les Films' : media === 'tv' ? 'les Séries' : 'les Jeux'}.`, 'error');
    dom.dbInputs[media].focus();
    return;
  }

  const btn = dom.inspectBtns[media];
  const banner = dom.statusBanners[media];

  setButtonLoading(btn, true, 'Inspection en cours...');
  banner.className = 'discovery-banner loading';
  banner.innerHTML = '<span>⏳ Connexion à l\'API Notion et inspection du schéma...</span>';

  try {
    const dbMetadata = await inspectDatabase(rawId, apiKey);
    state.discoveredDbs[rawId] = dbMetadata;
    state.discoveredDbs[formatDatabaseId(rawId)] = dbMetadata;

    // Save ID into schema
    if (state.schema.mediaTypes?.[media]) {
      state.schema.mediaTypes[media].databaseId = dbMetadata.id;
    }

    // Run heuristic recommendation
    const recommendation = generateSchemaRecommendation(dbMetadata, media);
    applyRecommendation(media, recommendation);

    banner.className = 'discovery-banner success';
    banner.innerHTML = `<span>✅ <strong>Base connectée :</strong> "${escapeHtml(dbMetadata.title)}" (${dbMetadata.propertiesCount} colonnes réelles détectées).</span>`;

    renderMappingTable(media);
    markDirty();
    showToast(`Base "${dbMetadata.title}" inspectée avec succès !`, 'success');
  } catch (err) {
    console.error('Erreur inspection distinct database:', err);
    banner.className = 'discovery-banner error';
    banner.innerHTML = `<span>❌ <strong>Erreur :</strong> ${escapeHtml(err.message)}</span>`;
    showToast(`Échec inspection : ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false, '🔍 Auto-découvrir les colonnes');
  }
}

async function handleInspectUnifiedDatabase() {
  const apiKey = dom.notionApiKeyInput.value.trim();
  if (!apiKey) {
    showToast('Veuillez renseigner votre clé API Notion ci-dessus.', 'error');
    dom.notionApiKeyInput.focus();
    return;
  }

  const rawId = dom.unifiedDbIdInput.value.trim();
  if (!rawId) {
    showToast('Veuillez renseigner l\'identifiant de la base unifiée.', 'error');
    dom.unifiedDbIdInput.focus();
    return;
  }

  const btn = dom.btnInspectUnifiedDb;
  const banner = dom.unifiedDbStatusBanner;

  setButtonLoading(btn, true, 'Inspection en cours...');
  banner.className = 'discovery-banner loading';
  banner.innerHTML = '<span>⏳ Connexion à l\'API Notion et inspection de la base unifiée...</span>';

  try {
    const dbMetadata = await inspectDatabase(rawId, apiKey);
    state.discoveredDbs[rawId] = dbMetadata;
    state.discoveredDbs[formatDatabaseId(rawId)] = dbMetadata;

    state.schema.unifiedDatabase.databaseId = dbMetadata.id;

    // Populate Discriminator Property dropdown
    populateUnifiedTypeDropdown(dbMetadata);

    // Apply recommendations to all 3 media types
    ['movie', 'tv', 'game'].forEach(media => {
      const recommendation = generateSchemaRecommendation(dbMetadata, media);
      applyRecommendation(media, recommendation);
      renderMappingTable(media);
    });

    banner.className = 'discovery-banner success';
    banner.innerHTML = `<span>✅ <strong>Base unifiée connectée :</strong> "${escapeHtml(dbMetadata.title)}" (${dbMetadata.propertiesCount} colonnes réelles détectées).</span>`;

    markDirty();
    showToast(`Base unifiée "${dbMetadata.title}" inspectée avec succès !`, 'success');
  } catch (err) {
    console.error('Erreur inspection unified database:', err);
    banner.className = 'discovery-banner error';
    banner.innerHTML = `<span>❌ <strong>Erreur :</strong> ${escapeHtml(err.message)}</span>`;
    showToast(`Échec inspection : ${err.message}`, 'error');
  } finally {
    setButtonLoading(btn, false, '🔍 Auto-découvrir la base unifiée');
  }
}

function populateUnifiedTypeDropdown(dbMetadata) {
  if (!dom.unifiedTypePropertySelect) return;

  const currentProp = state.schema.unifiedDatabase?.typeProperty;
  const currentPropName = typeof currentProp === 'object' ? currentProp.notionName : currentProp;

  const options = [];
  let foundMatch = false;

  const props = Object.values(dbMetadata.properties || {});
  // Sort properties: status and select first
  props.sort((a, b) => {
    const scoreA = (a.type === 'select' || a.type === 'status') ? 0 : 1;
    const scoreB = (b.type === 'select' || b.type === 'status') ? 0 : 1;
    return scoreA - scoreB;
  });

  for (const prop of props) {
    const isSelected = prop.name === currentPropName;
    if (isSelected) foundMatch = true;
    options.push(`<option value="${escapeHtml(prop.name)}" ${isSelected ? 'selected' : ''}>
      ${escapeHtml(prop.name)} [${prop.type}]
    </option>`);
  }

  if (!foundMatch && currentPropName) {
    options.unshift(`<option value="${escapeHtml(currentPropName)}" selected>${escapeHtml(currentPropName)} [configuré]</option>`);
  }

  dom.unifiedTypePropertySelect.innerHTML = options.join('');
}

// Apply recommendations from schema-discovery
function applyRecommendation(media, recommendation) {
  if (!recommendation || !recommendation.recommendedProperties) return;
  const recProps = recommendation.recommendedProperties;

  const mediaConfig = state.schema.mediaTypes?.[media];
  if (!mediaConfig) return;
  if (!mediaConfig.properties) mediaConfig.properties = {};

  for (const [logicalKey, recDef] of Object.entries(recProps)) {
    if (!mediaConfig.properties[logicalKey]) {
      mediaConfig.properties[logicalKey] = {
        notionName: recDef.notionName,
        type: recDef.type
      };
    } else {
      mediaConfig.properties[logicalKey].notionName = recDef.notionName;
      mediaConfig.properties[logicalKey].type = recDef.type;
    }
  }
}

// Visual Mapping Table Renderer
function renderMappingTable(media) {
  const container = dom.mappingRows[media];
  if (!container) return;

  const mediaConfig = state.schema.mediaTypes?.[media] || {};
  const currentProps = mediaConfig.properties || {};

  // Resolve which database metadata to use
  let activeDbId = '';
  if (state.schema.databaseMode === 'unified') {
    activeDbId = state.schema.unifiedDatabase?.databaseId || dom.unifiedDbIdInput?.value.trim();
  } else {
    activeDbId = mediaConfig.databaseId || dom.dbInputs[media]?.value.trim();
  }

  const dbMetadata = state.discoveredDbs[activeDbId] || state.discoveredDbs[formatDatabaseId(activeDbId)] || null;
  const fields = MEDIA_FIELD_DEFINITIONS[media] || [];

  const html = fields.map(field => {
    const propConfig = currentProps[field.key] || null;
    const mappedNotionName = propConfig?.notionName || '';
    const mappedType = propConfig?.type || field.defaultType;
    const isMapped = !!mappedNotionName;

    // Build Notion Property Dropdown
    const selectOptions = [];
    if (!field.required) {
      selectOptions.push(`<option value="" ${!isMapped ? 'selected' : ''}>(Ne pas mapper / Inactif)</option>`);
    }

    if (dbMetadata && dbMetadata.properties) {
      // Discovered properties available
      let foundInDiscovered = false;
      for (const [propName, propDef] of Object.entries(dbMetadata.properties)) {
        const isSelected = propName === mappedNotionName;
        if (isSelected) foundInDiscovered = true;
        selectOptions.push(`
          <option value="${escapeHtml(propName)}" data-type="${propDef.type}" ${isSelected ? 'selected' : ''}>
            ${escapeHtml(propName)} [${propDef.type}]
          </option>
        `);
      }
      if (mappedNotionName && !foundInDiscovered) {
        selectOptions.unshift(`
          <option value="${escapeHtml(mappedNotionName)}" data-type="${mappedType}" selected>
            ${escapeHtml(mappedNotionName)} [${mappedType}] (Actuel)
          </option>
        `);
      }
    } else {
      // Fallback before inspection: show current mapping and defaults
      if (mappedNotionName) {
        selectOptions.push(`
          <option value="${escapeHtml(mappedNotionName)}" data-type="${mappedType}" selected>
            ${escapeHtml(mappedNotionName)} [${mappedType}]
          </option>
        `);
      }
      // Add typical defaults for quick selection
      if (field.key === 'title' && mappedNotionName !== 'Title') selectOptions.push('<option value="Title" data-type="title">Title [title]</option>');
      if (field.key === 'releaseDate' && mappedNotionName !== 'Release Date') selectOptions.push('<option value="Release Date" data-type="date">Release Date [date]</option>');
      if (field.key === 'rating' && mappedNotionName !== 'Rating') selectOptions.push('<option value="Rating" data-type="number">Rating [number]</option>');
      if (field.key === 'status' && mappedNotionName !== 'Watch Status') selectOptions.push('<option value="Watch Status" data-type="select">Watch Status [select]</option>');
      if (field.key === 'genres' && mappedNotionName !== 'Genres') selectOptions.push('<option value="Genres" data-type="relation">Genres [relation]</option>');
      if (field.key === 'platform' && mappedNotionName !== 'Platforms') selectOptions.push('<option value="Platforms" data-type="relation">Platforms [relation]</option>');
    }

    // Dynamic Options Configurator for Right Column
    let configHtml = '';
    const detectedPropDef = dbMetadata?.properties?.[mappedNotionName];

    if (!isMapped) {
      configHtml = `<span class="type-badge badge-unmapped">⚪ Non exporté</span>`;
    } else if (detectedPropDef?.options && detectedPropDef.options.length > 0) {
      // Dynamic options for select / status
      const defaultVal = propConfig?.defaultValue || '';
      const optionItems = detectedPropDef.options.map(opt => {
        const isOptSelected = opt.name === defaultVal;
        return `<option value="${escapeHtml(opt.name)}" ${isOptSelected ? 'selected' : ''}>
          ${escapeHtml(opt.name)}
        </option>`;
      });

      configHtml = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;">Valeur par défaut :</span>
          <select class="form-select default-value-picker" data-media="${media}" data-field="${field.key}" style="padding: 4px 8px; font-size: 12px; min-height: 34px;">
            <option value="">(Aucune)</option>
            ${optionItems.join('')}
          </select>
        </div>
      `;
    } else if (mappedType === 'relation') {
      const lookupName = propConfig?.lookupTable || 'Table relationnelle';
      configHtml = `<span class="type-badge badge-relation" title="Lié via table relationnelle Notion">🔗 Relation (${escapeHtml(lookupName)})</span>`;
    } else if (mappedType === 'multi_select' || mappedType === 'select') {
      configHtml = `<span class="type-badge badge-multi_select" title="Valeurs injectées directement sans table relationnelle">🏷️ Colonne directe</span>`;
    } else {
      configHtml = `<span class="type-badge badge-${mappedType}">${escapeHtml(mappedType)}</span>`;
    }

    return `
      <tr>
        <td>
          <div class="field-info">
            <span class="field-name">
              ${escapeHtml(field.label)}
              ${field.required ? '<span class="field-badge-required">Requis</span>' : ''}
            </span>
            <span class="field-key">${escapeHtml(field.key)}</span>
          </div>
        </td>
        <td>
          <select class="form-select notion-prop-select" data-media="${media}" data-field="${field.key}" style="width: 100%;">
            ${selectOptions.join('')}
          </select>
        </td>
        <td>
          ${configHtml}
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = html;

  // Attach change event listeners to dynamically created selects
  container.querySelectorAll('.notion-prop-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const mediaType = e.target.dataset.media;
      const fieldKey = e.target.dataset.field;
      const chosenNotionName = e.target.value.trim();
      const selectedOption = e.target.options[e.target.selectedIndex];
      const detectedType = selectedOption?.dataset?.type || 'rich_text';

      handlePropertySelectionChange(mediaType, fieldKey, chosenNotionName, detectedType, dbMetadata);
    });
  });

  container.querySelectorAll('.default-value-picker').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const mediaType = e.target.dataset.media;
      const fieldKey = e.target.dataset.field;
      const defaultVal = e.target.value;

      if (state.schema.mediaTypes?.[mediaType]?.properties?.[fieldKey]) {
        state.schema.mediaTypes[mediaType].properties[fieldKey].defaultValue = defaultVal;
        markDirty();
      }
    });
  });
}

function handlePropertySelectionChange(media, fieldKey, notionName, type, dbMetadata) {
  const mediaConfig = state.schema.mediaTypes?.[media];
  if (!mediaConfig) return;
  if (!mediaConfig.properties) mediaConfig.properties = {};

  if (!notionName) {
    // Unmapped
    delete mediaConfig.properties[fieldKey];
  } else {
    const existing = mediaConfig.properties[fieldKey] || {};
    const propDef = dbMetadata?.properties?.[notionName];

    mediaConfig.properties[fieldKey] = {
      ...existing,
      notionName,
      type: propDef?.type || type || existing.type || 'rich_text'
    };

    // If options are available in Notion and none set, pick first or keep existing
    if (propDef?.options?.length > 0 && !mediaConfig.properties[fieldKey].defaultValue) {
      mediaConfig.properties[fieldKey].defaultValue = propDef.options[0].name;
    }
  }

  markDirty();
  renderMappingTable(media);
}

// Full Render
function renderAll() {
  renderModeSelection();
  switchMediaSubtab(state.activeMediaSubtab);
  ['movie', 'tv', 'game'].forEach(media => {
    renderMappingTable(media);
  });
  switchTemplateMedia(state.activeTemplateMedia);
}

// Dirty state & Save Handlers
function markDirty() {
  state.isDirty = true;
  if (dom.footerStatusText) {
    dom.footerStatusText.innerHTML = '<span style="color: var(--warning);">⚠️ Modifications non enregistrées</span>';
  }
}

async function handleSave() {
  // Sync Notion API key into cultureTrackerConfig
  const apiKey = dom.notionApiKeyInput.value.trim();
  state.config.notionApiKey = apiKey;

  // Sync Database IDs into cultureTrackerConfig
  if (state.schema.databaseMode === 'unified') {
    state.schema.unifiedDatabase.databaseId = dom.unifiedDbIdInput.value.trim();
  } else {
    if (dom.dbInputs.movie) {
      const id = dom.dbInputs.movie.value.trim();
      state.config.moviesDbId = id;
      if (state.schema.mediaTypes?.movie) state.schema.mediaTypes.movie.databaseId = id;
    }
    if (dom.dbInputs.tv) {
      const id = dom.dbInputs.tv.value.trim();
      state.config.tvShowsDbId = id;
      if (state.schema.mediaTypes?.tv) state.schema.mediaTypes.tv.databaseId = id;
    }
    if (dom.dbInputs.game) {
      const id = dom.dbInputs.game.value.trim();
      state.config.gamesDbId = id;
      if (state.schema.mediaTypes?.game) state.schema.mediaTypes.game.databaseId = id;
    }
  }

  // Persist cultureTrackerConfig
  const okConfig = await saveConfig(state.config);

  // Persist cultureTrackerSchema
  let okSchema = false;
  try {
    await browserAPI.storage.local.set({ cultureTrackerSchema: state.schema });
    okSchema = true;
  } catch (err) {
    console.error('Erreur sauvegarde cultureTrackerSchema:', err);
  }

  if (okConfig && okSchema) {
    state.isDirty = false;
    if (dom.footerStatusText) {
      dom.footerStatusText.innerHTML = '<span class="save-status-indicator saved">✅ Configuration enregistrée</span>';
    }
    showToast('Toutes les modifications ont été enregistrées avec succès !', 'success');
  } else {
    showToast('Erreur lors de la sauvegarde de la configuration.', 'error');
  }
}

async function handleCancel() {
  if (confirm('Voulez-vous annuler toutes les modifications non enregistrées ?')) {
    await loadState();
    renderAll();
    state.isDirty = false;
    if (dom.footerStatusText) {
      dom.footerStatusText.innerHTML = '<span>Prêt</span>';
    }
    showToast('Modifications annulées.', 'info');
  }
}

// Tab 3: Diagnostics & Live Notion Validation
async function handleRunDiagnostics() {
  if (!dom.diagnosticResultsBox) return;

  const btn = dom.btnRunDiagnostic || dom.btnRunDiagnostics;
  const originalBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span> Test en cours...`;
  }

  dom.diagnosticResultsBox.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0;">
      <div class="spinner" style="width: 20px; height: 20px; border-width: 3px;"></div>
      <div>
        <div style="font-weight: 600; font-size: 14px;">Interrogation des bases Notion en direct...</div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
          Contrôle des permissions, de l'accessibilité des bases et de la concordance des colonnes configurées.
        </div>
      </div>
    </div>
  `;

  try {
    const apiKey = dom.notionApiKeyInput?.value?.trim() || state.config?.notionApiKey || '';
    if (!apiKey) {
      dom.diagnosticResultsBox.innerHTML = `
        <div class="diag-overall-banner status-error">
          <div class="diag-banner-header">
            <span class="diag-banner-icon">🔴</span>
            <div>
              <div class="diag-banner-title">Clé API Notion Manquante</div>
              <div class="diag-banner-desc">Renseignez votre token d'intégration Notion dans le champ en haut de page pour lancer le test.</div>
            </div>
          </div>
        </div>
      `;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      }
      return;
    }

    const report = await runDryRunDiagnostic(state.schema, apiKey, {
      fallbackConfig: state.config || {},
      inspectFn: (id, key) => inspectDatabase(id, key)
    });

    renderDiagnosticReport(report);
    showToast(
      'Diagnostic Notion terminé.',
      report.overallStatus === 'error' ? 'error' : (report.overallStatus === 'warning' ? 'warning' : 'success')
    );
  } catch (err) {
    dom.diagnosticResultsBox.innerHTML = `
      <div class="diag-overall-banner status-error">
        <div class="diag-banner-header">
          <span class="diag-banner-icon">🔴</span>
          <div>
            <div class="diag-banner-title">Erreur lors de l'exécution du diagnostic</div>
            <div class="diag-banner-desc">${escapeHtml(err.message || String(err))}</div>
          </div>
        </div>
      </div>
    `;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
}

function renderDiagnosticReport(report) {
  if (!dom.diagnosticResultsBox) return;

  const isOk = report.overallStatus === 'ok';
  const isWarn = report.overallStatus === 'warning';

  const statusClass = isOk ? 'status-ok' : (isWarn ? 'status-warning' : 'status-error');
  const statusIcon = isOk ? '🟢' : (isWarn ? '🟠' : '🔴');
  const statusTitle = isOk
    ? 'Configuration Notion 100% Conforme'
    : (isWarn ? 'Configuration Fonctionnelle avec Avertissements' : 'Erreurs de Configuration Détectées');
  const statusDesc = isOk
    ? 'Toutes les bases configurées sont accessibles et leurs colonnes correspondent parfaitement au schéma.'
    : (isWarn
      ? 'Certaines colonnes ont des types compatibles avec adaptation (ex: select vs status), mais aucune erreur bloquante n\'empêche l\'import.'
      : 'Certaines colonnes sont introuvables ou des bases sont inaccessibles. Corrigez les erreurs signalées en rouge avant d\'importer.');

  // Summary Badges
  const badgesHtml = `
    <div class="diag-badges-row">
      <span class="diag-badge diag-badge-ok">✓ ${report.summary.valid} valide(s)</span>
      <span class="diag-badge diag-badge-warning">⚠️ ${report.summary.warnings} attention</span>
      <span class="diag-badge diag-badge-error">✕ ${report.summary.errors} erreur(s)</span>
      <span class="diag-badge diag-badge-skipped">⚪ ${report.summary.skipped} non mappé(s)</span>
    </div>
  `;

  // Per Database Tables
  let dbCardsHtml = '';
  report.databases.forEach(db => {
    const isDbErr = db.status === 'error' || Boolean(db.error);
    const isDbWarn = db.status === 'warning';
    const dbBadgeClass = isDbErr ? 'diag-badge-error' : (isDbWarn ? 'diag-badge-warning' : 'diag-badge-ok');
    const dbBadgeText = isDbErr ? '✕ Inaccessible / Erreur' : (isDbWarn ? '⚠️ Avertissements' : '✓ Prête');

    let bodyContent = '';
    if (db.error) {
      bodyContent = `
        <div class="diag-db-error-alert">
          <strong>Échec de connexion :</strong> ${escapeHtml(db.error)}
        </div>
      `;
    } else {
      const rowsHtml = db.properties.map(p => {
        let badgeHtml;
        if (p.status === 'ok') {
          badgeHtml = `<span class="diag-status-pill pill-ok">✓ Valide</span>`;
        } else if (p.status === 'warning') {
          badgeHtml = `<span class="diag-status-pill pill-warning">⚠️ Attention</span>`;
        } else if (p.status === 'error') {
          badgeHtml = `<span class="diag-status-pill pill-error">✕ Erreur</span>`;
        } else {
          badgeHtml = `<span class="diag-status-pill pill-skipped">⚪ Ignoré</span>`;
        }

        const typeDisplay = p.expectedType
          ? `<span class="diag-type-tag">${escapeHtml(p.expectedType)}</span>${p.actualType && p.actualType !== p.expectedType ? ` &rarr; <span class="diag-type-tag actual">${escapeHtml(p.actualType)}</span>` : ''}`
          : '<span style="color: var(--text-muted);">-</span>';

        return `
          <tr>
            <td><strong>${escapeHtml(p.label || p.key)}</strong></td>
            <td><code>${escapeHtml(p.notionName)}</code></td>
            <td>${typeDisplay}</td>
            <td>${badgeHtml}</td>
            <td class="diag-msg-cell">${escapeHtml(p.message || '')}</td>
          </tr>
        `;
      }).join('');

      bodyContent = `
        <div class="table-responsive">
          <table class="diagnostic-table">
            <thead>
              <tr>
                <th style="width: 24%;">Champ Culture Tracker</th>
                <th style="width: 24%;">Colonne Notion</th>
                <th style="width: 18%;">Type (Attendu / Réel)</th>
                <th style="width: 14%;">Statut</th>
                <th style="width: 20%;">Diagnostic</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }

    dbCardsHtml += `
      <div class="diagnostic-db-card">
        <div class="diag-db-header">
          <div class="diag-db-info">
            <span class="diag-db-title">${escapeHtml(db.name)}</span>
            ${db.databaseTitle ? `<span class="diag-db-subtitle">"${escapeHtml(db.databaseTitle)}"</span>` : ''}
            ${db.databaseId ? `<code class="diag-db-id">${escapeHtml(db.databaseId)}</code>` : ''}
          </div>
          <span class="diag-badge ${dbBadgeClass}">${dbBadgeText}</span>
        </div>
        ${bodyContent}
      </div>
    `;
  });

  dom.diagnosticResultsBox.innerHTML = `
    <div class="diagnostic-report-container">
      <div class="diag-overall-banner ${statusClass}">
        <div class="diag-banner-header">
          <span class="diag-banner-icon">${statusIcon}</span>
          <div>
            <div class="diag-banner-title">${statusTitle}</div>
            <div class="diag-banner-desc">${statusDesc}</div>
          </div>
        </div>
        ${badgesHtml}
      </div>
      <div class="diag-db-list">
        ${dbCardsHtml}
      </div>
    </div>
  `;
}

// ==========================================
// Milestone 4: Export, Import & Factory Reset
// ==========================================

export function handleExportSchema() {
  const exportPayload = {
    version: state.schema?.version || '1.0.0',
    description: state.schema?.description || "Configuration déclarative du schéma Notion pour Culture Tracker.",
    databaseMode: state.schema?.databaseMode || 'distinct',
    unifiedDatabase: state.schema?.unifiedDatabase || {
      databaseId: '',
      typeProperty: 'Type',
      typeValues: { movie: 'Film', tv: 'Série TV', game: 'Jeu Vidéo' }
    },
    mediaTypes: JSON.parse(JSON.stringify(state.schema?.mediaTypes || {})),
    customTemplates: state.schema?.customTemplates || {}
  };

  // Ensure each mediaType preserves properties, template, templateBlocks and usePageTemplate
  ['movie', 'tv', 'game'].forEach(media => {
    if (exportPayload.mediaTypes[media]) {
      const m = exportPayload.mediaTypes[media];
      if (!m.templateBlocks && state.schema?.mediaTypes?.[media]?.templateBlocks) {
        m.templateBlocks = JSON.parse(JSON.stringify(state.schema.mediaTypes[media].templateBlocks));
      }
      if (m.usePageTemplate === undefined) {
        m.usePageTemplate = state.schema?.mediaTypes?.[media]?.usePageTemplate !== false;
      }
    }
  });

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);

  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = blobUrl;
  downloadAnchor.download = 'culture-tracker-schema.json';
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

  showToast('Schéma exporté avec succès sous "culture-tracker-schema.json" !', 'success');
  return exportPayload;
}

export const handleExportJson = handleExportSchema;

export async function handleImportSchema(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const fileContent = event.target?.result;
      let parsed;
      try {
        parsed = JSON.parse(fileContent);
      } catch (parseErr) {
        const errMsg = `Fichier JSON invalide : ${parseErr.message}`;
        alert(errMsg);
        showToast(errMsg, 'error');
        return;
      }

      const validation = validateSchema(parsed);
      if (!validation.valid) {
        const errorBullets = (validation.errors || []).map(err => `• ${err}`).join('\n');
        const alertMsg = `Impossible d'importer le schéma : erreurs de validation détectées :\n\n${errorBullets}\n\nLe schéma actif reste inchangé.`;
        alert(alertMsg);
        showToast(`Schéma invalide (${validation.errors?.length || 0} erreur(s)).`, 'error');
        return;
      }

      // Valid schema - apply to state.schema
      state.schema = {
        version: parsed.version || '1.0.0',
        description: parsed.description || state.schema?.description || '',
        databaseMode: parsed.databaseMode || 'distinct',
        unifiedDatabase: parsed.unifiedDatabase || state.schema?.unifiedDatabase || {},
        mediaTypes: parsed.mediaTypes,
        customTemplates: parsed.customTemplates || state.schema?.customTemplates || {}
      };

      // Ensure templateBlocks exist on all media types
      ['movie', 'tv', 'game'].forEach(media => {
        if (state.schema.mediaTypes?.[media]) {
          const m = state.schema.mediaTypes[media];
          if (!m.templateBlocks || !Array.isArray(m.templateBlocks)) {
            const presetKey = m.template || `${media}-default`;
            m.templateBlocks = JSON.parse(JSON.stringify(DECLARATIVE_PRESETS[presetKey] || DECLARATIVE_PRESETS[`${media}-default`] || []));
          }
          if (m.usePageTemplate === undefined) {
            m.usePageTemplate = true;
          }
        }
      });

      // Persist into browserAPI.storage.local under cultureTrackerSchema
      try {
        await browserAPI.storage.local.set({ cultureTrackerSchema: state.schema });
      } catch (storageErr) {
        console.error('Erreur sauvegarde storage.local lors de l\'import:', storageErr);
      }

      // Update database input fields in UI
      if (dom.unifiedDbIdInput) {
        dom.unifiedDbIdInput.value = state.schema.unifiedDatabase?.databaseId || '';
      }
      if (dom.dbInputs?.movie) {
        dom.dbInputs.movie.value = state.schema.mediaTypes?.movie?.databaseId || '';
      }
      if (dom.dbInputs?.tv) {
        dom.dbInputs.tv.value = state.schema.mediaTypes?.tv?.databaseId || '';
      }
      if (dom.dbInputs?.game) {
        dom.dbInputs.game.value = state.schema.mediaTypes?.game?.databaseId || '';
      }

      // Refresh all UI tabs: Tab 1 mapping dropdowns, Tab 2 templates, Tab 3 diagnostics
      renderAll();
      state.isDirty = false;
      if (dom.footerStatusText) {
        dom.footerStatusText.innerHTML = '<span class="save-status-indicator saved">✅ Schéma importé</span>';
      }

      // Reset diagnostic banner to invite re-test
      if (dom.diagnosticResultsBox) {
        dom.diagnosticResultsBox.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 6px;">État du système :</div>
          <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
            Nouveau schéma importé avec succès. Cliquez sur "Tester la configuration" pour valider la connexion Notion.
          </p>
        `;
      }

      showToast('Schéma JSON importé, validé et appliqué avec succès !', 'success');
    } catch (err) {
      console.error('Erreur import schéma:', err);
      alert(`Erreur inattendue lors de l'importation : ${err.message}`);
      showToast(`Erreur import : ${err.message}`, 'error');
    } finally {
      if (dom.inputImportSchema) dom.inputImportSchema.value = '';
      if (dom.importJsonFileInput) dom.importJsonFileInput.value = '';
    }
  };

  reader.onerror = () => {
    const errMsg = 'Erreur lors de la lecture du fichier.';
    alert(errMsg);
    showToast(errMsg, 'error');
  };

  reader.readAsText(file);
}

export const handleImportJson = (e) => {
  const file = e.target.files?.[0];
  if (file) handleImportSchema(file);
};

export async function handleResetFactorySchema() {
  const confirmed = confirm(
    'Attention : Voulez-vous réinitialiser le schéma vers les valeurs par défaut d\'usine ?\n\nToutes les correspondances de colonnes personnalisées seront perdues.'
  );
  if (!confirmed) return;

  // Revert state.schema to a clean deep copy of DEFAULT_SCHEMA
  state.schema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));

  // Ensure templateBlocks exist on all media types
  ['movie', 'tv', 'game'].forEach(media => {
    if (state.schema.mediaTypes?.[media]) {
      const m = state.schema.mediaTypes[media];
      if (!m.templateBlocks || !Array.isArray(m.templateBlocks)) {
        const presetKey = m.template || `${media}-default`;
        m.templateBlocks = JSON.parse(JSON.stringify(DECLARATIVE_PRESETS[presetKey] || DECLARATIVE_PRESETS[`${media}-default`] || []));
      }
      m.usePageTemplate = true;
    }
  });

  // Persist to browserAPI.storage.local under cultureTrackerSchema
  try {
    await browserAPI.storage.local.set({ cultureTrackerSchema: state.schema });
  } catch (err) {
    console.warn('Erreur sauvegarde réinitialisation usine:', err);
  }

  // Update database inputs in UI
  if (dom.unifiedDbIdInput) {
    dom.unifiedDbIdInput.value = state.schema.unifiedDatabase?.databaseId || '';
  }
  if (dom.dbInputs?.movie) {
    dom.dbInputs.movie.value = state.schema.mediaTypes?.movie?.databaseId || state.config?.moviesDbId || '';
  }
  if (dom.dbInputs?.tv) {
    dom.dbInputs.tv.value = state.schema.mediaTypes?.tv?.databaseId || state.config?.tvShowsDbId || '';
  }
  if (dom.dbInputs?.game) {
    dom.dbInputs.game.value = state.schema.mediaTypes?.game?.databaseId || state.config?.gamesDbId || '';
  }

  // Re-renders all UI tabs (Tab 1, Tab 2, Tab 3)
  renderAll();
  state.isDirty = false;
  if (dom.footerStatusText) {
    dom.footerStatusText.innerHTML = '<span class="save-status-indicator saved">✅ Paramètres d\'usine restaurés</span>';
  }

  if (dom.diagnosticResultsBox) {
    dom.diagnosticResultsBox.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 6px;">État du système :</div>
      <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
        Schéma réinitialisé aux valeurs d'usine. Cliquez sur "Tester la configuration" pour vérifier la conformité Notion.
      </p>
    `;
  }

  showToast('Schéma réinitialisé avec succès aux paramètres d\'usine !', 'info');
}

export const handleResetDefault = handleResetFactorySchema;

// Utilities
function setButtonLoading(btn, isLoading, text) {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = text;
}

function showToast(message, type = 'info') {
  if (!dom.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
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

// ==========================================
// Milestone 2: Template Builder & Live Preview Logic
// ==========================================

const SAMPLE_PREVIEW_DATA = {
  movie: {
    title: 'Inception',
    overview: 'Dom Cobb est un voleur expérimenté, le meilleur qui soit dans l\'art périlleux de l\'extraction : voler les secrets les plus précieux enfouis au plus profond du subconscient pendant qu\'une personne rêve.',
    releaseDate: '2010-07-16',
    year: '2010',
    rating: '8.8',
    genres: 'Science-Fiction, Action, Thriller',
    cast: 'Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page, Tom Hardy',
    posterUrl: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    platform: 'Netflix',
    status: '🟢 Watched',
    notes: 'Chef-d\'œuvre absolu de Christopher Nolan avec une bande-son magistrale de Hans Zimmer.'
  },
  tv: {
    title: 'Breaking Bad',
    overview: 'Walter White, un professeur de chimie de lycée surqualifié et sous-payé, apprend qu\'il est atteint d\'un cancer du poumon en phase terminale. Pour subvenir aux besoins de sa famille, il s\'associe avec son ancien élève Jesse Pinkman pour fabriquer et vendre de la méthamphétamine.',
    releaseDate: '2008-01-20',
    year: '2008',
    rating: '9.5',
    genres: 'Drame, Crime, Thriller',
    cast: 'Bryan Cranston, Aaron Paul, Anna Gunn, Dean Norris',
    posterUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/w1280/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    platform: 'Netflix',
    status: '🟢 Watched',
    totalEp: '62',
    notes: 'Une des plus grandes séries télévisées de tous les temps.'
  },
  game: {
    title: 'The Legend of Zelda: Breath of the Wild',
    overview: 'Après un sommeil de 100 ans, Link se réveille seul dans un monde qu\'il ne reconnaît plus. Le héros légendaire doit désormais explorer un vaste et dangereux royaume et retrouver ses souvenirs avant qu\'Hyrule ne soit perdue à jamais.',
    releaseDate: '2017-03-03',
    year: '2017',
    rating: '9.7',
    genres: 'Action-Aventure, Monde Ouvert',
    cast: 'Nintendo EPD, Eiji Aonuma, Hidemaro Fujibayashi',
    posterUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.png',
    backdropUrl: 'https://images.igdb.com/igdb/image/upload/t_1080p/sc6qq9.jpg',
    platform: 'Nintendo Switch',
    status: '🟢 Completed',
    notes: 'Révolution du genre open-world.'
  }
};

function switchTemplateMedia(media) {
  state.activeTemplateMedia = media;

  if (dom.tplSubtabBtns) {
    Object.entries(dom.tplSubtabBtns).forEach(([m, btn]) => {
      if (btn) {
        const isActive = m === media;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });
  }

  const mediaLabels = { movie: 'Films', tv: 'Séries TV', game: 'Jeux Vidéo' };
  if (dom.previewMediaBadge) {
    dom.previewMediaBadge.textContent = mediaLabels[media] || media;
  }

  const mediaCfg = state.schema.mediaTypes?.[media] || {};
  if (dom.tplMasterToggle) {
    dom.tplMasterToggle.checked = mediaCfg.usePageTemplate !== false;
  }

  if (dom.templatePresetSelector) {
    dom.templatePresetSelector.value = mediaCfg.template || (mediaCfg.templateBlocks ? 'custom' : `${media}-default`);
  }

  renderTemplateBlocksList();
  renderLivePreview();
}

function handlePresetSelection(presetKey) {
  const media = state.activeTemplateMedia;
  const mediaCfg = state.schema.mediaTypes?.[media];
  if (!mediaCfg) return;

  if (presetKey === 'custom') {
    mediaCfg.template = 'custom';
    markDirty();
    return;
  }

  const preset = DECLARATIVE_PRESETS[presetKey];
  if (preset) {
    mediaCfg.templateBlocks = JSON.parse(JSON.stringify(preset));
    mediaCfg.template = presetKey;
    if (dom.templatePresetSelector) {
      dom.templatePresetSelector.value = presetKey;
    }
    markDirty();
    renderTemplateBlocksList();
    renderLivePreview();
  }
}

function addBlockFromPalette(blockType) {
  const media = state.activeTemplateMedia;
  const mediaCfg = state.schema.mediaTypes?.[media];
  if (!mediaCfg) return;

  if (!Array.isArray(mediaCfg.templateBlocks)) {
    mediaCfg.templateBlocks = [];
  }

  const newId = `blk_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;
  let newBlock = null;

  switch (blockType) {
    case 'heading_1':
      newBlock = { id: newId, type: 'heading_1', content: '', color: 'default', bold: false };
      break;
    case 'heading_2':
      newBlock = { id: newId, type: 'heading_2', content: '', color: 'default', bold: false };
      break;
    case 'heading_3':
      newBlock = { id: newId, type: 'heading_3', content: '', color: 'default', bold: false };
      break;
    case 'paragraph':
      newBlock = { id: newId, type: 'paragraph', content: '' };
      break;
    case 'callout':
      newBlock = { id: newId, type: 'callout', content: '', emoji: '📌', color: 'default' };
      break;
    case 'column_list':
    case 'columns':
      newBlock = {
        id: newId,
        type: 'column_list',
        columns: [
          { children: [{ id: `${newId}_c1`, type: 'paragraph', content: '' }] },
          { children: [{ id: `${newId}_c2`, type: 'paragraph', content: '' }] }
        ]
      };
      break;
    case 'toggle':
      newBlock = { id: newId, type: 'toggle', title: 'Titre déroulant', color: 'default', children: [] };
      break;
    case 'image':
      newBlock = { id: newId, type: 'image', url: '{{posterUrl}}' };
      break;
    case 'divider':
      newBlock = { id: newId, type: 'divider' };
      break;
    default:
      newBlock = { id: newId, type: 'paragraph', content: '' };
  }

  mediaCfg.templateBlocks.push(newBlock);
  mediaCfg.template = 'custom';
  if (dom.templatePresetSelector) {
    dom.templatePresetSelector.value = 'custom';
  }

  markDirty();
  renderTemplateBlocksList();
  renderLivePreview();
  showToast(`Bloc "${blockType}" ajouté !`, 'info');
}

function insertVariableToken(token) {
  let target = state.lastFocusedInput;
  if (!target || !document.contains(target)) {
    target = dom.templateBlocksContainer?.querySelector('input[type="text"], textarea');
  }

  if (target) {
    target.focus();
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const text = target.value;
    target.value = text.substring(0, start) + token + text.substring(end);
    const newPos = start + token.length;
    target.setSelectionRange(newPos, newPos);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    showToast(`Variable ${token} insérée !`, 'info');
  } else {
    showToast(`Cliquez d'abord dans un champ texte pour y insérer ${token}.`, 'warning');
  }
}

function handleBlockFieldInput(e) {
  const target = e.target;
  const action = target.dataset.action;
  const media = state.activeTemplateMedia;
  const mediaCfg = state.schema.mediaTypes?.[media];
  if (!mediaCfg || !mediaCfg.templateBlocks) return;

  if (action === 'edit-block') {
    const index = parseInt(target.dataset.index, 10);
    const field = target.dataset.field;
    const block = mediaCfg.templateBlocks[index];
    if (block) {
      if (field === 'bold') {
        block.bold = target.checked;
      } else if (field === 'level') {
        block.level = parseInt(target.value, 10);
        block.type = `heading_${block.level}`;
      } else {
        block[field] = target.value;
      }
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderLivePreview();
    }
  } else if (action === 'edit-col-sub') {
    const parentIndex = parseInt(target.dataset.parentIndex, 10);
    const colIndex = parseInt(target.dataset.colIndex, 10);
    const subIndex = parseInt(target.dataset.subIndex, 10);
    const field = target.dataset.field;
    const block = mediaCfg.templateBlocks[parentIndex];
    const subBlock = block?.columns?.[colIndex]?.children?.[subIndex];
    if (subBlock) {
      if (field === 'bold') {
        subBlock.bold = target.checked;
      } else {
        subBlock[field] = target.value;
      }
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderLivePreview();
    }
  } else if (action === 'edit-toggle-child') {
    const parentIndex = parseInt(target.dataset.parentIndex, 10);
    const childIndex = parseInt(target.dataset.childIndex, 10);
    const field = target.dataset.field;
    const block = mediaCfg.templateBlocks[parentIndex];
    const child = block?.children?.[childIndex];
    if (child) {
      child[field] = target.value;
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderLivePreview();
    }
  }
}

function handleBlockActionClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const media = state.activeTemplateMedia;
  const mediaCfg = state.schema.mediaTypes?.[media];
  if (!mediaCfg || !mediaCfg.templateBlocks) return;
  const blocks = mediaCfg.templateBlocks;

  if (action === 'move-up') {
    const index = parseInt(target.dataset.index, 10);
    if (index > 0) {
      const temp = blocks[index];
      blocks[index] = blocks[index - 1];
      blocks[index - 1] = temp;
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderTemplateBlocksList();
      renderLivePreview();
    }
  } else if (action === 'move-down') {
    const index = parseInt(target.dataset.index, 10);
    if (index < blocks.length - 1) {
      const temp = blocks[index];
      blocks[index] = blocks[index + 1];
      blocks[index + 1] = temp;
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderTemplateBlocksList();
      renderLivePreview();
    }
  } else if (action === 'delete-block') {
    const index = parseInt(target.dataset.index, 10);
    blocks.splice(index, 1);
    mediaCfg.template = 'custom';
    if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
    markDirty();
    renderTemplateBlocksList();
    renderLivePreview();
    showToast('Bloc supprimé.', 'info');
  } else if (action === 'set-image-url') {
    const index = parseInt(target.dataset.index, 10);
    const val = target.dataset.val;
    if (blocks[index]) {
      blocks[index].url = val;
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderTemplateBlocksList();
      renderLivePreview();
    }
  } else if (action === 'add-col-child') {
    const parentIndex = parseInt(target.dataset.parentIndex, 10);
    const colIndex = parseInt(target.dataset.colIndex, 10);
    const type = target.dataset.type || 'paragraph';
    const parentBlock = blocks[parentIndex];
    if (parentBlock && parentBlock.columns?.[colIndex]) {
      const newChildId = `sub_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 3)}`;
      let subBlock = { id: newChildId, type: 'paragraph', content: '' };
      if (type === 'heading_2') subBlock = { id: newChildId, type: 'heading_2', content: '', color: 'default', bold: false };
      else if (type === 'image') subBlock = { id: newChildId, type: 'image', url: '{{posterUrl}}' };
      else if (type === 'callout') subBlock = { id: newChildId, type: 'callout', content: '', emoji: '📌', color: 'default' };
      else if (type === 'toggle') subBlock = { id: newChildId, type: 'toggle', title: 'Titre', color: 'default', children: [] };
      parentBlock.columns[colIndex].children.push(subBlock);
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderTemplateBlocksList();
      renderLivePreview();
    }
  } else if (action === 'delete-col-child') {
    const parentIndex = parseInt(target.dataset.parentIndex, 10);
    const colIndex = parseInt(target.dataset.colIndex, 10);
    const subIndex = parseInt(target.dataset.subIndex, 10);
    const parentBlock = blocks[parentIndex];
    if (parentBlock && parentBlock.columns?.[colIndex]?.children) {
      parentBlock.columns[colIndex].children.splice(subIndex, 1);
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderTemplateBlocksList();
      renderLivePreview();
    }
  } else if (action === 'add-toggle-child') {
    const parentIndex = parseInt(target.dataset.parentIndex, 10);
    const parentBlock = blocks[parentIndex];
    if (parentBlock) {
      if (!Array.isArray(parentBlock.children)) parentBlock.children = [];
      const newChildId = `tog_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 3)}`;
      parentBlock.children.push({ id: newChildId, type: 'bullet', content: '' });
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderTemplateBlocksList();
      renderLivePreview();
    }
  } else if (action === 'delete-toggle-child') {
    const parentIndex = parseInt(target.dataset.parentIndex, 10);
    const childIndex = parseInt(target.dataset.childIndex, 10);
    const parentBlock = blocks[parentIndex];
    if (parentBlock && parentBlock.children) {
      parentBlock.children.splice(childIndex, 1);
      mediaCfg.template = 'custom';
      if (dom.templatePresetSelector) dom.templatePresetSelector.value = 'custom';
      markDirty();
      renderTemplateBlocksList();
      renderLivePreview();
    }
  }
}

function renderTemplateBlocksList() {
  if (!dom.templateBlocksContainer) return;
  const media = state.activeTemplateMedia;
  const mediaCfg = state.schema.mediaTypes?.[media];
  const blocks = mediaCfg?.templateBlocks || [];

  if (dom.tplBlockCount) {
    dom.tplBlockCount.textContent = blocks.length;
  }

  if (blocks.length === 0) {
    dom.templateBlocksContainer.innerHTML = `
      <div style="text-align: center; padding: 32px 16px; background: var(--bg-tertiary); border: 1px dashed var(--border-color); border-radius: var(--radius-md); color: var(--text-secondary);">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📄</span>
        <h4 style="margin: 0 0 6px; color: var(--text-primary); font-size: 14px;">Aucun bloc configuré</h4>
        <p style="margin: 0; font-size: 12px;">Choisissez un modèle prédéfini ci-dessus ou ajoutez des blocs depuis la palette.</p>
      </div>
    `;
    return;
  }

  const colorOptions = (selected) => [
    { id: 'default', label: 'Par défaut' },
    { id: 'blue', label: 'Bleu' },
    { id: 'gray', label: 'Gris' },
    { id: 'orange', label: 'Orange' },
    { id: 'green', label: 'Vert' },
    { id: 'red', label: 'Rouge' },
    { id: 'purple', label: 'Violet' },
    { id: 'pink', label: 'Rose' }
  ].map(c => `<option value="${c.id}" ${selected === c.id ? 'selected' : ''}>${c.label}</option>`).join('');

  const html = blocks.map((b, i) => {
    const isFirst = i === 0;
    const isLast = i === blocks.length - 1;

    let badge = 'Bloc';
    let fieldsHtml = '';

    if (b.type.startsWith('heading')) {
      const level = b.level || (b.type === 'heading_1' ? 1 : (b.type === 'heading_3' ? 3 : 2));
      badge = `H${level} Titre`;
      fieldsHtml = `
        <div class="block-field-row">
          <input type="text" class="block-input" data-action="edit-block" data-field="content" data-index="${i}" value="${escapeHtml(b.content || '')}" placeholder="Texte du titre (ex: {{title}} ou Screenshots)">
          <select class="block-select" data-action="edit-block" data-field="level" data-index="${i}" style="width: 75px;">
            <option value="1" ${level === 1 ? 'selected' : ''}>H1</option>
            <option value="2" ${level === 2 ? 'selected' : ''}>H2</option>
            <option value="3" ${level === 3 ? 'selected' : ''}>H3</option>
          </select>
          <select class="block-select" data-action="edit-block" data-field="color" data-index="${i}" style="width: 110px;">
            ${colorOptions(b.color || 'default')}
          </select>
          <label style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); cursor: pointer; white-space: nowrap;">
            <input type="checkbox" data-action="edit-block" data-field="bold" data-index="${i}" ${b.bold ? 'checked' : ''}>
            <span>Gras</span>
          </label>
        </div>
      `;
    } else if (b.type === 'paragraph') {
      badge = '📝 Paragraphe';
      fieldsHtml = `
        <textarea class="block-textarea" data-action="edit-block" data-field="content" data-index="${i}" placeholder="Texte du paragraphe (ex: {{overview}})">${escapeHtml(b.content || '')}</textarea>
      `;
    } else if (b.type === 'callout') {
      badge = '📌 Callout';
      fieldsHtml = `
        <div class="block-field-row" style="margin-bottom: 6px;">
          <input type="text" class="block-input" data-action="edit-block" data-field="emoji" data-index="${i}" value="${escapeHtml(b.emoji || '📌')}" style="width: 50px; text-align: center;" title="Icône émoji">
          <select class="block-select" data-action="edit-block" data-field="color" data-index="${i}" style="width: 140px;">
            ${colorOptions(b.color || 'default')}
          </select>
        </div>
        <textarea class="block-textarea" data-action="edit-block" data-field="content" data-index="${i}" placeholder="Contenu du callout (ex: {{overview}})">${escapeHtml(b.content || '')}</textarea>
      `;
    } else if (b.type === 'image') {
      badge = '🖼️ Image';
      fieldsHtml = `
        <div class="block-field-row" style="margin-bottom: 6px;">
          <input type="text" class="block-input" data-action="edit-block" data-field="url" data-index="${i}" value="${escapeHtml(b.url || '')}" placeholder="URL d'image ou {{posterUrl}}">
        </div>
        <div style="display: flex; gap: 6px;">
          <button type="button" class="btn btn-secondary" data-action="set-image-url" data-index="${i}" data-val="{{posterUrl}}" style="padding: 4px 8px; font-size: 11px; min-height: 28px;">
            🖼️ Affiche {{posterUrl}}
          </button>
          <button type="button" class="btn btn-secondary" data-action="set-image-url" data-index="${i}" data-val="{{backdropUrl}}" style="padding: 4px 8px; font-size: 11px; min-height: 28px;">
            🌄 Bannière {{backdropUrl}}
          </button>
        </div>
      `;
    } else if (b.type === 'divider') {
      badge = '── Séparateur';
      fieldsHtml = `
        <div style="padding: 8px 0; color: var(--text-muted); font-size: 12px; font-style: italic;">
          Ligne de séparation horizontale Notion
        </div>
      `;
    } else if (b.type === 'toggle') {
      badge = '▶ Toggle déroulant';
      const children = Array.isArray(b.children) ? b.children : [];
      const childrenHtml = children.map((child, cIdx) => `
        <div class="block-field-row" style="margin-bottom: 4px;">
          <span style="font-size: 11px; color: var(--text-secondary); width: 14px;">•</span>
          <input type="text" class="block-input" data-action="edit-toggle-child" data-parent-index="${i}" data-child-index="${cIdx}" data-field="content" value="${escapeHtml(child.content || '')}" placeholder="Élément de liste">
          <button type="button" class="btn-block-action btn-delete" data-action="delete-toggle-child" data-parent-index="${i}" data-child-index="${cIdx}" title="Supprimer cet élément">🗑️</button>
        </div>
      `).join('');

      fieldsHtml = `
        <div class="block-field-row" style="margin-bottom: 8px;">
          <input type="text" class="block-input" data-action="edit-block" data-field="title" data-index="${i}" value="${escapeHtml(b.title || '')}" placeholder="Titre du toggle">
          <select class="block-select" data-action="edit-block" data-field="color" data-index="${i}" style="width: 120px;">
            ${colorOptions(b.color || 'default')}
          </select>
        </div>
        <div class="toggle-children-container">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary);">Sous-éléments dépliants (${children.length}) :</span>
            <button type="button" class="btn btn-secondary" data-action="add-toggle-child" data-parent-index="${i}" style="padding: 2px 8px; font-size: 11px; min-height: 24px;">+ Puce</button>
          </div>
          ${childrenHtml || '<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">Aucun sous-élément (toggle vide)</div>'}
        </div>
      `;
    } else if (b.type === 'column_list' || b.type === 'columns') {
      badge = '▥ 2 Colonnes';
      const col1Children = b.columns?.[0]?.children || [];
      const col2Children = b.columns?.[1]?.children || [];

      const renderColChildren = (colArr, colIdx) => colArr.map((sub, sIdx) => {
        let subBadge = sub.type;
        if (sub.type.startsWith('heading')) subBadge = 'H' + (sub.level || 2);
        else if (sub.type === 'image') subBadge = '🖼️ Img';
        else if (sub.type === 'toggle') subBadge = '▶ Tog';
        else if (sub.type === 'callout') subBadge = '📌 Call';
        else subBadge = '📝 Text';

        let subInput = '';
        if (sub.type === 'image') {
          subInput = `<input type="text" class="block-input" data-action="edit-col-sub" data-parent-index="${i}" data-col-index="${colIdx}" data-sub-index="${sIdx}" data-field="url" value="${escapeHtml(sub.url || '')}" placeholder="URL image">`;
        } else if (sub.type === 'toggle') {
          subInput = `<input type="text" class="block-input" data-action="edit-col-sub" data-parent-index="${i}" data-col-index="${colIdx}" data-sub-index="${sIdx}" data-field="title" value="${escapeHtml(sub.title || '')}" placeholder="Titre toggle">`;
        } else {
          subInput = `<input type="text" class="block-input" data-action="edit-col-sub" data-parent-index="${i}" data-col-index="${colIdx}" data-sub-index="${sIdx}" data-field="content" value="${escapeHtml(sub.content || '')}" placeholder="Contenu...">`;
        }

        return `
          <div class="sub-block-card">
            <div class="sub-block-header">
              <span style="font-size: 10px; font-weight: 700; color: var(--accent-primary);">${subBadge}</span>
              <button type="button" class="btn-block-action btn-delete" data-action="delete-col-child" data-parent-index="${i}" data-col-index="${colIdx}" data-sub-index="${sIdx}" style="min-width: 22px; min-height: 22px; font-size: 10px;" title="Supprimer ce sous-bloc">🗑️</button>
            </div>
            ${subInput}
          </div>
        `;
      }).join('');

      fieldsHtml = `
        <div class="columns-sub-container">
          <div class="column-sub-box">
            <div class="column-sub-header">
              <span>Colonne Gauche (${col1Children.length})</span>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn btn-secondary" data-action="add-col-child" data-parent-index="${i}" data-col-index="0" data-type="heading_2" style="padding: 2px 6px; font-size: 10px; min-height: 22px;">+H2</button>
                <button type="button" class="btn btn-secondary" data-action="add-col-child" data-parent-index="${i}" data-col-index="0" data-type="image" style="padding: 2px 6px; font-size: 10px; min-height: 22px;">+Img</button>
                <button type="button" class="btn btn-secondary" data-action="add-col-child" data-parent-index="${i}" data-col-index="0" data-type="paragraph" style="padding: 2px 6px; font-size: 10px; min-height: 22px;">+P</button>
              </div>
            </div>
            ${renderColChildren(col1Children, 0) || '<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">Colonne 1 vide</div>'}
          </div>

          <div class="column-sub-box">
            <div class="column-sub-header">
              <span>Colonne Droite (${col2Children.length})</span>
              <div style="display: flex; gap: 4px;">
                <button type="button" class="btn btn-secondary" data-action="add-col-child" data-parent-index="${i}" data-col-index="1" data-type="heading_2" style="padding: 2px 6px; font-size: 10px; min-height: 22px;">+H2</button>
                <button type="button" class="btn btn-secondary" data-action="add-col-child" data-parent-index="${i}" data-col-index="1" data-type="paragraph" style="padding: 2px 6px; font-size: 10px; min-height: 22px;">+P</button>
                <button type="button" class="btn btn-secondary" data-action="add-col-child" data-parent-index="${i}" data-col-index="1" data-type="toggle" style="padding: 2px 6px; font-size: 10px; min-height: 22px;">+Tog</button>
              </div>
            </div>
            ${renderColChildren(col2Children, 1) || '<div style="font-size: 11px; color: var(--text-muted); font-style: italic;">Colonne 2 vide</div>'}
          </div>
        </div>
      `;
    }

    return `
      <div class="block-card" data-block-id="${escapeHtml(b.id || '')}">
        <div class="block-card-header">
          <div class="block-type-badge">${badge}</div>
          <div class="block-actions">
            <button type="button" class="btn-block-action" data-action="move-up" data-index="${i}" ${isFirst ? 'disabled' : ''} title="Monter ce bloc">▲</button>
            <button type="button" class="btn-block-action" data-action="move-down" data-index="${i}" ${isLast ? 'disabled' : ''} title="Descendre ce bloc">▼</button>
            <button type="button" class="btn-block-action btn-delete" data-action="delete-block" data-index="${i}" title="Supprimer ce bloc">🗑️</button>
          </div>
        </div>
        <div class="block-fields">
          ${fieldsHtml}
        </div>
      </div>
    `;
  }).join('');

  dom.templateBlocksContainer.innerHTML = html;
}

function renderLivePreview() {
  if (!dom.notionPreviewCanvas) return;
  const media = state.activeTemplateMedia;
  const mediaCfg = state.schema.mediaTypes?.[media];
  const isEnabled = mediaCfg ? mediaCfg.usePageTemplate !== false : true;
  const blocks = mediaCfg?.templateBlocks || [];
  const sample = SAMPLE_PREVIEW_DATA[media] || SAMPLE_PREVIEW_DATA.movie;
  const mode = state.previewMode || 'data';

  if (!isEnabled) {
    dom.notionPreviewCanvas.innerHTML = `
      <div class="notion-preview-disabled">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">🚫</span>
        <h3 style="margin: 0 0 6px; font-size: 15px;">Corps de page Notion désactivé</h3>
        <p style="margin: 0; font-size: 13px;">
          La génération du corps de page est désactivée pour ce média (<code>usePageTemplate = false</code>).
          Seules les colonnes et propriétés de base de données seront envoyées à Notion.
        </p>
      </div>
    `;
    return;
  }

  if (blocks.length === 0) {
    dom.notionPreviewCanvas.innerHTML = `
      <div class="notion-preview-empty">
        <span style="font-size: 36px; display: block; margin-bottom: 8px;">📄</span>
        <h3 style="margin: 0 0 6px; font-size: 15px;">Page Notion Vierge</h3>
        <p style="margin: 0; font-size: 13px;">Aucun bloc configuré dans ce modèle. Utilisez la palette pour concevoir votre fiche.</p>
      </div>
    `;
    return;
  }

  const resolveText = (text) => {
    if (!text) return '';
    if (mode === 'tokens') {
      return escapeHtml(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, '<span class="token-highlight">{{$1}}</span>');
    }
    return escapeHtml(resolveVariables(text, sample));
  };

  const renderBlockPreview = (b) => {
    if (!b || !b.type) return '';
    const colorClass = b.color ? `color-${b.color}` : '';

    switch (b.type) {
      case 'heading_1':
        return `<h1 class="notion-preview-h1 ${colorClass}">${resolveText(b.content) || '<span style="color:#666;">Titre H1</span>'}</h1>`;
      case 'heading_2':
        return `<h2 class="notion-preview-h2 ${colorClass}">${resolveText(b.content) || '<span style="color:#666;">Titre H2</span>'}</h2>`;
      case 'heading_3':
        return `<h3 class="notion-preview-h3 ${colorClass}">${resolveText(b.content) || '<span style="color:#666;">Titre H3</span>'}</h3>`;
      case 'paragraph':
        return `<p class="notion-preview-p ${colorClass}">${resolveText(b.content) || '<span style="color:#555;">(Paragraphe vide)</span>'}</p>`;
      case 'callout':
        return `
          <div class="notion-preview-callout ${colorClass}">
            <span class="callout-emoji">${escapeHtml(b.emoji || '📌')}</span>
            <div class="callout-body">${resolveText(b.content) || '<span style="color:#666;">Contenu du callout...</span>'}</div>
          </div>
        `;
      case 'image': {
        const rawUrl = b.url || b.content || '';
        if (mode === 'tokens' || !rawUrl) {
          return `
            <div class="notion-preview-img-box">
              <span>🖼️ Image Notion</span>
              <span style="font-family: monospace;">${resolveText(rawUrl) || 'URL non définie'}</span>
            </div>
          `;
        }
        const resolvedUrl = resolveVariables(rawUrl, sample).trim();
        if (resolvedUrl && (resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://'))) {
          return `
            <div class="notion-preview-img-wrapper">
              <img src="${escapeHtml(resolvedUrl)}" class="notion-preview-img" alt="Affiche" onerror="this.parentElement.innerHTML='<div class=\\'notion-preview-img-box\\'><span>🖼️ Image introuvable</span></div>'">
            </div>
          `;
        }
        return `
          <div class="notion-preview-img-box">
            <span>🖼️ Aucune image valide</span>
          </div>
        `;
      }
      case 'divider':
        return `<hr class="notion-preview-divider">`;
      case 'bullet':
      case 'bulleted_list_item':
        return `<li class="notion-preview-bullet">${resolveText(b.content) || '<span style="color:#555;">(Puce vide)</span>'}</li>`;
      case 'toggle': {
        const titleText = resolveText(b.title || b.content) || 'Toggle déroulant';
        const children = Array.isArray(b.children) && b.children.length > 0
          ? b.children.map(renderBlockPreview).join('')
          : '<div style="font-size: 12px; color: #6b7280; font-style: italic; padding: 4px 0;">(Sous-blocs vides)</div>';
        return `
          <details class="notion-preview-toggle ${colorClass}" open>
            <summary><span class="arrow">▶</span> <span>${titleText}</span></summary>
            <div class="toggle-content">${children}</div>
          </details>
        `;
      }
      case 'column_list':
      case 'columns': {
        const col1Blocks = b.columns?.[0]?.children || [];
        const col2Blocks = b.columns?.[1]?.children || [];
        return `
          <div class="notion-preview-columns">
            <div class="notion-preview-col">
              ${col1Blocks.map(renderBlockPreview).join('') || '<div style="color: #6b7280; font-size: 12px; padding: 8px; border: 1px dashed #333; border-radius: 4px;">Colonne 1 vide</div>'}
            </div>
            <div class="notion-preview-col">
              ${col2Blocks.map(renderBlockPreview).join('') || '<div style="color: #6b7280; font-size: 12px; padding: 8px; border: 1px dashed #333; border-radius: 4px;">Colonne 2 vide</div>'}
            </div>
          </div>
        `;
      }
      default:
        return '';
    }
  };

  const coverHtml = (sample.backdropUrl && mode === 'data')
    ? `<div class="notion-preview-cover" style="background-image: url('${escapeHtml(sample.backdropUrl)}');"></div>`
    : '';

  const mediaEmoji = media === 'game' ? '🎮' : (media === 'tv' ? '📺' : '🎬');
  const pageTitle = mode === 'tokens' ? '<span class="token-highlight">{{title}}</span>' : escapeHtml(sample.title);

  const headerHtml = `
    ${coverHtml}
    <div class="notion-preview-icon-badge">${mediaEmoji}</div>
    <h1 class="notion-preview-page-title">${pageTitle}</h1>
  `;

  const blocksHtml = blocks.map(renderBlockPreview).join('\n');

  dom.notionPreviewCanvas.innerHTML = headerHtml + blocksHtml;
}

export { validateSchema };




