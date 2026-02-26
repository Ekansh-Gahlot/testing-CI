// 1. MOCKS (before ANY imports)
// (none) - multiply has no external dependencies

// 2. IMPORTS
import { beforeEach, describe, expect, it } from 'vitest';
import { multiply } from '../multiply';
import { divide } from '../multiply';


// 3. TYPED MOCKS
// (none)

// 4. TESTS
describe('multiply', () => {
  beforeEach(() => {
    // clearMocks: true in config handles cleanup
  });

  it('should_return_product_when_given_two_positive_numbers', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(6);
  });

  it('should_return_negative_product_when_given_positive_and_negative_numbers', () => {
    // ARRANGE
    const a = 2;
    const b = -3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(-6);
  });

  it('should_return_positive_product_when_given_two_negative_numbers', () => {
    // ARRANGE
    const a = -2;
    const b = -3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(6);
  });

  it('should_return_zero_when_multiplying_by_zero', () => {
    // ARRANGE
    const a = 12345;
    const b = 0;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_return_nan_when_any_input_is_nan', () => {
    // ARRANGE
    const a = Number.NaN;
    const b = 3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBeNaN();
  });

  it('should_return_infinity_when_overflowing_number_range', () => {
    // ARRANGE
    const a = Number.MAX_VALUE;
    const b = 2;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('divide', () => {
  // This function: divides a by b and throws when b is 0.
  // It calls: no dependencies.
  // I will only mock: nothing (pure function).
  // Edge cases to cover: division by zero, negative numbers, floating point results.

  beforeEach(() => {
    // clearMocks: true in config handles cleanup
  });

  it('should_return_quotient_when_divisor_is_nonzero', () => {
    // ARRANGE
    const a = 10;
    const b = 2;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_return_negative_when_operands_have_opposite_signs', () => {
    // ARRANGE
    const a = -9;
    const b = 3;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(-3);
  });

  it('should_return_positive_when_both_operands_are_negative', () => {
    // ARRANGE
    const a = -8;
    const b = -2;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(4);
  });

  it('should_return_zero_when_numerator_is_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 5;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_return_decimal_when_division_is_not_even', () => {
    // ARRANGE
    const a = 1;
    const b = 4;

    // ACT
    const result = divide(a, b);

    // ASSERT
    expect(result).toBe(0.25);
  });

  it('should_throw_error_when_divisor_is_zero', () => {
    // ARRANGE
    const a = 10;
    const b = 0;

    // ACT
    const act = () => divide(a, b);

    // ASSERT
    expect(act).toThrowError(new Error('Division by zero'));
  });
});
