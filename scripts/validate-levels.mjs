// Validates every level from the command line: `npm run validate`.
// Runs the same LevelParser + LevelValidator the game uses at load (dev), with the
// jump distance and treasure values from TUNING. Exits with code 1 if any level fails.
import { register } from 'node:module';

register('./ts-resolve-hooks.mjs', import.meta.url);

const { TUNING } = await import('../src/config.ts');
const { LEVELS } = await import('../src/levels/index.ts');
const { parseLevel } = await import('../src/systems/LevelParser.ts');
const { validateLevel, walkSeconds } = await import('../src/systems/LevelValidator.ts');

const T = TUNING.treasure;
const ts = TUNING.level.tileSize;
const secs = (tiles) => walkSeconds(tiles, ts, TUNING.movement.sneakSpeed).toFixed(0);
let failed = 0;

for (const level of LEVELS) {
  let parsed;
  try {
    parsed = parseLevel(level);
  } catch (e) {
    console.error(`✗ ${level.id}: ${e.message}`);
    failed++;
    continue;
  }
  const r = validateLevel(
    parsed,
    { coin: T.coin.value, gem: T.gem.value, chest: T.chest.value },
    { maxJumpTiles: TUNING.jump.maxJumpTiles },
  );
  const t = r.treasure;
  const head = `${level.id} "${level.name}" ${parsed.cols}x${parsed.rows}`;
  if (r.errors.length > 0) {
    failed++;
    console.error(`✗ ${head}`);
    for (const e of r.errors) console.error(`    - ${e}`);
    continue;
  }
  console.log(`✓ ${head}`);
  console.log(
    `    path ${r.shortest.length.toFixed(0)} tiles (~${secs(r.shortest.length)}s sneaking), ` +
      `${r.shortestCollapsed.length.toFixed(0)} with every floor trap dropped`,
  );
  console.log(`    treasure: ${t.coins} coins, ${t.gems} gems, ${t.chests} chests (max loot ${t.maxLoot})`);
  console.log(
    `    dragons ${parsed.dragons.length}, checkpoints ${parsed.checkpoints.length}, portal pairs ${parsed.portals.length}, ` +
      `hints ${level.hintLevel ?? TUNING.hints.defaultLevel}, spikes ${parsed.spikeTiming}`,
  );
  r.fromCheckpoints.forEach((p, i) => {
    const c = parsed.checkpoints[i];
    console.log(`    from checkpoint ${c.x},${c.y}: ${p.length.toFixed(0)} tiles to the exit`);
  });
}

if (failed > 0) {
  console.error(`\n${failed} level(s) failed validation.`);
  process.exit(1);
}
console.log(`\nAll ${LEVELS.length} levels are valid.`);
