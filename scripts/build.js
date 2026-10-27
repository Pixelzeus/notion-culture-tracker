#!/usr/bin/env node

/**
 * scripts/build.js
 * Notion Culture Tracker — Multi-Platform Packaging Pipeline
 *
 * Compiles and packages targeted Manifest V3 extension deliverables for:
 * - Google Chrome (MV3 with service_worker, no blocking webRequest)
 * - Mozilla Firefox (MV3 with background.scripts, gecko ID, webRequestBlocking)
 * - Apple Safari (MV3 with service_worker, standard WebExtension format)
 *
 * Produces unpacked extension folders in dist/<browser>/ and release archives:
 * - dist/culture-tracker-v1.5.0-chrome.zip
 * - dist/culture-tracker-v1.5.0-firefox.zip
 * - dist/culture-tracker-v1.5.0-firefox.xpi
 * - dist/culture-tracker-v1.5.0-safari.zip
 *
 * Zero external npm runtime dependencies (uses Node.js built-ins: fs, path, zlib, crypto).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Fallback CRC-32 table in case zlib.crc32 is unavailable
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function computeCRC32(buf) {
  if (typeof zlib.crc32 === 'function') {
    return zlib.crc32(buf) >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0);
}

/**
 * Creates a standard, fully reproducible PKZIP archive buffer in pure Node.js.
 * @param {Array<{ name: string, content: Buffer | string, mtime?: Date }>} entries
 * @returns {Buffer}
 */
export function createZipArchive(entries) {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  // Fixed MS-DOS timestamp (2026-10-25 12:00:00) for build reproducibility
  const dosTime = 24576; // 12:00:00
  const dosDate = 23897; // 2026-10-25

  for (const entry of sorted) {
    const normalizedName = entry.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(normalizedName, 'utf8');
    const contentBuf = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content, 'utf8');

    const uncompressedSize = contentBuf.length;
    const crc = computeCRC32(contentBuf);
    const compressedBuf = zlib.deflateRawSync(contentBuf, { level: 9 });
    const compressedSize = compressedBuf.length;

    // Local file header (30 bytes + nameBuf.length)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6);     // General purpose bit flag (bit 11 = UTF-8)
    localHeader.writeUInt16LE(8, 8);          // Compression method (8 = Deflate)
    localHeader.writeUInt16LE(dosTime, 10);   // File mod time
    localHeader.writeUInt16LE(dosDate, 12);   // File mod date
    localHeader.writeUInt32LE(crc, 14);       // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // Extra field length
    nameBuf.copy(localHeader, 30);

    localChunks.push(localHeader, compressedBuf);

    // Central directory header (46 bytes + nameBuf.length)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central file header signature
    centralHeader.writeUInt16LE(0x031E, 4);      // Version made by (UNIX 3.0)
    centralHeader.writeUInt16LE(20, 6);          // Version needed to extract (2.0)
    centralHeader.writeUInt16LE(0x0800, 8);      // General purpose bit flag (bit 11 = UTF-8)
    centralHeader.writeUInt16LE(8, 10);          // Compression method (8 = Deflate)
    centralHeader.writeUInt16LE(dosTime, 12);   // File mod time
    centralHeader.writeUInt16LE(dosDate, 14);   // File mod date
    centralHeader.writeUInt32LE(crc, 16);       // CRC-32
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);          // Extra field length
    centralHeader.writeUInt16LE(0, 32);          // File comment length
    centralHeader.writeUInt16LE(0, 34);          // Disk number start
    centralHeader.writeUInt16LE(0, 36);          // Internal file attributes
    centralHeader.writeUInt32LE(((0o100644 << 16) >>> 0), 38); // External file attributes (-rw-r--r--)
    centralHeader.writeUInt32LE(offset, 42);     // Relative offset of local header
    nameBuf.copy(centralHeader, 46);

    centralChunks.push(centralHeader);

    offset += localHeader.length + compressedBuf.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const chunk of centralChunks) {
    centralDirSize += chunk.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);          // EOCD signature
  eocd.writeUInt16LE(0, 4);                     // Disk number
  eocd.writeUInt16LE(0, 6);                     // Start disk number
  eocd.writeUInt16LE(sorted.length, 8);         // Number of central directory records on this disk
  eocd.writeUInt16LE(sorted.length, 10);        // Total central directory records
  eocd.writeUInt32LE(centralDirSize, 12);       // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);     // Offset of central directory
  eocd.writeUInt16LE(0, 20);                    // Comment length

  return Buffer.concat([...localChunks, ...centralChunks, eocd]);
}

/**
 * Computes SHA-256 hash of a buffer or string.
 * @param {Buffer | string} content
 * @returns {string} hex digest
 */
export function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Returns extension version from package.json or manifest.json.
 * @returns {string}
 */
export function getProjectVersion() {
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) return pkg.version;
    } catch (_) {}
  }
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (m.version) return m.version;
    } catch (_) {}
  }
  return '1.5.0';
}

/**
 * Generates tailored Manifest V3 JSON for the given browser target.
 * @param {'chrome' | 'firefox' | 'safari'} browser
 * @param {object} baseManifest
 * @returns {object}
 */
export function generateManifest(browser, baseManifest) {
  const manifest = JSON.parse(JSON.stringify(baseManifest));

  switch (browser) {
    case 'chrome':
      // Chrome MV3 strictly requires service_worker and forbids background.scripts
      manifest.background = {
        service_worker: 'background.js'
      };
      // Chrome MV3 forbids webRequestBlocking for standard Web Store extensions
      if (Array.isArray(manifest.permissions)) {
        manifest.permissions = manifest.permissions.filter(p => p !== 'webRequestBlocking');
      }
      // Chrome does not recognize gecko browser_specific_settings
      delete manifest.browser_specific_settings;
      break;

    case 'firefox':
      // Firefox MV3 uses background event scripts
      manifest.background = {
        scripts: ['background.js']
      };
      // Firefox MV3 retains webRequestBlocking & webRequest
      if (Array.isArray(manifest.permissions) && !manifest.permissions.includes('webRequestBlocking')) {
        manifest.permissions.push('webRequestBlocking');
      }
      // Firefox requires gecko ID
      manifest.browser_specific_settings = {
        gecko: {
          id: manifest.browser_specific_settings?.gecko?.id || 'culture-tracker-notion@pixelzeus.local',
          strict_min_version: manifest.browser_specific_settings?.gecko?.strict_min_version || '109.0'
        }
      };
      break;

    case 'safari':
      // Safari 15.4+ Web Extension supports MV3 service_worker
      manifest.background = {
        service_worker: 'background.js'
      };
      // Safari disallows webRequestBlocking
      if (Array.isArray(manifest.permissions)) {
        manifest.permissions = manifest.permissions.filter(p => p !== 'webRequestBlocking');
      }
      // Remove gecko specific settings for clean Safari WebExtension structure
      delete manifest.browser_specific_settings;
      break;

    default:
      throw new Error(`Unsupported browser target: ${browser}`);
  }

  return manifest;
}

/**
 * Collects runtime files from project directory to copy into distribution packages.
 * Excludes tests, development docs, agents, secrets, git, and sync conflicts.
 * @returns {Array<{ relativePath: string, fullPath: string }>}
 */
export function collectRuntimeFiles() {
  const runtimeFiles = [];

  const includeItems = [
    { type: 'file', rel: 'background.js' },
    { type: 'dir', rel: 'config' },
    { type: 'dir', rel: 'content' },
    { type: 'dir', rel: 'icons' },
    { type: 'dir', rel: 'options' },
    { type: 'dir', rel: 'popup' },
    { type: 'dir', rel: 'services' }
  ];

  function shouldExclude(fileName, relPath) {
    if (fileName.startsWith('.') || fileName.endsWith('.tmp') || fileName.endsWith('.bak')) return true;
    if (fileName === 'Thumbs.db' || fileName === '.DS_Store') return true;
    if (fileName.includes('sync-conflict')) return true;
    if (fileName.endsWith('.test.js') || fileName.endsWith('.spec.js')) return true;
    if (relPath.startsWith('test') || relPath.startsWith('.agents') || relPath.startsWith('scripts')) return true;
    if (relPath.startsWith('.git') || relPath.startsWith('dist') || relPath.startsWith('web-ext-artifacts')) return true;
    return false;
  }

  function walkDir(dirRel) {
    const dirFull = path.join(ROOT_DIR, dirRel);
    if (!fs.existsSync(dirFull)) return;

    const entries = fs.readdirSync(dirFull, { withFileTypes: true });
    for (const entry of entries) {
      const entryRel = path.join(dirRel, entry.name).replace(/\\/g, '/');
      if (shouldExclude(entry.name, entryRel)) continue;

      if (entry.isDirectory()) {
        walkDir(entryRel);
      } else if (entry.isFile()) {
        runtimeFiles.push({
          relativePath: entryRel,
          fullPath: path.join(ROOT_DIR, entryRel)
        });
      }
    }
  }

  for (const item of includeItems) {
    const full = path.join(ROOT_DIR, item.rel);
    if (!fs.existsSync(full)) continue;

    if (item.type === 'file') {
      const fileName = path.basename(item.rel);
      if (!shouldExclude(fileName, item.rel)) {
        runtimeFiles.push({
          relativePath: item.rel,
          fullPath: full
        });
      }
    } else if (item.type === 'dir') {
      walkDir(item.rel);
    }
  }

  return runtimeFiles;
}

/**
 * Builds an unpacked directory and zip/xpi archive for a single browser target.
 * @param {'chrome' | 'firefox' | 'safari'} browser
 * @param {object} baseManifest
 * @param {string} version
 * @returns {object} build result with artifacts and checksums
 */
export function buildBrowser(browser, baseManifest, version) {
  const browserDir = path.join(DIST_DIR, browser);
  fs.mkdirSync(browserDir, { recursive: true });

  const runtimeFiles = collectRuntimeFiles();
  const zipEntries = [];

  // Copy shared runtime files
  for (const file of runtimeFiles) {
    const targetPath = path.join(browserDir, file.relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const content = fs.readFileSync(file.fullPath);
    fs.writeFileSync(targetPath, content);

    zipEntries.push({
      name: file.relativePath,
      content
    });
  }

  // Generate and write targeted manifest.json
  const tailoredManifest = generateManifest(browser, baseManifest);
  const manifestJson = JSON.stringify(tailoredManifest, null, 2) + '\n';
  const manifestPath = path.join(browserDir, 'manifest.json');
  fs.writeFileSync(manifestPath, manifestJson, 'utf8');

  zipEntries.push({
    name: 'manifest.json',
    content: manifestJson
  });

  // Create ZIP archive
  const zipBuffer = createZipArchive(zipEntries);
  const zipName = `culture-tracker-v${version}-${browser}.zip`;
  const zipPath = path.join(DIST_DIR, zipName);
  fs.writeFileSync(zipPath, zipBuffer);
  const zipHash = sha256(zipBuffer);

  const artifacts = [
    { name: zipName, path: zipPath, size: zipBuffer.length, sha256: zipHash }
  ];

  // Firefox also creates identical .xpi package
  if (browser === 'firefox') {
    const xpiName = `culture-tracker-v${version}-firefox.xpi`;
    const xpiPath = path.join(DIST_DIR, xpiName);
    fs.writeFileSync(xpiPath, zipBuffer);
    artifacts.push({
      name: xpiName,
      path: xpiPath,
      size: zipBuffer.length,
      sha256: zipHash
    });
  }

  return {
    browser,
    unpackedDir: browserDir,
    fileCount: zipEntries.length,
    artifacts
  };
}

/**
 * Main build execution for all requested browser targets.
 * @param {Array<'chrome' | 'firefox' | 'safari'>} [targets]
 * @returns {object} results summary
 */
export function buildAll(targets) {
  const version = getProjectVersion();
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Base manifest.json not found at ${manifestPath}`);
  }
  const baseManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const activeTargets = targets && targets.length > 0 ? targets : ['chrome', 'firefox', 'safari'];
  const results = [];

  console.log('======================================================================');
  console.log(`📦 NOTION CULTURE TRACKER — MULTI-PLATFORM BUILD PIPELINE`);
  console.log(`   Version: ${version} | Targets: ${activeTargets.join(', ')}`);
  console.log(`   Output Directory: ${DIST_DIR}`);
  console.log('======================================================================\n');

  for (const browser of activeTargets) {
    console.log(`🔨 Building target: ${browser.toUpperCase()}...`);
    const result = buildBrowser(browser, baseManifest, version);
    results.push(result);
    console.log(`   📁 Unpacked folder: ${result.unpackedDir} (${result.fileCount} files)`);
    for (const art of result.artifacts) {
      console.log(`   📦 Package: ${art.name} (${(art.size / 1024).toFixed(1)} KB)`);
      console.log(`      SHA-256: ${art.sha256}`);
    }
    console.log('');
  }

  console.log('======================================================================');
  console.log('✅ BUILD COMPLETED SUCCESSFULLY');
  console.log('======================================================================');
  return { version, results };
}

/**
 * CLI Entry Point
 */
export function runCLI() {
  const args = process.argv.slice(2);
  let requestedBrowser = null;

  for (const arg of args) {
    if (arg.startsWith('--browser=')) {
      requestedBrowser = arg.split('=')[1].trim().toLowerCase();
    } else if (arg === '-b' || arg === '--browser') {
      const idx = args.indexOf(arg);
      if (idx !== -1 && args[idx + 1]) {
        requestedBrowser = args[idx + 1].trim().toLowerCase();
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/build.js [options]');
      console.log('Options:');
      console.log('  --browser=chrome|firefox|safari   Build specific browser package');
      console.log('  --help, -h                       Show help');
      process.exit(0);
    }
  }

  let targets = ['chrome', 'firefox', 'safari'];
  if (requestedBrowser) {
    if (['chrome', 'firefox', 'safari'].includes(requestedBrowser)) {
      targets = [requestedBrowser];
    } else if (requestedBrowser === 'all') {
      targets = ['chrome', 'firefox', 'safari'];
    } else {
      console.error(`❌ Unknown browser target: "${requestedBrowser}". Valid options: chrome, firefox, safari, all.`);
      process.exit(1);
    }
  }

  try {
    buildAll(targets);
    process.exit(0);
  } catch (err) {
    console.error('❌ Build failed with error:', err);
    process.exit(1);
  }
}

// Auto-run when executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runCLI();
}
