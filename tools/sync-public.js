#!/usr/bin/env node
/*
  Regenerates ./public from the project root files.

  - Backs up existing ./public to ./public-backup-YYYYMMDD-HHMMSS
  - Copies updated HTML/JS/assets from root into new ./public
  - Optionally preserves legacy asset folders from previous public (e.g., Gilrlsimage)

  Usage:
    node tools/sync-public.js
    node tools/sync-public.js --dry-run
*/

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || args.has('-n');
// Backups are disabled by default to avoid creating public-backup-* folders.
// Pass --backup to re-enable the old behavior.
const doBackup = args.has('--backup');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function timestamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  if (dryRun) return;
  await fsp.mkdir(dirPath, { recursive: true });
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  if (dryRun) {
    console.log(`[dry-run] copy file: ${path.relative(projectRoot, src)} -> ${path.relative(projectRoot, dest)}`);
    return;
  }
  await fsp.copyFile(src, dest);
}

async function copyDir(srcDir, destDir) {
  const entries = await fsp.readdir(srcDir, { withFileTypes: true });
  await ensureDir(destDir);

  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await copyFile(srcPath, destPath);
    }
  }
}

async function removePath(targetPath) {
  if (dryRun) {
    console.log(`[dry-run] remove: ${path.relative(projectRoot, targetPath)}`);
    return;
  }
  // force: true makes it tolerant if something disappears mid-run
  await fsp.rm(targetPath, { recursive: true, force: true });
}

async function emptyDir(dirPath, { keep = [] } = {}) {
  if (!(await exists(dirPath))) return;
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (keep.includes(entry.name)) continue;
    const entryPath = path.join(dirPath, entry.name);
    await removePath(entryPath);
  }
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeBackupPublic(backupDir) {
  // Preferred path: rename is fast and preserves timestamps.
  // On Windows, rename can fail with EPERM if a file handle is open.
  try {
    if (dryRun) {
      console.log(`[dry-run] backup: public -> ${path.basename(backupDir)}`);
      return { backupDir, usedRename: true };
    }
    await fsp.rename(publicDir, backupDir);
    return { backupDir, usedRename: true };
  } catch (err) {
    const code = err && typeof err === 'object' ? err.code : undefined;
    if (code !== 'EPERM' && code !== 'EACCES') throw err;

    // Retry a few times (common with antivirus / Explorer / watchers).
    for (let i = 0; i < 5; i++) {
      await delay(200);
      try {
        await fsp.rename(publicDir, backupDir);
        return { backupDir, usedRename: true };
      } catch (e) {
        const c = e && typeof e === 'object' ? e.code : undefined;
        if (c !== 'EPERM' && c !== 'EACCES') throw e;
      }
    }

    // Fallback: copy to backup + clear existing public contents.
    await ensureDir(backupDir);
    console.log('Rename blocked (EPERM). Falling back to copy-backup + clear public/.');
    await copyDir(publicDir, backupDir);
    await emptyDir(publicDir);
    return { backupDir, usedRename: false };
  }
}

async function listTopLevelFiles(filterFn) {
  const entries = await fsp.readdir(projectRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter(filterFn);
}

async function main() {
  const backupDir = path.join(projectRoot, `public-backup-${timestamp()}`);
  const legacyDirs = ['Gilrlsimage'];

  const hasPublic = await exists(publicDir);
  let oldPublicDir = null;

  if (hasPublic) {
    if (doBackup) {
      oldPublicDir = backupDir;
      await safeBackupPublic(backupDir);
    } else {
      // Clean public/ in-place (no backup). Preserve legacy asset dirs.
      await emptyDir(publicDir, { keep: legacyDirs });
    }
  }

  await ensureDir(publicDir);

  // 1) Copy top-level HTML files
  const htmlFiles = await listTopLevelFiles((name) => name.toLowerCase().endsWith('.html'));
  for (const name of htmlFiles) {
    await copyFile(path.join(projectRoot, name), path.join(publicDir, name));
  }

  // Make introduction.html the default landing page for Firebase Hosting.
  // Firebase serves /index.html at the site root, so we overwrite it.
  const introSrc = path.join(projectRoot, 'introduction.html');
  if (await exists(introSrc)) {
    await copyFile(introSrc, path.join(publicDir, 'index.html'));
  }

  // 2) Copy top-level JS files that are part of the web app
  const topLevelJsFiles = await listTopLevelFiles((name) => {
    const lower = name.toLowerCase();
    if (!lower.endsWith('.js')) return false;
    if (lower === 'vite.config.js') return false;
    if (lower === 'index.js') return false;
    return true;
  });

  for (const name of topLevelJsFiles) {
    await copyFile(path.join(projectRoot, name), path.join(publicDir, name));
  }

  // 3) Copy asset/source directories
  const dirsToCopy = ['script.js', 'images', 'GirlsImage', 'Boysimage', '30pagesofgirls', '30pagesofboys'];
  for (const dirName of dirsToCopy) {
    const src = path.join(projectRoot, dirName);
    if (!(await exists(src))) continue;
    const stat = await fsp.stat(src);
    if (!stat.isDirectory()) continue;
    await copyDir(src, path.join(publicDir, dirName));
  }

  // 4) Preserve legacy asset folders from previous public/ if they existed.
  //    If backups are enabled, we restore legacy dirs from the backup.
  //    If backups are disabled, legacy dirs were kept in-place.
  if (oldPublicDir) {
    for (const legacy of legacyDirs) {
      const legacySrc = path.join(oldPublicDir, legacy);
      if (await exists(legacySrc)) {
        const stat = await fsp.stat(legacySrc);
        if (stat.isDirectory()) {
          await copyDir(legacySrc, path.join(publicDir, legacy));
          console.log(`Preserved legacy dir: ${legacy}`);
        }
      }
    }
  } else if (hasPublic) {
    for (const legacy of legacyDirs) {
      const legacyPath = path.join(publicDir, legacy);
      if (await exists(legacyPath)) {
        const stat = await fsp.stat(legacyPath);
        if (stat.isDirectory()) console.log(`Preserved legacy dir: ${legacy}`);
      }
    }
  }

  // 5) Basic verification
  const mustExist = ['index.html', 'login.html', 'signup.html'];
  const missing = [];
  for (const f of mustExist) {
    if (!(await exists(path.join(publicDir, f)))) missing.push(f);
  }

  if (missing.length) {
    console.warn(`WARNING: public/ is missing: ${missing.join(', ')}`);
  }

  console.log(dryRun ? 'Dry-run complete.' : 'public/ sync complete.');
  if (!dryRun && oldPublicDir) {
    console.log(`Backup created: ${path.basename(oldPublicDir)}`);
  } else if (!dryRun && hasPublic && !doBackup) {
    console.log('Backups disabled: no public-backup-* folder created.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
