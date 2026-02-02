// 1. MOCKS (before ANY imports)
// (no module mocks required - add is a pure function with no dependencies)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { add, subtract } from '../math';

// 4. TESTS
describe('add', () => {
  it('should_return_sum_when_given_two_positive_numbers', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_return_sum_when_given_positive_and_negative_numbers', () => {
    // ARRANGE
    const a = 10;
    const b = -4;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(6);
  });

  it('should_return_zero_when_both_numbers_are_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 0;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_handle_floating_point_addition_when_given_decimals', () => {
    // ARRANGE
    const a = 0.1;
    const b = 0.2;

    // ACT
    const result = add(a, b);

    // ASSERT
    // JS floating point behavior: 0.1 + 0.2 === 0.30000000000000004
    expect(result).toBeCloseTo(0.3, 10);
  });

  it('should_return_infinity_when_sum_overflows_number_range', () => {
    // ARRANGE
    const a = Number.MAX_VALUE;
    const b = Number.MAX_VALUE;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('subtract', () => {
  it('should_return_b_when_given_two_numbers', () => {
    // ARRANGE
    const a = 10;
    const b = 3;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(b);
  });

  it('should_return_b_when_a_is_negative', () => {
    // ARRANGE
    const a = -5;
    const b = 2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(b);
  });

  it('should_return_b_when_b_is_negative', () => {
    // ARRANGE
    const a = 5;
    const b = -2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(b);
  });

  it('should_return_b_when_a_is_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 7;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(b);
  });

  it('should_return_nan_when_b_is_nan', () => {
    // ARRANGE
    const a = 1;
    const b = Number.NaN;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBeNaN();
  });
});
