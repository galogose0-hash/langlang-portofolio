import {
  existsSync,
  readdirSync,
  renameSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { join } from "node:path";

// Next exports the static site into `out/`. The portfolio serves `porto/` as
// the site root, and this project lives at `porto/game/catur3d/`, so the page
// must be reachable at `/game/catur3d/catur3d.html`. That means the exported
// files have to sit directly in this folder (next to the source), not in `out/`.
// This script moves them up and also exposes the page as `catur3d.html`.

const root = process.cwd();
const out = join(root, "out");

// Names Next emits into `out/`. None of these exist as source files, so it is
// safe to replace older copies at the project root on every build.
const PUBLISHED = ["_next", "404", "404.html", "index.html", "index.txt", "catur3d.html"];

if (!existsSync(join(out, "index.html"))) {
  console.warn("postbuild: out/index.html not found — nothing to publish");
  process.exit(0);
}

for (const name of PUBLISHED) {
  const p = join(root, name);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}

for (const name of readdirSync(out)) {
  const src = join(out, name);
  if (name === "catur3d.html") {
    rmSync(src, { force: true });
    continue;
  }
  renameSync(src, join(root, name));
}

copyFileSync(join(root, "index.html"), join(root, "catur3d.html"));
rmSync(out, { recursive: true, force: true });

console.log("postbuild: published site to project root (incl. catur3d.html)");
