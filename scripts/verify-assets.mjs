/**
 * Sanity checks on the SUPPLIED assets.
 *
 * These are the only files in the project that were authored elsewhere, and
 * none of them may be modified: a silent change should produce a loud failure
 * here rather than a character that animates wrongly weeks later.
 *
 * Everything else the game draws and every other noise it makes is generated
 * at runtime, which is why this list is short and why it stays short.
 */
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/**
 * Known-good digests of the assets as supplied.
 *
 * `base_rig.fbx` is byte-identical to `player.fbx` on purpose; only
 * `player.fbx` is ever loaded, and the build prunes the other from `dist`.
 */
const EXPECTED = [
  { path: 'assets/player/player.fbx', md5: '4211d040bb7098791816ad92a0accaaa' },
  { path: 'assets/player/base_rig.fbx', md5: '4211d040bb7098791816ad92a0accaaa' },
  { path: 'assets/player/green.png', md5: '67421b6f13962ead111335ff50bf58fe' },
  // The nine HUD icons, used at their real aspect ratios and never
  // regenerated. `shoe.png` is the Walkspeed upgrade's; `shop.png` is spare.
  { path: 'assets/ui/Bills.png', md5: '31b9761863c08e40c7f065a4db6a7f36' },
  { path: 'assets/ui/Pets.png', md5: '6fc55cbd9332cf90f098690ad7131b47' },
  { path: 'assets/ui/Sound.png', md5: '225e1f3bc86303e689d3d56239724aa2' },
  { path: 'assets/ui/Upgrades.png', md5: 'a66cd7a0756b236dce197af4ba44febb' },
  { path: 'assets/ui/trophy.png', md5: 'e57cb95031c6a5feb6142eb05b53e7c1' },
  { path: 'assets/ui/rebirth.png', md5: '022dccdad65f256a546d2a14baf7512a' },
  { path: 'assets/ui/shoe.png', md5: 'c5305c2301b18df2d2b4f5f57ccf5fb7' },
  { path: 'assets/ui/aura.png', md5: 'f30df632e885addc0eeae9ca2753fe9c' },
  { path: 'assets/ui/shop.png', md5: 'baf5b63cba7737b79dd63478a11768fa' },
  // The five sounds. The track is the single largest file in the build. The
  // footstep loop's name carries a space as supplied; it is referenced as
  // `robot%20steps.mp3` and never renamed.
  { path: 'assets/audio/background.mp3', md5: 'ff13ed4af40fe632cdc257a4765524dd' },
  { path: 'assets/audio/fall.mp3', md5: 'a6c361490b027a8effd0ac861936a5a7' },
  { path: 'assets/audio/jump.mp3', md5: '77c58db6921be7b0c7a61903d38bbf30' },
  { path: 'assets/audio/robot steps.mp3', md5: '4023a023528e516573e1663921432c93' },
  { path: 'assets/audio/money.mp3', md5: '029f7e89646ef250b25c95d5c2b10fcd' },
];

let failures = 0;

for (const asset of EXPECTED) {
  const full = new URL(asset.path, `file://${root.replace(/\\/g, '/')}`);
  let bytes;
  try {
    bytes = readFileSync(full);
  } catch {
    console.error(`  FAIL  ${asset.path} is missing`);
    failures += 1;
    continue;
  }
  const digest = createHash('md5').update(bytes).digest('hex');
  const size = statSync(full).size;
  if (digest !== asset.md5) {
    console.error(`  FAIL  ${asset.path} has changed (${digest})`);
    failures += 1;
  } else {
    console.log(`  ok    ${asset.path} (${size} bytes)`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} asset problem(s). The supplied files must never be modified.`);
  process.exit(1);
}
console.log('\nassets OK');
