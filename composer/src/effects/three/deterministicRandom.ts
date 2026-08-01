// Hash-based PRNG, not Math.random(): particle setup must be identical no
// matter which frame is rendered first or which worker renders it.
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
