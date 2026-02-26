export const combineAndAddOne = (a: number, b: number): number => {
  return a + b + 1;
};

// Backwards-compatible alias for existing consumers of `combine`.
export const combine = combineAndAddOne;