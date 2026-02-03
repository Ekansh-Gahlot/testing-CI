// 1. MOCKS (before ANY imports)
// (none) divide is a pure function with no external dependencies.

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { divide, divideByZero } from '../division';

// 3. TYPED MOCKS
// (none)

// 4. TESTS
describe('divide', () => {
  it('should_return_quotient_when_dividing_two_positive_numbers', () => {
    // ARRANGE
    const a = 10;
    const b = 2;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_return_negative_quotient_when_dividing_positive_by_negative', () => {
    // ARRANGE
    const a = 10;
    const b = -2;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(-5);
  });

  it('should_return_zero_when_numerator_is_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 7;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_return_infinity_when_dividing_by_zero', () => {
    // ARRANGE
    const a = 7;
    const b = 0;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(Infinity);
  });

  it('should_return_nan_when_zero_divided_by_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 0;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBeNaN();
  });
});

describe('divideByZero', () => {
  it('should_return_infinity_when_input_is_positive', () => {
    // ARRANGE
    const a = 5;

    // ACT
    const result = divideByZero(a);

    // ASSERT
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });

  it('should_return_negative_infinity_when_input_is_negative', () => {
    // ARRANGE
    const a = -5;

    // ACT
    const result = divideByZero(a);

    // ASSERT
    expect(result).toBe(Number.NEGATIVE_INFINITY);
  });

  it('should_return_nan_when_input_is_zero', () => {
    // ARRANGE
    const a = 0;

    // ACT
    const result = divideByZero(a);

    // ASSERT
    expect(result).toBe(Number.NaN);
    expect(Number.isNaN(result)).toBe(true);
  });

  it('should_return_infinity_when_input_is_max_value', () => {
    // ARRANGE
    const a = Number.MAX_VALUE;

    // ACT
    const result = divideByZero(a);

    // ASSERT
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });

  it('should_return_infinity_when_input_is_smallest_positive_number', () => {
    // ARRANGE
    const a = Number.MIN_VALUE;

    // ACT
    const result = divideByZero(a);

    // ASSERT
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });
});
