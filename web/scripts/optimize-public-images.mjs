import { readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import sharp from "sharp";

const publicDir = resolve(process.cwd(), "public");
const dryRun = process.argv.includes("--dry-run");
const keepSource = process.argv.includes("--keep-source");
const recompressWebp = process.argv.includes("--recompress-webp");
const quality = readNumberFlag("--quality", 82);
const maxWidth = readNumberFlag("--max-width", 1600);
const minSavingsBytes = readNumberFlag("--min-savings-bytes", 1024);
const sourceExtensions = new Set([".jpeg", ".jpg", ".png", ".webp"]);

async function replaceFile(sourcePath, targetPath) {
  await rm(targetPath, { force: true });
  await rename(sourcePath, targetPath);
}

function readNumberFlag(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return fallback;
  }

  const raw = process.argv[index + 1];
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function collectImages(directory, results = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectImages(fullPath, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (sourceExtensions.has(extname(entry.name).toLowerCase())) {
      results.push(fullPath);
    }
  }

  return results;
}

function webpTargetFor(filePath) {
  const extension = extname(filePath);
  return filePath.slice(0, -extension.length) + ".webp";
}

async function buildWebp(filePath, targetPath) {
  const input = await readFile(filePath);
  const image = sharp(input, { limitInputPixels: 36_000_000 }).rotate();
  const metadata = await image.metadata();

  if (metadata.width && metadata.width > maxWidth) {
    image.resize({
      width: maxWidth,
      withoutEnlargement: true
    });
  }

  await image
    .webp({
      alphaQuality: 90,
      effort: 5,
      quality,
      smartSubsample: true
    })
    .toFile(targetPath);
}

async function optimizeImage(filePath) {
  const extension = extname(filePath).toLowerCase();
  const targetPath = webpTargetFor(filePath);
  const tempPath = `${targetPath}.tmp-${process.pid}.webp`;
  const before = (await stat(filePath)).size;
  const relativePath = relative(publicDir, filePath).replace(/\\/g, "/");
  const targetRelativePath = relative(publicDir, targetPath).replace(/\\/g, "/");

  if (extension === ".webp" && !recompressWebp) {
    return { action: "kept", before, after: before, file: relativePath };
  }

  await buildWebp(filePath, tempPath);

  const after = (await stat(tempPath)).size;

  if (extension === ".webp") {
    if (after + minSavingsBytes >= before) {
      await rm(tempPath, { force: true });
      return { action: "kept", before, after, file: relativePath };
    }

    if (!dryRun) {
      await replaceFile(tempPath, filePath);
    } else {
      await rm(tempPath, { force: true });
    }

    return { action: dryRun ? "would-recompress" : "recompressed", before, after, file: relativePath };
  }

  if (!dryRun) {
    await replaceFile(tempPath, targetPath);

    if (!keepSource) {
      await rm(filePath, { force: true });
    }
  } else {
    await rm(tempPath, { force: true });
  }

  return {
    action: dryRun ? "would-convert" : "converted",
    before,
    after,
    file: relativePath,
    target: targetRelativePath
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  const images = await collectImages(publicDir);
  const results = [];

  for (const imagePath of images) {
    results.push(await optimizeImage(imagePath));
  }

  let savedBytes = 0;
  for (const result of results) {
    if (result.action === "kept") {
      continue;
    }

    savedBytes += Math.max(0, result.before - result.after);
    const suffix = result.target ? ` -> ${result.target}` : "";
    console.log(
      `${result.action}: ${result.file}${suffix} ${formatBytes(result.before)} -> ${formatBytes(result.after)}`
    );
  }

  const keptCount = results.filter((result) => result.action === "kept").length;
  console.log(
    `Image optimization ${dryRun ? "dry run " : ""}OK: ${results.length} checked, ${keptCount} already efficient, ${formatBytes(savedBytes)} potential savings.`
  );
}

main().catch((error) => {
  console.error("Image optimization failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
