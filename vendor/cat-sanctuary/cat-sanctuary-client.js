// Obsidian Prism — Channel 8 Multi-Cat Sanctuary Client Runtime
// 4 distinct pixel-art cat breeds sharing a single unified px: 1.5 Retina grid (0 Mixels):
// - pusheen (Chonky Silver Tabby, 28x24 -> 42x36px): loaf, belly-roll, big yawn, greedy bowl munch, squishy pet bounce
// - ginger  (Tiny Ginger Kitten,  20x21 -> 30x32px): bouncy hop-trot, butt-wiggle + butterfly pounce, cozy cuddle
// - calico  (Fluffy Calico,       26x25 -> 39x38px): heterochromia eyes, plume tail, face groom, elegant big stretch
// - ragdoll (Slender Siamese,     24x27 -> 36x41px): tall pointed ears, cocoa mask, coral bow, strut, post-scratch frenzy, head-tilt
// Preserves: dark-theme crisp outer halo, 0Hz blur/hidden/peek pause, full VRAM reclaim, 13-signal semantics, __agPrismCatRimState.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const PX = 1.5;
  const PAD_X = 1;
  const HEADROOM_ROWS = 8; // 12px top transparent headroom for floating symbols
  const IDLE_NAP_AFTER_MS = 30000;
  const DARK_HALO_COLOR = 'rgba(216, 212, 248, 0.46)';

  // Helper: guarantee exact uniform (cols x rows) grid bottom-aligned so feet are always flush on row (rows-1)
  function normPose(lines, cols, rows) {
    const out = [];
    const padTop = Math.max(0, rows - lines.length);
    const blank = '.'.repeat(cols);
    for (let i = 0; i < padTop; i++) out.push(blank);
    for (let i = 0; i < lines.length && out.length < rows; i++) {
      const s = lines[i];
      out.push(s.length >= cols ? s.slice(0, cols) : s + '.'.repeat(cols - s.length));
    }
    while (out.length < rows) out.push(blank);
    return out;
  }

  function buildPoseMap(cols, rows, rawDict) {
    const map = Object.create(null);
    for (const [k, lines] of Object.entries(rawDict)) {
      map[k] = normPose(lines, cols, rows);
    }
    return map;
  }

  // ── 1. PUSHEEN: Chonky Silver-Grey American Shorthair Tabby (26x16 body -> 28x24 = 42x36px) ──
  const PUSHEEN_POSES = buildPoseMap(26, 16, {
    standA: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      '.O##o###s###o###O.........',
      'O##p##o#p#o##p##OO....OO..',
      'O######bbb##s#s##O...O#sO.',
      'O####bbbbbb#s#s##O..O#s##O',
      'O###bbbbbbbb##s##O.O##s#O.',
      'O##bbbbbbbbb#s###OO#s##O..',
      'O##bbbbbbbbbb#####s###O...',
      'O###bbbbbbbbbb#######O....',
      '.O###bbbbbbbb#######O.....',
      '..OOw#O#w####O#w#OwO......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    standB: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      '.O##o###s###o###O.........',
      'O##p##o#p#o##p##OO........',
      'O######bbb##s#s##O...OO...',
      'O####bbbbbb#s#s##O..O#sO..',
      'O###bbbbbbbb##s##O.O#s##O.',
      'O##bbbbbbbbb#s###OO##s#O..',
      'O##bbbbbbbbbb#####s###O...',
      'O###bbbbbbbbbb#######O....',
      '.O###bbbbbbbb#######O.....',
      '..OOw#O#w####O#w#OwO......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    blink: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      '.O#oo###s###oo##O.........',
      'O##p##o#p#o##p##OO....OO..',
      'O######bbb##s#s##O...O#sO.',
      'O####bbbbbb#s#s##O..O#s##O',
      'O###bbbbbbbb##s##O.O##s#O.',
      'O##bbbbbbbbb#s###OO#s##O..',
      'O##bbbbbbbbbb#####s###O...',
      'O###bbbbbbbbbb#######O....',
      '.O###bbbbbbbb#######O.....',
      '..OOw#O#w####O#w#OwO......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    earL: [
      '..........OO..............',
      '...OO....O##O.............',
      '..O##OOOO#ss#O............',
      '.O###s#s##s#s###O.........',
      '.O##o###s###o###O.........',
      'O##p##o#p#o##p##OO....OO..',
      'O######bbb##s#s##O...O#sO.',
      'O####bbbbbb#s#s##O..O#s##O',
      'O###bbbbbbbb##s##O.O##s#O.',
      'O##bbbbbbbbb#s###OO#s##O..',
      'O##bbbbbbbbbb#####s###O...',
      'O###bbbbbbbbbb#######O....',
      '.O###bbbbbbbb#######O.....',
      '..OOw#O#w####O#w#OwO......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    walk1: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      '.O##o###s###o###O.........',
      'O##p##o#p#o##p##OO...OO...',
      'O######bbb##s#s##O..O#sO..',
      'O####bbbbbb#s#s##O.O#s##O.',
      'O###bbbbbbbb##s##OO##s#O..',
      'O##bbbbbbbbb#s####s###O...',
      'O##bbbbbbbbbb########O....',
      'O###bbbbbbbbbb######O.....',
      '.O###bbbbbbbb######O......',
      '..OwwO.O#w###O#w#.OwwO....',
      '..OO...OwwO..OwwO..OO.....',
      '........OO....OO..........',
    ],
    walk2: [
      '..........................',
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      '.O##o###s###o###O.........',
      'O##p##o#p#o##p##OO....OO..',
      'O######bbb##s#s##O...O#sO.',
      'O####bbbbbb#s#s##O..O#s##O',
      'O###bbbbbbbb##s##O.O##s#O.',
      'O##bbbbbbbbb#s###OO#s##O..',
      'O##bbbbbbbbbb#####s###O...',
      '.O###bbbbbbbb########O....',
      '..OOw#O#wwO..OwwO#w#O.....',
      '....OwwO.OO..OO.OwwO......',
      '.....OO..........OO.......',
    ],
    sitA: [
      '.....OO......OO...........',
      '....O##O....O##O..........',
      '...O#ssOOOOOOss#O.........',
      '..O###s#s##s#s###O........',
      '..O##o###s###o###O........',
      '.O##p##o#p#o##p###O.......',
      '.O#####s###s######O...OO..',
      'O###bbbbbbbb####s##O.O#sO.',
      'O##bbbbbbbbbb##s###OO#s##O',
      'O##bbbbbbbbbb##s####s##O..',
      'O##bbbbbbbbbb#####s###O...',
      'O##bbbbbbbbbb########O....',
      'O###bbbwwbbwwbbb####O.....',
      '.O##O#wwO##Oww#O###O......',
      '.O##O#wwO##Oww#O###O......',
      '..OOOOOOOOOOOOOOOOO.......',
    ],
    sitB: [
      '.....OO......OO...........',
      '....O##O....O##O..........',
      '...O#ssOOOOOOss#O.........',
      '..O###s#s##s#s###O........',
      '..O##o###s###o###O........',
      '.O##p##o#p#o##p###O.......',
      '.O#####s###s######O.......',
      'O###bbbbbbbb####s##O..OO..',
      'O##bbbbbbbbbb##s###O.O#sO.',
      'O##bbbbbbbbbb##s####O#s##O',
      'O##bbbbbbbbbb#####s###s#O.',
      'O##bbbbbbbbbb########OO...',
      'O###bbbwwbbwwbbb####O.....',
      '.O##O#wwO##Oww#O###O......',
      '.O##O#wwO##Oww#O###O......',
      '..OOOOOOOOOOOOOOOOO.......',
    ],
    loaf1: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      'O###oo###s###oo##OO.......',
      'O##p###o#p#o###p##sO..OO..',
      'O##bb###s###s######O.O#sO.',
      'O#bbbb######s#####sOO##O..',
      'O#bbbbbb###s#######s##O...',
      '.O##bbbbbbbb#########O....',
      '..OOOOOOOOOOOOOOOOOOO.....',
    ],
    loaf2: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      'O###oo###s###oo##OO.......',
      'O##p###o#p#o###p##sO......',
      'O##bb###s###s######O...OO.',
      'O#bbbb######s#####sO..O#sO',
      'O#bbbbbb###s#######OO##O..',
      '.O##bbbbbbbb#########O....',
      '..OOOOOOOOOOOOOOOOOOO.....',
    ],
    belly1: [
      '.........OO....OO.........',
      '..OO....OwwO..OwwO...OO...',
      '.O##O...O##O..O##O..O#sO..',
      'O#ssOOOOO##OOOO##OOO#s##O.',
      'O#o##o##bbbbbbbbbb###s#O..',
      'O#p#p###bbbbbbbbbbb###O...',
      'O######bbbbbbbbbbbb##O....',
      '.O####bbbbbbbbbbbb##O.....',
      '..O####s####s####s#O......',
      '...OOOOOOOOOOOOOOOO.......',
    ],
    belly2: [
      '........OO......OO........',
      '..OO...OwwO....OwwO.......',
      '.O##O..O##O....O##O...OO..',
      'O#ssOOOO##OOOOOO##OO.O#sO.',
      'O#o##o##bbbbbbbbbb##O#s##O',
      'O#p#p###bbbbbbbbbbb###s#O.',
      'O######bbbbbbbbbbbb###OO..',
      '.O####bbbbbbbbbbbb##O.....',
      '..O####s####s####s#O......',
      '...OOOOOOOOOOOOOOOO.......',
    ],
    yawn1: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O##o#s#s##s#o##O.........',
      'O##o##o#s##o##o##O........',
      'O##p####uu####p##OO...OO..',
      'O######uuuu######O...O#sO.',
      'O####bb#uu#bs#s##O..O#s##O',
      'O###bbbbbbbb##s##O.O##s#O.',
      'O##bbbbbbbbb#s###OO#s##O..',
      'O##bbbbbbbbbb#####s###O...',
      'O###bbbbbbbbbb#######O....',
      '.O###bbbbbbbb#######O.....',
      '..OOw#O#w####O#w#OwO......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    yawn2: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      'O##oo###s###oo###O........',
      'O##p####uu####p##OO...OO..',
      'O######bbb##s#s##O...O#sO.',
      'O####bbbbbb#s#s##O..O#s##O',
      'O###bbbbbbbb##s##O.O##s#O.',
      'O##bbbbbbbbb#s###OO#s##O..',
      'O##bbbbbbbbbb#####s###O...',
      'O###bbbbbbbbbb#######O....',
      '.O###bbbbbbbb#######O.....',
      '..OOw#O#w####O#w#OwO......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    squish: [
      '....OO........OO..........',
      '...O##O......O##O.........',
      '..O#ssOOOOOOOOss#O........',
      '.O##o##s#s##s##o##OO......',
      'O##o#o##s###s#o#o###OO.OO.',
      'O#ppp###o#p#o###ppp###O#sO',
      'O##bbbb#s###s##s######s##O',
      'O#bbbbbbbb###s######s###O.',
      'O##bbbbbbbbbb##########O..',
      '.OOwwO#bbbbbbbb###OwwOO...',
      '..OOOOOOOOOOOOOOOOOOOO....',
    ],
    happy: [
      '....OO......OO............',
      '...O##O....O##O......OO...',
      '..O#ssOOOOOOss#O....O#sO..',
      '.O###s#s##s#s###O..O#s##O.',
      '.O##o######o####O.O##s#O..',
      'O##o#o####o#o###OO#s##O...',
      'O#pp###o#p#o##pp#s###O....',
      'O####sssssss########O.....',
      'O##bb#########s####O......',
      'O#bbbb######s#####O.......',
      'O#bbbbbb###s######O.......',
      'O##bbbbbbbb#######O.......',
      '.O##bbbbbbbb#####O........',
      '..OOw#O#w###O#w#OwO.......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    eat1: [
      '...................OO.....',
      '..................O#sO....',
      '.................O#s##O...',
      '...OO.....OO....O##s#O....',
      '..O##O...O##OOOO#s##O.....',
      '.O#ssOOOOO#ss###s##O......',
      'O###s#s####s######O.......',
      'O#oo###s###oo#####O.......',
      'O#ppp#o#p#o#ppp##O........',
      'O##bbbb######bb##O........',
      '.O#bbbbbbbbbbbb#O.........',
      '..OOw#O#w###O#w#OwO.......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    eat2: [
      '....................OO....',
      '...................O#sO...',
      '..................O#s##O..',
      '.................O##s#O...',
      '...OO.....OO....O#s##O....',
      '..O##O...O##OOOO#s##O.....',
      '.O#ssOOOOO#ss###s##O......',
      'O###s#s####s######O.......',
      'O#oo###s###oo#####O.......',
      'O#ppp#o#p#o#ppp##O........',
      '.O#bbbbbbbbbbbb#O.........',
      '..OOw#O#w###O#w#OwO.......',
      '...OwwOwwO..OwwOwwO.......',
      '....OO.OO....OO.OO........',
    ],
    sleep1: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s##OOOO.......',
      'O##oo###s###oo##s##OO.....',
      'O##p##o#p#o##p##s####O....',
      'O####################O.OO.',
      'O###bbbbbbbbbbbbb###OO#sO.',
      'O###bbbbbbbbbbbbb###O##O..',
      '.O###bbbbbbbbbbbb##OOO....',
      '..OOOOOOOOOOOOOOOOOO......',
    ],
    sleep2: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#OOOO.......',
      '.O###s#s##s#s####s#OO.....',
      'O##oo###s###oo###s###O....',
      'O##p##o#p#o##p#######O....',
      'O####################O.OO.',
      'O###bbbbbbbbbbbbb###OO#sO.',
      'O###bbbbbbbbbbbbb###O##O..',
      '.O###bbbbbbbbbbbb##OOO....',
      '..OOOOOOOOOOOOOOOOOO......',
    ],
    wave1: [
      '.....OO......OO...........',
      '....O##O....O##O..........',
      '...O#ssOOOOOOss#O.........',
      '..O###s#s##s#s###O........',
      '..O##o###s###o###O........',
      '.O##p##o#p#o##p###O...OO..',
      '.O#####s###s######O..O#sO.',
      '.OO###bbbbbb####s##OO#s##O',
      'Oww###bbbbbbbb##s####s##O.',
      'OwwO##bbbbbbbb#####s###O..',
      '.OO.##bbbbbbbb########O...',
      '.O####bbbwwbbwwbbb###O....',
      '..O###O#wwO##Oww#O##O.....',
      '..O###O#wwO##Oww#O##O.....',
      '...OOOOOOOOOOOOOOOOO......',
    ],
    wave2: [
      '.....OO......OO...........',
      '....O##O....O##O..........',
      '...O#ssOOOOOOss#O.........',
      '..O###s#s##s#s###O........',
      '..O##o###s###o###O........',
      '.O##p##o#p#o##p###O.......',
      'OO#####s###s######O...OO..',
      'Oww###bbbbbb####s##O.O#sO.',
      'OwwO##bbbbbbbb##s###O#s##O',
      '.OO.##bbbbbbbb#####s##s#O.',
      'O#####bbbbbbbb#######OO...',
      '.O####bbbwwbbwwbbb###O....',
      '..O###O#wwO##Oww#O##O.....',
      '..O###O#wwO##Oww#O##O.....',
      '...OOOOOOOOOOOOOOOOO......',
    ],
    dangle: [
      '....OO......OO............',
      '...O##O....O##O...........',
      '..O#ssOOOOOOss#O..........',
      '.O###s#s##s#s###O.........',
      '.O#oo###s###oo##O.........',
      'O##p##o#p#o##p##O.........',
      'O################O........',
      '.O#O##bbbbbb##O#O.........',
      '.OwwO#bbbbbb#OwwO....OO...',
      '..O###bbbbbb###O....O#sO..',
      '..O###bbbbbb###OO..O#s##O.',
      '..O############OO#s##O....',
      '...O#O......O#OO#s#O......',
      '...OwwO....OwwO.OO........',
      '...OOO......OOO...........',
      '..........................',
    ],
  });

  // ── 2. GINGER: Tiny Energetic Ginger Kitten (18x13 body -> 20x21 = 30x32px) ──
  const GINGER_POSES = buildPoseMap(18, 13, {
    standA: [
      '..OO....OO........',
      '.O##O..O##O....OO.',
      '.O#sOOOO#sO...O#sO',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..OObbbbOOOO.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '...O#w#O#w#w#O....',
      '...OwwO.OwwOwO....',
      '....OO...OO.OO....',
    ],
    standB: [
      '..OO....OO........',
      '.O##O..O##O...OO..',
      '.O#sOOOO#sO..O#sO.',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..OObbbbOOOO.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '...O#w#O#w#w#O....',
      '...OwwO.OwwOwO....',
      '....OO...OO.OO....',
    ],
    blink: [
      '..OO....OO........',
      '.O##O..O##O....OO.',
      '.O#sOOOO#sO...O#sO',
      'O###s##s###O..O##O',
      'O##########O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..OObbbbOOOO.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '...O#w#O#w#w#O....',
      '...OwwO.OwwOwO....',
      '....OO...OO.OO....',
    ],
    earL: [
      '........OO........',
      '.OO....O##O....OO.',
      'O##OOOO#s#O...O#sO',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..OObbbbOOOO.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '...O#w#O#w#w#O....',
      '...OwwO.OwwOwO....',
      '....OO...OO.OO....',
    ],
    hop1: [
      '..................',
      '..OO....OO........',
      '.O##O..O##O...OO..',
      '.O#sOOOO#sO..O#sO.',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pOO.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb######O...',
      '..OwwO#w##OwwO....',
      '..OO..OwwO.OO.....',
      '.......OO.........',
    ],
    hop2: [
      '..OO....OO.....OO.',
      '.O##O..O##O...O#sO',
      '.O#sOOOO#sO...O##O',
      'O###s##s###O..O#sO',
      'O#wo####wo#O..O##O',
      'O#oo#p##oo#O.O#sO.',
      '.O#pbbbb#pOO.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb######O...',
      '.OwwO....OwwOwO...',
      '.OO.......OO.OO...',
      '..................',
      '..................',
    ],
    sitA: [
      '...OO....OO.......',
      '..O##O..O##O......',
      '..O#sOOOO#sO...OO.',
      '.O###s##s###O.O#sO',
      '.O#wo####wo#O.O##O',
      '.O#oo#p##oo#O.O#sO',
      '..O#pbbbb#pO..O##O',
      '..O#bbbbbb##OO##O.',
      '..O#bbbbbb#####O..',
      '..O##bbbb#####O...',
      '..O#ww#ww#####O...',
      '..O#wwOwwO###O....',
      '...OOOOOOOOOO.....',
    ],
    sitB: [
      '...OO....OO.......',
      '..O##O..O##O......',
      '..O#sOOOO#sO..OO..',
      '.O###s##s###OO#sO.',
      '.O#wo####wo#O.O##O',
      '.O#oo#p##oo#O.O#sO',
      '..O#pbbbb#pO..O##O',
      '..O#bbbbbb##OO##O.',
      '..O#bbbbbb#####O..',
      '..O##bbbb#####O...',
      '..O#ww#ww#####O...',
      '..O#wwOwwO###O....',
      '...OOOOOOOOOO.....',
    ],
    wiggle1: [
      '..............OO..',
      '.............O#sO.',
      '.............O##O.',
      '..OO....OO..O#sO..',
      '.O##O..O##O.O##O..',
      '.O#sOOOO#sOO#sO...',
      'O###s##s####s#O...',
      'O#wo####wo####O...',
      'O#oo#p##oo####O...',
      '.O#pbbbb#p###O....',
      'OwwObbbb##OwwO....',
      'OOO.OOOOO..OO.....',
    ],
    wiggle2: [
      '...............OO.',
      '..............O#sO',
      '..............O##O',
      '.............O#sO.',
      '..OO....OO..O##O..',
      '.O##O..O##OO#sO...',
      '.O#sOOOO#s##s#O...',
      'O###s##s######O...',
      'O#wo####wo####O...',
      'O#oo#p##oo###O....',
      'OwwObbbb##OwwO....',
      'OOO.OOOOO..OO.....',
    ],
    pounce: [
      '..OO....OO.....OO.',
      '.O##O..O##O...O#sO',
      '.O#sOOOO#sO..O##O.',
      'O###s##s###OO#sO..',
      'O#wo####wo###O....',
      'O#oo#p##oo###O....',
      'Owwpbbbb####O.....',
      'OO.O#bbb####O.....',
      '....OOOOOOwwO.....',
      '..........OO......',
      '..................',
      '..................',
    ],
    happy: [
      '..OO....OO.....OO.',
      '.O##O..O##O...O#sO',
      '.O#sOOOO#sO...O##O',
      'O###s##s###O..O#sO',
      'O##o####o##O..O##O',
      'O#o#o##o#o#O..O#sO',
      '.O#pbbpbbpO..O##O.',
      '..OObbbbOOOOO##O..',
      '..O#bbbb#####OO...',
      '..O##bbb#####O....',
      '...O#w#O#w#w#O....',
      '...OwwO.OwwOwO....',
      '....OO...OO.OO....',
    ],
    eat1: [
      '..............OO..',
      '.............O#sO.',
      '..OO....OO...O##O.',
      '.O##O..O##O.O#sO..',
      '.O#sOOOO#sOO##O...',
      'O###s##s#####O....',
      'O#oo#p##oo###O....',
      'O#pbbbb#p###O.....',
      '.O#bbbb#####O.....',
      '..O#w#O#w#w#O.....',
      '..OwwO.OwwOwO.....',
      '...OO...OO.OO.....',
    ],
    eat2: [
      '...............OO.',
      '..............O#sO',
      '..............O##O',
      '..OO....OO...O#sO.',
      '.O##O..O##O.O##O..',
      '.O#sOOOO#sOO##O...',
      'O###s##s#####O....',
      'O#oo#p##oo###O....',
      '.O#pbbbb#####O....',
      '..O#w#O#w#w#O.....',
      '..OwwO.OwwOwO.....',
      '...OO...OO.OO.....',
    ],
    sleep1: [
      '..OO....OO........',
      '.O##O..O##O.......',
      '.O#sOOOO#sOOOO....',
      'O###s##s###s##O...',
      'O#oo#p##oo####OO..',
      'O#pbbbbbb####O#sO.',
      '.O#bbbbbb###O##O..',
      '..OOOOOOOOOOOO....',
    ],
    sleep2: [
      '..OO....OO........',
      '.O##O..O##OOOO....',
      '.O#sOOOO#s##s#O...',
      'O###s##s######O...',
      'O#oo#p##oo####OO..',
      'O#pbbbbbb####O#sO.',
      '.O#bbbbbb###O##O..',
      '..OOOOOOOOOOOO....',
    ],
    wave1: [
      '...OO....OO.......',
      '..O##O..O##O...OO.',
      '..O#sOOOO#sO..O#sO',
      '.O###s##s###O.O##O',
      '.O#wo####wo#O.O#sO',
      '.O#oo#p##oo#O.O##O',
      'OO#pbbbb#pO..O##O.',
      'Owwbbbbbb##OO##O..',
      '.OObbbbbb#####O...',
      '..O##bbbb#####O...',
      '..O#ww#ww####O....',
      '...OOOOOOOOOO.....',
    ],
    wave2: [
      '...OO....OO.......',
      '..O##O..O##O..OO..',
      '..O#sOOOO#sO.O#sO.',
      '.O###s##s###OO##O.',
      'OO#wo####wo#O.O#sO',
      'Oww#oo#p##oo#OO##O',
      '.OO#pbbbb#pO..O#O.',
      '..O#bbbbbb####O...',
      '..O##bbbb#####O...',
      '..O#ww#ww####O....',
      '...OOOOOOOOOO.....',
    ],
    dangle: [
      '..OO....OO........',
      '.O##O..O##O.......',
      '.O#sOOOO#sO.......',
      'O###s##s###O......',
      'O#oo####oo#O......',
      'O#p#bbbb#p#O......',
      '.O#ObbbbO#O...OO..',
      '.OwwObbOwwO..O#sO.',
      '..O#bbbb#OO..O##O.',
      '..O######OO#s#O...',
      '...OwwOwwO.OO.....',
      '...OO..OO.........',
      '..................',
    ],
  });

  // ── 3. CALICO: Fluffy Heterochromia Longhair Calico with Plume Tail (24x17 body -> 26x25 = 39x38px) ──
  const CALICO_POSES = buildPoseMap(24, 17, {
    standA: [
      '...OO.....OO......OOOO..',
      '..OkkO...OaaO....O#aa#O.',
      '..OkkOOOOOaaO...O#a##k#O',
      '.Okk####a###aO..O##kk##O',
      '.Ok##L###R##aO.O#aa###kO',
      'O##p#o#p#o#p#O.O##a##k#O',
      'O#wwwww#wwwwwO.O###kk##O',
      '.OwwwwwwwwwwOO.O#a####O.',
      '.O#wwwwwwwwk##OO##k##O..',
      '.O##wwwwwwkk##a###k#O...',
      'O###wwww#kk##aa####O....',
      'O##w####kk###aa###O.....',
      '.O######k###aa###O......',
      '..O###O###O###O#O.......',
      '..O##wO##wO##wOwO.......',
      '..OwwwOwwwOwwwOwO.......',
      '...OOO.OOO.OOO.O........',
    ],
    standB: [
      '...OO.....OO.......OOOO.',
      '..OkkO...OaaO.....O#aa#O',
      '..OkkOOOOOaaO....O#a##kO',
      '.Okk####a###aO...O##kk#O',
      '.Ok##L###R##aO..O#aa##kO',
      'O##p#o#p#o#p#O..O##a#k#O',
      'O#wwwww#wwwwwO.O###kk##O',
      '.OwwwwwwwwwwOO.O#a####O.',
      '.O#wwwwwwwwk##OO##k##O..',
      '.O##wwwwwwkk##a###k#O...',
      'O###wwww#kk##aa####O....',
      'O##w####kk###aa###O.....',
      '.O######k###aa###O......',
      '..O###O###O###O#O.......',
      '..O##wO##wO##wOwO.......',
      '..OwwwOwwwOwwwOwO.......',
      '...OOO.OOO.OOO.O........',
    ],
    blink: [
      '...OO.....OO......OOOO..',
      '..OkkO...OaaO....O#aa#O.',
      '..OkkOOOOOaaO...O#a##k#O',
      '.Okk####a###aO..O##kk##O',
      '.Ok#oo###oo#aO.O#aa###kO',
      'O##p#o#p#o#p#O.O##a##k#O',
      'O#wwwww#wwwwwO.O###kk##O',
      '.OwwwwwwwwwwOO.O#a####O.',
      '.O#wwwwwwwwk##OO##k##O..',
      '.O##wwwwwwkk##a###k#O...',
      'O###wwww#kk##aa####O....',
      'O##w####kk###aa###O.....',
      '.O######k###aa###O......',
      '..O###O###O###O#O.......',
      '..O##wO##wO##wOwO.......',
      '..OwwwOwwwOwwwOwO.......',
      '...OOO.OOO.OOO.O........',
    ],
    earL: [
      '..........OO......OOOO..',
      '..OO.....OaaO....O#aa#O.',
      '.OkkOOOOO#aaO...O#a##k#O',
      '.Okk####a###aO..O##kk##O',
      '.Ok##L###R##aO.O#aa###kO',
      'O##p#o#p#o#p#O.O##a##k#O',
      'O#wwwww#wwwwwO.O###kk##O',
      '.OwwwwwwwwwwOO.O#a####O.',
      '.O#wwwwwwwwk##OO##k##O..',
      '.O##wwwwwwkk##a###k#O...',
      'O###wwww#kk##aa####O....',
      'O##w####kk###aa###O.....',
      '.O######k###aa###O......',
      '..O###O###O###O#O.......',
      '..O##wO##wO##wOwO.......',
      '..OwwwOwwwOwwwOwO.......',
      '...OOO.OOO.OOO.O........',
    ],
    walk1: [
      '...OO.....OO......OOOO..',
      '..OkkO...OaaO....O#aa#O.',
      '..OkkOOOOOaaO...O#a##k#O',
      '.Okk####a###aO..O##kk##O',
      '.Ok##L###R##aO.O#aa###kO',
      'O##p#o#p#o#p#O.O##a##k#O',
      'O#wwwww#wwwwwO.O###kk##O',
      '.OwwwwwwwwwwOO.O#a####O.',
      '.O#wwwwwwwwk##OO##k##O..',
      '.O##wwwwwwkk##a###k#O...',
      'O###wwww#kk##aa####O....',
      'O##w####kk###aa###O.....',
      '.O######k###aa###O......',
      '.OwwwO.##O##wO.OwwwO....',
      '.OOO...OwwwO....OOO.....',
      '........OOO.............',
    ],
    walk2: [
      '........................',
      '...OO.....OO.......OOOO.',
      '..OkkO...OaaO.....O#aa#O',
      '..OkkOOOOOaaO....O#a##kO',
      '.Okk####a###aO...O##kk#O',
      '.Ok##L###R##aO..O#aa##kO',
      'O##p#o#p#o#p#O..O##a#k#O',
      'O#wwwww#wwwwwO.O###kk##O',
      '.OwwwwwwwwwwOO.O#a####O.',
      '.O#wwwwwwwwk##OO##k##O..',
      '.O##wwwwwwkk##a###k#O...',
      'O###wwww#kk##aa####O....',
      '.O######k###aa###O......',
      '..O###OwwwO.OwwwO#O.....',
      '..OwwwO.OO...OO.OwwO....',
      '...OOO...........OO.....',
    ],
    sitA: [
      '....OO.....OO...........',
      '...OkkO...OaaO....OOOO..',
      '...OkkOOOOOaaO...O#aa#O.',
      '..Okk####a###aO.O#a##k#O',
      '..Ok##L###R##aO.O##kk##O',
      '.O##p#o#p#o#p##OO#aa##kO',
      '.O#wwwwwwwwwww#OO##a#k#O',
      'O##wwwwwwwwwww##O##kk##O',
      'O##wwwwwwwwwwwk#O#a###O.',
      'O###wwwwwwwwwkk#OO#k#O..',
      'O###wwwwwwwwwkk##a###O..',
      'O####wwwwwww#k###aa#O...',
      'O#####wwwww#####aa##O...',
      '.O##OwwwOwwOwwwO###O....',
      '.O##OwwwO##OwwwO###O....',
      '..OOOOOOOOOOOOOOOOO.....',
    ],
    sitB: [
      '....OO.....OO...........',
      '...OkkO...OaaO.....OOOO.',
      '...OkkOOOOOaaO....O#aa#O',
      '..Okk####a###aO..O#a##kO',
      '..Ok##L###R##aO..O##kk#O',
      '.O##p#o#p#o#p##O.O#aa#kO',
      '.O#wwwwwwwwwww#O.O##ak#O',
      'O##wwwwwwwwwww##O##kk##O',
      'O##wwwwwwwwwwwk#O#a###O.',
      'O###wwwwwwwwwkk#OO#k#O..',
      'O###wwwwwwwwwkk##a###O..',
      'O####wwwwwww#k###aa#O...',
      'O#####wwwww#####aa##O...',
      '.O##OwwwOwwOwwwO###O....',
      '.O##OwwwO##OwwwO###O....',
      '..OOOOOOOOOOOOOOOOO.....',
    ],
    groom1: [
      '....OO.....OO...........',
      '...OkkO...OaaO....OOOO..',
      '...OkkOOOOOaaO...O#aa#O.',
      '..Okk####a###aO.O#a##k#O',
      '..Ok#oo###oo#aO.O##kk##O',
      '.O##p#o#p#o#p##OO#aa##kO',
      '.OOwwwwwwwwwww#OO##a#k#O',
      'OwwOwwwwwwwwww##O##kk##O',
      'Oww#wwwwwwwwwwk#O#a###O.',
      '.OO##wwwwwwwwkk#OO#k#O..',
      'O###wwwwwwwwwkk##a###O..',
      'O####wwwwwww#k###aa#O...',
      'O#####wwwww#####aa##O...',
      '.O##OwwwO##OwwwO###O....',
      '.O##OwwwO##OwwwO###O....',
      '..OOOOOOOOOOOOOOOOO.....',
    ],
    groom2: [
      '....OO.....OO...........',
      '...OkkO...OaaO.....OOOO.',
      '...OkkOOOOOaaO....O#aa#O',
      '..Okk####a###aO..O#a##kO',
      '.OO#oo###oo#aO...O##kk#O',
      'OwwO#p#o#p#o#p#O.O#aa#kO',
      'Oww#wwwwwwwwww#O.O##ak#O',
      '.OO#wwwwwwwwww##O##kk##O',
      'O##wwwwwwwwwwwk#O#a###O.',
      'O###wwwwwwwwwkk#OO#k#O..',
      'O###wwwwwwwwwkk##a###O..',
      'O####wwwwwww#k###aa#O...',
      'O#####wwwww#####aa##O...',
      '.O##OwwwO##OwwwO###O....',
      '.O##OwwwO##OwwwO###O....',
      '..OOOOOOOOOOOOOOOOO.....',
    ],
    stretch1: [
      '.................OOOO...',
      '................O#aa#O..',
      '...............O#a##k#O.',
      '...............O##kk##O.',
      '..............O#aa###kO.',
      '..............O##a##k#O.',
      '...OO.....OO..O###kk##O.',
      '..OkkO...OaaO.O#a####O..',
      '..OkkOOOOOaaOO###kk##O..',
      '.Okk####a###a###kk#aaO..',
      '.Ok#oo###oo#a###k##aaO..',
      'O##p#o#p#o#p#w####aa#O..',
      '.O#wwwwwwwwww####aa#O...',
      'OwwwOOwwwwww#####O#wO...',
      'OOOO..OOOOO#####OwwwO...',
      '...........OOOOO.OOO....',
    ],
    stretch2: [
      '..................OOOO..',
      '.................O#aa#O.',
      '................O#a##k#O',
      '................O##kk##O',
      '...............O#aa###kO',
      '...............O##a##k#O',
      '...OO.....OO...O###kk##O',
      '..OkkO...OaaO..O#a####O.',
      '..OkkOOOOOaaOO###kk##O..',
      '.Okk####a###a###kk#aaO..',
      '.Ok#oo###oo#a###k##aaO..',
      'O##p#o#p#o#p#w####aa#O..',
      '.O#wwwwwwwwww####aa#O...',
      'OwwwOOwwwwww#####O#wO...',
      'OOOO..OOOOO#####OwwwO...',
      '...........OOOOO.OOO....',
    ],
    happy: [
      '...OO.....OO......OOOO..',
      '..OkkO...OaaO....O#aa#O.',
      '..OkkOOOOOaaO...O#a##k#O',
      '.Okk####a###aO..O##kk##O',
      '.Ok##o###o##aO.O#aa###kO',
      'O##po#o#o#o#pO.O##a##k#O',
      'O#wwwww#wwwwwO.O###kk##O',
      '.OwwwwwwwwwwOO.O#a####O.',
      '.O#wwwwwwwwk##OO##k##O..',
      '.O##wwwwwwkk##a###k#O...',
      'O###wwww#kk##aa####O....',
      'O##w####kk###aa###O.....',
      '.O######k###aa###O......',
      '..O###O###O###O#O.......',
      '..O##wO##wO##wOwO.......',
      '..OwwwOwwwOwwwOwO.......',
      '...OOO.OOO.OOO.O........',
    ],
    eat1: [
      '..................OOOO..',
      '.................O#aa#O.',
      '................O#a##k#O',
      '................O##kk##O',
      '...OO....OO....O#aa###kO',
      '..OkkO..OaaOOOO##a##k#O.',
      '.OkkOOOOOaa#####kk###O..',
      'Okk####a###a###kk#aaO...',
      'O#oo###oo#a####k##aaO...',
      'O#p#o#p#o#pw#####aa#O...',
      '.O#wwwwwwww#####aa#O....',
      '..O###O###O###O###O.....',
      '..OwwwOwwwOwwwOwwwO.....',
      '...OOO.OOO.OOO.OOO......',
    ],
    eat2: [
      '...................OOOO.',
      '..................O#aa#O',
      '.................O#a##kO',
      '.................O##kk#O',
      '................O#aa##kO',
      '...OO....OO....O##a##k#O',
      '..OkkO..OaaOOOO##kk###O.',
      '.OkkOOOOOaa#####kk#aaO..',
      'Okk####a###a###k##aaO...',
      'O#oo###oo#a#####aa#O....',
      '.O#wwwwwwww#####aa#O....',
      '..O###O###O###O###O.....',
      '..OwwwOwwwOwwwOwwwO.....',
      '...OOO.OOO.OOO.OOO......',
    ],
    sleep1: [
      '...OO.....OO............',
      '..OkkO...OaaO...........',
      '..OkkOOOOOaaOOOOO.......',
      '.Okk####a###a##kkOO.....',
      'O#oo###oo#a###kk#aaO....',
      'O#p#o#p#o#pw##k##aaO.OO.',
      'O#wwwwwwwwww####aa#OOaaO',
      'O##wwwwwwwww####a##O#kkO',
      '.O##wwwwwww#######O##aO.',
      '..OOOOOOOOOOOOOOOOOOOO..',
    ],
    sleep2: [
      '...OO.....OO............',
      '..OkkO...OaaOOOOO.......',
      '..OkkOOOOOaa###kkOO.....',
      '.Okk####a###a##k#aaO....',
      'O#oo###oo#a#####aa#O....',
      'O#p#o#p#o#pw####aa#O.OO.',
      'O#wwwwwwwwww####aa#OOaaO',
      'O##wwwwwwwww####a##O#kkO',
      '.O##wwwwwww#######O##aO.',
      '..OOOOOOOOOOOOOOOOOOOO..',
    ],
    wave1: [
      '....OO.....OO...........',
      '...OkkO...OaaO....OOOO..',
      '...OkkOOOOOaaO...O#aa#O.',
      '..Okk####a###aO.O#a##k#O',
      '..Ok##L###R##aO.O##kk##O',
      '.O##p#o#p#o#p##OO#aa##kO',
      '.OOwwwwwwwwwww#OO##a#k#O',
      'Oww#wwwwwwwwww##O##kk##O',
      'OwwOwwwwwwwwwwk#O#a###O.',
      '.OO##wwwwwwwwkk#OO#k#O..',
      'O###wwwwwwwwwkk##a###O..',
      'O####wwwwwww#k###aa#O...',
      '.O##OwwwO##OwwwO###O....',
      '.O##OwwwO##OwwwO###O....',
      '..OOOOOOOOOOOOOOOOO.....',
    ],
    wave2: [
      '....OO.....OO...........',
      '...OkkO...OaaO.....OOOO.',
      '...OkkOOOOOaaO....O#aa#O',
      '..Okk####a###aO..O#a##kO',
      '..Ok##L###R##aO..O##kk#O',
      'OO##p#o#p#o#p##O.O#aa#kO',
      'Oww#wwwwwwwwww#O.O##ak#O',
      'OwwOwwwwwwwwww##O##kk##O',
      '.OO#wwwwwwwwwwk#O#a###O.',
      'O###wwwwwwwwwkk#OO#k#O..',
      'O####wwwwwww#k###aa#O...',
      '.O##OwwwO##OwwwO###O....',
      '.O##OwwwO##OwwwO###O....',
      '..OOOOOOOOOOOOOOOOO.....',
    ],
    dangle: [
      '...OO.....OO............',
      '..OkkO...OaaO...........',
      '..OkkOOOOOaaO...........',
      '.Okk####a###aO..........',
      '.Ok#oo###oo#aO..........',
      'O##p#o#p#o#p#O..........',
      'O#wwwwwwwwwwwO..........',
      '.O#OwwwwwwwO#O....OOOO..',
      '.OwwOwwwwwOwwO...O#aa#O.',
      '..O##wwwwkk##O..O#a##k#O',
      '..O##www#kk##OO.O##kk##O',
      '..O#####k##aa#OO#aa##kO.',
      '...O#O....O#OO###a##O...',
      '...OwwO..OwwO.OOOOOO....',
      '...OOO....OOO...........',
      '........................',
    ],
  });

  // ── 4. RAGDOLL: Tall Slender Pointed Siamese with Cocoa Mask, Ice-Blue Eyes & Coral Bow (22x19 -> 24x27 = 36x41px) ──
  const SIAMESE_POSES = buildPoseMap(22, 19, {
    standA: [
      '...OO....OO.......OO..',
      '..OmmO..OmmO.....OmmO.',
      '..OmmO..OmmO....OmdO..',
      '..OmmOOOOmmO.....O#O..',
      '.O#dmmmmmm#dO.....O#O.',
      '.Odmme#m#emmdO....O#O.',
      '.Odmmmo#ommmdO...O#O..',
      '..OOdmmmmmdOO....O#O..',
      '...O#rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbb###OOO#O.....',
      '...O###b#######O......',
      '....O##########O......',
      '....O#dO####O#dO......',
      '....OmmO.##.OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '.....OO......OO.......',
    ],
    standB: [
      '...OO....OO........OO.',
      '..OmmO..OmmO......OmmO',
      '..OmmO..OmmO.....OmdO.',
      '..OmmOOOOmmO....O#O...',
      '.O#dmmmmmm#dO....O#O..',
      '.Odmme#m#emmdO....O#O.',
      '.Odmmmo#ommmdO...O#O..',
      '..OOdmmmmmdOO....O#O..',
      '...O#rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbb###OOO#O.....',
      '...O###b#######O......',
      '....O##########O......',
      '....O#dO####O#dO......',
      '....OmmO.##.OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '.....OO......OO.......',
    ],
    blink: [
      '...OO....OO.......OO..',
      '..OmmO..OmmO.....OmmO.',
      '..OmmO..OmmO....OmdO..',
      '..OmmOOOOmmO.....O#O..',
      '.O#dmmmmmm#dO.....O#O.',
      '.Odmmom#ommmdO....O#O.',
      '.Odmmmo#ommmdO...O#O..',
      '..OOdmmmmmdOO....O#O..',
      '...O#rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbb###OOO#O.....',
      '...O###b#######O......',
      '....O##########O......',
      '....O#dO####O#dO......',
      '....OmmO.##.OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '.....OO......OO.......',
    ],
    earL: [
      '.........OO.......OO..',
      '..OO....OmmO.....OmmO.',
      '.OmmO...OmmO....OmdO..',
      '.OmmOOOO#mmO.....O#O..',
      '.O#dmmmmmm#dO.....O#O.',
      '.Odmme#m#emmdO....O#O.',
      '.Odmmmo#ommmdO...O#O..',
      '..OOdmmmmmdOO....O#O..',
      '...O#rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbb###OOO#O.....',
      '...O###b#######O......',
      '....O##########O......',
      '....O#dO####O#dO......',
      '....OmmO.##.OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '.....OO......OO.......',
    ],
    strut1: [
      '...OO....OO.......OO..',
      '..OmmO..OmmO.....OmmO.',
      '..OmmO..OmmO....OmdO..',
      '..OmmOOOOmmO.....O#O..',
      '.O#dmmmmmm#dO.....O#O.',
      '.Odmme#m#emmdO....O#O.',
      '.Odmmmo#ommmdO...O#O..',
      '..OOdmmmmmdOO....O#O..',
      '...O#rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbb###OOO#O.....',
      '...O###b#######O......',
      '....O##########O......',
      '...O#dO.O##O.#dO......',
      '..OmmO..OmmO..OmmO....',
      '..OmmO..OmmO...OmmO...',
      '.OmmO...OmmO....OmmO..',
      '.OmmO...OmmO....OmmO..',
      '..OO.....OO......OO...',
    ],
    strut2: [
      '......................',
      '...OO....OO........OO.',
      '..OmmO..OmmO......OmmO',
      '..OmmO..OmmO.....OmdO.',
      '..OmmOOOOmmO....O#O...',
      '.O#dmmmmmm#dO....O#O..',
      '.Odmme#m#emmdO....O#O.',
      '.Odmmmo#ommmdO...O#O..',
      '..OOdmmmmmdOO....O#O..',
      '...O#rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbb###OOO#O.....',
      '...O###b#######O......',
      '....O##########O......',
      '....O#dO#dO#dO#O......',
      '....OmmOmmOmmOmmO.....',
      '.....OmmO..OmmO.......',
      '.....OmmO..OmmO.......',
      '......OO....OO........',
    ],
    sitA: [
      '....OO....OO..........',
      '...OmmO..OmmO.........',
      '...OmmO..OmmO.....OO..',
      '...OmmOOOOmmO....OmmO.',
      '..O#dmmmmmm#dO...OmdO.',
      '..Odmme#m#emmdO...O#O.',
      '..Odmmmo#ommmdO...O#O.',
      '...OOdmmmmmdOO...O#O..',
      '....O#rrcrr#O....O#O..',
      '....O#b#r#b#O...O#O...',
      '...O##bbbbb##O..O#O...',
      '...O##bbbbb###OO#O....',
      '...O##bbbbb#####O.....',
      '...O##bbbbb#####O.....',
      '...O#d#b#b#d###O......',
      '...OmmO#b#Omm##O......',
      '...OmmO###Omm##O......',
      '...OmmO###Omm##O......',
      '....OOOOOOOOOOO.......',
    ],
    sitB: [
      '....OO....OO..........',
      '...OmmO..OmmO.........',
      '...OmmO..OmmO......OO.',
      '...OmmOOOOmmO.....OmmO',
      '..O#dmmmmmm#dO....OmdO',
      '..Odmme#m#emmdO...O#O.',
      '..Odmmmo#ommmdO...O#O.',
      '...OOdmmmmmdOO...O#O..',
      '....O#rrcrr#O....O#O..',
      '....O#b#r#b#O...O#O...',
      '...O##bbbbb##O..O#O...',
      '...O##bbbbb###OO#O....',
      '...O##bbbbb#####O.....',
      '...O##bbbbb#####O.....',
      '...O#d#b#b#d###O......',
      '...OmmO#b#Omm##O......',
      '...OmmO###Omm##O......',
      '...OmmO###Omm##O......',
      '....OOOOOOOOOOO.......',
    ],
    tilt: [
      '.....OO....OO.........',
      '....OmmO..OmmO........',
      '...OmmO....OmmO...OO..',
      '...OmmOOOOOOmmO..OmmO.',
      '..O#dmmmmmmm#dO..OmdO.',
      '..Odmme#mm#emmdO..O#O.',
      '..Odmmm#oo#mmmdO..O#O.',
      '...OOdmmmmmdOO...O#O..',
      '....O#rrcrr#O....O#O..',
      '....O#b#r#b#O...O#O...',
      '...O##bbbbb##O..O#O...',
      '...O##bbbbb###OO#O....',
      '...O##bbbbb#####O.....',
      '...O##bbbbb#####O.....',
      '...O#d#b#b#d###O......',
      '...OmmO#b#Omm##O......',
      '...OmmO###Omm##O......',
      '...OmmO###Omm##O......',
      '....OOOOOOOOOOO.......',
    ],
    scratch1: [
      '....OO....OO..........',
      '...OmmO..OmmO.........',
      '...OmmO..OmmO.........',
      '...OmmOOOOmmO.........',
      '..O#dmmmmmm#dO........',
      'OO#dmme#m#emmdO.......',
      'Omm#dmmmo#ommdO.......',
      '.OO#OdmmmmmdOO........',
      '..O##rrcrr#O..........',
      '..Omm#b#r#b#O.....OO..',
      '..OO##bbbbb##O...OmmO.',
      '....O##bbbbb##O..OmdO.',
      '....O##bbbbb###OO#O...',
      '.....O#########O#O....',
      '.....O#dO###O#dO......',
      '.....OmmO...OmmO......',
      '.....OmmO...OmmO......',
      '.....OmmO...OmmO......',
      '......OO.....OO.......',
    ],
    scratch2: [
      '....OO....OO..........',
      '...OmmO..OmmO.........',
      '...OmmO..OmmO.........',
      '...OmmOOOOmmO.........',
      '..O#dmmmmmm#dO........',
      '..Odmme#m#emmdO.......',
      '.O#dmmmo#ommmdO.......',
      'OmmOOdmmmmmdOO........',
      '.OO##rrcrr#O..........',
      'Omm###b#r#b#O......OO.',
      '.OO###bbbbb##O....OmmO',
      '....O##bbbbb##O...OmdO',
      '....O##bbbbb###OO#O...',
      '.....O#########O#O....',
      '.....O#dO###O#dO......',
      '.....OmmO...OmmO......',
      '.....OmmO...OmmO......',
      '.....OmmO...OmmO......',
      '......OO.....OO.......',
    ],
    happy: [
      '...OO....OO.......OO..',
      '..OmmO..OmmO.....OmmO.',
      '..OmmO..OmmO....OmdO..',
      '..OmmOOOOmmO.....O#O..',
      '.O#dmmmmmm#dO.....O#O.',
      '.OdmbbmmbbmdO.....O#O.',
      '.OdmrmmmrmmdO....O#O..',
      '..OOdmmmmmdOO....O#O..',
      '...O#rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbb###OOO#O.....',
      '...O###b#######O......',
      '....O##########O......',
      '....O#dO####O#dO......',
      '....OmmO.##.OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '....OmmO....OmmO......',
      '.....OO......OO.......',
    ],
    eat1: [
      '.................OO...',
      '................OmmO..',
      '...............OmdO...',
      '................O#O...',
      '................O#O...',
      '...OO....OO.....O#O...',
      '..OmmO..OmmO...O#O....',
      '..OmmOOOOmmO..O#O.....',
      '.O#dmmmmmm#dOO#O......',
      '.Odmmom#ommmd##O......',
      '.O#rrcrr#######O......',
      '..O#bbb########O......',
      '...O#dO####O#dO.......',
      '...OmmO....OmmO.......',
      '...OmmO....OmmO.......',
      '...OmmO....OmmO.......',
      '....OO......OO........',
    ],
    eat2: [
      '..................OO..',
      '.................OmmO.',
      '................OmdO..',
      '.................O#O..',
      '.................O#O..',
      '................O#O...',
      '...OO....OO....O#O....',
      '..OmmO..OmmO..O#O.....',
      '..OmmOOOOmmOO#O.......',
      '.O#dmmmmmm#d##O.......',
      '.Odmmom#ommmd#O.......',
      '.O#rrcrr######O.......',
      '...O#dO####O#dO.......',
      '...OmmO....OmmO.......',
      '...OmmO....OmmO.......',
      '...OmmO....OmmO.......',
      '....OO......OO........',
    ],
    sleep1: [
      '...OO....OO...........',
      '..OmmO..OmmO..........',
      '..OmmOOOOmmOOOO.......',
      '.O#dmmmmmm#d###OO.....',
      'Odmmom#ommmd#####O....',
      'O#rrcrr##########O.OO.',
      'O##bbbbbbbbb####OOmmO.',
      '.O##bbbbbbbb###O#mdO..',
      '..OOOOOOOOOOOOOOOO....',
    ],
    sleep2: [
      '...OO....OO...........',
      '..OmmO..OmmOOOO.......',
      '..OmmOOOOmm####OO.....',
      '.O#dmmmmmm#d#####O....',
      'Odmmom#ommmd#####O....',
      'O#rrcrr##########O.OO.',
      'O##bbbbbbbbb####OOmmO.',
      '.O##bbbbbbbb###O#mdO..',
      '..OOOOOOOOOOOOOOOO....',
    ],
    wave1: [
      '....OO....OO..........',
      '...OmmO..OmmO.....OO..',
      '...OmmO..OmmO....OmmO.',
      '...OmmOOOOmmO...OmdO..',
      '..O#dmmmmmm#dO...O#O..',
      '..Odmme#m#emmdO..O#O..',
      '..Odmmmo#ommmdO..O#O..',
      '...OOdmmmmmdOO...O#O..',
      '..OO#rrcrr#O....O#O...',
      'Omm##b#r#b#O...O#O....',
      '.OO###bbbbb##OO#O.....',
      '...O##bbbbb####O......',
      '...O##bbbbb####O......',
      '...O#d#b#b#d##O.......',
      '...OmmO###Omm#O.......',
      '...OmmO###Omm#O.......',
      '...OmmO###Omm#O.......',
      '....OOOOOOOOOO........',
    ],
    wave2: [
      '....OO....OO..........',
      '...OmmO..OmmO......OO.',
      '...OmmO..OmmO.....OmmO',
      '...OmmOOOOmmO....OmdO.',
      '..O#dmmmmmm#dO...O#O..',
      '..Odmme#m#emmdO..O#O..',
      'OO#dmmmo#ommmdO..O#O..',
      'OmmOOdmmmmmdOO...O#O..',
      '.OO##rrcrr#O....O#O...',
      '...O#b#r#b#O...O#O....',
      '...O##bbbbb##OO#O.....',
      '...O##bbbbb####O......',
      '...O##bbbbb####O......',
      '...O#d#b#b#d##O.......',
      '...OmmO###Omm#O.......',
      '...OmmO###Omm#O.......',
      '...OmmO###Omm#O.......',
      '....OOOOOOOOOO........',
    ],
    dangle: [
      '...OO....OO...........',
      '..OmmO..OmmO..........',
      '..OmmO..OmmO..........',
      '..OmmOOOOmmO..........',
      '.O#dmmmmmm#dO.........',
      '.Odmmom#ommmdO........',
      '..OOdmmmmmdOO.........',
      '...O#rrcrr#O..........',
      '..O#ObbbbO#O......OO..',
      '..OmmObbOmmO.....OmmO.',
      '...O#bbbb#O.....OmdO..',
      '...O#bbbb#O....O#O....',
      '...O######OO..O#O.....',
      '....O#dO#dOO#O........',
      '....OmmOmmO.O.........',
      '....OmmOmmO...........',
      '....OmmOmmO...........',
      '.....OO.OO............',
      '......................',
    ],
  });

  // 4 distinct species presets (ordered so catCount 1->[pusheen], 2->[pusheen,ginger], 3->+calico, 4->all)
  const CAT_PRESETS = [
    {
      id: 'pusheen',
      breed: 'tabby',
      px: PX,
      bodyCols: 26,
      bodyRows: 16,
      xPct: 0.54,
      hue: 0.72,
      speed: 0.30,
      mood: 'cozy',
      poses: PUSHEEN_POSES,
      pal: { O: '#2D2936', '#': '#B4B8C4', s: '#636776', b: '#F1F3F8', o: '#1A1722', p: '#F472B6', w: '#FFFFFF', u: '#FB7185' },
    },
    {
      id: 'ginger',
      breed: 'kitten',
      px: PX,
      bodyCols: 18,
      bodyRows: 13,
      xPct: 0.12,
      hue: 0.09,
      speed: 0.56,
      mood: 'playful',
      poses: GINGER_POSES,
      pal: { O: '#3D2618', '#': '#FBB268', s: '#D9772B', b: '#FFF6E8', o: '#23160E', p: '#FF8FAB', w: '#FFFFFF' },
    },
    {
      id: 'calico',
      breed: 'calico',
      px: PX,
      bodyCols: 24,
      bodyRows: 17,
      xPct: 0.34,
      hue: 0.94,
      speed: 0.42,
      mood: 'sweet',
      poses: CALICO_POSES,
      pal: { O: '#332930', '#': '#FFF9F2', w: '#FFFFFF', a: '#EB8E47', k: '#4D4552', L: '#38BDF8', R: '#F59E0B', o: '#231D24', p: '#F9A8C9' },
    },
    {
      id: 'ragdoll',
      breed: 'siamese',
      px: PX,
      bodyCols: 22,
      bodyRows: 19,
      xPct: 0.85,
      hue: 0.56,
      speed: 0.40,
      mood: 'regal',
      poses: SIAMESE_POSES,
      pal: { O: '#2C2224', '#': '#FAF3E6', b: '#FFFBF2', m: '#5C4033', d: '#7C5846', e: '#38BDF8', o: '#1A1416', r: '#FB7185', c: '#FDA4AF' },
    },
  ];

  const SANCTUARY_SYMS = {
    heart: ['.p.p.', 'ppppp', '.ppp.', '..p..'],
    hearts2: ['.p.p...p.', 'pppp..ppp', '.pp....p.'],
    z1: ['ooo', '.o.', 'ooo'],
    z2: ['oooo', '..o.', '.o..', 'oooo'],
    spark: ['..y..', '..y..', 'yywyy', '..y..', '..y..'],
    note: ['..bb', '..b.', 'bbb.', 'bb..'],
    fish: ['..bb.b', '.bwbbb', '..bb.b'],
    think: ['i..i..i'],
    q: ['.ii.', 'i..i', '..i.', '....', '..i.'],
    alert: ['.r.', '.r.', '.r.', '...', '.r.'],
    sweat: ['.b.', 'bwb', 'bbb', '.b.'],
  };

  const YARN_SPRITE = [
    '..OOO..',
    '.OrrrO.',
    'OrprprO',
    'OrrprrO',
    'OprrrpO',
    '.OrrrO.',
    '..OOO..',
  ];

  // Occasional 5px pastel pixel butterfly (idle / non-streaming only)
  const BUTTERFLY_FRAMES = [
    ['p...p', 'ppOpp', '.yOy.', '.....'],
    ['.....', 'p.O.p', 'pyOyp', '.p.p.'],
  ];

  // Unified px: 1.5 proportional props (cushion widened to 30 cols = 45px with front-rim tuck layer)
  const SHELF_PROPS = [
    {
      id: 'bowl',
      pct: 0.04,
      compactVisible: true,
      px: PX,
      pal: { O: '#2D3040', b: '#7DD3FC', d: '#38BDF8', w: '#F8FAFC', k: '#E8A860', f: '#C9853E' },
      rows: [
        '...OOOOOOOO...',
        '..OkfkkffkkO..',
        '.OOOOOOOOOOOO.',
        'ObbbbwwbbbbbbO',
        '.OddddddddddO.',
        '..OOOOOOOOOO..',
      ],
    },
    {
      id: 'plant',
      pct: 0.21,
      compactVisible: false,
      px: PX,
      pal: { O: '#352A26', g: '#34D399', l: '#6EE7B7', p: '#F9A8C9', c: '#E5926E', s: '#C67350' },
      rows: [
        '....OO.....',
        '...OppO..O.',
        '.O..OO..OlO',
        'OlO.OgO.OgO',
        '.OgOOgOOgO.',
        '..OglglgO..',
        '.OOOOOOOOO.',
        '.OccccccccO',
        '..OcsssssO.',
        '...OOOOOO..',
      ],
    },
    {
      id: 'cushion',
      pct: 0.72,
      compactVisible: false,
      px: PX,
      pal: { O: '#352E45', c: '#DDD6FE', l: '#EDE9FE', s: '#C4B5FD' },
      rows: [
        '..OOOO..................OOOO..',
        '.OllllOOOOOOOOOOOOOOOOOOllllO.',
        'OllccccccccccccccccccccccccllO',
        'OlcccsccccccssccccccsscccccllO',
        'OlcccccccccccccccccccccccccssO',
        'OcccssccccccssccccccssccccccsO',
        '.OssssssssssssssssssssssssssO.',
        '..OOOOOOOOOOOOOOOOOOOOOOOOOO..',
      ],
      frontRows: [
        'Oll........................llO',
        'OlccssccccccssccccccsscccccssO',
        '.OssssssssssssssssssssssssssO.',
        '..OOOOOOOOOOOOOOOOOOOOOOOOOO..',
      ],
    },
    {
      id: 'post',
      pct: 0.94,
      compactVisible: true,
      px: PX,
      pal: { O: '#362C25', w: '#E9C89B', s: '#CFA674', d: '#B48858', p: '#F9A8C9', h: '#FBCFE8' },
      rows: [
        '..OOOOOOOOO..',
        '.OwwwwwwwwwO.',
        '..OOOOOOOOO..',
        '....OwwwO.O..',
        '....OsssO.O..',
        '....OwwwOOphO',
        '....OsssOOppO',
        '....OwwwO.OO.',
        '....OsssO....',
        '....OwwwO....',
        '....OsssO....',
        '..OOOOOOOOO..',
        '.OdddddddddO.',
        '..OOOOOOOOO..',
      ],
    },
  ];

  function createCatSanctuary(ctx) {
    if (!ctx || !ctx.hostEl) return null;
    const {
      hostEl,
      doc = hostEl.ownerDocument,
      win = (doc && doc.defaultView) || (typeof window !== 'undefined' ? window : G),
      markNoTrOwned = (el) => el,
      readStageWidth = () => hostEl.clientWidth || 720,
      readDpr = () => Math.min((win && win.devicePixelRatio) || 1, 2),
      isVramSleepState = () => false,
      isWindowBlurred = () => Boolean(doc && doc.hidden),
      getReducedMotion = () => false,
      getStreaming = () => false,
      getIsThinking = () => false,
      getHasError = () => false,
      getPeekHidden = () => false,
      getConfig = () => ({}),
      onDragStateChange = () => {},
      registerDragRelease = () => () => {},
    } = ctx;

    const nowMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const wrap = markNoTrOwned(doc.createElement('div'));
    wrap.className = 'ag-v2-cat-sanctuary';
    hostEl.appendChild(wrap);

    let disposed = false;
    let running = false;
    let pausedPower = false;
    let peekHidden = Boolean(getPeekHidden());
    let streaming = Boolean(getStreaming());
    let thinking = Boolean(getIsThinking());
    let hasError = Boolean(getHasError());
    let focusNap = false;
    let vramReclaimed = false;

    const readCfg = () => {
      const c = getConfig() || {};
      return {
        catCount: c.catCount === '1' || c.catCount === '2' ? c.catCount : '4',
        catProps: c.catProps === 'off' ? 'off' : 'on',
        catQuietMode: c.catQuietMode === 'nap' ? 'nap' : 'auto',
      };
    };
    let sCfg = readCfg();

    const isDarkThemeNow = () => {
      const rootEl = doc && doc.documentElement;
      const attr = rootEl && typeof rootEl.getAttribute === 'function' ? rootEl.getAttribute('data-ag-cs-theme') : '';
      if (attr === 'light') return false;
      if (attr === 'dark') return true;
      const bodyCl = doc && doc.body && doc.body.classList;
      if (bodyCl && (bodyCl.contains('theme-light') || bodyCl.contains('light-theme') || bodyCl.contains('light'))) return false;
      return true;
    };

    const drawCrispGrid = (c2, rows, p, curDpr, xOffGrid, yOffGrid, colorOf, flipX, cwPhys, darkHalo) => {
      const step = p * curDpr;
      const rCount = rows.length;
      const cCount = rCount > 0 ? rows[0].length : 0;

      if (darkHalo) {
        c2.fillStyle = darkHalo;
        const hasPx = (gx, gy) => {
          if (gy < 0 || gy >= rCount || gx < 0 || gx >= cCount) return false;
          const ch = rows[gy][gx];
          return Boolean(ch && ch !== '.' && colorOf(ch, gx, gy));
        };
        for (let gy = -1; gy <= rCount; gy++) {
          const y0 = Math.round((yOffGrid + gy) * step);
          const y1 = Math.round((yOffGrid + gy + 1) * step);
          const rh = y1 - y0;
          if (rh <= 0) continue;
          for (let gx = -1; gx <= cCount; gx++) {
            if (hasPx(gx, gy)) continue;
            if (!hasPx(gx - 1, gy) && !hasPx(gx + 1, gy) && !hasPx(gx, gy - 1) && !hasPx(gx, gy + 1)) continue;
            const lx0 = Math.round((xOffGrid + gx) * step);
            const lx1 = Math.round((xOffGrid + gx + 1) * step);
            const rw = lx1 - lx0;
            if (rw <= 0) continue;
            c2.fillRect(flipX ? cwPhys - lx1 : lx0, y0, rw, rh);
          }
        }
      }

      for (let gy = 0; gy < rCount; gy++) {
        const r = rows[gy];
        const y0 = Math.round((yOffGrid + gy) * step);
        const y1 = Math.round((yOffGrid + gy + 1) * step);
        const rh = y1 - y0;
        if (rh <= 0) continue;
        for (let gx = 0; gx < r.length; gx++) {
          const col = colorOf(r[gx], gx, gy);
          if (!col) continue;
          const lx0 = Math.round((xOffGrid + gx) * step);
          const lx1 = Math.round((xOffGrid + gx + 1) * step);
          const rw = lx1 - lx0;
          if (rw <= 0) continue;
          c2.fillStyle = col;
          c2.fillRect(flipX ? cwPhys - lx1 : lx0, y0, rw, rh);
        }
      }
    };

    const publishRimState = (activeNow, sw, now) => {
      if (!win) return;
      if (!activeNow) {
        if (win.__agPrismCatRimState && win.__agPrismCatRimState.active) {
          win.__agPrismCatRimState = { active: false, ts: now || nowMs(), cats: [] };
          if (typeof win.__agPrismNotifyCatRim === 'function') {
            try { win.__agPrismNotifyCatRim(); } catch (_) {}
          }
        }
        return;
      }
      const list = [];
      const w = Math.max(220, sw || 720);
      for (let i = 0; i < cats.length; i++) {
        const c = cats[i];
        if (!c.visible) continue;
        list.push({
          nx: Math.max(0.02, Math.min(0.98, (c.x + c.cw * 0.5) / w)),
          hue: c.hue,
          moving: c.state === 'walk' || c.dragging || c.vy !== 0,
        });
      }
      win.__agPrismCatRimState = { active: list.length > 0, ts: now || nowMs(), cats: list };
      if (typeof win.__agPrismNotifyCatRim === 'function') {
        try { win.__agPrismNotifyCatRim(); } catch (_) {}
      }
    };

    let lastInteractionAt = nowMs();
    let lastPlantClickAt = 0;
    const markUserInteraction = (now) => {
      lastInteractionAt = typeof now === 'number' ? now : nowMs();
    };

    const propById = {};
    const propNodes = SHELF_PROPS.map((sp) => {
      const cv = markNoTrOwned(doc.createElement('canvas'));
      cv.className = 'ag-v2-cat-pet';
      cv.setAttribute('data-shelf-prop', sp.id);
      cv.setAttribute('aria-hidden', 'true');
      const cols = sp.rows[0].length;
      const rowsLen = sp.rows.length;
      const cw = Math.round((cols + 2) * sp.px);
      const ch = Math.round((rowsLen + 1) * sp.px);
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      cv.style.zIndex = '1';
      cv.style.cursor = 'pointer';
      wrap.appendChild(cv);

      let frontCv = null;
      let frontCtx = null;
      let frontCh = 0;
      if (sp.frontRows) {
        frontCv = markNoTrOwned(doc.createElement('canvas'));
        frontCv.className = 'ag-v2-cat-pet';
        frontCv.setAttribute('data-shelf-prop', sp.id + '-front');
        frontCv.setAttribute('aria-hidden', 'true');
        frontCh = Math.round((sp.frontRows.length + 1) * sp.px);
        frontCv.style.width = `${cw}px`;
        frontCv.style.height = `${frontCh}px`;
        frontCv.style.zIndex = '3';
        frontCv.style.pointerEvents = 'none';
        wrap.appendChild(frontCv);
        frontCtx = typeof frontCv.getContext === 'function' ? frontCv.getContext('2d') : null;
      }

      const node = {
        ...sp,
        cv,
        ctx: typeof cv.getContext === 'function' ? cv.getContext('2d') : null,
        frontCv,
        frontCtx,
        frontCh,
        cw,
        ch,
        x: 24,
        visible: true,
        drawnKey: '',
      };
      propById[sp.id] = node;

      const onPropClick = (ev) => {
        if (peekHidden || disposed || !node.visible) return;
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        const now = nowMs();
        markUserInteraction(now);
        if (sp.id === 'post') {
          focusNap = false;
          spawnYarn(node.x, now);
          return;
        }
        if (sp.id === 'plant') {
          if (now - lastPlantClickAt < 420) {
            lastPlantClickAt = 0;
            focusNap = !focusNap;
            applyFocusNapState(now);
            return;
          }
          lastPlantClickAt = now;
        }
        focusNap = false;
        let best = null;
        let bestD = Infinity;
        for (const c of cats) {
          if (!c.visible || c.dragging) continue;
          const d = Math.abs(c.x + c.cw * 0.5 - (node.x + node.cw * 0.5));
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        if (best) {
          sendCatToProp(best, sp.id, now, true);
          paintCat(best, now);
          scheduleNext(true);
        }
      };
      cv.addEventListener('pointerdown', onPropClick);
      node.cleanup = () => cv.removeEventListener('pointerdown', onPropClick);
      return node;
    });

    let lastPropsSw = 0;
    let lastPropsKey = '';
    const computePropX = (pr, sw) => {
      const minX = 18;
      const maxX = Math.max(minX + 4, sw - minX - pr.cw);
      if (pr.id === 'bowl') return Math.min(maxX, Math.max(minX, Math.round(sw * pr.pct)));
      return Math.max(minX, Math.min(maxX, Math.round(sw * pr.pct - pr.cw * 0.5)));
    };

    const drawProps = (sw, force = false) => {
      const curDpr = Math.max(1, Math.min(2, readDpr() || 1));
      const dark = isDarkThemeNow();
      const propsKey = `${sw}:${curDpr}:${dark ? 1 : 0}:${sCfg.catProps}:${sw < 420 ? 1 : 0}`;
      if (!force && sw === lastPropsSw && propsKey === lastPropsKey) return;
      lastPropsSw = sw;
      lastPropsKey = propsKey;

      const propsEnabled = sCfg.catProps !== 'off';
      const compact = sw < 420;
      const halo = dark ? DARK_HALO_COLOR : null;

      for (const pr of propNodes) {
        const show = propsEnabled && (!compact || pr.compactVisible);
        pr.visible = show;
        pr.cv.style.display = show ? '' : 'none';
        if (pr.frontCv) pr.frontCv.style.display = show ? '' : 'none';
        if (!show) continue;

        pr.x = computePropX(pr, sw);
        const tx = `translate3d(${Math.round(pr.x)}px,0px,0)`;
        if (pr.cv.style.transform !== tx) pr.cv.style.transform = tx;
        if (pr.frontCv && pr.frontCv.style.transform !== tx) pr.frontCv.style.transform = tx;

        const dKey = `${curDpr}:${dark ? 1 : 0}`;
        if (pr.ctx && (force || pr.drawnKey !== dKey || pr.cv.width === 0)) {
          pr.drawnKey = dKey;
          const pw = Math.round((pr.rows[0].length + 2) * pr.px * curDpr);
          const ph = Math.round((pr.rows.length + 1) * pr.px * curDpr);
          pr.cv.width = pw;
          pr.cv.height = ph;
          pr.ctx.setTransform(1, 0, 0, 1, 0, 0);
          pr.ctx.clearRect(0, 0, pw, ph);
          pr.ctx.imageSmoothingEnabled = false;
          drawCrispGrid(pr.ctx, pr.rows, pr.px, curDpr, 1, 1, (ch) => (ch === '.' ? null : pr.pal[ch]), false, pw, halo);

          if (pr.frontCv && pr.frontCtx && pr.frontRows) {
            const fph = Math.round((pr.frontRows.length + 1) * pr.px * curDpr);
            pr.frontCv.width = pw;
            pr.frontCv.height = fph;
            pr.frontCtx.setTransform(1, 0, 0, 1, 0, 0);
            pr.frontCtx.clearRect(0, 0, pw, fph);
            pr.frontCtx.imageSmoothingEnabled = false;
            drawCrispGrid(pr.frontCtx, pr.frontRows, pr.px, curDpr, 1, 1, (ch) => (ch === '.' ? null : pr.pal[ch]), false, pw, null);
          }
        }
      }
    };

    // Shared interactive pixel yarn ball (unified px: 1.5)
    const yarnCv = markNoTrOwned(doc.createElement('canvas'));
    yarnCv.className = 'ag-v2-cat-pet';
    yarnCv.setAttribute('aria-hidden', 'true');
    const yarnSize = Math.round((YARN_SPRITE[0].length + 2) * PX);
    yarnCv.style.width = `${yarnSize}px`;
    yarnCv.style.height = `${yarnSize}px`;
    yarnCv.style.zIndex = '5';
    yarnCv.style.display = 'none';
    yarnCv.style.pointerEvents = 'none';
    wrap.appendChild(yarnCv);
    const yarn = {
      cv: yarnCv,
      ctx: typeof yarnCv.getContext === 'function' ? yarnCv.getContext('2d') : null,
      active: false,
      x: 120,
      y: 0,
      vx: 0,
      vy: 0,
      until: 0,
      lastHitCat: null,
      lastHitAt: 0,
      drawnKey: '',
    };
    const drawYarn = () => {
      if (!yarn.ctx) return;
      const curDpr = Math.max(1, Math.min(2, readDpr() || 1));
      const dark = isDarkThemeNow();
      const dKey = `${curDpr}:${dark ? 1 : 0}`;
      const pw = Math.round(yarnSize * curDpr);
      if (yarn.cv.width !== pw || yarn.drawnKey !== dKey) {
        yarn.drawnKey = dKey;
        yarn.cv.width = pw;
        yarn.cv.height = pw;
        yarn.ctx.setTransform(1, 0, 0, 1, 0, 0);
        yarn.ctx.clearRect(0, 0, pw, pw);
        yarn.ctx.imageSmoothingEnabled = false;
        drawCrispGrid(
          yarn.ctx,
          YARN_SPRITE,
          PX,
          curDpr,
          1,
          1,
          (ch) => (ch === '.' ? null : ch === 'O' ? '#2D1D28' : ch === 'p' ? '#FBCFE8' : '#F472B6'),
          false,
          pw,
          dark ? DARK_HALO_COLOR : null
        );
      }
      yarn.cv.style.transform = `translate3d(${Math.round(yarn.x)}px,${Math.round(yarn.y)}px,0)`;
    };
    const spawnYarn = (originX, now) => {
      const sw = Math.max(220, readStageWidth());
      dismissButterfly();
      yarn.active = true;
      yarn.x = Math.max(24, Math.min(sw - 38, originX));
      yarn.y = -8;
      yarn.vx = (originX > sw * 0.5 ? -1 : 1) * (3.6 + Math.random() * 1.6);
      yarn.vy = -3.8;
      yarn.until = now + 8500;
      yarn.lastHitCat = null;
      yarn.lastHitAt = 0;
      yarn.cv.style.display = '';
      drawYarn();
      scheduleNext(true);
    };

    // Occasional pastel pixel butterfly (idle / non-streaming only, unified px: 1.5)
    const bfCv = markNoTrOwned(doc.createElement('canvas'));
    bfCv.className = 'ag-v2-cat-pet';
    bfCv.setAttribute('data-sanctuary-fx', 'butterfly');
    bfCv.setAttribute('aria-hidden', 'true');
    const bfW = Math.round((5 + 2) * PX); // 11px
    const bfH = Math.round((4 + 2) * PX); // 9px
    bfCv.style.width = `${bfW}px`;
    bfCv.style.height = `${bfH}px`;
    bfCv.style.zIndex = '5';
    bfCv.style.display = 'none';
    bfCv.style.pointerEvents = 'none';
    wrap.appendChild(bfCv);
    const butterfly = {
      cv: bfCv,
      ctx: typeof bfCv.getContext === 'function' ? bfCv.getContext('2d') : null,
      active: false,
      fleeing: false,
      x: 120,
      y: -18,
      baseY: -18,
      vx: 0.9,
      phase: 0,
      tint: 0,
      bornAt: 0,
      until: 0,
      nextSpawnAt: nowMs() + 18000 + Math.random() * 10000,
      hunterId: null,
      drawnKey: '',
    };
    const BUTTERFLY_TINTS = [
      { p: '#F9A8D4', y: '#FDE68A', O: '#4A3348' },
      { p: '#93C5FD', y: '#DDD6FE', O: '#2E3B55' },
      { p: '#FDE68A', y: '#FCA5A5', O: '#4A3828' },
    ];
    const dismissButterfly = () => {
      if (!butterfly.active) return;
      butterfly.active = false;
      butterfly.fleeing = false;
      butterfly.hunterId = null;
      butterfly.cv.style.display = 'none';
    };
    const drawButterfly = (now) => {
      if (!butterfly.ctx) return;
      const curDpr = Math.max(1, Math.min(2, readDpr() || 1));
      const dark = isDarkThemeNow();
      const frameIdx = Math.floor(now / 150) % 2;
      const dKey = `${frameIdx}:${butterfly.tint}:${curDpr}:${dark ? 1 : 0}`;
      const pw = Math.round(bfW * curDpr);
      const ph = Math.round(bfH * curDpr);
      if (butterfly.cv.width !== pw || butterfly.cv.height !== ph || butterfly.drawnKey !== dKey) {
        butterfly.drawnKey = dKey;
        butterfly.cv.width = pw;
        butterfly.cv.height = ph;
        butterfly.ctx.setTransform(1, 0, 0, 1, 0, 0);
        butterfly.ctx.clearRect(0, 0, pw, ph);
        butterfly.ctx.imageSmoothingEnabled = false;
        const pal = BUTTERFLY_TINTS[butterfly.tint % BUTTERFLY_TINTS.length];
        drawCrispGrid(
          butterfly.ctx,
          BUTTERFLY_FRAMES[frameIdx],
          PX,
          curDpr,
          1,
          1,
          (ch) => (ch === '.' ? null : pal[ch] || pal.p),
          butterfly.vx < 0,
          pw,
          dark ? DARK_HALO_COLOR : null
        );
      }
      butterfly.cv.style.transform = `translate3d(${Math.round(butterfly.x)}px,${Math.round(butterfly.y)}px,0)`;
    };
    const spawnButterfly = (sw, now) => {
      const fromLeft = Math.random() < 0.5;
      butterfly.active = true;
      butterfly.fleeing = false;
      butterfly.x = fromLeft ? 24 : sw - 36;
      butterfly.baseY = -(18 + Math.round(Math.random() * 8));
      butterfly.y = butterfly.baseY;
      butterfly.vx = (fromLeft ? 1 : -1) * (0.95 + Math.random() * 0.45);
      butterfly.phase = Math.random() * Math.PI * 2;
      butterfly.tint = Math.floor(Math.random() * BUTTERFLY_TINTS.length);
      butterfly.bornAt = now;
      butterfly.until = now + 7500 + Math.random() * 2500;
      butterfly.hunterId = null;
      butterfly.cv.style.display = '';
      drawButterfly(now);
    };

    const ptr = { active: false, clientX: 0, clientY: 0, lastAt: 0 };
    let cachedStageRect = null;
    let stageRectAt = 0;
    const onGlobalMove = (ev) => {
      ptr.active = true;
      ptr.clientX = ev.clientX || 0;
      ptr.clientY = ev.clientY || 0;
      ptr.lastAt = nowMs();
    };
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('pointermove', onGlobalMove, { passive: true });
    }

    const setSym = (c, sym, now, dur) => {
      c.sym = sym;
      c.symBornAt = now;
      c.symUntil = now + dur;
    };

    const notifyDragState = () => {
      let any = false;
      for (const c of cats) {
        if (c.dragging) {
          any = true;
          break;
        }
      }
      try { onDragStateChange(any); } catch (_) {}
    };

    const cats = CAT_PRESETS.map((pr, idx) => {
      const cv = markNoTrOwned(doc.createElement('canvas'));
      cv.className = 'ag-v2-cat-pet';
      cv.setAttribute('data-cat-id', pr.id);
      cv.setAttribute('data-cat-breed', pr.breed);
      cv.setAttribute('aria-hidden', 'true'); // Never place tabindex="0" inside aria-hidden parent
      const totalCols = pr.bodyCols + PAD_X * 2;
      const totalRows = pr.bodyRows + HEADROOM_ROWS;
      const cw = Math.round(totalCols * pr.px);
      const ch = Math.round(totalRows * pr.px);
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      cv.style.zIndex = '4';
      wrap.appendChild(cv);
      const now0 = nowMs();
      const initStates = ['loaf', 'sit', 'groom', 'sit'];
      const c = {
        ...pr,
        idx,
        totalCols,
        totalRows,
        cv,
        ctx: typeof cv.getContext === 'function' ? cv.getContext('2d') : null,
        cw,
        ch,
        x: 40 + idx * 96,
        y: 0,
        vy: 0,
        dir: idx % 2 === 0 ? -1 : 1,
        state: initStates[idx] || 'sit',
        until: now0 + 2600 + idx * 1000,
        targetX: null,
        targetProp: null,
        atProp: null,
        cuddleTarget: null,
        queuedHop: false,
        tsundereUntil: 0,
        squishUntil: 0,
        boopOffset: 0,
        boopUntil: 0,
        blinkUntil: 0,
        nextBlink: now0 + 1400 + idx * 700,
        twitchUntil: 0,
        nextTwitch: now0 + 3000 + idx * 1200,
        sym: null,
        symBornAt: 0,
        symUntil: 0,
        petCount: 0,
        lastPetAt: 0,
        gazeDx: 0,
        dragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragMoved: false,
        cancelDrag: null,
        visible: true,
        lastSig: '',
        lastTx: '',
        lastZ: '4',
        placed: false,
      };

      const readLocalY = (ev) => {
        if (ev && typeof ev.offsetY === 'number' && Number.isFinite(ev.offsetY)) return ev.offsetY;
        if (ev && typeof ev.clientY === 'number' && typeof cv.getBoundingClientRect === 'function') {
          const r = cv.getBoundingClientRect();
          if (r && r.height > 0) return ev.clientY - r.top;
        }
        return HEADROOM_ROWS * c.px;
      };

      const onHoverMove = (ev) => {
        if (peekHidden || c.dragging) return;
        const hitBody = readLocalY(ev) >= HEADROOM_ROWS * c.px;
        const nextCur = hitBody ? 'grab' : 'default';
        if (cv.style.cursor !== nextCur) cv.style.cursor = nextCur;
      };

      const onPd = (ev) => {
        if (peekHidden || disposed || !c.visible) return;
        if (ev && ev.button !== undefined && ev.button !== 0) return;
        // Ignore transparent bubble headroom above cat ears (offsetY < 8 * px)
        if (readLocalY(ev) < HEADROOM_ROWS * c.px) return;
        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

        const nowDown = nowMs();
        markUserInteraction(nowDown);
        if (c.cancelDrag) c.cancelDrag();

        c.dragging = true;
        c.dragMoved = false;
        c.targetX = null;
        c.targetProp = null;
        c.atProp = null;
        c.cuddleTarget = null;
        c.dragStartX = (ev && ev.clientX) || 0;
        c.dragStartY = (ev && ev.clientY) || 0;
        const x0 = c.x;
        const y0 = c.y;

        const unbind = () => {
          if (win && typeof win.removeEventListener === 'function') {
            win.removeEventListener('pointermove', onPm);
            win.removeEventListener('pointerup', onPu);
            win.removeEventListener('pointercancel', onPu);
          }
          c.cancelDrag = null;
        };

        const onPm = (mv) => {
          if (!c.dragging || disposed || peekHidden) return;
          const dx = ((mv && mv.clientX) || 0) - c.dragStartX;
          const dy = ((mv && mv.clientY) || 0) - c.dragStartY;
          if (!c.dragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            c.dragMoved = true;
            notifyDragState();
          }
          if (c.dragMoved) {
            const sw = Math.max(220, readStageWidth());
            c.x = Math.max(18, Math.min(sw - 18 - c.cw, x0 + dx));
            c.y = Math.min(0, Math.max(-40, y0 + dy));
            c.state = 'dangle';
            c.until = nowMs() + 900;
            paintCat(c, nowMs());
          }
        };

        const onPu = () => {
          unbind();
          const wasDragging = c.dragging;
          c.dragging = false;
          notifyDragState();
          if (!wasDragging || disposed || peekHidden) return;
          const now = nowMs();
          markUserInteraction(now);
          if (!c.dragMoved) {
            focusNap = false;
            const quickTap = now - c.lastPetAt < 480;
            c.petCount = now - c.lastPetAt < 2200 ? c.petCount + 1 : 1;
            c.lastPetAt = now;
            if (quickTap) {
              spawnYarn(c.x + c.cw * 0.5, now);
              c.state = 'wave';
              c.until = now + 900;
              setSym(c, 'spark', now, 900);
            } else if (c.breed === 'tabby') {
              // Chonky tabby: squishy pancake bounce-flatten when petted!
              c.state = 'happy';
              c.squishUntil = now + 280;
              c.until = now + 1500;
              setSym(c, c.petCount >= 3 ? 'hearts2' : 'heart', now, 1400);
              c.vy = -3.4;
              c.y = -1;
            } else if (c.breed === 'kitten') {
              // Tiny ginger kitten: excited double-hop + sparkles!
              c.state = 'happy';
              c.queuedHop = true;
              c.until = now + 1500;
              setSym(c, 'spark', now, 1300);
              c.vy = -4.6;
              c.y = -1;
            } else if (c.breed === 'calico') {
              // Fluffy calico: graceful musical note & plume-tail flourish!
              c.state = 'happy';
              c.until = now + 1600;
              setSym(c, c.petCount >= 3 ? 'hearts2' : 'note', now, 1500);
              c.vy = -3.6;
              c.y = -1;
            } else {
              // Slender Siamese: curious head-tilt '?' -> tsundere heart!
              c.state = 'tilt';
              c.tsundereUntil = now + 520;
              c.until = now + 1800;
              setSym(c, 'q', now, 520);
            }
          } else {
            c.state = 'happy';
            c.until = now + 1000;
            c.vy = 0;
            setSym(c, 'heart', now, 900);
          }
          paintCat(c, now);
          scheduleNext(true);
        };

        c.cancelDrag = () => {
          unbind();
          if (c.dragging) {
            c.dragging = false;
            c.dragMoved = false;
            c.y = 0;
            c.vy = 0;
            if (c.state === 'dangle') c.state = 'sit';
            notifyDragState();
          }
        };

        if (win && typeof win.addEventListener === 'function') {
          win.addEventListener('pointermove', onPm);
          win.addEventListener('pointerup', onPu);
          win.addEventListener('pointercancel', onPu);
        }
      };

      cv.addEventListener('pointerdown', onPd);
      cv.addEventListener('pointermove', onHoverMove, { passive: true });
      c.cleanup = () => {
        if (c.cancelDrag) c.cancelDrag();
        cv.removeEventListener('pointerdown', onPd);
        cv.removeEventListener('pointermove', onHoverMove);
      };
      return c;
    });

    const cancelAllDrags = () => {
      for (const c of cats) {
        if (c.cancelDrag) c.cancelDrag();
        else if (c.dragging) {
          c.dragging = false;
          c.y = 0;
          c.vy = 0;
        }
      }
      notifyDragState();
    };
    const unregisterDragRelease = registerDragRelease(cancelAllDrags);

    const syncActiveCatTiers = (sw) => {
      const cfgMax = sCfg.catCount === '1' ? 1 : sCfg.catCount === '2' ? 2 : 4;
      const widthMax = sw < 300 ? 2 : sw < 420 ? 3 : 4;
      const limit = Math.min(cfgMax, widthMax);
      for (let i = 0; i < cats.length; i++) {
        const c = cats[i];
        const show = i < limit;
        if (c.visible !== show) {
          c.visible = show;
          c.cv.style.display = show ? '' : 'none';
          if (!show && c.cancelDrag) c.cancelDrag();
        }
      }
    };

    const isPropBusy = (propId, excludeCat) =>
      cats.some((o) => o.visible && o !== excludeCat && (o.atProp === propId || o.targetProp === propId));

    const propAnchorX = (c, propId, sw) => {
      const pr = propById[propId];
      if (!pr || !pr.visible) return c.x;
      const minX = 18;
      const maxX = Math.max(minX + 8, sw - 18 - c.cw);
      let tx = pr.x + pr.cw * 0.5 - c.cw * 0.5;
      if (propId === 'bowl') tx = pr.x + pr.cw - 4;
      else if (propId === 'post') tx = pr.x - c.cw + 5;
      else if (propId === 'plant') tx = pr.x + pr.cw - 2;
      return Math.max(minX, Math.min(maxX, Math.round(tx)));
    };

    const arriveAtProp = (c, propId, now) => {
      c.targetX = null;
      c.targetProp = null;
      c.atProp = propId;
      if (propId === 'cushion') {
        c.state = 'sleep';
        c.y = -2;
        c.vy = 0;
        c.until = now + 7200 + Math.random() * 5200;
        c.sym = null;
      } else if (propId === 'bowl') {
        c.dir = -1;
        c.state = 'eat';
        c.until = now + (c.breed === 'tabby' ? 4400 : 3200) + Math.random() * 2000;
        setSym(c, c.breed === 'tabby' ? 'fish' : 'heart', now, 1600);
      } else if (propId === 'post') {
        c.dir = 1;
        c.state = c.breed === 'siamese' ? 'scratch' : 'wave';
        c.until = now + (c.breed === 'siamese' ? 2800 : 2000) + Math.random() * 1400;
        setSym(c, 'spark', now, 1300);
      } else {
        c.dir = -1;
        c.state = 'happy';
        c.until = now + 1800;
        setSym(c, 'note', now, 1300);
      }
    };

    const sendCatToProp = (c, propId, now, fromClick) => {
      const pr = propById[propId];
      if (!pr || !pr.visible) return;
      const sw = Math.max(220, readStageWidth());
      drawProps(sw);
      const tx = propAnchorX(c, propId, sw);
      c.atProp = null;
      c.cuddleTarget = null;
      if (c.y < 0 && c.vy === 0) c.y = 0;
      if (Math.abs(tx - c.x) <= 6) {
        c.x = tx;
        arriveAtProp(c, propId, now);
      } else {
        c.targetX = tx;
        c.targetProp = propId;
        c.state = 'walk';
        c.dir = tx > c.x ? 1 : -1;
        c.until = now + 7000;
        if (fromClick) setSym(c, 'spark', now, 750);
      }
    };

    const overlapsAnyProp = (cx, cw) => {
      const a0 = cx + 2;
      const a1 = cx + cw - 2;
      for (const pr of propNodes) {
        if (!pr.visible) continue;
        if (a1 > pr.x - 4 && a0 < pr.x + pr.cw + 4) return pr;
      }
      return null;
    };

    const hasCrowdNear = (c, cx) => {
      for (const o of cats) {
        if (!o.visible || o === c || o.dragging) continue;
        const minSep = (c.cw + o.cw) * 0.54;
        if (Math.abs(cx + c.cw * 0.5 - (o.x + o.cw * 0.5)) < minSep) return o;
      }
      return null;
    };

    const pickClearSpot = (c, sw) => {
      const minX = 22;
      const maxX = Math.max(minX + 16, sw - 22 - c.cw);
      let bestX = c.x;
      let bestScore = -1e9;
      for (let tries = 0; tries < 14; tries++) {
        const cand = Math.round(minX + Math.random() * (maxX - minX));
        let nearestCat = Infinity;
        for (const o of cats) {
          if (!o.visible || o === c) continue;
          nearestCat = Math.min(nearestCat, Math.abs(cand + c.cw * 0.5 - (o.x + o.cw * 0.5)));
        }
        let propPenalty = 0;
        for (const pr of propNodes) {
          if (!pr.visible) continue;
          const overlap = Math.min(cand + c.cw, pr.x + pr.cw + 4) - Math.max(cand, pr.x - 4);
          if (overlap > 0) propPenalty += 120 + overlap * 2;
        }
        const score = Math.min(nearestCat, 140) - propPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestX = cand;
        }
      }
      return bestX;
    };

    const resolvePoseKey = (c, now) => {
      const fastStep = Math.floor(now / 145) % 2;
      const medStep = Math.floor(now / 260) % 2;
      const slowStep = Math.floor(now / 460) % 2;
      const sleepStep = Math.floor(now / 900) % 2;
      const p = c.poses;
      if (c.dragging || c.state === 'dangle') return 'dangle';
      if (now < c.squishUntil && p.squish) return 'squish';
      if (c.state === 'pounce' || (c.y < -5 && p.pounce)) return p.pounce ? 'pounce' : 'happy';
      if (c.state === 'wiggle' && p.wiggle1) return fastStep === 0 ? 'wiggle1' : 'wiggle2';
      if (c.state === 'scratch' && p.scratch1) return Math.floor(now / 120) % 2 === 0 ? 'scratch1' : 'scratch2';
      if (c.state === 'loaf' && p.loaf1) return slowStep === 0 ? 'loaf1' : 'loaf2';
      if (c.state === 'belly' && p.belly1) return medStep === 0 ? 'belly1' : 'belly2';
      if (c.state === 'yawn' && p.yawn1) return Math.floor(now / 650) % 2 === 0 ? 'yawn1' : 'yawn2';
      if (c.state === 'tilt' && p.tilt) return 'tilt';
      if (c.state === 'walk') {
        if (p.hop1) return fastStep === 0 ? 'hop1' : 'hop2';
        if (p.strut1) return Math.floor(now / 170) % 2 === 0 ? 'strut1' : 'strut2';
        return fastStep === 0 ? 'walk1' : 'walk2';
      }
      if (c.state === 'eat') return medStep === 0 ? 'eat1' : 'eat2';
      if (c.state === 'sleep') return sleepStep === 0 ? 'sleep1' : 'sleep2';
      if (c.state === 'sit') return slowStep === 0 ? 'sitA' : 'sitB';
      if (c.state === 'groom' && p.groom1) return medStep === 0 ? 'groom1' : 'groom2';
      if (c.state === 'stretch' && p.stretch1) return slowStep === 0 ? 'stretch1' : 'stretch2';
      if (c.state === 'wave') return Math.floor(now / 190) % 2 === 0 ? 'wave1' : 'wave2';
      if (c.state === 'happy') return 'happy';
      if (now < c.twitchUntil && p.earL) return 'earL';
      if (now < c.blinkUntil && p.blink) return 'blink';
      return slowStep === 0 ? 'standA' : 'standB';
    };

    const paintCat = (c, now) => {
      if (!c.visible) return;
      const ctx2 = c.ctx;
      if (!ctx2) return;
      const curDpr = Math.max(1, Math.min(2, readDpr() || 1));
      const dark = isDarkThemeNow();
      const pw = Math.round(c.totalCols * c.px * curDpr);
      const ph = Math.round(c.totalRows * c.px * curDpr);
      if (c.cv.width !== pw || c.cv.height !== ph) {
        c.cv.width = pw;
        c.cv.height = ph;
        c.lastSig = '';
      }
      const nextZ = c.dragging ? '6' : c.atProp === 'cushion' ? '2' : '4';
      if (c.lastZ !== nextZ) {
        c.lastZ = nextZ;
        c.cv.style.zIndex = nextZ;
      }
      const boopDx = now < c.boopUntil ? c.boopOffset : 0;
      const tx = `translate3d(${Math.round(c.x + boopDx)}px,${Math.round(c.y)}px,0)`;
      if (c.lastTx !== tx) {
        c.lastTx = tx;
        c.cv.style.transform = tx;
      }

      const poseKey = resolvePoseKey(c, now);
      let activeSym = null;
      let symPhase = 0;
      if (c.sym && now < c.symUntil) {
        activeSym = c.sym;
        const dur = Math.max(400, c.symUntil - c.symBornAt);
        symPhase = Math.min(5, Math.floor(((now - c.symBornAt) / dur) * 6));
      } else if (c.state === 'sleep') {
        const zCycle = (now % 1800) / 1800;
        activeSym = zCycle < 0.5 ? 'z1' : 'z2';
        symPhase = Math.min(5, Math.floor(zCycle * 6));
      } else if (thinking && c.idx <= 1 && !focusNap && c.state === 'sit') {
        const tCycle = (now % 2200) / 2200;
        activeSym = c.idx === 0 ? 'think' : 'q';
        symPhase = Math.min(5, Math.floor(tCycle * 6));
      } else if (c.state === 'eat' && Math.floor(now / 1100) % 2 === 0) {
        activeSym = c.breed === 'tabby' ? 'fish' : 'note';
        symPhase = Math.floor((now % 1100) / 220);
      } else if (c.state === 'groom' && Math.floor(now / 1100) % 2 === 0) {
        activeSym = 'note';
        symPhase = Math.floor((now % 1100) / 220);
      }

      const scratchChipPhase = c.state === 'scratch' ? Math.floor(now / 110) % 4 : -1;
      const sig = `${poseKey}:${c.dir}:${activeSym || ''}:${symPhase}:${scratchChipPhase}:${curDpr}:${dark ? 1 : 0}`;
      if (c.lastSig === sig) return;
      c.lastSig = sig;

      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.clearRect(0, 0, pw, ph);
      ctx2.imageSmoothingEnabled = false;
      const rows = c.poses[poseKey] || c.poses.standA;

      drawCrispGrid(
        ctx2,
        rows,
        c.px,
        curDpr,
        PAD_X,
        HEADROOM_ROWS,
        (ch) => (ch === '.' ? null : c.pal[ch] || null),
        c.dir > 0,
        pw,
        dark ? DARK_HALO_COLOR : null
      );

      // Tiny pixel woodchip sparks during Siamese scratching-post frenzy
      if (scratchChipPhase >= 0) {
        const step = c.px * curDpr;
        const chips = [
          [20, HEADROOM_ROWS + 4 - scratchChipPhase, '#E9C89B'],
          [19 - (scratchChipPhase % 2), HEADROOM_ROWS + 7 - scratchChipPhase, '#FDE68A'],
          [21, HEADROOM_ROWS + 9 - (scratchChipPhase % 3), '#CFA674'],
        ];
        for (const [gx, gy, col] of chips) {
          const x0 = Math.round(gx * step);
          const y0 = Math.round(gy * step);
          const sz = Math.max(1, Math.round(step));
          ctx2.fillStyle = col;
          ctx2.fillRect(x0, y0, sz, sz);
        }
      }

      if (activeSym && SANCTUARY_SYMS[activeSym]) {
        const sRows = SANCTUARY_SYMS[activeSym];
        const sp = Math.max(1.25, c.px * 0.85);
        const sStep = sp * curDpr;
        const rise = symPhase * 0.42 * c.px * curDpr;
        const driftX = activeSym.startsWith('z') ? symPhase * 0.32 * c.px * curDpr : 0;
        const sx0 = Math.round(pw * 0.32 + driftX);
        const lowPose = poseKey.startsWith('sleep') || poseKey.startsWith('loaf') || poseKey.startsWith('belly');
        const sy0 = Math.round((lowPose ? 4.8 : 2.0) * c.px * curDpr - rise);
        ctx2.save();
        ctx2.globalAlpha = symPhase >= 5 ? 0.25 : symPhase >= 4 ? 0.55 : 0.95;
        for (let sy = 0; sy < sRows.length; sy++) {
          const sr = sRows[sy];
          const y0 = Math.round(sy0 + sy * sStep);
          const y1 = Math.round(sy0 + (sy + 1) * sStep);
          for (let sx = 0; sx < sr.length; sx++) {
            const sc = sr[sx];
            if (sc === '.') continue;
            const x0 = Math.round(sx0 + sx * sStep);
            const x1 = Math.round(sx0 + (sx + 1) * sStep);
            ctx2.fillStyle =
              sc === 'p' ? '#F472B6' :
              sc === 'y' ? '#F59E0B' :
              sc === 'w' ? '#FFFBEB' :
              sc === 'b' ? '#38BDF8' :
              sc === 'r' ? '#EF4444' :
              sc === 'i' ? (dark ? '#A5B4FC' : '#6366F1') :
              (dark ? '#CBD5E1' : '#94A3B8');
            ctx2.fillRect(x0, y0, x1 - x0, y1 - y0);
          }
        }
        ctx2.restore();
      }
    };

    const isQuietNapActive = (now) => {
      if (focusNap || sCfg.catQuietMode === 'nap') return true;
      if (streaming || thinking || yarn.active) return false;
      return now - lastInteractionAt >= IDLE_NAP_AFTER_MS;
    };

    const applyFocusNapState = (now) => {
      if (focusNap) dismissButterfly();
      for (const c of cats) {
        if (!c.visible || c.dragging) continue;
        c.targetX = null;
        c.targetProp = null;
        c.cuddleTarget = null;
        if (focusNap) {
          c.state = 'sleep';
          c.until = now + 15000;
          setSym(c, 'z1', now, 1200);
        } else {
          c.state = c.idx % 2 === 0 ? 'sit' : 'stand';
          c.until = now + 2600 + c.idx * 500;
          setSym(c, 'spark', now, 800);
        }
        paintCat(c, now);
      }
      scheduleNext(true);
    };

    const pickNextBehavior = (c, now, sw) => {
      c.targetX = null;
      c.targetProp = null;
      c.cuddleTarget = null;
      if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
      c.atProp = null;

      if (isQuietNapActive(now)) {
        c.state = 'sleep';
        c.until = now + 8000 + Math.random() * 5000;
        return;
      }
      if (thinking) {
        c.state = c.idx <= 1 ? 'sit' : 'sleep';
        c.until = now + 3400 + Math.random() * 2000;
        return;
      }
      if (streaming) {
        c.state = c.breed === 'tabby' ? 'loaf' : c.idx % 2 === 0 ? 'sit' : 'stand';
        c.until = now + 3200 + Math.random() * 2200;
        return;
      }

      if (hasCrowdNear(c, c.x) || overlapsAnyProp(c.x, c.cw)) {
        const tx = pickClearSpot(c, sw);
        c.targetX = tx;
        c.state = 'walk';
        c.dir = tx >= c.x ? 1 : -1;
        c.until = now + 4500;
        return;
      }

      const r = Math.random();
      const propsOn = sCfg.catProps !== 'off';

      // Species-specific signature behavior tables!
      if (c.breed === 'tabby') {
        if (propsOn && propById.bowl?.visible && r < 0.16 && !isPropBusy('bowl', c)) {
          sendCatToProp(c, 'bowl', now, false);
        } else if (propsOn && propById.cushion?.visible && r < 0.28 && !isPropBusy('cushion', c)) {
          sendCatToProp(c, 'cushion', now, false);
        } else if (r < 0.48) {
          c.state = 'loaf';
          c.until = now + 4400 + Math.random() * 3800;
        } else if (r < 0.62) {
          c.state = 'belly';
          setSym(c, 'heart', now, 1400);
          c.until = now + 2800 + Math.random() * 1800;
        } else if (r < 0.72) {
          c.state = 'yawn';
          c.until = now + 1800;
        } else if (r < 0.84) {
          const tx = pickClearSpot(c, sw);
          c.targetX = tx;
          c.state = 'walk';
          c.dir = tx >= c.x ? 1 : -1;
          c.until = now + 2600 + Math.random() * 2400;
        } else if (r < 0.93) {
          c.state = 'sleep';
          c.until = now + 5200 + Math.random() * 4400;
        } else {
          c.state = 'sit';
          c.until = now + 3000 + Math.random() * 2600;
        }
        return;
      }

      if (c.breed === 'kitten') {
        // Cozy Cuddle: occasionally trot beside sleeping/loafing chonky tabby to sync-nap!
        const chonk = cats[0];
        if (chonk && chonk !== c && chonk.visible && !chonk.dragging && (chonk.state === 'sleep' || chonk.state === 'loaf') && r < 0.22) {
          const sideLeft = chonk.x - c.cw - 3;
          const sideRight = chonk.x + chonk.cw + 3;
          const minX = 18;
          const maxX = Math.max(minX + 8, sw - 18 - c.cw);
          const cand = sideLeft >= minX && !overlapsAnyProp(sideLeft, c.cw) ? sideLeft : Math.min(maxX, sideRight);
          c.targetX = Math.max(minX, Math.min(maxX, Math.round(cand)));
          c.cuddleTarget = chonk.id;
          c.state = 'walk';
          c.dir = c.targetX >= c.x ? 1 : -1;
          c.until = now + 5200;
          return;
        }
        if (propsOn && propById.bowl?.visible && r < 0.30 && !isPropBusy('bowl', c)) {
          sendCatToProp(c, 'bowl', now, false);
        } else if (propsOn && propById.post?.visible && r < 0.38 && !isPropBusy('post', c)) {
          sendCatToProp(c, 'post', now, false);
        } else if (r < 0.66) {
          const tx = pickClearSpot(c, sw);
          c.targetX = tx;
          c.state = 'walk';
          c.dir = tx >= c.x ? 1 : -1;
          c.until = now + 2200 + Math.random() * 2200;
        } else if (r < 0.78) {
          c.state = 'wiggle';
          c.until = now + 750;
        } else if (r < 0.88) {
          c.state = 'sit';
          c.until = now + 2400 + Math.random() * 2200;
        } else if (r < 0.94) {
          c.state = 'sleep';
          c.until = now + 4200 + Math.random() * 3200;
        } else {
          c.state = 'pounce';
          c.vy = -4.5;
          c.y = -1;
          setSym(c, 'spark', now, 900);
          c.until = now + 850;
        }
        return;
      }

      if (c.breed === 'calico') {
        if (propsOn && propById.cushion?.visible && r < 0.14 && !isPropBusy('cushion', c)) {
          sendCatToProp(c, 'cushion', now, false);
        } else if (propsOn && propById.bowl?.visible && r < 0.22 && !isPropBusy('bowl', c)) {
          sendCatToProp(c, 'bowl', now, false);
        } else if (r < 0.44) {
          c.state = 'groom';
          c.until = now + 3000 + Math.random() * 2400;
        } else if (r < 0.58) {
          c.state = 'stretch';
          c.until = now + 2200 + Math.random() * 1200;
        } else if (r < 0.74) {
          const tx = pickClearSpot(c, sw);
          c.targetX = tx;
          c.state = 'walk';
          c.dir = tx >= c.x ? 1 : -1;
          c.until = now + 2600 + Math.random() * 2400;
        } else if (r < 0.86) {
          c.state = 'sit';
          c.until = now + 3200 + Math.random() * 2800;
        } else {
          c.state = 'sleep';
          c.until = now + 4800 + Math.random() * 3800;
        }
        return;
      }

      // Slender Siamese
      if (propsOn && propById.cushion?.visible && r < 0.22 && !isPropBusy('cushion', c)) {
        sendCatToProp(c, 'cushion', now, false);
      } else if (propsOn && propById.post?.visible && r < 0.40 && !isPropBusy('post', c)) {
        sendCatToProp(c, 'post', now, false);
      } else if (propsOn && propById.bowl?.visible && r < 0.47 && !isPropBusy('bowl', c)) {
        sendCatToProp(c, 'bowl', now, false);
      } else if (r < 0.68) {
        const tx = pickClearSpot(c, sw);
        c.targetX = tx;
        c.state = 'walk';
        c.dir = tx >= c.x ? 1 : -1;
        c.until = now + 2600 + Math.random() * 2400;
      } else if (r < 0.78) {
        c.state = 'tilt';
        setSym(c, 'q', now, 1300);
        c.until = now + 1800 + Math.random() * 1200;
      } else if (r < 0.90) {
        c.state = 'sit';
        c.until = now + 3400 + Math.random() * 2800;
      } else {
        c.state = 'sleep';
        c.until = now + 4800 + Math.random() * 3800;
      }
    };

    const enforceCatSeparation = (minX, sw) => {
      const active = cats.filter((c) => c.visible && !c.dragging && !c.atProp && !c.cuddleTarget);
      if (active.length < 2) return;
      active.sort((a, b) => a.x - b.x);
      for (let i = 0; i < active.length - 1; i++) {
        const a = active[i];
        const b = active[i + 1];
        if (a.state !== 'walk' && b.state !== 'walk') continue;
        const minGap = (a.cw + b.cw) * 0.44;
        const curGap = b.x - a.x;
        if (curGap < minGap) {
          const push = (minGap - curGap) * 0.5;
          const aMax = Math.max(minX + 8, sw - 18 - a.cw);
          const bMax = Math.max(minX + 8, sw - 18 - b.cw);
          a.x = Math.max(minX, Math.min(aMax, a.x - push));
          b.x = Math.max(minX, Math.min(bMax, b.x + push));
        }
      }
    };

    let stepTimer = null;
    let lastStepAt = 0;
    let lastBoopAt = 0;

    const cancelSched = () => {
      if (stepTimer !== null) {
        clearTimeout(stepTimer);
        stepTimer = null;
      }
    };

    const shouldSuspend = () =>
      Boolean(disposed || !running || pausedPower || peekHidden || isVramSleepState() || isWindowBlurred());

    const computeNextDelayMs = (now) => {
      if (getReducedMotion()) return 0;
      if (yarn.active || butterfly.active) return 32;
      let anyFast = false;
      let allSleeping = true;
      for (const c of cats) {
        if (!c.visible) continue;
        if (
          c.dragging ||
          c.state === 'walk' ||
          c.state === 'scratch' ||
          c.state === 'wiggle' ||
          c.vy !== 0 ||
          now < c.squishUntil ||
          now < c.boopUntil ||
          (c.y < 0 && c.atProp !== 'cushion')
        ) {
          anyFast = true;
          allSleeping = false;
          break;
        }
        if (c.state !== 'sleep' || (c.sym && now < c.symUntil)) {
          allSleeping = false;
        }
      }
      if (anyFast) return 32;
      if (allSleeping && isQuietNapActive(now)) return 900;
      return 160;
    };

    const scheduleNext = (immediateReset = false) => {
      if (shouldSuspend()) {
        cancelSched();
        return;
      }
      if (immediateReset) cancelSched();
      if (stepTimer !== null) return;
      const delay = computeNextDelayMs(nowMs());
      if (delay <= 0) return;
      stepTimer = setTimeout(() => {
        stepTimer = null;
        if (shouldSuspend()) return;
        step(nowMs());
        scheduleNext(false);
      }, delay);
      if (stepTimer && typeof stepTimer.unref === 'function') stepTimer.unref();
    };

    const step = (nowArg) => {
      if (shouldSuspend()) {
        cancelSched();
        dismissButterfly();
        publishRimState(false, 0, nowMs());
        return;
      }
      const now = typeof nowArg === 'number' ? nowArg : nowMs();
      const dt = lastStepAt ? Math.min(80, Math.max(12, now - lastStepAt)) : 32;
      const dtScale = dt / 55;
      lastStepAt = now;
      vramReclaimed = false;

      const reduced = Boolean(getReducedMotion());
      const sw = Math.max(220, readStageWidth());
      const minX = 18;
      syncActiveCatTiers(sw);
      drawProps(sw);

      const quietNapNow = isQuietNapActive(now);

      // Occasional Pixel Butterfly lifecycle (calm idle only, never during streaming/thinking/nap/yarn)
      const allowButterfly = !reduced && !streaming && !thinking && !quietNapNow && !yarn.active && sw >= 300;
      if (!allowButterfly) {
        dismissButterfly();
      } else if (!butterfly.active && now >= butterfly.nextSpawnAt) {
        spawnButterfly(sw, now);
      }

      if (butterfly.active) {
        butterfly.phase += 0.22 * dtScale;
        butterfly.x += butterfly.vx * (butterfly.fleeing ? 2.4 : 1) * dtScale;
        if (butterfly.fleeing) {
          butterfly.y -= 1.6 * dtScale;
        } else {
          butterfly.y = butterfly.baseY + Math.sin(butterfly.phase) * 4.5;
        }
        if (now >= butterfly.until || butterfly.x < 6 || butterfly.x > sw - 16 || butterfly.y < -44) {
          dismissButterfly();
          butterfly.nextSpawnAt = now + 18000 + Math.random() * 12000;
        } else {
          drawButterfly(now);
          // Pick hunter: Tiny Ginger Kitten priority, fallback Siamese
          let hunter = cats.find((c) => c.visible && !c.dragging && c.id === butterfly.hunterId) || null;
          if (!hunter) {
            hunter = cats.find((c) => c.visible && !c.dragging && c.breed === 'kitten') ||
                     cats.find((c) => c.visible && !c.dragging && c.breed === 'siamese') || null;
            if (hunter) butterfly.hunterId = hunter.id;
          }
          if (hunter && !butterfly.fleeing && hunter.state !== 'pounce') {
            const dist = butterfly.x - (hunter.x + hunter.cw * 0.5);
            hunter.dir = dist >= 0 ? 1 : -1;
            if (Math.abs(dist) < 42) {
              if (hunter.state !== 'wiggle') {
                hunter.targetX = null;
                hunter.targetProp = null;
                hunter.atProp = null;
                hunter.state = 'wiggle';
                hunter.until = now + 560;
              } else if (now >= hunter.until - 80) {
                hunter.state = 'pounce';
                hunter.vy = -4.6;
                hunter.y = -1;
                hunter.until = now + 850;
                setSym(hunter, 'spark', now, 850);
                butterfly.fleeing = true;
                butterfly.vx = (dist >= 0 ? 1 : -1) * 1.8;
              }
            } else if (Math.abs(dist) < 220 && hunter.state !== 'wiggle') {
              hunter.targetX = null;
              hunter.targetProp = null;
              hunter.atProp = null;
              hunter.state = 'walk';
              hunter.until = now + 600;
            }
          }
        }
      }

      // Multi-Cat Yarn Soccer (nearest 1-2 cats actively chase & bat yarn back and forth!)
      let yarnChasers = null;
      if (yarn.active) {
        if (now >= yarn.until) {
          yarn.active = false;
          yarn.cv.style.display = 'none';
        } else {
          yarn.x += yarn.vx * dtScale;
          yarn.vx *= Math.pow(0.968, dtScale);
          if (yarn.x <= minX) {
            yarn.x = minX;
            yarn.vx = Math.abs(yarn.vx) * 0.86;
          } else if (yarn.x >= sw - 32) {
            yarn.x = sw - 32;
            yarn.vx = -Math.abs(yarn.vx) * 0.86;
          }
          if (yarn.y < 0 || yarn.vy !== 0) {
            yarn.y += yarn.vy * dtScale;
            yarn.vy += 0.95 * dtScale;
            if (yarn.y >= 0) {
              yarn.y = 0;
              yarn.vy = Math.abs(yarn.vy) > 1.5 ? -yarn.vy * 0.5 : 0;
            }
          }
          drawYarn();
          const eligible = cats.filter((c) => c.visible && !c.dragging && !focusNap);
          eligible.sort((a, b) => {
            const da = Math.abs(a.x + a.cw * 0.5 - yarn.x) - (a.breed === 'kitten' ? 60 : 0);
            const db = Math.abs(b.x + b.cw * 0.5 - yarn.x) - (b.breed === 'kitten' ? 60 : 0);
            return da - db;
          });
          yarnChasers = new Set(eligible.slice(0, 2));
        }
      }

      for (const c of cats) {
        if (!c.visible) continue;
        const maxX = Math.max(minX + 8, sw - 18 - c.cw);
        if (!c.placed) {
          c.x = Math.max(minX, Math.min(maxX, Math.round(minX + (maxX - minX) * c.xPct)));
          c.placed = true;
        } else if (!c.dragging && c.x > maxX) {
          c.x = maxX;
        }
        if (c.dragging) {
          paintCat(c, now);
          continue;
        }

        // Siamese tsundere pet transition: tilt '?' -> happy heart
        if (c.tsundereUntil > 0 && now >= c.tsundereUntil) {
          c.tsundereUntil = 0;
          c.state = 'happy';
          c.until = now + 1300;
          setSym(c, 'heart', now, 1300);
        }

        if ((c.y < 0 && c.atProp !== 'cushion') || c.vy !== 0) {
          c.y += c.vy * dtScale;
          c.vy += 1.42 * dtScale;
          if (c.y >= 0) {
            c.y = 0;
            c.vy = 0;
            if (c.queuedHop) {
              c.queuedHop = false;
              c.vy = -3.8;
              c.y = -1;
              setSym(c, 'heart', now, 1000);
            } else if (c.state === 'pounce') {
              c.state = 'happy';
              c.until = now + 700;
            }
          }
        }

        if (!reduced && now >= c.nextBlink) {
          c.blinkUntil = now + 170;
          c.nextBlink = now + 2600 + Math.random() * 3400;
        }
        if (!reduced && now >= c.nextTwitch) {
          c.twitchUntil = now + 220;
          c.nextTwitch = now + 4200 + Math.random() * 4800;
        }

        // Yarn Soccer AI for the active 1-2 chasers
        if (!reduced && yarn.active && yarnChasers && yarnChasers.has(c)) {
          c.targetX = null;
          c.targetProp = null;
          c.atProp = null;
          c.cuddleTarget = null;
          const cx = c.x + c.cw * 0.5;
          const dist = yarn.x + 7 - cx;
          if (Math.abs(dist) < c.cw * 0.52 && (yarn.lastHitCat !== c.id || now - yarn.lastHitAt > 360)) {
            yarn.lastHitCat = c.id;
            yarn.lastHitAt = now;
            // Bat toward the other chaser if present, else away!
            let batDir = dist >= 0 ? 1 : -1;
            for (const other of yarnChasers) {
              if (other !== c) batDir = other.x >= c.x ? 1 : -1;
            }
            yarn.vx = batDir * (4.4 + Math.random() * 2.0);
            yarn.vy = -3.6;
            c.dir = batDir;
            c.state = 'wave';
            c.until = now + 520;
            if (c.breed === 'kitten') {
              c.vy = -3.2;
              c.y = -1;
            }
            setSym(c, 'spark', now, 700);
          } else if (c.state !== 'wave' || now >= c.until) {
            c.state = 'walk';
            c.dir = dist < 0 ? -1 : 1;
            c.until = now + 500;
          }
        } else if (!reduced && now >= c.until) {
          // Kitten wiggle transitions straight into a playful mini-pounce!
          if (c.breed === 'kitten' && c.state === 'wiggle') {
            c.state = 'pounce';
            c.vy = -4.4;
            c.y = -1;
            setSym(c, 'spark', now, 850);
            c.until = now + 800;
          } else {
            pickNextBehavior(c, now, sw);
          }
        }

        if (!reduced && c.state === 'walk') {
          const boost = yarn.active ? 1.38 : 1;
          const stepPx = c.speed * 2.2 * boost * dtScale;
          if (c.targetX !== null) {
            const rem = c.targetX - c.x;
            if (Math.abs(rem) <= stepPx + 1.5) {
              c.x = c.targetX;
              if (c.targetProp) {
                arriveAtProp(c, c.targetProp, now);
              } else if (c.cuddleTarget) {
                // Arrived beside chonky tabby -> Cozy Cuddle sync-nap!
                c.targetX = null;
                c.state = 'sleep';
                c.until = now + 6800 + Math.random() * 4000;
                setSym(c, 'heart', now, 1400);
              } else {
                c.targetX = null;
                c.state = c.breed === 'tabby' && Math.random() < 0.5 ? 'loaf' : Math.random() < 0.5 ? 'stand' : 'sit';
                c.until = now + 2600 + Math.random() * 2600;
              }
            } else {
              c.dir = rem > 0 ? 1 : -1;
              c.x += c.dir * stepPx;
            }
          } else {
            c.x += c.dir * stepPx;
            if (c.x <= minX) {
              c.x = minX;
              c.dir = 1;
            } else if (c.x >= maxX) {
              c.x = maxX;
              c.dir = -1;
            }
          }
        }
      }

      enforceCatSeparation(minX, sw);

      // Nose Boop Greeting (when two walking cats meet face-to-face during calm idle)
      if (!reduced && !yarn.active && !streaming && !thinking && !quietNapNow && now - lastBoopAt > 8500) {
        for (let i = 0; i < cats.length; i++) {
          for (let j = i + 1; j < cats.length; j++) {
            const a = cats[i];
            const b = cats[j];
            if (!a.visible || !b.visible || a.dragging || b.dragging || a.atProp || b.atProp || (a.state !== 'walk' && b.state !== 'walk')) continue;
            const dist = Math.abs(a.x + a.cw * 0.5 - (b.x + b.cw * 0.5));
            const noseDist = (a.cw + b.cw) * 0.58;
            if (dist < noseDist && dist > noseDist * 0.42) {
              lastBoopAt = now;
              a.targetX = b.targetX = null;
              a.targetProp = b.targetProp = null;
              a.cuddleTarget = b.cuddleTarget = null;
              const aLeft = a.x <= b.x;
              a.dir = aLeft ? 1 : -1;
              b.dir = -a.dir;
              a.boopOffset = aLeft ? 2 : -2;
              b.boopOffset = -a.boopOffset;
              a.boopUntil = b.boopUntil = now + 360;
              a.state = 'happy';
              b.state = 'happy';
              a.until = b.until = now + 1300;
              setSym(a, 'heart', now, 1300);
              setSym(b, 'spark', now, 1200);
              if (b.breed === 'kitten' || Math.random() < 0.45) {
                b.vy = -3.4;
                b.y = -1;
              }
              break;
            }
          }
        }
      }

      for (const c of cats) {
        if (c.visible) paintCat(c, now);
      }

      publishRimState(true, sw, now);
    };

    const triggerErrorAlert = (now) => {
      dismissButterfly();
      let alerted = 0;
      for (const c of cats) {
        if (!c.visible || c.dragging || alerted >= 2) continue;
        c.targetX = null;
        c.targetProp = null;
        c.cuddleTarget = null;
        if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
        c.atProp = null;
        c.state = 'stand';
        c.twitchUntil = now + 650;
        c.until = now + 2400;
        setSym(c, alerted === 0 ? 'alert' : 'sweat', now, 2200);
        paintCat(c, now);
        alerted += 1;
      }
      scheduleNext(true);
    };

    const onSemanticEvent = (type, payload = {}) => {
      if (disposed) return;
      const now = nowMs();
      const pl = payload && typeof payload === 'object' ? payload : {};
      const activeCats = cats.filter((c) => c.visible && !c.dragging);
      const lead = activeCats[0] || null;
      const rightmost = activeCats.length ? activeCats.reduce((best, cur) => (cur.x > best.x ? cur : best), activeCats[0]) : null;

      if (type === 'activity') {
        markUserInteraction(now);
        if (!focusNap && sCfg.catQuietMode !== 'nap' && !shouldSuspend()) scheduleNext(false);
        return;
      }

      if (type === 'streaming') {
        const nextStream = Boolean(pl.on);
        if (nextStream === streaming) return;
        streaming = nextStream;
        if (streaming) {
          dismissButterfly();
          if (!focusNap && sCfg.catQuietMode !== 'nap') {
            for (const c of activeCats) {
              c.targetX = null;
              c.targetProp = null;
              c.cuddleTarget = null;
              if (c.state === 'walk' || c.state === 'pounce' || c.state === 'wiggle' || c.state === 'scratch') {
                c.state = c.breed === 'tabby' ? 'loaf' : c.idx % 2 === 0 ? 'sit' : 'stand';
                c.until = now + 3200 + c.idx * 400;
              } else if (c.state === 'sleep' && c.idx === 0) {
                if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
                c.atProp = null;
                c.state = 'loaf';
                c.until = now + 3400;
              }
              paintCat(c, now);
            }
            scheduleNext(true);
          }
        }
        return;
      }

      if (type === 'isThinking') {
        const nextThink = Boolean(pl.on);
        if (nextThink === thinking) return;
        thinking = nextThink;
        if (thinking) {
          dismissButterfly();
          if (!focusNap) {
            for (let i = 0; i < Math.min(2, activeCats.length); i++) {
              const c = activeCats[i];
              c.targetX = null;
              c.targetProp = null;
              c.cuddleTarget = null;
              if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
              c.atProp = null;
              c.state = 'sit';
              c.until = now + 3800;
              setSym(c, i === 0 ? 'think' : 'q', now, 1800);
              paintCat(c, now);
            }
            scheduleNext(true);
          }
        }
        return;
      }

      if (type === 'hasError') {
        const nextErr = Boolean(pl.on);
        const rising = nextErr && !hasError;
        hasError = nextErr;
        if (rising) triggerErrorAlert(now);
        return;
      }

      if (type === 'awaitingDecision') return;

      if (type === 'streamDone') {
        if (pl.error) {
          triggerErrorAlert(now);
          return;
        }
        const dur = Number(pl.durationMs) || 0;
        if (dur >= 6000) {
          const reduced = Boolean(getReducedMotion());
          for (const c of activeCats) {
            c.targetX = null;
            c.targetProp = null;
            c.cuddleTarget = null;
            if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
            c.atProp = null;
            c.state = 'happy';
            c.until = now + 1200;
            setSym(c, 'heart', now, 1200);
            if (!reduced) {
              c.vy = c.breed === 'kitten' ? -4.2 : -3.4;
              c.y = -1;
            }
            paintCat(c, now);
          }
          scheduleNext(true);
        }
        return;
      }

      if (type === 'vial-high') {
        if (rightmost) {
          rightmost.targetX = null;
          rightmost.targetProp = null;
          rightmost.cuddleTarget = null;
          if (propById.post && propById.post.visible && !focusNap) {
            sendCatToProp(rightmost, 'post', now, false);
          } else {
            rightmost.state = rightmost.breed === 'siamese' ? 'scratch' : 'wave';
            rightmost.until = now + 1800;
          }
          setSym(rightmost, 'sweat', now, 1800);
          paintCat(rightmost, now);
          scheduleNext(true);
        }
        return;
      }

      if (focusNap || sCfg.catQuietMode === 'nap') return;

      if (type === 'send') {
        markUserInteraction(now);
        if (lead) {
          lead.state = 'wave';
          lead.until = now + 850;
          setSym(lead, 'spark', now, 850);
          paintCat(lead, now);
          scheduleNext(true);
        }
      } else if (type === 'slash-cmd') {
        markUserInteraction(now);
        const cmd = String(pl.cmd || '').toLowerCase();
        if (lead) {
          if (cmd === 'plan' || cmd === 'grill-me') {
            lead.state = 'sit';
            setSym(lead, 'q', now, 1500);
          } else if (cmd === 'compact') {
            lead.state = lead.poses.loaf1 ? 'loaf' : 'sit';
            setSym(lead, 'spark', now, 1400);
          } else {
            lead.state = 'wave';
            setSym(lead, 'spark', now, 1200);
          }
          lead.until = now + 1500;
          paintCat(lead, now);
          scheduleNext(true);
        }
      } else if (type === 'files-changed') {
        if (lead) {
          lead.twitchUntil = now + 320;
          setSym(lead, 'spark', now, 750);
          paintCat(lead, now);
          scheduleNext(false);
        }
      } else if (type === 'code-copied') {
        if (lead) {
          setSym(lead, 'note', now, 800);
          paintCat(lead, now);
          scheduleNext(false);
        }
      } else if (type === 'effort-tier' || type === 'model-shift' || type === 'orchestrator' || type === 'vial-opened' || type === 'aura-complete') {
        markUserInteraction(now);
        if (lead) {
          setSym(lead, type === 'aura-complete' ? 'heart' : 'spark', now, 950);
          if (type === 'orchestrator' && pl.on && activeCats[1]) {
            setSym(activeCats[1], 'spark', now, 950);
            paintCat(activeCats[1], now);
          }
          paintCat(lead, now);
          scheduleNext(false);
        }
      } else if (type === 'ripple') {
        markUserInteraction(now);
        const rx = Number(pl.x);
        if (Number.isFinite(rx)) {
          for (const c of activeCats) {
            if (Math.abs(rx - (c.x + c.cw * 0.5)) < 160) {
              c.twitchUntil = now + 260;
              paintCat(c, now);
            }
          }
        }
      }
    };

    const onResize = (prevW, newW) => {
      if (disposed) return;
      const pw = Math.max(220, Number(prevW) || 720);
      const nw = Math.max(220, Number(newW) || readStageWidth());
      cachedStageRect = null;
      const minX = 18;
      syncActiveCatTiers(nw);
      drawProps(nw, true);
      for (const c of cats) {
        if (c.dragging || !c.placed) continue;
        const prevSpan = Math.max(8, pw - 36 - c.cw);
        const nextSpan = Math.max(8, nw - 36 - c.cw);
        const ratio = Math.max(0, Math.min(1, (c.x - minX) / prevSpan));
        c.x = Math.round(minX + ratio * nextSpan);
        if (c.targetProp && propById[c.targetProp]?.visible) {
          c.targetX = propAnchorX(c, c.targetProp, nw);
        } else if (c.atProp && propById[c.atProp]?.visible) {
          c.x = propAnchorX(c, c.atProp, nw);
        }
        if (c.visible && !shouldSuspend()) paintCat(c, nowMs());
      }
      if (!shouldSuspend()) publishRimState(true, nw, nowMs());
    };

    const onThemeChange = () => {
      if (disposed || shouldSuspend()) return;
      const sw = Math.max(220, readStageWidth());
      drawProps(sw, true);
      if (yarn.active) drawYarn();
      if (butterfly.active) drawButterfly(nowMs());
      const now = nowMs();
      for (const c of cats) {
        c.lastSig = '';
        if (c.visible) paintCat(c, now);
      }
    };

    const updateConfig = (nextCfg = {}) => {
      if (disposed) return;
      const merged = { ...sCfg };
      if (nextCfg.catCount !== undefined) merged.catCount = nextCfg.catCount === '1' || nextCfg.catCount === '2' ? nextCfg.catCount : '4';
      if (nextCfg.catProps !== undefined) merged.catProps = nextCfg.catProps === 'off' ? 'off' : 'on';
      if (nextCfg.catQuietMode !== undefined) merged.catQuietMode = nextCfg.catQuietMode === 'nap' ? 'nap' : 'auto';
      const changed = merged.catCount !== sCfg.catCount || merged.catProps !== sCfg.catProps || merged.catQuietMode !== sCfg.catQuietMode;
      sCfg = merged;
      if (!changed) return;
      const now = nowMs();
      const sw = Math.max(220, readStageWidth());
      syncActiveCatTiers(sw);
      drawProps(sw, true);
      if (sCfg.catQuietMode === 'nap') {
        dismissButterfly();
        for (const c of cats) {
          if (!c.visible || c.dragging) continue;
          c.targetX = null;
          c.targetProp = null;
          c.cuddleTarget = null;
          c.state = 'sleep';
          c.until = now + 10000;
        }
      }
      if (!shouldSuspend()) {
        for (const c of cats) if (c.visible) paintCat(c, now);
        publishRimState(true, sw, now);
        scheduleNext(true);
      }
    };

    const reclaimVram = () => {
      cancelSched();
      dismissButterfly();
      vramReclaimed = true;
      lastPropsSw = 0;
      lastPropsKey = '';
      publishRimState(false, 0, nowMs());
      yarn.cv.width = 0;
      yarn.cv.height = 0;
      yarn.drawnKey = '';
      butterfly.cv.width = 0;
      butterfly.cv.height = 0;
      butterfly.drawnKey = '';
      for (const pr of propNodes) {
        pr.cv.width = 0;
        pr.cv.height = 0;
        pr.drawnKey = '';
        if (pr.frontCv) {
          pr.frontCv.width = 0;
          pr.frontCv.height = 0;
        }
      }
      for (const c of cats) {
        c.cv.width = 0;
        c.cv.height = 0;
        c.lastSig = '';
      }
    };

    const syncPowerState = (paused) => {
      if (disposed) return;
      const nextPaused = Boolean(paused || isVramSleepState() || isWindowBlurred());
      pausedPower = nextPaused;
      if (pausedPower) {
        cancelAllDrags();
        cancelSched();
        dismissButterfly();
        publishRimState(false, 0, nowMs());
      } else if (running && !peekHidden) {
        lastStepAt = 0;
        if (vramReclaimed) {
          lastPropsSw = 0;
          lastPropsKey = '';
        }
        step(nowMs());
        scheduleNext(true);
      }
    };

    const setPeek = (hidden) => {
      const next = Boolean(hidden);
      if (peekHidden === next) return;
      peekHidden = next;
      if (peekHidden) {
        cancelAllDrags();
        cancelSched();
        dismissButterfly();
        publishRimState(false, 0, nowMs());
      } else if (running && !pausedPower && !disposed) {
        lastStepAt = 0;
        step(nowMs());
        scheduleNext(true);
      }
    };

    const start = () => {
      if (disposed) return;
      const wasRunning = running;
      running = true;
      wrap.style.display = '';
      pausedPower = Boolean(isVramSleepState() || isWindowBlurred());
      peekHidden = Boolean(getPeekHidden());
      if (shouldSuspend()) {
        cancelSched();
        publishRimState(false, 0, nowMs());
        return;
      }
      if (!wasRunning || vramReclaimed || stepTimer === null) {
        lastStepAt = 0;
        step(nowMs());
        scheduleNext(true);
      }
    };

    const stop = () => {
      running = false;
      cancelAllDrags();
      cancelSched();
      dismissButterfly();
      wrap.style.display = 'none';
      publishRimState(false, 0, nowMs());
    };

    const dispose = () => {
      if (disposed) return;
      disposed = true;
      stop();
      try { unregisterDragRelease(); } catch (_) {}
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('pointermove', onGlobalMove);
      }
      reclaimVram();
      for (const pr of propNodes) {
        try { pr.cleanup(); } catch (_) {}
      }
      for (const c of cats) {
        try { c.cleanup(); } catch (_) {}
      }
      if (typeof wrap.remove === 'function') wrap.remove();
      else if (wrap.parentNode && typeof wrap.parentNode.removeChild === 'function') wrap.parentNode.removeChild(wrap);
    };

    return {
      start,
      stop,
      step,
      setPeek,
      syncPowerState,
      reclaimVram,
      onResize,
      onThemeChange,
      updateConfig,
      onSemanticEvent,
      onStreamingChange: (on) => onSemanticEvent('streaming', { on }),
      isDragging: () => cats.some((c) => c.dragging),
      dispose,
    };
  }

  G.__agCatSanctuaryFactory = createCatSanctuary;
  if (typeof window !== 'undefined' && window !== G) {
    window.__agCatSanctuaryFactory = createCatSanctuary;
  }
  try {
    const bridge = G.__agCatSanctuaryBridge || (typeof window !== 'undefined' ? window.__agCatSanctuaryBridge : null);
    if (bridge && typeof bridge.onFactoryReady === 'function') {
      bridge.onFactoryReady(createCatSanctuary);
    }
  } catch (_) {}

  if (typeof module === 'object' && module.exports) {
    module.exports = { createCatSanctuary, PX, CAT_PRESETS, SHELF_PROPS, SANCTUARY_SYMS, BUTTERFLY_FRAMES };
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
