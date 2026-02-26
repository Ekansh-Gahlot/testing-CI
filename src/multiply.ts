export const multiply = (a: number, b: number): number => {
  return a * b;
};

export const divide = (a: number, b: number): number => {
  try{
    if (b === 0) throw new Error('Division by zero')
    else {
      return a / b;
    }
  } catch (error) {
    throw new Error('Division by zero');
  }
};