# SOLMARA — Streets of the Sun

[![make.fun](https://make.fun/badge.svg)](https://make.fun/c/gta6-01)

An original 2D top-down open-world crime game for make.fun's **gta6-01**
("Make GTA 6") competition. Dario Reyes is back in the fictional sun-soaked
city of Solmara — broke, owed, and out of options. Mama Rosa has five jobs
for him: steal cars, outrun the Solmara police, and pay off the debt.

## Play

Serve `game/` with any static server (or `node serve.ts`) and open
`game/index.html` in desktop Chrome. No build step, no network requests.

- **WASD / arrows** — move / drive · **Shift** — run
- **E** — enter / steal a car, get out again
- **F** — punch · **Space** or **click** — shoot
- **P / Esc** — pause · **M** — mute

## What's in the game

- A 3600×3600 open city on an 8×8 road grid: Palmera Park, South Beach,
  the docks, Rosa's Garage, the First Bank of Solmara, Hotel Miramonte
- Traffic and pedestrians, cars to steal and drive, wanted stars (0–5)
  with police cruisers that chase, ram, and bust you
- 5 story missions from Mama Rosa, with timers, rewards, and a finale
- Punch and shoot combat, rival gang members, health, cash, ammo
- HUD with minimap, objective arrow, toasts, and a localStorage save
- Fully synthesised WebAudio sound and music — no audio files

## Layout

- `game/index.html` — the playable page; `game/src/` — the 14 game modules
  (`config`, `random`, `input`, `audio`, `city`, `traffic`, `police`,
  `missions`, `player`, `world`, `render`, `shots`, `save`, `main`)
- `main.ts` — the make.fun entrypoint (copies `game/` + `screenshots/` and
  writes `dossier.json`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — real renders of this game's own code

Everything — city, characters, vehicles, names, story, art, sound and
music — is original to this game. Nothing is taken from any commercial game.

## License

MIT — see `LICENSE`.
