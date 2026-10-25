#!/usr/bin/env node

/**
 * scripts/publish-release.js
 * Notion Culture Tracker — GitHub Release & Asset Publication
 *
 * Automates the release publication and multi-browser asset distribution to GitHub:
 * - Reads GitHub token from environment (GITHUB_TOKEN) or git remote URL.
 * - Targets repository Pixelzeus/notion-culture-tracker and release tag v1.5.0.
 * - Updates release title to:
 *   "Culture Tracker v1.5.0 — Multi-navigateurs (Firefox, Chrome & Safari)"
 * - Updates release body with comprehensive multi-platform changelog and 3-browser install guides.
 * - Deletes any duplicate existing release assets to prevent HTTP 422 errors.
 * - Uploads all 4 binary assets from dist/:
 *   * dist/culture-tracker-v1.5.0-chrome.zip   (application/zip)
 *   * dist/culture-tracker-v1.5.0-firefox.xpi  (application/x-xpinstall)
 *   * dist/culture-tracker-v1.5.0-firefox.zip  (application/zip)
 *   * dist/culture-tracker-v1.5.0-safari.zip   (application/zip)
 * - Verifies attached assets via GitHub REST API query.
 *
 * Zero external npm runtime dependencies (uses Node.js built-ins: https, fs, path, child_process, url).
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

export const DEFAULT_REPO = 'Pixelzeus/notion-culture-tracker';
export const DEFAULT_TAG = 'v1.5.0';
export const RELEASE_TITLE = 'Culture Tracker v1.5.0 — Multi-navigateurs (Firefox, Chrome & Safari)';

export const TARGET_ASSETS = [
  { name: 'culture-tracker-v1.5.0-chrome.zip', type: 'application/zip' },
  { name: 'culture-tracker-v1.5.0-firefox.xpi', type: 'application/x-xpinstall' },
  { name: 'culture-tracker-v1.5.0-firefox.zip', type: 'application/zip' },
  { name: 'culture-tracker-v1.5.0-safari.zip', type: 'application/zip' }
];

/**
 * Extracts GitHub Personal Access Token from CLI args, environment, or git remote URL.
 * @param {string} [explicitToken]
 * @returns {string}
 */
export function extractToken(explicitToken) {
  if (explicitToken && explicitToken.trim()) {
    return explicitToken.trim();
  }

  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    return process.env.GITHUB_TOKEN.trim();
  }

  if (process.env.GH_TOKEN && process.env.GH_TOKEN.trim()) {
    return process.env.GH_TOKEN.trim();
  }

  // Attempt to extract token from git remote URL
  try {
    const remoteUrl = execSync('git remote get-url origin', { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    // Matches https://TOKEN@github.com or https://username:TOKEN@github.com
    const match = remoteUrl.match(/https:\/\/(?:[^:]+:)?([^@]+)@github\.com/i);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  } catch (_) {
    // Try git config --get remote.origin.url
    try {
      const configUrl = execSync('git config --get remote.origin.url', { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const match = configUrl.match(/https:\/\/(?:[^:]+:)?([^@]+)@github\.com/i);
      if (match && match[1] && match[1].trim()) {
        return match[1].trim();
      }
    } catch (_) {}
  }

  throw new Error('Token GitHub manquant. Définissez GITHUB_TOKEN ou configurez le remote git origin avec le token d\'authentification.');
}

/**
 * Helper to determine appropriate MIME type for an asset filename.
 * @param {string} filename
 * @returns {string}
 */
export function getMimeType(filename) {
  if (filename.endsWith('.xpi')) {
    return 'application/x-xpinstall';
  }
  return 'application/zip';
}

/**
 * Performs an HTTPS request to the GitHub API.
 * @param {object} options https request options
 * @param {Buffer | string} [body]
 * @returns {Promise<{ statusCode: number, headers: object, data: string, json: any }>}
 */
export function githubRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      ...options,
      headers: {
        'User-Agent': 'NotionCultureTracker-Publisher',
        'Accept': 'application/vnd.github+json',
        ...(options.headers || {})
      }
    };

    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          if (raw) parsed = JSON.parse(raw);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: raw,
          json: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(body, 'utf8');
      }
    }
    req.end();
  });
}

/**
 * Retrieves release information by tag.
 * @param {string} repo
 * @param {string} tag
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function getReleaseByTag(repo, tag, token) {
  const res = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${repo}/releases/tags/${tag}`,
    method: 'GET',
    headers: {
      'Authorization': `token ${token}`
    }
  });

  if (res.statusCode !== 200) {
    throw new Error(`Failed to get release for tag "${tag}" on ${repo}: HTTP ${res.statusCode} — ${res.data}`);
  }

  return res.json;
}

/**
 * Updates release metadata (title and description).
 * @param {string} repo
 * @param {number} releaseId
 * @param {string} title
 * @param {string} body
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function updateRelease(repo, releaseId, title, body, token) {
  const payload = JSON.stringify({ name: title, body });
  const res = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${repo}/releases/${releaseId}`,
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload, 'utf8')
    }
  }, payload);

  if (res.statusCode !== 200) {
    throw new Error(`Failed to update release ${releaseId}: HTTP ${res.statusCode} — ${res.data}`);
  }

  return res.json;
}

/**
 * Deletes an asset by ID from a release.
 * @param {string} repo
 * @param {number} assetId
 * @param {string} token
 * @returns {Promise<void>}
 */
export async function deleteAsset(repo, assetId, token) {
  const res = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${repo}/releases/assets/${assetId}`,
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`
    }
  });

  if (res.statusCode !== 204 && res.statusCode !== 200) {
    throw new Error(`Failed to delete asset ${assetId}: HTTP ${res.statusCode} — ${res.data}`);
  }
}

/**
 * Uploads a binary asset to a release.
 * @param {string} uploadUrl e.g. https://uploads.github.com/repos/.../assets{?name,label}
 * @param {string} assetPath local path to file
 * @param {string} assetName name of file in release
 * @param {string} mimeType
 * @param {string} token
 * @returns {Promise<object>}
 */
export async function uploadAsset(uploadUrl, assetPath, assetName, mimeType, token) {
  const fileBuffer = fs.readFileSync(assetPath);
  const cleanUrl = uploadUrl.replace(/\{(\?|&)[^}]+\}/, '');
  const parsedUrl = new URL(cleanUrl);
  parsedUrl.searchParams.set('name', assetName);

  const res = await githubRequest({
    hostname: parsedUrl.hostname,
    path: `${parsedUrl.pathname}${parsedUrl.search}`,
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': mimeType,
      'Content-Length': fileBuffer.length
    }
  }, fileBuffer);

  if (res.statusCode !== 201) {
    throw new Error(`Failed to upload asset "${assetName}": HTTP ${res.statusCode} — ${res.data}`);
  }

  return res.json;
}

/**
 * Lists all assets currently attached to a release.
 * @param {string} repo
 * @param {number} releaseId
 * @param {string} token
 * @returns {Promise<Array<object>>}
 */
export async function listReleaseAssets(repo, releaseId, token) {
  const res = await githubRequest({
    hostname: 'api.github.com',
    path: `/repos/${repo}/releases/${releaseId}/assets`,
    method: 'GET',
    headers: {
      'Authorization': `token ${token}`
    }
  });

  if (res.statusCode !== 200) {
    throw new Error(`Failed to list assets for release ${releaseId}: HTTP ${res.statusCode} — ${res.data}`);
  }

  return res.json;
}

/**
 * Builds the comprehensive release notes content for v1.5.0.
 * Preserves the original changelog section while adding multi-platform details.
 * @returns {string}
 */
export function buildReleaseNotes() {
  return `## 🍿 Culture Tracker v1.5.0 — Multi-navigateurs (Firefox, Chrome & Safari)

Extension officielle pour importer facilement vos **Films**, **Séries** (TMDb) et **Jeux Vidéo** (TheGamesDB & Steam) dans votre espace **Notion** avec templates de page automatiques et jaquettes officielles.

### 🚀 Nouveautés de la version 1.5.0
* **Support Multi-Navigateurs Complet** : Packages Manifest V3 officiels disponibles pour **Google Chrome**, **Mozilla Firefox** et **Apple Safari**.
* **Adaptation Mobile & Tablette (UX Tactile)** : Interface responsive fluide sans débordement horizontal (largeurs <= 420px), zones tactiles confortables (>= 44x44px) et disposition empilable des formulaires sur écrans étroits (<= 380px).
* **Intégration Directe dans l'UI de Notion** : Un bouton flottant discret \`🍿 Culture Tracker\` et le raccourci \`Alt + C\` déploient un panneau latéral rétractable (460px) directement sur Notion (avec bascule 100vw sur mobile <= 480px).
* **Jeux Vidéo Multiplateformes** : Support complet de TheGamesDB et Steam avec jaquettes HD, genres, plateformes, support joueurs et templates de page (\`Game Title Here\`).
* **Films & Séries (TMDb)** : Affiches officielles, casting, dates de sortie, fournisseurs de streaming français (Netflix, Prime, Disney+...) et templates 2 colonnes avec sections dépliantes (*Pros/Cons*, *DLC*, *Guides*, *Screenshots*, *Notes*).
* **Diagnostic en 1 Clic** : Bouton \`🔍 Tester toutes les APIs\` dans les paramètres (test simultané TMDb, Notion, TheGamesDB et Steam).
* **Architecture Universelle & Modulaire** : Adaptateur universel (\`notion-adapter.js\`) et guide complet pour agents IA (\`AGENTS.md\`) pour adapter l'extension à n'importe quel template Notion.

### 📦 Fichiers Disponibles au Téléchargement
* **Google Chrome / Chromium** (Edge, Brave, Opera) : \`culture-tracker-v1.5.0-chrome.zip\` (Manifest V3 avec Service Worker)
* **Mozilla Firefox** : \`culture-tracker-v1.5.0-firefox.xpi\` et \`culture-tracker-v1.5.0-firefox.zip\` (Manifest V3 avec Event Script et Gecko ID)
* **Apple Safari** : \`culture-tracker-v1.5.0-safari.zip\` (Manifest V3 WebExtension standard, compatible macOS, iPadOS, iOS)

---

### 🛠️ Guide d'Installation par Navigateur

#### 1. Google Chrome & Chromium (Brave, Edge, Opera, Vivaldi)
1. Téléchargez et décompressez **\`culture-tracker-v1.5.0-chrome.zip\`**.
2. Dans la barre d'adresse de Chrome, accédez à \`chrome://extensions\`.
3. Activez le commutateur **« Mode développeur »** (*Developer mode*) en haut à droite.
4. Cliquez sur le bouton **« Charger l'extension non empaquetée »** (*Load unpacked*).
5. Sélectionnez le dossier décompressé de l'extension.

#### 2. Mozilla Firefox
1. Téléchargez le fichier **\`culture-tracker-v1.5.0-firefox.xpi\`** ou **\`culture-tracker-v1.5.0-firefox.zip\`**.
2. Dans Firefox, accédez à \`about:debugging#/runtime/this-firefox\`.
3. Cliquez sur **« Charger un module temporaire... »** (*Load Temporary Add-on*).
4. Sélectionnez le fichier \`.xpi\` téléchargé (ou le fichier \`manifest.json\` extrait de l'archive zip).

#### 3. Apple Safari (macOS, iPadOS & iOS)
1. Téléchargez et décompressez **\`culture-tracker-v1.5.0-safari.zip\`**.
2. Dans Safari, ouvrez **Réglages** > **Avancé** et cochez **« Afficher les fonctionnalités pour les développeurs web »**.
3. Dans le menu **Développement**, cochez **« Autoriser les extensions non signées »**.
4. Vous pouvez charger le dossier décompressé ou utiliser l'outil de conversion Xcode :
   \`\`\`bash
   xcrun safari-web-extension-converter path/to/unpacked-safari --app-name "Culture Tracker"
   \`\`\`
`;
}

/**
 * Main publisher orchestration function.
 * @param {object} options
 * @returns {Promise<object>} publication summary
 */
export async function publishRelease(options = {}) {
  const repo = options.repo || DEFAULT_REPO;
  const tag = options.tag || DEFAULT_TAG;
  const isDryRun = Boolean(options.dryRun);
  const token = extractToken(options.token);

  console.log('======================================================================');
  console.log('🚀 NOTION CULTURE TRACKER — GITHUB RELEASE PUBLISHER');
  console.log(`   Repository: ${repo} | Tag: ${tag} | Dry Run: ${isDryRun ? 'YES' : 'NO'}`);
  console.log('======================================================================\n');

  // Step 1: Verify dist directory and assets
  console.log('🔍 Checking local build artifacts in dist/...');
  for (const asset of TARGET_ASSETS) {
    const assetPath = path.join(DIST_DIR, asset.name);
    if (!fs.existsSync(assetPath)) {
      throw new Error(`Asset not found: ${assetPath}. Please run "npm.cmd run build" first.`);
    }
    const stat = fs.statSync(assetPath);
    console.log(`   ✔ Found ${asset.name} (${stat.size} bytes, ${asset.type})`);
  }
  console.log('');

  // Step 2: Fetch existing release on GitHub
  console.log(`📡 Fetching release ${tag} from https://api.github.com/repos/${repo}...`);
  const release = await getReleaseByTag(repo, tag, token);
  console.log(`   ✔ Found release ID ${release.id}: "${release.name}"`);
  console.log(`   ✔ Upload URL: ${release.upload_url}`);
  const existingAssets = release.assets || [];
  console.log(`   ✔ Existing attached assets (${existingAssets.length}):`);
  for (const a of existingAssets) {
    console.log(`      - ID ${a.id}: ${a.name} (${a.size} bytes)`);
  }
  console.log('');

  // Step 3: Update Release Title and Body
  console.log(`📝 Updating release metadata on GitHub...`);
  const newNotes = buildReleaseNotes();
  if (isDryRun) {
    console.log(`   [DRY RUN] Skipping PATCH /repos/${repo}/releases/${release.id}`);
  } else {
    const updated = await updateRelease(repo, release.id, RELEASE_TITLE, newNotes, token);
    console.log(`   ✔ Release title updated to: "${updated.name}"`);
    console.log(`   ✔ Release notes updated (${Buffer.byteLength(newNotes, 'utf8')} bytes)`);
  }
  console.log('');

  // Step 4: Upload Assets (cleaning duplicate existing assets first)
  console.log(`📦 Publishing ${TARGET_ASSETS.length} assets to release ${release.id}...`);
  const uploadedResults = [];

  for (const target of TARGET_ASSETS) {
    const assetPath = path.join(DIST_DIR, target.name);
    const existing = existingAssets.find((a) => a.name === target.name);

    if (existing) {
      console.log(`   ♻ Found existing asset ${target.name} (ID: ${existing.id}). Deleting before upload...`);
      if (isDryRun) {
        console.log(`   [DRY RUN] Skipping DELETE /repos/${repo}/releases/assets/${existing.id}`);
      } else {
        await deleteAsset(repo, existing.id, token);
        console.log(`   ✔ Deleted duplicate asset ${existing.id}`);
      }
    }

    console.log(`   ⬆ Uploading ${target.name} (${target.type})...`);
    if (isDryRun) {
      console.log(`   [DRY RUN] Skipping POST upload of ${target.name}`);
      uploadedResults.push({
        id: existing ? existing.id : 999999999,
        name: target.name,
        size: fs.statSync(assetPath).size,
        browser_download_url: `https://github.com/${repo}/releases/download/${tag}/${target.name}`,
        dryRun: true
      });
    } else {
      const uploadRes = await uploadAsset(release.upload_url, assetPath, target.name, target.type, token);
      console.log(`   ✔ Uploaded successfully! ID: ${uploadRes.id} (${uploadRes.size} bytes)`);
      console.log(`     Download URL: ${uploadRes.browser_download_url}`);
      uploadedResults.push(uploadRes);
    }
  }
  console.log('');

  // Step 5: Verification of all assets attached to release
  console.log('🔍 Verifying final release asset list on GitHub...');
  let finalAssets = [];
  if (isDryRun) {
    console.log('   [DRY RUN] Simulating final assets list verification:');
    finalAssets = uploadedResults;
  } else {
    finalAssets = await listReleaseAssets(repo, release.id, token);
  }

  console.log(`\n======================================================================`);
  console.log(`🎉 RELEASE PUBLICATION SUMMARY`);
  console.log(`   Tag: ${tag}`);
  console.log(`   Title: ${RELEASE_TITLE}`);
  console.log(`   Total Assets on Release: ${finalAssets.length}`);
  console.log('----------------------------------------------------------------------');
  for (const a of finalAssets) {
    console.log(`   * ${a.name.padEnd(38)} | ID: ${String(a.id).padEnd(10)} | Size: ${String(a.size).padStart(6)} bytes | URL: ${a.browser_download_url}`);
  }
  console.log('======================================================================\n');

  return {
    releaseId: release.id,
    title: RELEASE_TITLE,
    uploaded: uploadedResults,
    finalAssets
  };
}

/**
 * CLI Entry Point
 */
export async function runCLI() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    token: null,
    repo: DEFAULT_REPO,
    tag: DEFAULT_TAG
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--token=')) {
      options.token = arg.split('=')[1].trim();
    } else if (arg.startsWith('--repo=')) {
      options.repo = arg.split('=')[1].trim();
    } else if (arg.startsWith('--tag=')) {
      options.tag = arg.split('=')[1].trim();
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/publish-release.js [options]');
      console.log('Options:');
      console.log('  --dry-run          Simulate publication without modifying GitHub release');
      console.log('  --token=<token>    Specify GitHub Personal Access Token (defaults to env or git remote)');
      console.log('  --repo=<user/repo> GitHub repository (defaults to Pixelzeus/notion-culture-tracker)');
      console.log('  --tag=<tag>        Release tag to target (defaults to v1.5.0)');
      console.log('  --help, -h         Show this help message');
      process.exit(0);
    }
  }

  try {
    await publishRelease(options);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Release publication failed with error:', err.message || err);
    process.exit(1);
  }
}

// Auto-run when executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runCLI();
}
