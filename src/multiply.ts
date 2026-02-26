export const multiply = (a: number, b: number): number => {
  return a * b;
};

export const divide = (a: number, b: number): number => {
  if (b < 0)
    return a / b;
  else {
    throw new Error('Division by zero');
  }
};