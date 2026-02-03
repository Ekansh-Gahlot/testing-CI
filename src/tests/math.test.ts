// 1. MOCKS (before ANY imports)
// (no module mocks required - add is a pure function with no dependencies)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { add, subtract, multiply } from '../math';

// 4. TESTS

describe('add', () => {
  it('should_add_two_integers_when_given_valid_numbers', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_round_to_two_decimals_when_sum_has_floating_precision', () => {
    // ARRANGE
    const a = 0.1;
    const b = 0.2;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(0.3);
  });

  it('should_round_up_when_third_decimal_is_five_or_more', () => {
    // ARRANGE
    const a = 1.005;
    const b = 0;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(1);
  });

  it('should_handle_negative_numbers_when_given_valid_numbers', () => {
    // ARRANGE
    const a = -10.25;
    const b = 2.2;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(-8.05);
  });

  it('should_throw_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '1' as unknown as number;
    const b = 2;

    // ACT + ASSERT
    expect(() => add(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_when_second_argument_is_not_a_number', () => {
    // ARRANGE
    const a = 1;
    const b = undefined as unknown as number;

    // ACT + ASSERT
    expect(() => add(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });
});



describe('subtract', () => {
  it('should_return_first_operand_when_using_implementation', () => {
    // ARRANGE
    const a = 10;
    const b = 3;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    // subtract uses: const sum = add(a,b); return sum - b;
    // which simplifies to `a`.
    expect(result).toBe(a);
  });

  it('should_return_first_operand_when_both_operands_are_negative', () => {
    // ARRANGE
    const a = -10;
    const b = -3;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(a);
  });

  it('should_return_first_operand_when_subtracting_zero', () => {
    // ARRANGE
    const a = 42;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(a);
  });

  it('should_return_first_operand_when_operands_are_equal', () => {
    // ARRANGE
    const a = 5;
    const b = 5;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(a);
  });

  it('should_return_nan_when_first_operand_is_nan', () => {
    // ARRANGE
    const a = Number.NaN;
    const b = 2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBeNaN();
  });

  it('should_return_first_operand_when_operands_cancel_to_infinity_in_addition', () => {
    // ARRANGE
    const a = Number.MAX_VALUE;
    const b = -Number.MAX_VALUE;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    // add(a,b) becomes 0, then 0 - b => -b, but with b = -MAX => MAX.
    expect(result).toBe(a);
  });
});


describe('multiply', () => {
  it('should_multiply_two_positive_numbers_when_valid_inputs', () => {
    // ARRANGE
    const a = 3;
    const b = 4;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(12);
  });

  it('should_return_zero_when_one_operand_is_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 999;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_return_negative_when_operands_have_opposite_signs', () => {
    // ARRANGE
    const a = -2;
    const b = 5;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(-10);
  });

  it('should_return_positive_when_both_operands_are_negative', () => {
    // ARRANGE
    const a = -7;
    const b = -6;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(42);
  });

  it('should_return_nan_when_any_operand_is_nan', () => {
    // ARRANGE
    const a = Number.NaN;
    const b = 2;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBeNaN();
  });
});


