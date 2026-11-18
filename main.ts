// SOLMARA — Streets of the Sun, entrypoint for make.fun gta6-01.
// Node 22, standard library only. It copies this repository's game/ and
// screenshots/ beside it into /output (or MAKEFUN_OUTPUT_DIR outside the
// grader) and writes /output/dossier.json with the vendored make.fun
// library, so the judge can read the game. Nothing here fetches anything.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's caps (from the kit's reference/gate.json): text is capped at
// 160 KiB, screenshots at 4 files of 256 KiB, game/ at 993 files and 48 MiB.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
