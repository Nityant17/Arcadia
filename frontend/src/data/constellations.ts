export type Constellation = {
  name: string;
  philosopher: string;
  stars: Array<{ x: number; y: number }>;
  lines: Array<[number, number]>;
};

export const CONSTELLATIONS: Constellation[] = [
  {
    name: "Ursa Major",
    philosopher: "Aristotle",
    stars: [
      { x: 16, y: 18 },
      { x: 24, y: 22 },
      { x: 30, y: 32 },
      { x: 36, y: 42 },
      { x: 48, y: 46 },
      { x: 58, y: 40 },
      { x: 66, y: 32 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    name: "Orion",
    philosopher: "Plato",
    stars: [
      { x: 62, y: 18 }, // left shoulder
      { x: 78, y: 22 }, // right shoulder
      { x: 64, y: 34 }, // belt left
      { x: 70, y: 36 }, // belt middle
      { x: 76, y: 34 }, // belt right
      { x: 60, y: 52 }, // left knee
      { x: 80, y: 56 }, // right knee
    ],
    lines: [
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
    ],
  },
  {
    name: "Cassiopeia",
    philosopher: "Hypatia",
    stars: [
      { x: 20, y: 68 },
      { x: 28, y: 62 },
      { x: 36, y: 70 },
      { x: 44, y: 64 },
      { x: 52, y: 72 },
      { x: 60, y: 66 },
      { x: 68, y: 74 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    name: "Lyra",
    philosopher: "Socrates",
    stars: [
      { x: 78, y: 62 },
      { x: 84, y: 70 },
      { x: 86, y: 80 },
      { x: 74, y: 82 },
      { x: 66, y: 76 },
      { x: 70, y: 66 },
      { x: 76, y: 72 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
];
