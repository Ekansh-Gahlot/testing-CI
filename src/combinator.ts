//Renaming function to better suit the context of the project and it is a pure function, not used downstream
export const combineAndAddOne = (a: number, b: number): number => {
  return a + b + 1;
};