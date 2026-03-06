// Crossword puzzle data.
// Each grid is 25 chars for a 5×5. '#' = black square.
// Intersections verified: every cell shared by an across and down word
// contains the same letter in both answers.
//
// Puzzle 1: CATER across, CABIN down (col 0), RACES down (col 4)
//   Row 0: C A T E R  — CATER
//   Col 0: C A B I N  — CABIN   (CATER[0]=C = CABIN[0]=C ✓)
//   Col 4: R A C E S  — RACES   (CATER[4]=R = RACES[0]=R ✓)
//
// Puzzle 2: STEAM across, STONE down (col 0), MAPLE down (col 4)
//   Row 0: S T E A M  — STEAM
//   Col 0: S T O N E  — STONE   (STEAM[0]=S = STONE[0]=S ✓)
//   Col 4: M A P L E  — MAPLE   (STEAM[4]=M = MAPLE[0]=M ✓)
//
// Puzzle 3: FLAME across, FROGS down (col 0), ENDED down (col 4)
//   Row 0: F L A M E  — FLAME
//   Col 0: F R O G S  — FROGS   (FLAME[0]=F = FROGS[0]=F ✓)
//   Col 4: E N D E D  — ENDED   (FLAME[4]=E = ENDED[0]=E ✓)

const PUZZLES = [
  {
    title: 'Test Puzzle One',
    grid:  'CATERA###AB###CI###EN###S',
    clues: {
      across: { 1: 'To provide food for an event' },
      down:   { 1: 'Small wooden dwelling', 2: 'Sprint competitions' }
    }
  },
  {
    title: 'Test Puzzle Two',
    grid:  'STEAMT###AO###PN###LE###E',
    clues: {
      across: { 1: 'Hot water vapor' },
      down:   { 1: 'A rock', 2: 'Tree that produces syrup' }
    }
  },
  {
    title: 'Test Puzzle Three',
    grid:  'FLAMER###NO###DG###ES###D',
    clues: {
      across: { 1: "Fire's glow" },
      down:   { 1: 'Jumping pond creatures', 2: 'Came to a finish' }
    }
  }
];
