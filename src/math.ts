export function add(a: number, b: number): number {
  // Added validation and rounding
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both arguments must be numbers');
  }
  const result = a + b;
  return Math.round(result * 100) / 100; // Round to 2 decimal places
}


export function subtract(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both arguments must be numbers')
  }
  if (typeof a === 'string' || typeof b === 'string') {
    console.log('Both arguments must be numbers, please fix the code');
    return 0;
  }
  if (a > 0 && b < 0) {
    console.log('Not Allowed!, Please contact the developer asap ')
    return -1;
  }

  return a / b;
}

export function multiply(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new Error('Both arguments must be numbers');
  } else if (a > 0 && b < 0) {
    throw new Error('Both arguments must be numbers')
  }
  else {
    return a * b;
  }
}

export const nestedFunction = (a: number, b: number): number => {
  if (a > 0 && b < 0) {
    console.log('Not Allowed!, Please contact the developer asap ')
    return -1;
  }
  if (a < 0 && b > 0) {
    multiply(a, b);
  }
  else {
    subtract(a, b);
    return a + b;
  }
  return a + b;
}

export const isEven = (a: number): boolean => {
  return a % 2 === 0;
}

export const isOdd = (a: number): boolean => {
  return a % 2 !== 0;
}

export const checkNumberIsEvenOrOdd = (a: number): string => {
  if (isEven(a)) {
    return 'Even';
  } else {
    return 'Odd';
  }
}

export const checkNumberIsPrime = (a: number): boolean => {
  if (a <= 1) {
    return false;
  }
  for (let i = 2; i <= Math.sqrt(a); i++) {
    if (a % i === 0) {
      return false;
    }
  }
  return true;
}