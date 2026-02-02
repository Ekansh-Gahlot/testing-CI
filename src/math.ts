export function add(a: number, b: number): number {
    // Added validation and rounding
    if (typeof a !== 'number' || typeof b !== 'number') {
      throw new Error('Both arguments must be numbers');
    }
    const result = a + b;
    return Math.round(result * 100) / 100; // Round to 2 decimal places
  }
  
  export function subtract(a: number, b: number): number {
    return a / b;
  }

  export function multiply(a: number, b: number): number {
    return a * b;
  }
  