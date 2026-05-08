import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const quiet = args.has("--quiet");

const removableDirs = [".cache", ".next/cache", ".tmp", ".turbo", "node_cache", "temp", "tmp"];
const removableFiles = [".next-dev*.log", "*.log", "npm-debug.log*", "pnpm-debug.log*", "yarn-debug.log*", "yarn-error.log*"];

function log(message) {
  if (!quiet) {
    console.log(message);
  }
}

function safeResolve(relativePath) {
  const target = path.resolve(appRoot, relativePath);
  if (target !== appRoot && !target.startsWith(`${appRoot}${path.sep}`)) {
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
  const relative = path.relative(appRoot, target) || ".";

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
  const directory = safeResolve(path.posix.dirname(pattern));
  const filePattern = globToRegExp(path.posix.basename(pattern));
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

for (const relativePath of removableDirs) {
  const target = safeResolve(relativePath);
  if (statOrNull(target)) {
    removeTarget(target);
  }
}

for (const pattern of removableFiles) {
  removeMatchingFiles(pattern);
}

log(dryRun ? "build cleanup dry-run complete" : "build cleanup complete");
