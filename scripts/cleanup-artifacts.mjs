import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const quiet = args.has("--quiet");
const keepArg = process.argv.find((arg) => arg.startsWith("--keep="));
const keepLimit = Number(keepArg?.split("=")[1] ?? process.env.ARTIFACT_KEEP_LIMIT ?? "5");

const removableDirs = [
  ".cache",
  ".tmp",
  ".turbo",
  "tmp",
  "temp",
  "web/.cache",
  "web/.next/cache",
  "web/.npm-cache",
  "web/.tmp",
  "web/.turbo",
  "web/node_cache",
  "web/tmp",
  "web/temp"
];

const removableFiles = [
  ".tmp-*.log",
  "npm-debug.log*",
  "pnpm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",
  "web/.next-dev*.log",
  "web/*.log"
];

const rotatedDirs = [
  ".deploy/releases",
  "artifacts",
  "backup",
  "backups",
  "deploy-artifacts",
  "logs",
  "web/artifacts",
  "web/logs"
];

function log(message) {
  if (!quiet) {
    console.log(message);
  }
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function safeResolve(relativePath) {
  const target = path.resolve(repoRoot, relativePath);
  if (target !== repoRoot && !target.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error(`Unsafe cleanup target: ${target}`);
  }

  return target;
}

function statOrNull(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

function removeTarget(target) {
  const relative = path.relative(repoRoot, target) || ".";

  if (dryRun) {
    log(`would remove ${relative}`);
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  log(`removed ${relative}`);
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`);
}

function removeMatchingFiles(pattern) {
  const normalized = pattern.replaceAll("\\", "/");
  const directory = safeResolve(path.posix.dirname(normalized));
  const filePattern = globToRegExp(path.posix.basename(normalized));
  const stat = statOrNull(directory);

  if (!stat?.isDirectory()) {
    return;
  }

  for (const name of fs.readdirSync(directory)) {
    if (filePattern.test(name)) {
      removeTarget(path.join(directory, name));
    }
  }
}

function rotateDirectory(relativePath) {
  const target = safeResolve(relativePath);
  const stat = statOrNull(target);

  if (!stat?.isDirectory()) {
    return;
  }

  const entries = fs
    .readdirSync(target)
    .map((name) => {
      const entryPath = path.join(target, name);
      const entryStat = statOrNull(entryPath);
      if (!entryStat || name === ".gitkeep") {
        return null;
      }

      return { name, path: entryPath, mtimeMs: entryStat.mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const entry of entries.slice(Math.max(0, keepLimit))) {
    removeTarget(entry.path);
  }
}

if (!Number.isInteger(keepLimit) || keepLimit < 0) {
  fail("Invalid keep limit. Use --keep=5 or ARTIFACT_KEEP_LIMIT=5.");
} else {
  for (const relativePath of removableDirs) {
    const target = safeResolve(relativePath);
    if (statOrNull(target)) {
      removeTarget(target);
    }
  }

  for (const pattern of removableFiles) {
    removeMatchingFiles(pattern);
  }

  for (const relativePath of rotatedDirs) {
    rotateDirectory(relativePath);
  }

  log(dryRun ? "cleanup dry-run complete" : "cleanup complete");
}
