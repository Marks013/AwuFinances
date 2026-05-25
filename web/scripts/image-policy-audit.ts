import { readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const publicDir = resolve(process.cwd(), "public");
const maxWebpKilobytes = Number.parseInt(process.env.IMAGE_POLICY_MAX_WEBP_KB ?? "220", 10);
const maxWebpBytes = maxWebpKilobytes * 1024;
const forbiddenRasterExtensions = new Set([".jpeg", ".jpg", ".png"]);

type Finding = {
  file: string;
  message: string;
};

async function collectFiles(directory: string, results: string[] = []) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(fullPath, results);
      continue;
    }

    if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function main() {
  const files = await collectFiles(publicDir);
  const findings: Finding[] = [];

  for (const filePath of files) {
    const extension = extname(filePath).toLowerCase();
    const file = relative(process.cwd(), filePath).replace(/\\/g, "/");

    if (forbiddenRasterExtensions.has(extension)) {
      findings.push({
        file,
        message: "Use WebP para imagens publicas de conteudo. PNG/JPG so devem ficar em app/icon.png, app/apple-icon.png e favicon.ico."
      });
      continue;
    }

    if (extension === ".webp") {
      const fileStats = await stat(filePath);
      if (fileStats.size > maxWebpBytes) {
        findings.push({
          file,
          message: `WebP muito pesado (${formatBytes(fileStats.size)}). Otimize ou reduza dimensoes para ficar abaixo de ${maxWebpKilobytes} KB.`
        });
      }
    }
  }

  if (findings.length === 0) {
    console.log(`Image policy audit OK: ${files.length} arquivo(s) em public, WebP ate ${maxWebpKilobytes} KB.`);
    return;
  }

  console.error(`Image policy audit failed: ${findings.length} problema(s).`);
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.message}`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Image policy audit failed");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
