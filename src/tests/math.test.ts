// 1. MOCKS (before ANY imports)
// (no module mocks required - add is a pure function with no dependencies)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { add, subtract, multiply } from '../math';

// 4. TESTS

describe('add', () => {
  it('should_return_sum_for_integers_when_valid_inputs', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_round_to_two_decimals_when_result_has_more_precision', () => {
    // ARRANGE
    const a = 0.1;
    const b = 0.2;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(0.3);
  });

  it('should_handle_negative_numbers_when_valid_inputs', () => {
    // ARRANGE
    const a = -10;
    const b = 4;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(-6);
  });

  it('should_return_zero_when_both_arguments_are_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 0;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_throw_error_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '1' as unknown as number;
    const b = 2;

    // ACT
    const act = () => add(a, b);

    // ASSERT
    expect(act).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_error_when_second_argument_is_not_a_number', () => {
    // ARRANGE
    const a = 1;
    const b = undefined as unknown as number;

    // ACT
    const act = () => add(a, b);

    // ASSERT
    expect(act).toThrowError(new Error('Both arguments must be numbers'));
  });
});


describe('subtract', () => {
  it('should_divide_a_by_b_when_b_is_nonzero', () => {
    // ARRANGE
    const a = 10;
    const b = 2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_return_fraction_when_division_is_not_even', () => {
    // ARRANGE
    const a = 7;
    const b = 2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(3.5);
  });

  it('should_return_infinity_when_dividing_by_zero', () => {
    // ARRANGE
    const a = 1;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(Infinity);
  });

  it('should_return_negative_infinity_when_dividing_negative_by_zero', () => {
    // ARRANGE
    const a = -1;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(-Infinity);
  });

  it('should_return_nan_when_both_inputs_are_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(Number.isNaN(result)).toBe(true);
  });
});

describe('multiply', () => {
  it('should_multiply_positive_numbers_when_both_positive', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(6);
  });

  it('should_multiply_when_one_operand_is_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 123;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_return_positive_result_when_both_operands_negative', () => {
    // ARRANGE
    const a = -4;
    const b = -5;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(20);
  });

  it('should_return_negative_result_when_one_operand_negative', () => {
    // ARRANGE
    const a = -7;
    const b = 6;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(-42);
  });

  it('should_return_nan_when_any_operand_is_nan', () => {
    // ARRANGE
    const a = Number.NaN;
    const b = 3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBeNaN();
  });
});


