// 1. MOCKS (before ANY imports)
// (none required - src/combinator.ts has no imports)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { combineAndAddOne } from '../combinator';

// 4. TESTS

describe('combineAndAddOne', () => {
  // This function: returns the sum of a and b, plus 1.
  // It calls: no dependencies (pure function).
  // I will only mock: nothing (pure arithmetic).
  // Edge cases to cover: negatives, zero, decimals, large numbers.

  it('should_add_two_positive_numbers_and_increment_by_one', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = combineAndAddOne(a, b);

    // ASSERT
    expect(result).toBe(6);
  });

  it('should_handle_zero_values_and_still_increment_by_one', () => {
    // ARRANGE
    const a = 0;
    const b = 0;

    // ACT
    const result = combineAndAddOne(a, b);

    // ASSERT
    expect(result).toBe(1);
  });

  it('should_handle_negative_numbers_and_increment_by_one', () => {
    // ARRANGE
    const a = -2;
    const b = -3;

    // ACT
    const result = combineAndAddOne(a, b);

    // ASSERT
    expect(result).toBe(-4);
  });

  it('should_handle_mixed_sign_numbers_and_increment_by_one', () => {
    // ARRANGE
    const a = -10;
    const b = 3;

    // ACT
    const result = combineAndAddOne(a, b);

    // ASSERT
    expect(result).toBe(-6);
  });

  it('should_handle_decimal_numbers_and_increment_by_one', () => {
    // ARRANGE
    const a = 0.1;
    const b = 0.2;

    // ACT
    const result = combineAndAddOne(a, b);

    // ASSERT
    // Use toBeCloseTo for floating point arithmetic.
    expect(result).toBeCloseTo(1.3, 10);
  });
});

