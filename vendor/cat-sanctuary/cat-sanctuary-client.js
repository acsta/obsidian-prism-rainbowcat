// Obsidian Prism — Channel 8 Multi-Cat Sanctuary Client Runtime
// 4 Kawaii Q-style pixel-art cats on a single unified px: 1.5 Retina grid (0 Mixels, 100% closed contours):
// - pusheen (Round Silver Mochi Tabby, 24x23 -> 36x35px): plump dome loaf, happy biscuit kneading, soft pastel yawn, Q-squish
// - ginger  (Tiny Apricot Kitten,      20x21 -> 30x32px): baby round head, white socks, bouncy 4-beat hop, butterfly wiggle+pounce
// - calico  (Fluffy Cream Calico,      24x23 -> 36x35px): clean 3-patch coat, pure white face, heterochromia glint, paw-groom, bow-stretch
// - ragdoll (Soft Cream-Latte Ragdoll, 24x24 -> 36x36px): plush 2-3px paws, clean ivory blaze, vivid sky-blue eyes, coral bow, gentle post-pat
// Preserves: dark-theme 1px halo, 0Hz blur/hidden/peek pause, full VRAM reclaim, 13-signal semantics, __agPrismCatRimState.

(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null);
  if (!G) return;

  const PX = 1.5;
  const PAD_X = 1;
  const HEADROOM_ROWS = 8; // 12px top transparent headroom for floating symbols
  const IDLE_NAP_AFTER_MS = 30000;
  const DARK_HALO_COLOR = 'rgba(216, 212, 248, 0.46)';

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

  // ── 1. PUSHEEN: Plump Round Silver-Grey Mochi Tabby (22x15 body -> 24x23 = 36x35px) ──
  const PUSHEEN_POSES = buildPoseMap(22, 15, {
    standA: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.........',
      '.O###s#s#s###O....OO..',
      'O#############O..O#sO.',
      'O##o###o###o##O.O##sO.',
      'O#p####w####p#OO#s##O.',
      'O###bbbbbb##s###s##O..',
      'O##bbbbbbbb#s#####O...',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    standB: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.........',
      '.O###s#s#s###O........',
      'O#############O...OO..',
      'O##o###o###o##O..O#sO.',
      'O#p####w####p#O.O##sO.',
      'O###bbbbbb##s##OO#s#O.',
      'O##bbbbbbbb#s#####OO..',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    blink: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.........',
      '.O###s#s#s###O....OO..',
      'O#############O..O#sO.',
      'O#oo###o###oo#O.O##sO.',
      'O#p####w####p#OO#s##O.',
      'O###bbbbbb##s###s##O..',
      'O##bbbbbbbb#s#####O...',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    earL: [
      '..........OO..........',
      '..OOO....O##O.........',
      '.O###OOOOO##O.........',
      '.O###s#s#s###O....OO..',
      'O#############O..O#sO.',
      'O##o###o###o##O.O##sO.',
      'O#p####w####p#OO#s##O.',
      'O###bbbbbb##s###s##O..',
      'O##bbbbbbbb#s#####O...',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    walk1: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.........',
      '.O###s#s#s###O...OO...',
      'O#############O.O#sO..',
      'O##o###o###o##O.O##sO.',
      'O#p####w####p#OO#s##O.',
      'O###bbbbbb##s###s##O..',
      'O##bbbbbbbb#s#####O...',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '.O#wOO######OO#wO.....',
      '.OwwO.OOOOOO.OwwO.....',
      '..OO..........OO......',
    ],
    walk2: [
      '......................',
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.....OO..',
      '.O###s#s#s###O...O#sO.',
      'O#############O.O##sO.',
      'O##o###o###o##OO#s##O.',
      'O#p####w####p###s##O..',
      'O###bbbbbb##s#####O...',
      'O##bbbbbbbb#s#####O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..OOO#wOOOOO#wOOO.....',
      '....OwwO...OwwO.......',
      '.....OO.....OO........',
    ],
    sitA: [
      '....OO.....OO.........',
      '...O##O...O##O........',
      '...O##OOOOO##O........',
      '..O###s#s#s###O.......',
      '.O#############O..OO..',
      '.O##o###o###o##O.O#sO.',
      '.O#p####w####p#O.O##sO',
      'O###bbbbbbbb###OO#s#O.',
      'O##bbbbbbbbbb##s###O..',
      'O##bbbbbbbbbb##s###O..',
      'O##bbbbbbbbbb#####O...',
      'O###bbbbbbbb######O...',
      'O###ww#bb#ww#####O....',
      '.O##wwObbOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    sitB: [
      '....OO.....OO.........',
      '...O##O...O##O........',
      '...O##OOOOO##O........',
      '..O###s#s#s###O.......',
      '.O#############O......',
      '.O##o###o###o##O..OO..',
      '.O#p####w####p#O.O#sO.',
      'O###bbbbbbbb###O.O##sO',
      'O##bbbbbbbbbb##sO#s#O.',
      'O##bbbbbbbbbb##s###O..',
      'O##bbbbbbbbbb#####O...',
      'O###bbbbbbbb######O...',
      'O###ww#bb#ww#####O....',
      '.O##wwObbOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    loaf1: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##OO........',
      '.O###s#s#s####OO......',
      'O###############O.....',
      'O#oo###o###oo##s#O.OO.',
      'O#p####w####p##s#OO#sO',
      'O###bbbbbbbb######s#O.',
      'O##bbbbbbbbbb######O..',
      '.O#bbbbbbbbbb#####O...',
      '..OOOOOOOOOOOOOOOO....',
    ],
    loaf2: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##OO........',
      '.O###s#s#s####OO......',
      'O###############O.....',
      'O#oo###o###oo##s#O....',
      'O#p####w####p##s#O.OO.',
      'O###bbbbbbbb######O#sO',
      'O##bbbbbbbbbb#####s#O.',
      '.O#bbbbbbbbbb#####OO..',
      '..OOOOOOOOOOOOOOOO....',
    ],
    knead1: [
      '....OO.....OO.........',
      '...O##O...O##O........',
      '...O##OOOOO##O........',
      '..O###s#s#s###O.......',
      '.O###o#####o###O..OO..',
      '.O##o#o###o#o##O.O#sO.',
      '.O#p####w####p#O.O##sO',
      'O###bbbbbbbb###OO#s#O.',
      'O##bbbbbbbbbb##s###O..',
      'O##bbbbbbbbbb##s###O..',
      'O##bbwwbbbbbb#####O...',
      'O##OwwwO#bbww####O....',
      'O###OOO##OwwwO##O.....',
      '.O#######OOOO##O......',
      '..OOOOOOOOOOOOO.......',
    ],
    knead2: [
      '....OO.....OO.........',
      '...O##O...O##O........',
      '...O##OOOOO##O........',
      '..O###s#s#s###O.......',
      '.O###o#####o###O......',
      '.O##o#o###o#o##O..OO..',
      '.O#p####w####p#O.O#sO.',
      'O###bbbbbbbb###O.O##sO',
      'O##bbbbbbbbbb##sO#s#O.',
      'O##bbbbbbbbbb##s###O..',
      'O##bbbbbbwwbb#####O...',
      'O##wwbb#OwwwO####O....',
      'O#OwwwO##OOO####O.....',
      '.O#OOO#########O......',
      '..OOOOOOOOOOOOO.......',
    ],
    yawn1: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.........',
      '.O###s#s#s###O....OO..',
      'O#oo#######oo#O..O#sO.',
      'O#p####uu####pO.O##sO.',
      'O######uu#####OO#s##O.',
      'O###bbbbbb##s###s##O..',
      'O##bbbbbbbb#s#####O...',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    yawn2: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.........',
      '.O###s#s#s###O....OO..',
      'O#oo#######oo#O..O#sO.',
      'O#p####u#####pO.O##sO.',
      'O#####bbbb####OO#s##O.',
      'O###bbbbbb##s###s##O..',
      'O##bbbbbbbb#s#####O...',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    squish: [
      '...OO......OO.........',
      '..O##O....O##O........',
      '..O##OOOOOO##O........',
      '.O####s#s#s###OO..OO..',
      'O###o######o####OO#sO.',
      'O##o#o#o##o#o###O##sO.',
      'O#pp###w####pp##O#s#O.',
      'O###bbbbbbbb##s###sO..',
      'O##bbbbbbbbbb#s####O..',
      'O###bbbbbbbb######O...',
      '.O#ww#bbbbbb#ww##O....',
      '..OOwwOOOOOOwwOOO.....',
      '....OO......OO........',
    ],
    happy: [
      '...OO.....OO..........',
      '..O##O...O##O....OO...',
      '..O##OOOOO##O...O#sO..',
      '.O###s#s#s###O..O##sO.',
      'O###o#####o###O.O#s#O.',
      'O##o#o###o#o##OO#s##O.',
      'O#pp###w####pp##s##O..',
      'O###bbbbbb##s#####O...',
      'O##bbbbbbbb#s#####O...',
      'O##bbbbbbbb#######O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    eat1: [
      '...OO.....OO..........',
      '..O##O...O##O....OO...',
      '..O##OOOOO##O...O#sO..',
      '.O###s#s#s###O..O##sO.',
      'O#############OO#s##O.',
      'O#oo###o###oo###s##O..',
      'O#p####w####p#s###O...',
      'O###bbbbbb###s####O...',
      'O##bbbbbbbb#######O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    eat2: [
      '......................',
      '...OO.....OO.....OO...',
      '..O##O...O##O...O#sO..',
      '..O##OOOOO##O...O##sO.',
      '.O###s#s#s###O.O#s##O.',
      'O#############OO#s#O..',
      'O#oo###o###oo##s##O...',
      'O#p####w####p#####O...',
      'O###bbbbbb########O...',
      '.O##bbbbbb#######O....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    sleep1: [
      '...OO.....OO..........',
      '..O##O...O##OO........',
      '..O##OOOOO####OO......',
      '.O###s#s#s###s##O.....',
      'O#############s##O.OO.',
      'O#oo###o###oo####OO#sO',
      'O#p####w####p#####s#O.',
      'O###bbbbbbbbbb####OO..',
      '.O##bbbbbbbbbb###O....',
      '..OOOOOOOOOOOOOOO.....',
    ],
    sleep2: [
      '......................',
      '...OO.....OO..........',
      '..O##O...O##OO........',
      '..O##OOOOO####OO......',
      '.O###s#s#s###s##O.....',
      'O#############s##O.OO.',
      'O#oo###o###oo####OO#sO',
      'O#p####w####p#####s#O.',
      'O###bbbbbbbbbb####OO..',
      '.O##bbbbbbbbbb###O....',
      '..OOOOOOOOOOOOOOO.....',
    ],
    wave1: [
      '....OO.....OO.........',
      '...O##O...O##O........',
      '...O##OOOOO##O........',
      '..O###s#s#s###O...OO..',
      '.O#############O.O#sO.',
      '.O##o###o###o##O.O##sO',
      'OO#p####w####p#OO#s#O.',
      'Oww#bbbbbbbb###s###O..',
      'Oww#bbbbbbbb###s###O..',
      '.OO#bbbbbbbbb#####O...',
      '.O##bbbbbbbbb#####O...',
      '.O###bbbbbbb######O...',
      '.O###ww#bb#ww####O....',
      '..O##wwObbOww###O.....',
      '...OOOOOOOOOOOOO......',
    ],
    wave2: [
      '....OO.....OO.........',
      '...O##O...O##O........',
      '...O##OOOOO##O........',
      '..O###s#s#s###O.......',
      'OO#############O..OO..',
      'Oww#o###o###o##O.O#sO.',
      'Owwp####w####p#O.O##sO',
      '.OO#bbbbbbbb###OO#s#O.',
      '.O##bbbbbbbb###s###O..',
      '.O##bbbbbbbbb##s###O..',
      '.O##bbbbbbbbb#####O...',
      '.O###bbbbbbb######O...',
      '.O###ww#bb#ww####O....',
      '..O##wwObbOww###O.....',
      '...OOOOOOOOOOOOO......',
    ],
    dangle: [
      '...OO.....OO..........',
      '..O##O...O##O.........',
      '..O##OOOOO##O.........',
      '.O###s#s#s###O........',
      'O#oo###o###oo#O.......',
      'O#p####w####p#O.......',
      '.O###bbbbb###O........',
      '.OwwObbbbbOwwO...OO...',
      '..O##bbbbb##O...O#sO..',
      '..O##bbbbb##O..O##sO..',
      '..O#########OOO#s#O...',
      '...O#wOOO#wOOOO#sO....',
      '...OwwO.OwwO...OO.....',
      '....OO...OO...........',
      '......................',
    ],
  });

  // ── 2. GINGER: Tiny Energetic Apricot Kitten (18x13 body -> 20x21 = 30x32px) ──
  const GINGER_POSES = buildPoseMap(18, 13, {
    standA: [
      '..OO....OO........',
      '.O##O..O##O....OO.',
      '.O#sOOOO#sO...O#sO',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..O#bbbb###O.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '..O#w#O###O#wO....',
      '..OwwO.OOO.OwwO...',
      '...OO.......OO....',
    ],
    standB: [
      '..OO....OO........',
      '.O##O..O##O...OO..',
      '.O#sOOOO#sO..O#sO.',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..O#bbbb###O.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '..O#w#O###O#wO....',
      '..OwwO.OOO.OwwO...',
      '...OO.......OO....',
    ],
    blink: [
      '..OO....OO........',
      '.O##O..O##O....OO.',
      '.O#sOOOO#sO...O#sO',
      'O###s##s###O..O##O',
      'O##########O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..O#bbbb###O.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '..O#w#O###O#wO....',
      '..OwwO.OOO.OwwO...',
      '...OO.......OO....',
    ],
    earL: [
      '........OO........',
      '.OOO...O##O....OO.',
      'O###OOOO#sO...O#sO',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO...O#sO',
      '..O#bbbb###O.O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '..O#w#O###O#wO....',
      '..OwwO.OOO.OwwO...',
      '...OO.......OO....',
    ],
    walk1: [
      '..OO....OO........',
      '.O##O..O##O...OO..',
      '.O#sOOOO#sO..O#sO.',
      'O###s##s###O..O##O',
      'O#wo####wo#O..O#sO',
      'O#oo#p##oo#O..O##O',
      '.O#pbbbb#pO..O##O.',
      '..O#bbbb###OO##O..',
      '..O##bbb######O...',
      '.O#wOO####OO#wO...',
      '.OwwO.OOOO.OwwO...',
      '..OO........OO....',
      '..................',
    ],
    walk2: [
      '..................',
      '..OO....OO.....OO.',
      '.O##O..O##O...O#sO',
      '.O#sOOOO#sO...O##O',
      'O###s##s###O..O#sO',
      'O#wo####wo#O..O##O',
      'O#oo#p##oo#O.O##O.',
      '.O#pbbbb#pOO.O#sO.',
      '..O#bbbb###OO##O..',
      '..O##bbb######O...',
      '..OO#wOOOO#wOO....',
      '...OwwO..OwwO.....',
      '....OO....OO......',
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
      '..OO....OO...O##O.',
      '.O##O..O##O..O#sO.',
      '.O#sOOOO#sO.O##O..',
      'O###s##s###OO#sO..',
      'O#wo####wo####O...',
      'O#oo#p##oo####O...',
      '.O#pbbbb#p####O...',
      'OwwObbbb#####O....',
      'OOO.OOOOO#w##O....',
      '.........OwwO.....',
      '..........OO......',
    ],
    wiggle2: [
      '...............OO.',
      '..............O#sO',
      '..OO....OO....O##O',
      '.O##O..O##O..O#sO.',
      '.O#sOOOO#sO..O##O.',
      'O###s##s###OO#sO..',
      'O#wo####wo####O...',
      'O#oo#p##oo####O...',
      '.O#pbbbb#p####O...',
      'OwwObbbb#####O....',
      'OOO.OOOOO#w##O....',
      '.........OwwO.....',
      '..........OO......',
    ],
    pounce: [
      '..OO....OO........',
      '.O##O..O##O....OO.',
      '.O#sOOOO#sO...O#sO',
      'O###s##s###O..O##O',
      'O#wo####wo#O.O#sO.',
      'O#oo#p##oo#OO##O..',
      'Oww#bbbb######O...',
      'OOO#bbbb#####O....',
      '..O#####O#w##O....',
      '...OOOOO.OwwO.....',
      '..........OO......',
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
      '..O#bbbb###OO##O..',
      '..O##bbb#####OO...',
      '..O#w#O###O#wO....',
      '..OwwO.OOO.OwwO...',
      '...OO.......OO....',
    ],
    eat1: [
      '..OO....OO........',
      '.O##O..O##O...OO..',
      '.O#sOOOO#sO..O#sO.',
      'O###s##s###O.O##O.',
      'O#oo#p##oo#OO#sO..',
      'O#pbbbb#p###s#O...',
      '.O#bbbb######O....',
      '..O##bbb#####O....',
      '..O#w#O###O#wO....',
      '..OwwO.OOO.OwwO...',
      '...OO.......OO....',
    ],
    eat2: [
      '..................',
      '..OO....OO....OO..',
      '.O##O..O##O..O#sO.',
      '.O#sOOOO#sO..O##O.',
      'O###s##s###OO#sO..',
      'O#oo#p##oo###sO...',
      'O#pbbbb#p####O....',
      '.O#bbbb#####O.....',
      '..O#w#O###O#wO....',
      '..OwwO.OOO.OwwO...',
      '...OO.......OO....',
    ],
    sleep1: [
      '..OO....OO........',
      '.O##O..O##OO......',
      '.O#sOOOO#s##OO....',
      'O###s##s###s##O...',
      'O#oo#p##oo####OO..',
      'O#pbbbbbbb###O#sO.',
      'O##bbbbbbb##O##O..',
      '.O##bbbbbb##OOO...',
      '..OOOOOOOOOO......',
    ],
    sleep2: [
      '..................',
      '..OO....OO........',
      '.O##O..O##OO......',
      '.O#sOOOO#s##OO....',
      'O###s##s###s##O...',
      'O#oo#p##oo####OO..',
      'O#pbbbbbbb###O#sO.',
      'O##bbbbbbb##O##O..',
      '.O##bbbbbb##OOO...',
      '..OOOOOOOOOO......',
    ],
    wave1: [
      '...OO....OO.......',
      '..O##O..O##O...OO.',
      '..O#sOOOO#sO..O#sO',
      '.O###s##s###O.O##O',
      '.O#wo####wo#O.O#sO',
      '.O#oo#p##oo#O.O##O',
      'OO#pbbbb#p#O.O##O.',
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
      'Oww#oo#p##ooOO##O.',
      '.OO#pbbbb#pOO##O..',
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
      '.O#ObbbbO#O..OO...',
      '.OwwObbOwwO.O#sO..',
      '..O#bbbb#OOO#sO...',
      '..O######OO##O....',
      '...OwwOwwOOOO.....',
      '....OO.OO.........',
      '..................',
    ],
  });

  // ── 3. CALICO: Fluffy Cream Calico — Clean 3-Patch Coat, Pure White Face, Big Plume Tail (22x15 -> 36x35px) ──
  const CALICO_POSES = buildPoseMap(22, 15, {
    standA: [
      '...OO....OO.....OOO...',
      '..OaaO..OkkO...OaaaO..',
      '..OaaOOOOkkO..Oaa##kO.',
      '.Oaa#####kk#O.O#kkk#O.',
      '.Oa##o###o##O.O##aa#O.',
      'O#p##L#p#R#pO.O#aa##O.',
      'O#wwwwwwwww#OO###k##O.',
      'O##wwwwwww##kk###k#O..',
      'O##wwwwwww#kkk###OO...',
      'O###wwwww##kk##a#O....',
      '.O##wwwww####aaaO.....',
      '.O###www#####aaO......',
      '..O#w#O####O#wO.......',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    standB: [
      '...OO....OO......OOO..',
      '..OaaO..OkkO....OaaaO.',
      '..OaaOOOOkkO...Oaa##kO',
      '.Oaa#####kk#O..O#kkk#O',
      '.Oa##o###o##O.O##aa#O.',
      'O#p##L#p#R#pO.O#aa##O.',
      'O#wwwwwwwww#OO###k##O.',
      'O##wwwwwww##kk###k#O..',
      'O##wwwwwww#kkk###OO...',
      'O###wwwww##kk##a#O....',
      '.O##wwwww####aaaO.....',
      '.O###www#####aaO......',
      '..O#w#O####O#wO.......',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    blink: [
      '...OO....OO.....OOO...',
      '..OaaO..OkkO...OaaaO..',
      '..OaaOOOOkkO..Oaa##kO.',
      '.Oaa#####kk#O.O#kkk#O.',
      '.Oa#oo###oo#O.O##aa#O.',
      'O#p####p###pO.O#aa##O.',
      'O#wwwwwwwww#OO###k##O.',
      'O##wwwwwww##kk###k#O..',
      'O##wwwwwww#kkk###OO...',
      'O###wwwww##kk##a#O....',
      '.O##wwwww####aaaO.....',
      '.O###www#####aaO......',
      '..O#w#O####O#wO.......',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    earL: [
      '.........OO.....OOO...',
      '..OOO...OkkO...OaaaO..',
      '.OaaaOOOOkkO..Oaa##kO.',
      '.Oaa#####kk#O.O#kkk#O.',
      '.Oa##o###o##O.O##aa#O.',
      'O#p##L#p#R#pO.O#aa##O.',
      'O#wwwwwwwww#OO###k##O.',
      'O##wwwwwww##kk###k#O..',
      'O##wwwwwww#kkk###OO...',
      'O###wwwww##kk##a#O....',
      '.O##wwwww####aaaO.....',
      '.O###www#####aaO......',
      '..O#w#O####O#wO.......',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    walk1: [
      '...OO....OO.....OOO...',
      '..OaaO..OkkO...OaaaO..',
      '..OaaOOOOkkO..Oaa##kO.',
      '.Oaa#####kk#O.O#kkk#O.',
      '.Oa##o###o##O.O##aa#O.',
      'O#p##L#p#R#pO.O#aa##O.',
      'O#wwwwwwwww#OO###k##O.',
      'O##wwwwwww##kk###k#O..',
      'O##wwwwwww#kkk###OO...',
      'O###wwwww##kk##a#O....',
      '.O##wwwww####aaaO.....',
      '.O###www#####aaO......',
      '.O#wOO#####OO#wO......',
      '.OwwO.OOOOO.OwwO......',
      '..OO.........OO.......',
    ],
    walk2: [
      '......................',
      '...OO....OO......OOO..',
      '..OaaO..OkkO....OaaaO.',
      '..OaaOOOOkkO...Oaa##kO',
      '.Oaa#####kk#O..O#kkk#O',
      '.Oa##o###o##O.O##aa#O.',
      'O#p##L#p#R#pO.O#aa##O.',
      'O#wwwwwwwww#OO###k##O.',
      'O##wwwwwww##kk###k#O..',
      'O##wwwwwww#kkk###OO...',
      '.O##wwwww##kk##a#O....',
      '.O###www#####aaaO.....',
      '..OOO#wOOOO#wOOO......',
      '....OwwO..OwwO........',
      '.....OO....OO.........',
    ],
    sitA: [
      '....OO....OO..........',
      '...OaaO..OkkO....OOO..',
      '...OaaOOOOkkO...OaaaO.',
      '..Oaa#####kk#O.Oaa##kO',
      '..Oa##o###o##O.O#kkk#O',
      '.O#p##L#p#R#pO.O##aa#O',
      '.O#wwwwwwwww#OO##aa#O.',
      'O##wwwwwwwww##O###k#O.',
      'O##wwwwwwwww#kk##k#O..',
      'O##wwwwwwwww#kkk##O...',
      'O###wwwwwww##kk#a#O...',
      'O###wwwwwww###aaaO....',
      'O###ww#ww#ww##aaO.....',
      '.O##wwOwwOww###O......',
      '..OOOOOOOOOOOOO.......',
    ],
    sitB: [
      '....OO....OO..........',
      '...OaaO..OkkO.....OOO.',
      '...OaaOOOOkkO....OaaaO',
      '..Oaa#####kk#O..Oaa#kO',
      '..Oa##o###o##O..O#kk#O',
      '.O#p##L#p#R#pO.O##aa#O',
      '.O#wwwwwwwww#O.O#aa##O',
      'O##wwwwwwwww##OO##k#O.',
      'O##wwwwwwwww#kk##k#O..',
      'O##wwwwwwwww#kkk##O...',
      'O###wwwwwww##kk#a#O...',
      'O###wwwwwww###aaaO....',
      'O###ww#ww#ww##aaO.....',
      '.O##wwOwwOww###O......',
      '..OOOOOOOOOOOOO.......',
    ],
    groom1: [
      '....OO....OO..........',
      '...OaaO..OkkO....OOO..',
      '...OaaOOOOkkO...OaaaO.',
      '..Oaa#####kk#O.Oaa##kO',
      '..Oa#o#####o#O.O#kkk#O',
      '.O##o#o#p#o#oO.O##aa#O',
      'OO#p#wwwwwww#OO##aa#O.',
      'Oww#wwwwwwww##O###k#O.',
      'Oww#wwwwwwww#kk##k#O..',
      '.OO#wwwwwwww#kkk##O...',
      '.O##wwwwwww##kk#a#O...',
      '.O###wwwww####aaaO....',
      '.O###ww#ww#ww#aaO.....',
      '..O##wwOwwOww##O......',
      '...OOOOOOOOOOOO.......',
    ],
    groom2: [
      '....OO....OO..........',
      '...OaaO..OkkO.....OOO.',
      '...OaaOOOOkkO....OaaaO',
      '..Oaa#####kk#O..Oaa#kO',
      '.OOa#o#####o#O..O#kk#O',
      'Oww#o#o#p#o#oO.O##aa#O',
      'Owwp#wwwwwww#O.O#aa##O',
      '.OO#wwwwwwww##OO##k#O.',
      'O##wwwwwwwww#kk##k#O..',
      'O##wwwwwwwww#kkk##O...',
      'O###wwwwwww##kk#a#O...',
      'O###wwwwwww###aaaO....',
      'O###ww#ww#ww##aaO.....',
      '.O##wwOwwOww###O......',
      '..OOOOOOOOOOOOO.......',
    ],
    stretch1: [
      '..............OOO.....',
      '.............OaaaO....',
      '............Oaa##kO...',
      '...OO....OO.O#kkk#O...',
      '..OaaO..OkkOO##aa#O...',
      '..OaaOOOOkk##aa###O...',
      '.Oaa#####kk###kk##O...',
      '.Oa##o###o####kkk#O...',
      'O#p##L#p#R#p###kk#O...',
      'O#wwwwwwwww###aaaO....',
      '.O##wwwwwww###aaO.....',
      '..O#w#O####O#w#wO.....',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    stretch2: [
      '...............OOO....',
      '..............OaaaO...',
      '.............Oaa##kO..',
      '.............O#kkk#O..',
      '............O##aa##O..',
      '...OO....OO.O#aa###O..',
      '..OaaO..OkkOO##kkk#O..',
      '..OaaOOOOkk###kkkk#O..',
      '.Oaa#####kk###kk#aaO..',
      '.Oa#oo###oo###k#aaaO..',
      'O#p####p###p###aaa#O..',
      'Owwww#wwwwwww##O#w#O..',
      '.OOOO#wwwwww###OwwO...',
      '.....OOOOOOOOOO.OO....',
    ],
    happy: [
      '...OO....OO.....OOO...',
      '..OaaO..OkkO...OaaaO..',
      '..OaaOOOOkkO..Oaa##kO.',
      '.Oaa#####kk#O.O#kkk#O.',
      '.Oa##o###o##O.O##aa#O.',
      'O#p#o#o#o#o#O.O#aa##O.',
      'O#wwwwwwwww#OO###k##O.',
      'O##wwwwwww##kk###k#O..',
      'O##wwwwwww#kkk###OO...',
      'O###wwwww##kk##a#O....',
      '.O##wwwww####aaaO.....',
      '.O###www#####aaO......',
      '..O#w#O####O#wO.......',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    eat1: [
      '...OO....OO......OOO..',
      '..OaaO..OkkO....OaaaO.',
      '..OaaOOOOkkO...Oaa##kO',
      '.Oaa#####kk#O..O#kkk#O',
      '.Oa#oo###oo#O.O##aa#O.',
      'O#p####p###pOO#aa###O.',
      'O#wwwwwwwww###kk###O..',
      'O##wwwwwww###kkk##O...',
      '.O##wwwww####aaa#O....',
      '.O###www#####aa#O.....',
      '..O#w#O####O#w#O......',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    eat2: [
      '......................',
      '...OO....OO.....OOO...',
      '..OaaO..OkkO...OaaaO..',
      '..OaaOOOOkkO..Oaa##kO.',
      '.Oaa#####kk#O.O#kkk#O.',
      '.Oa#oo###oo#OO##aa##O.',
      'O#p####p###p##kk###O..',
      'O#wwwwwwwww##kkk##O...',
      '.O##wwwwwww##aaa#O....',
      '.O###wwwww###aa#O.....',
      '..O#w#O####O#w#O......',
      '..OwwO.OOOO.OwwO......',
      '...OO........OO.......',
    ],
    sleep1: [
      '...OO....OO...........',
      '..OaaO..OkkOO.........',
      '..OaaOOOOkk##OO.......',
      '.Oaa#####kk##aaO......',
      'O#oo####oo###aa#O.OO..',
      'O#p#####p####kk#OOaaO.',
      'O#wwwwwwwwww#kk###kkO.',
      'O##wwwwwwwww####aakO..',
      '.O##wwwwwwww###aaaO...',
      '..OOOOOOOOOOOOOOOO....',
    ],
    sleep2: [
      '......................',
      '...OO....OO...........',
      '..OaaO..OkkOO.........',
      '..OaaOOOOkk##OO.......',
      '.Oaa#####kk##aaO......',
      'O#oo####oo###aa#O.OO..',
      'O#p#####p####kk#OOaaO.',
      'O#wwwwwwwwww#kk###kkO.',
      'O##wwwwwwwww####aakO..',
      '.O##wwwwwwww###aaaO...',
      '..OOOOOOOOOOOOOOOO....',
    ],
    wave1: [
      '....OO....OO..........',
      '...OaaO..OkkO....OOO..',
      '...OaaOOOOkkO...OaaaO.',
      '..Oaa#####kk#O.Oaa##kO',
      '..Oa##o###o##O.O#kkk#O',
      '.O#p##L#p#R#pO.O##aa#O',
      'OO#wwwwwwwww#OO##aa#O.',
      'Owwwwwwwwwww##O###k#O.',
      'Owwwwwwwwwww#kk##k#O..',
      '.OOwwwwwwwww#kkk##O...',
      '.O##wwwwwww##kk#a#O...',
      '.O###wwwww####aaaO....',
      '.O###ww#ww#ww#aaO.....',
      '..O##wwOwwOww##O......',
      '...OOOOOOOOOOOO.......',
    ],
    wave2: [
      '....OO....OO..........',
      '...OaaO..OkkO.....OOO.',
      '...OaaOOOOkkO....OaaaO',
      '..Oaa#####kk#O..Oaa#kO',
      'OOa##o###o##O...O#kk#O',
      'Owwp##L#p#R#pO.O##aa#O',
      'Oww#wwwwwwww#O.O#aa##O',
      '.OO#wwwwwwww##OO##k#O.',
      'O##wwwwwwwww#kk##k#O..',
      'O##wwwwwwwww#kkk##O...',
      'O###wwwwwww##kk#a#O...',
      'O###wwwwwww###aaaO....',
      'O###ww#ww#ww##aaO.....',
      '.O##wwOwwOww###O......',
      '..OOOOOOOOOOOOO.......',
    ],
    dangle: [
      '...OO....OO...........',
      '..OaaO..OkkO..........',
      '..OaaOOOOkkO..........',
      '.Oaa#####kk#O.........',
      '.Oa#oo###oo#O.........',
      'O#p####p###pO.........',
      '.O#wwwwwww#O..........',
      '.OwwOwwwOwwO....OOO...',
      '..O#wwwww#O....OaaaO..',
      '..O#wwwwkk#O..Oaa##kO.',
      '..O##ww#kk#OOO#kkk#O..',
      '...O#wOO#wOOOO#aa#O...',
      '...OwwOOwwO...OOOO....',
      '....OO..OO............',
      '......................',
    ],
  });

  // ── 4. RAGDOLL: Soft Creamy-Ivory & Dusty-Latte Plush Ragdoll (22x16 body -> 24x24 = 36x36px) ──
  // Clean creamy-white inverted-V blaze on face, vivid sky-blue eyes, coral ribbon bow, cute 2-3px plush paws!
  const RAGDOLL_POSES = buildPoseMap(22, 16, {
    standA: [
      '...OO.....OO..........',
      '..OmmO...OmmO.........',
      '..OmdOOOOOdmO.....OO..',
      '.Odm#######mdO...OmmO.',
      '.Od#oe###eo#dO..OmdmO.',
      'O#dp#e###e#pdO..O##dO.',
      'O##p###p###p#O.O###O..',
      '.O###rrcrr###OO###O...',
      '.O#wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O###wwwwwww#####O.....',
      '.O##wwwwwww#####O.....',
      '..O#w#O###O#w#wO......',
      '..OwwO.OOO.OwwO.......',
      '...OO.......OO........',
    ],
    standB: [
      '...OO.....OO..........',
      '..OmmO...OmmO.........',
      '..OmdOOOOOdmO......OO.',
      '.Odm#######mdO....OmmO',
      '.Od#oe###eo#dO...OmdmO',
      'O#dp#e###e#pdO..O##dO.',
      'O##p###p###p#O.O###O..',
      '.O###rrcrr###OO###O...',
      '.O#wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O###wwwwwww#####O.....',
      '.O##wwwwwww#####O.....',
      '..O#w#O###O#w#wO......',
      '..OwwO.OOO.OwwO.......',
      '...OO.......OO........',
    ],
    blink: [
      '...OO.....OO..........',
      '..OmmO...OmmO.........',
      '..OmdOOOOOdmO.....OO..',
      '.Odm#######mdO...OmmO.',
      '.Od#oo###oo#dO..OmdmO.',
      'O#dp#######pdO..O##dO.',
      'O##p###p###p#O.O###O..',
      '.O###rrcrr###OO###O...',
      '.O#wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O###wwwwwww#####O.....',
      '.O##wwwwwww#####O.....',
      '..O#w#O###O#w#wO......',
      '..OwwO.OOO.OwwO.......',
      '...OO.......OO........',
    ],
    earL: [
      '..........OO..........',
      '..OOO....OmmO.........',
      '.OmmmOOOOOdmO.....OO..',
      '.Odm#######mdO...OmmO.',
      '.Od#oe###eo#dO..OmdmO.',
      'O#dp#e###e#pdO..O##dO.',
      'O##p###p###p#O.O###O..',
      '.O###rrcrr###OO###O...',
      '.O#wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O###wwwwwww#####O.....',
      '.O##wwwwwww#####O.....',
      '..O#w#O###O#w#wO......',
      '..OwwO.OOO.OwwO.......',
      '...OO.......OO........',
    ],
    walk1: [
      '...OO.....OO..........',
      '..OmmO...OmmO.........',
      '..OmdOOOOOdmO....OO...',
      '.Odm#######mdO..OmmO..',
      '.Od#oe###eo#dO..OmdmO.',
      'O#dp#e###e#pdO.O##dO..',
      'O##p###p###p#O.O###O..',
      '.O###rrcrr###OO###O...',
      '.O#wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O###wwwwwww#####O.....',
      '.O##wwwwwww#####O.....',
      '.O#wOO######OO#wO.....',
      '.OwwO.OOOOOO.OwwO.....',
      '..OO..........OO......',
    ],
    walk2: [
      '......................',
      '...OO.....OO..........',
      '..OmmO...OmmO......OO.',
      '..OmdOOOOOdmO.....OmmO',
      '.Odm#######mdO...OmdmO',
      '.Od#oe###eo#dO..O##dO.',
      'O#dp#e###e#pdO.O###O..',
      'O##p###p###p#OO###O...',
      '.O###rrcrr#######O....',
      'O##wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O###wwwwwww#####O.....',
      '.O##wwwwwww#####O.....',
      '..OOO#wOOOO#wOOO......',
      '....OwwO..OwwO........',
      '.....OO....OO.........',
    ],
    sitA: [
      '....OO.....OO.........',
      '...OmmO...OmmO........',
      '...OmdOOOOOdmO........',
      '..Odm#######mdO...OO..',
      '..Od#oe###eo#dO..OmmO.',
      '.O#dp#e###e#pdO.OmdmO.',
      '.O##p###p###p#O.O##dO.',
      '..O###rrcrr###O.O##O..',
      '.O##wwwrwwww##OO###O..',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O###wwwwwwwww####O....',
      'O###ww#ww#ww#####O....',
      '.O##wwOwwOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    sitB: [
      '....OO.....OO.........',
      '...OmmO...OmmO........',
      '...OmdOOOOOdmO........',
      '..Odm#######mdO.......',
      '..Od#oe###eo#dO...OO..',
      '.O#dp#e###e#pdO..OmmO.',
      '.O##p###p###p#O.OmdmO.',
      '..O###rrcrr###O.O##dO.',
      '.O##wwwrwwww##OO###O..',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O###wwwwwwwww####O....',
      'O###ww#ww#ww#####O....',
      '.O##wwOwwOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    tilt: [
      '.....OO.....OO........',
      '....OmmO...OmmO.......',
      '...OmdOOOOOOdmO.......',
      '...Odm#######mdO..OO..',
      '..Od##oe###eo#dO.OmmO.',
      '..O#dp#e###e#pdOOmdmO.',
      '..O##p###p###p#OO##dO.',
      '..O###rrcrr###O.O##O..',
      '.O##wwwrwwww##OO###O..',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O###wwwwwwwww####O....',
      'O###ww#ww#ww#####O....',
      '.O##wwOwwOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    scratch1: [
      '....OO.....OO.........',
      '...OmmO...OmmO........',
      '...OmdOOOOOdmO........',
      '..Odm#######mdO...OO..',
      '..Od#oe###eo#dO..OmmO.',
      '.O#dp#e###e#pdO.OmdmO.',
      '.O##p###p###p#O.O##dO.',
      'OO####rrcrr###O.O##O..',
      'Oww#wwwrwwww##OO###O..',
      'Oww#wwwwwwwwww####O...',
      '.OO#wwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O###wwwwwwwww####O....',
      'O###ww#ww#ww#####O....',
      '.O##wwOwwOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    scratch2: [
      '....OO.....OO.........',
      '...OmmO...OmmO........',
      '...OmdOOOOOdmO........',
      '..Odm#######mdO.......',
      '..Od#oe###eo#dO...OO..',
      'OO#dp#e###e#pdO..OmmO.',
      'Oww#p###p###p#O.OmdmO.',
      'Oww###rrcrr###O.O##dO.',
      '.OO#wwwrwwww##OO###O..',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O###wwwwwwwww####O....',
      'O###ww#ww#ww#####O....',
      '.O##wwOwwOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    happy: [
      '...OO.....OO..........',
      '..OmmO...OmmO.....OO..',
      '..OmdOOOOOdmO....OmmO.',
      '.Odm#######mdO..OmdmO.',
      '.Od##o###o##dO..O##dO.',
      'O#dpo#o#o#opdO.O###O..',
      'O##p###p###p#OO###O...',
      '.O###rrcrr#######O....',
      '.O#wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O##wwwwwwwww#####O....',
      'O###wwwwwww#####O.....',
      '.O##wwwwwww#####O.....',
      '..O#w#O###O#w#wO......',
      '..OwwO.OOO.OwwO.......',
      '...OO.......OO........',
    ],
    eat1: [
      '...OO.....OO..........',
      '..OmmO...OmmO.....OO..',
      '..OmdOOOOOdmO....OmmO.',
      '.Odm#######mdO..OmdmO.',
      '.Od#oo###oo#dO..O##dO.',
      'O#dp###p###pdO.O###O..',
      'O####rrcrr####O###O...',
      'O##wwwwrwwww#####O....',
      'O##wwwwwwwww#####O....',
      '.O##wwwwwww#####O.....',
      '..O#w#O###O#w#wO......',
      '..OwwO.OOO.OwwO.......',
      '...OO.......OO........',
    ],
    eat2: [
      '......................',
      '...OO.....OO......OO..',
      '..OmmO...OmmO....OmmO.',
      '..OmdOOOOOdmO...OmdmO.',
      '.Odm#######mdO..O##dO.',
      '.Od#oo###oo#dO.O###O..',
      'O#dp###p###pdOO###O...',
      'O####rrcrr#######O....',
      'O##wwwwrwwww#####O....',
      '.O##wwwwwww#####O.....',
      '..O#w#O###O#w#wO......',
      '..OwwO.OOO.OwwO.......',
      '...OO.......OO........',
    ],
    sleep1: [
      '...OO.....OO..........',
      '..OmmO...OmmOO........',
      '..OmdOOOOOdm##OO......',
      '.Odm#######md###O.....',
      'O#d#oo###oo##d###O.OO.',
      'O##p###p###p#####OOmmO',
      'O####rrcrr#######OmdmO',
      'O##wwwwwwwwwww####mdO.',
      '.O##wwwwwwwwww###mmO..',
      '..OOOOOOOOOOOOOOOOO...',
    ],
    sleep2: [
      '......................',
      '...OO.....OO..........',
      '..OmmO...OmmOO........',
      '..OmdOOOOOdm##OO......',
      '.Odm#######md###O.....',
      'O#d#oo###oo##d###O.OO.',
      'O##p###p###p#####OOmmO',
      'O####rrcrr#######OmdmO',
      'O##wwwwwwwwwww####mdO.',
      '.O##wwwwwwwwww###mmO..',
      '..OOOOOOOOOOOOOOOOO...',
    ],
    wave1: [
      '....OO.....OO.........',
      '...OmmO...OmmO........',
      '...OmdOOOOOdmO....OO..',
      '..Odm#######mdO..OmmO.',
      '..Od#oe###eo#dO.OmdmO.',
      '.O#dp#e###e#pdO.O##dO.',
      'OO##p###p###p#O.O##O..',
      'Oww###rrcrr###OO###O..',
      'Oww#wwwrwwww######O...',
      '.OO#wwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O###wwwwwwwww####O....',
      'O###ww#ww#ww#####O....',
      '.O##wwOwwOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    wave2: [
      '....OO.....OO.........',
      '...OmmO...OmmO........',
      '...OmdOOOOOdmO........',
      '..Odm#######mdO...OO..',
      'OOd#oe###eo#dO...OmmO.',
      'Owwdp#e###e#pdO.OmdmO.',
      'Oww#p###p###p#O.O##dO.',
      '.OO###rrcrr###OO###O..',
      '.O##wwwrwwww######O...',
      'O##wwwwwwwwwww####O...',
      'O##wwwwwwwwwww####O...',
      'O###wwwwwwwww####O....',
      'O###ww#ww#ww#####O....',
      '.O##wwOwwOww####O.....',
      '..OOOOOOOOOOOOOO......',
    ],
    dangle: [
      '...OO.....OO..........',
      '..OmmO...OmmO.........',
      '..OmdOOOOOdmO.........',
      '.Odm#######mdO........',
      '.Od#oo###oo#dO........',
      'O#dp###p###pdO........',
      '.O###rrcrr###O........',
      '.OwwOwwrwwOwwO...OO...',
      '..O#wwwwwww#O...OmmO..',
      '..O#wwwwwww#O..OmdmO..',
      '..O#########OOO##dO...',
      '...O#wOOO#wOOOO##O....',
      '...OwwO.OwwO...OO.....',
      '....OO...OO...........',
      '......................',
    ],
  });

  // 4 cohesive Kawaii Q-style breeds (unified px: 1.5, ordered so catCount 1->pusheen, 2->+ginger, 3->+calico, 4->all)
  const CAT_PRESETS = [
    {
      id: 'pusheen',
      breed: 'tabby',
      px: PX,
      bodyCols: 22,
      bodyRows: 15,
      stepMs: 170,
      xPct: 0.54,
      hue: 0.72,
      speed: 0.30,
      mood: 'cozy',
      poses: PUSHEEN_POSES,
      pal: { O: '#2E2B38', '#': '#C4C8D4', s: '#7A8094', b: '#F5F6FA', o: '#1E1B26', p: '#F9A8C9', w: '#FFFFFF', u: '#FDA4AF' },
    },
    {
      id: 'ginger',
      breed: 'kitten',
      px: PX,
      bodyCols: 18,
      bodyRows: 13,
      stepMs: 145,
      xPct: 0.12,
      hue: 0.09,
      speed: 0.52,
      mood: 'playful',
      poses: GINGER_POSES,
      pal: { O: '#3D2618', '#': '#FBB268', s: '#DF8234', b: '#FFF7EB', o: '#23160E', p: '#FF9EBB', w: '#FFFFFF' },
    },
    {
      id: 'calico',
      breed: 'calico',
      px: PX,
      bodyCols: 22,
      bodyRows: 15,
      stepMs: 165,
      xPct: 0.34,
      hue: 0.94,
      speed: 0.40,
      mood: 'sweet',
      poses: CALICO_POSES,
      pal: { O: '#332930', '#': '#FFFBF5', w: '#FFFFFF', a: '#F4A261', k: '#5B5263', L: '#38BDF8', R: '#F59E0B', o: '#231D24', p: '#F9A8C9' },
    },
    {
      id: 'ragdoll',
      breed: 'ragdoll',
      px: PX,
      bodyCols: 22,
      bodyRows: 16,
      stepMs: 185,
      xPct: 0.85,
      hue: 0.56,
      speed: 0.38,
      mood: 'gentle',
      poses: RAGDOLL_POSES,
      pal: { O: '#3A313D', '#': '#FFFDF7', w: '#FFFFFF', m: '#9B8393', d: '#C9B5C0', e: '#38BDF8', o: '#1E293B', p: '#F9A8D4', r: '#F472B6', c: '#FBCFE8' },
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

  const BUTTERFLY_FRAMES = [
    ['p...p', 'ppOpp', '.yOy.', '.....'],
    ['.....', 'p.O.p', 'pyOyp', '.p.p.'],
  ];

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

    const setCatState = (c, nextState, now, dur) => {
      c.state = nextState;
      c.stateBornAt = now;
      c.until = now + dur;
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
    const bfW = Math.round((5 + 2) * PX);
    const bfH = Math.round((4 + 2) * PX);
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
      nextSpawnAt: nowMs() + 20000 + Math.random() * 12000,
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
      cv.setAttribute('aria-hidden', 'true');
      const totalCols = pr.bodyCols + PAD_X * 2;
      const totalRows = pr.bodyRows + HEADROOM_ROWS;
      const cw = Math.round(totalCols * pr.px);
      const ch = Math.round(totalRows * pr.px);
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      cv.style.zIndex = '4';
      wrap.appendChild(cv);
      const now0 = nowMs();
      const initStates = ['loaf', 'sit', 'sit', 'sit'];
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
        stateBornAt: now0,
        until: now0 + 3400 + idx * 1200,
        targetX: null,
        targetProp: null,
        atProp: null,
        cuddleTarget: null,
        queuedHop: false,
        tsundereUntil: 0,
        squishUntil: 0,
        landUntil: 0,
        boopOffset: 0,
        boopBornAt: 0,
        boopUntil: 0,
        blinkUntil: 0,
        nextBlink: now0 + 1600 + idx * 850,
        twitchUntil: 0,
        nextTwitch: now0 + 3200 + idx * 1350,
        sym: null,
        symBornAt: 0,
        symUntil: 0,
        petCount: 0,
        lastPetAt: 0,
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
            setCatState(c, 'dangle', nowMs(), 900);
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
              setCatState(c, 'wave', now, 900);
              setSym(c, 'spark', now, 900);
            } else if (c.breed === 'tabby') {
              setCatState(c, 'happy', now, 1500);
              c.squishUntil = now + 260;
              setSym(c, c.petCount >= 3 ? 'hearts2' : 'heart', now, 1400);
              c.vy = -3.2;
              c.y = -1;
            } else if (c.breed === 'kitten') {
              setCatState(c, 'happy', now, 1500);
              c.queuedHop = true;
              setSym(c, 'spark', now, 1300);
              c.vy = -4.3;
              c.y = -1;
            } else if (c.breed === 'calico') {
              setCatState(c, 'happy', now, 1600);
              setSym(c, c.petCount >= 3 ? 'hearts2' : 'note', now, 1500);
              c.vy = -3.4;
              c.y = -1;
            } else {
              setCatState(c, 'tilt', now, 1800);
              c.tsundereUntil = now + 520;
              setSym(c, 'q', now, 520);
            }
          } else {
            setCatState(c, 'happy', now, 1000);
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
        setCatState(c, 'sleep', now, 7600 + Math.random() * 5200);
        c.y = -2;
        c.vy = 0;
        c.sym = null;
      } else if (propId === 'bowl') {
        c.dir = -1;
        setCatState(c, 'eat', now, (c.breed === 'tabby' ? 4200 : 3200) + Math.random() * 1800);
        setSym(c, c.breed === 'tabby' ? 'fish' : 'heart', now, 1600);
      } else if (propId === 'post') {
        c.dir = 1;
        setCatState(c, c.breed === 'ragdoll' ? 'scratch' : 'wave', now, (c.breed === 'ragdoll' ? 2600 : 2000) + Math.random() * 1200);
        setSym(c, 'spark', now, 1300);
      } else {
        c.dir = -1;
        setCatState(c, 'happy', now, 1800);
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
        setCatState(c, 'walk', now, 7000);
        c.dir = tx > c.x ? 1 : -1;
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
      // Per-cat phase desynchronization so the 4 cats never breathe/sway/walk in robotic lockstep
      const t = now + c.idx * 370;
      const elapsed = Math.max(0, now - (c.stateBornAt || 0));
      const fastStep = Math.floor(t / 150) % 2;
      const medStep = Math.floor(t / 280) % 2;
      const slowStep = Math.floor(t / 520) % 2;
      const sleepStep = Math.floor(t / 1050) % 2;
      const p = c.poses;

      if (c.dragging || c.state === 'dangle') return 'dangle';
      if (now < c.squishUntil && p.squish) return 'squish';
      if (now < c.landUntil) return p.squish ? 'squish' : 'sitA';
      if (c.state === 'pounce' || (c.y < -5 && p.pounce)) return p.pounce ? 'pounce' : 'happy';
      if (c.state === 'wiggle' && p.wiggle1) return fastStep === 0 ? 'wiggle1' : 'wiggle2';
      if (c.state === 'scratch' && p.scratch1) return Math.floor(t / 160) % 2 === 0 ? 'scratch1' : 'scratch2';
      if (c.state === 'loaf' && p.loaf1) return slowStep === 0 ? 'loaf1' : 'loaf2';
      if ((c.state === 'knead' || c.state === 'belly') && p.knead1) return Math.floor(t / 300) % 2 === 0 ? 'knead1' : 'knead2';
      if (c.state === 'yawn' && p.yawn1) {
        // Natural hold: open (0..280ms) -> full cozy yawn (280..1250ms) -> close
        return elapsed >= 280 && elapsed < 1250 ? 'yawn1' : 'yawn2';
      }
      if (c.state === 'stretch' && p.stretch1) {
        // Natural hold: prep (0..360ms) -> comfy stretch hold (360ms+)
        return elapsed < 360 ? 'stretch1' : 'stretch2';
      }
      if (c.state === 'tilt' && p.tilt) return 'tilt';
      if (c.state === 'walk') {
        // Smooth 4-beat walk cycle: walk1 -> standA -> walk2 -> standA
        const beat = Math.floor(t / (c.stepMs || 165)) % 4;
        return beat === 0 ? 'walk1' : beat === 2 ? 'walk2' : 'standA';
      }
      if (c.state === 'eat') return medStep === 0 ? 'eat1' : 'eat2';
      if (c.state === 'sleep') return sleepStep === 0 ? 'sleep1' : 'sleep2';
      if (c.state === 'sit') return slowStep === 0 ? 'sitA' : 'sitB';
      if (c.state === 'groom' && p.groom1) return Math.floor(t / 300) % 2 === 0 ? 'groom1' : 'groom2';
      if (c.state === 'wave') return Math.floor(t / 210) % 2 === 0 ? 'wave1' : 'wave2';
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
      let boopDx = 0;
      if (now < c.boopUntil && c.boopOffset) {
        const bp = Math.max(0, Math.min(1, (now - c.boopBornAt) / Math.max(1, c.boopUntil - c.boopBornAt)));
        boopDx = Math.round(Math.sin(bp * Math.PI) * c.boopOffset);
      }
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
        const zCycle = ((now + c.idx * 450) % 2000) / 2000;
        activeSym = zCycle < 0.5 ? 'z1' : 'z2';
        symPhase = Math.min(5, Math.floor(zCycle * 6));
      } else if (thinking && c.idx <= 1 && !focusNap && c.state === 'sit') {
        const tCycle = ((now + c.idx * 400) % 2200) / 2200;
        activeSym = c.idx === 0 ? 'think' : 'q';
        symPhase = Math.min(5, Math.floor(tCycle * 6));
      } else if (c.state === 'eat' && Math.floor((now + c.idx * 300) / 1100) % 2 === 0) {
        activeSym = c.breed === 'tabby' ? 'fish' : 'note';
        symPhase = Math.floor(((now + c.idx * 300) % 1100) / 220);
      } else if (c.state === 'groom' && Math.floor((now + c.idx * 300) / 1200) % 2 === 0) {
        activeSym = 'note';
        symPhase = Math.floor(((now + c.idx * 300) % 1200) / 240);
      }

      const scratchChipPhase = c.state === 'scratch' ? Math.floor((now + c.idx * 200) / 160) % 3 : -1;
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

      // Gentle pastel woodchip sparkles during Ragdoll scratching-post pat
      if (scratchChipPhase >= 0) {
        const step = c.px * curDpr;
        const chips = [
          [21, HEADROOM_ROWS + 6 - scratchChipPhase, '#FDE68A'],
          [22, HEADROOM_ROWS + 9 - (scratchChipPhase % 2), '#E9C89B'],
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
        const driftX = activeSym.startsWith('z') ? symPhase * 0.30 * c.px * curDpr : 0;
        const sx0 = Math.round(pw * 0.32 + driftX);
        const lowPose = poseKey.startsWith('sleep') || poseKey.startsWith('loaf');
        const sy0 = Math.round((lowPose ? 4.4 : 2.0) * c.px * curDpr - rise);
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
          setCatState(c, 'sleep', now, 15000);
          setSym(c, 'z1', now, 1200);
        } else {
          setCatState(c, c.idx % 2 === 0 ? 'sit' : 'stand', now, 2800 + c.idx * 500);
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
        setCatState(c, 'sleep', now, 8500 + Math.random() * 5000);
        return;
      }
      if (thinking) {
        setCatState(c, c.idx <= 1 ? 'sit' : 'sleep', now, 3600 + Math.random() * 2000);
        return;
      }
      if (streaming) {
        setCatState(c, c.breed === 'tabby' ? 'loaf' : c.idx % 2 === 0 ? 'sit' : 'stand', now, 3400 + Math.random() * 2200);
        return;
      }

      if (hasCrowdNear(c, c.x) || overlapsAnyProp(c.x, c.cw)) {
        const tx = pickClearSpot(c, sw);
        c.targetX = tx;
        setCatState(c, 'walk', now, 4500);
        c.dir = tx >= c.x ? 1 : -1;
        return;
      }

      const r = Math.random();
      const propsOn = sCfg.catProps !== 'off';

      // ~75% calm cozy life (sit/loaf/sleep/stand/groom/tilt) + ~25% delightful strolls/treats/tricks
      if (c.breed === 'tabby') {
        if (r < 0.28) {
          setCatState(c, 'loaf', now, 5200 + Math.random() * 4200);
        } else if (r < 0.48) {
          setCatState(c, 'sit', now, 4200 + Math.random() * 3200);
        } else if (r < 0.64) {
          setCatState(c, 'sleep', now, 6200 + Math.random() * 4600);
        } else if (r < 0.74) {
          setCatState(c, 'stand', now, 3600 + Math.random() * 2400);
        } else if (r < 0.82) {
          setCatState(c, 'knead', now, 2800 + Math.random() * 1400);
          setSym(c, 'heart', now, 1300);
        } else if (r < 0.87) {
          setCatState(c, 'yawn', now, 1600);
        } else if (propsOn && propById.bowl?.visible && r < 0.92 && !isPropBusy('bowl', c)) {
          sendCatToProp(c, 'bowl', now, false);
        } else if (propsOn && propById.cushion?.visible && r < 0.96 && !isPropBusy('cushion', c)) {
          sendCatToProp(c, 'cushion', now, false);
        } else {
          const tx = pickClearSpot(c, sw);
          c.targetX = tx;
          setCatState(c, 'walk', now, 2600 + Math.random() * 2200);
          c.dir = tx >= c.x ? 1 : -1;
        }
        return;
      }

      if (c.breed === 'kitten') {
        const chonk = cats[0];
        if (r < 0.30) {
          setCatState(c, 'sit', now, 3600 + Math.random() * 2800);
        } else if (r < 0.50) {
          setCatState(c, 'stand', now, 3200 + Math.random() * 2600);
        } else if (r < 0.68) {
          setCatState(c, 'sleep', now, 5200 + Math.random() * 3800);
        } else if (chonk && chonk !== c && chonk.visible && !chonk.dragging && (chonk.state === 'sleep' || chonk.state === 'loaf') && r < 0.78) {
          const sideLeft = chonk.x - c.cw - 3;
          const sideRight = chonk.x + chonk.cw + 3;
          const minX = 18;
          const maxX = Math.max(minX + 8, sw - 18 - c.cw);
          const cand = sideLeft >= minX && !overlapsAnyProp(sideLeft, c.cw) ? sideLeft : Math.min(maxX, sideRight);
          c.targetX = Math.max(minX, Math.min(maxX, Math.round(cand)));
          c.cuddleTarget = chonk.id;
          setCatState(c, 'walk', now, 5200);
          c.dir = c.targetX >= c.x ? 1 : -1;
        } else if (r < 0.90) {
          const tx = pickClearSpot(c, sw);
          c.targetX = tx;
          setCatState(c, 'walk', now, 2200 + Math.random() * 2000);
          c.dir = tx >= c.x ? 1 : -1;
        } else if (propsOn && propById.bowl?.visible && r < 0.95 && !isPropBusy('bowl', c)) {
          sendCatToProp(c, 'bowl', now, false);
        } else {
          setCatState(c, 'wiggle', now, 720);
        }
        return;
      }

      if (c.breed === 'calico') {
        if (r < 0.28) {
          setCatState(c, 'sit', now, 4200 + Math.random() * 3200);
        } else if (r < 0.50) {
          setCatState(c, 'groom', now, 3200 + Math.random() * 2400);
        } else if (r < 0.66) {
          setCatState(c, 'sleep', now, 5600 + Math.random() * 4000);
        } else if (r < 0.76) {
          setCatState(c, 'stand', now, 3400 + Math.random() * 2400);
        } else if (r < 0.85) {
          setCatState(c, 'stretch', now, 1950);
        } else if (propsOn && propById.cushion?.visible && r < 0.91 && !isPropBusy('cushion', c)) {
          sendCatToProp(c, 'cushion', now, false);
        } else if (propsOn && propById.bowl?.visible && r < 0.95 && !isPropBusy('bowl', c)) {
          sendCatToProp(c, 'bowl', now, false);
        } else {
          const tx = pickClearSpot(c, sw);
          c.targetX = tx;
          setCatState(c, 'walk', now, 2600 + Math.random() * 2200);
          c.dir = tx >= c.x ? 1 : -1;
        }
        return;
      }

      // Soft Plush Ragdoll
      if (r < 0.30) {
        setCatState(c, 'sit', now, 4400 + Math.random() * 3200);
      } else if (r < 0.48) {
        setCatState(c, 'sleep', now, 5800 + Math.random() * 4200);
      } else if (r < 0.64) {
        setCatState(c, 'stand', now, 3600 + Math.random() * 2600);
      } else if (r < 0.76) {
        setCatState(c, 'tilt', now, 2200 + Math.random() * 1200);
        setSym(c, 'q', now, 1300);
      } else if (propsOn && propById.cushion?.visible && r < 0.85 && !isPropBusy('cushion', c)) {
        sendCatToProp(c, 'cushion', now, false);
      } else if (propsOn && propById.post?.visible && r < 0.92 && !isPropBusy('post', c)) {
        sendCatToProp(c, 'post', now, false);
      } else {
        const tx = pickClearSpot(c, sw);
        c.targetX = tx;
        setCatState(c, 'walk', now, 2600 + Math.random() * 2200);
        c.dir = tx >= c.x ? 1 : -1;
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
          now < c.landUntil ||
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
          butterfly.nextSpawnAt = now + 20000 + Math.random() * 12000;
        } else {
          drawButterfly(now);
          let hunter = cats.find((c) => c.visible && !c.dragging && c.id === butterfly.hunterId) || null;
          if (!hunter) {
            hunter = cats.find((c) => c.visible && !c.dragging && c.breed === 'kitten') ||
                     cats.find((c) => c.visible && !c.dragging && c.breed === 'ragdoll') || null;
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
                setCatState(hunter, 'wiggle', now, 560);
              } else if (now >= hunter.until - 80) {
                setCatState(hunter, 'pounce', now, 850);
                hunter.vy = -4.5;
                hunter.y = -1;
                setSym(hunter, 'spark', now, 850);
                butterfly.fleeing = true;
                butterfly.vx = (dist >= 0 ? 1 : -1) * 1.8;
              }
            } else if (Math.abs(dist) < 220 && hunter.state !== 'wiggle') {
              hunter.targetX = null;
              hunter.targetProp = null;
              hunter.atProp = null;
              setCatState(hunter, 'walk', now, 600);
            }
          }
        }
      }

      // Multi-Cat Yarn Soccer (nearest 1-2 cats actively chase & bat yarn back and forth)
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

        if (c.tsundereUntil > 0 && now >= c.tsundereUntil) {
          c.tsundereUntil = 0;
          setCatState(c, 'happy', now, 1300);
          setSym(c, 'heart', now, 1300);
        }

        if ((c.y < 0 && c.atProp !== 'cushion') || c.vy !== 0) {
          const prevVy = c.vy;
          c.y += c.vy * dtScale;
          c.vy += 1.42 * dtScale;
          if (c.y >= 0) {
            c.y = 0;
            c.vy = 0;
            if (c.queuedHop) {
              c.queuedHop = false;
              c.vy = -3.6;
              c.y = -1;
              setSym(c, 'heart', now, 1000);
            } else {
              // Soft Q-elastic landing cushion
              if (prevVy > 1.2) c.landUntil = now + 130;
              if (c.state === 'pounce') {
                setCatState(c, 'happy', now, 700);
              }
            }
          }
        }

        if (!reduced && now >= c.nextBlink) {
          c.blinkUntil = now + 170;
          c.nextBlink = now + 2800 + Math.random() * 3400;
        }
        if (!reduced && now >= c.nextTwitch) {
          c.twitchUntil = now + 220;
          c.nextTwitch = now + 4500 + Math.random() * 4800;
        }

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
            let batDir = dist >= 0 ? 1 : -1;
            for (const other of yarnChasers) {
              if (other !== c) batDir = other.x >= c.x ? 1 : -1;
            }
            yarn.vx = batDir * (4.4 + Math.random() * 2.0);
            yarn.vy = -3.6;
            c.dir = batDir;
            setCatState(c, 'wave', now, 520);
            if (c.breed === 'kitten') {
              c.vy = -3.2;
              c.y = -1;
            }
            setSym(c, 'spark', now, 700);
          } else if (c.state !== 'wave' || now >= c.until) {
            setCatState(c, 'walk', now, 500);
            c.dir = dist < 0 ? -1 : 1;
          }
        } else if (!reduced && now >= c.until) {
          if (c.breed === 'kitten' && c.state === 'wiggle') {
            setCatState(c, 'pounce', now, 800);
            c.vy = -4.2;
            c.y = -1;
            setSym(c, 'spark', now, 850);
          } else {
            pickNextBehavior(c, now, sw);
          }
        }

        if (!reduced && c.state === 'walk') {
          const boost = yarn.active ? 1.38 : 1;
          const stepPx = c.speed * 2.1 * boost * dtScale;
          if (c.targetX !== null) {
            const rem = c.targetX - c.x;
            if (Math.abs(rem) <= stepPx + 1.5) {
              c.x = c.targetX;
              if (c.targetProp) {
                arriveAtProp(c, c.targetProp, now);
              } else if (c.cuddleTarget) {
                c.targetX = null;
                setCatState(c, 'sleep', now, 7200 + Math.random() * 4000);
                setSym(c, 'heart', now, 1400);
              } else {
                c.targetX = null;
                setCatState(c, c.breed === 'tabby' && Math.random() < 0.55 ? 'loaf' : 'sit', now, 3200 + Math.random() * 2800);
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

      // Nose Boop Greeting with smooth sinusoidal lean easing
      if (!reduced && !yarn.active && !streaming && !thinking && !quietNapNow && now - lastBoopAt > 9000) {
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
              a.boopBornAt = b.boopBornAt = now;
              a.boopUntil = b.boopUntil = now + 420;
              setCatState(a, 'happy', now, 1300);
              setCatState(b, 'happy', now, 1300);
              setSym(a, 'heart', now, 1300);
              setSym(b, 'spark', now, 1200);
              if (b.breed === 'kitten' || Math.random() < 0.45) {
                b.vy = -3.2;
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
        setCatState(c, 'stand', now, 2400);
        c.twitchUntil = now + 650;
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
                setCatState(c, c.breed === 'tabby' ? 'loaf' : c.idx % 2 === 0 ? 'sit' : 'stand', now, 3400 + c.idx * 400);
              } else if (c.state === 'sleep' && c.idx === 0) {
                if (c.atProp === 'cushion' && c.y < 0) c.y = 0;
                c.atProp = null;
                setCatState(c, 'loaf', now, 3600);
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
              setCatState(c, 'sit', now, 3800);
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
            setCatState(c, 'happy', now, 1200);
            setSym(c, 'heart', now, 1200);
            if (!reduced) {
              c.vy = c.breed === 'kitten' ? -4.0 : -3.2;
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
            setCatState(rightmost, rightmost.breed === 'ragdoll' ? 'scratch' : 'wave', now, 1800);
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
          setCatState(lead, 'wave', now, 850);
          setSym(lead, 'spark', now, 850);
          paintCat(lead, now);
          scheduleNext(true);
        }
      } else if (type === 'slash-cmd') {
        markUserInteraction(now);
        const cmd = String(pl.cmd || '').toLowerCase();
        if (lead) {
          if (cmd === 'plan' || cmd === 'grill-me') {
            setCatState(lead, 'sit', now, 1500);
            setSym(lead, 'q', now, 1500);
          } else if (cmd === 'compact') {
            setCatState(lead, lead.poses.loaf1 ? 'loaf' : 'sit', now, 1500);
            setSym(lead, 'spark', now, 1400);
          } else {
            setCatState(lead, 'wave', now, 1500);
            setSym(lead, 'spark', now, 1200);
          }
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
          setCatState(c, 'sleep', now, 10000);
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
