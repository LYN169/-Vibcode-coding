import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const appDir = join(dist, "sc-datav");

if (!existsSync(dist)) {
  throw new Error("dist directory does not exist. Run vite build first.");
}

rmSync(appDir, { recursive: true, force: true });
rmSync(join(dist, "data_mock_backup_20260524_201832"), { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });

for (const entry of readdirSync(dist, { withFileTypes: true })) {
  if (entry.name === "sc-datav") continue;
  renameSync(join(dist, entry.name), join(appDir, entry.name));
}

writeFileSync(
  join(dist, "index.html"),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/sc-datav/#/wugong"><title>武功镇国土空间规划</title><a href="/sc-datav/#/wugong">进入武功镇国土空间规划</a>\n',
  "utf8",
);
