// 1. MOCKS (before ANY imports)
// (no module mocks required - add is a pure function with no dependencies)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { add, subtract, multiply } from '../math';

// 4. TESTS
// Updated to match new validation logic

describe('add', () => {
  it('should_return_rounded_difference_when_given_integers', () => {
    // ARRANGE
    const a = 10;
    const b = 3;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(7);
  });

  it('should_round_to_two_decimals_when_result_has_more_precision', () => {
    // ARRANGE
    const a = 1;
    const b = 0.3333;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(0.67);
  });

  it('should_handle_negative_numbers_when_subtracting', () => {
    // ARRANGE
    const a = -1.25;
    const b = -2.5;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(1.25);
  });

  it('should_return_zero_when_arguments_are_equal', () => {
    // ARRANGE
    const a = 5;
    const b = 5;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_throw_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '1' as unknown as number;
    const b = 2;

    // ACT / ASSERT
    expect(() => add(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_when_second_argument_is_not_a_number', () => {
    // ARRANGE
    const a = 1;
    const b = null as unknown as number;

    // ACT / ASSERT
    expect(() => add(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });
});






describe('subtract', () => {
  it('should_return_division_result_when_given_valid_numbers', () => {
    // ARRANGE
    const a = 10;
    const b = 2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_return_negative_result_when_division_results_in_negative', () => {
    // ARRANGE
    const a = -9;
    const b = 3;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(-3);
  });

  it('should_return_infinity_when_dividing_by_zero', () => {
    // ARRANGE
    const a = 5;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(Infinity);
  });

  it('should_return_negative_infinity_when_dividing_negative_by_zero', () => {
    // ARRANGE
    const a = -5;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(-Infinity);
  });

  it('should_throw_error_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '10' as unknown as number;
    const b = 2;

    // ACT & ASSERT
    expect(() => subtract(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_error_when_second_argument_is_not_a_number', () => {
    // ARRANGE
    const a = 10;
    const b = '2' as unknown as number;

    // ACT & ASSERT
    expect(() => subtract(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });
});





describe('multiply', () => {
  it('should_divide_numbers_when_inputs_are_valid', () => {
    // ARRANGE
    const a = 10;
    const b = 2;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_return_infinity_when_dividing_by_zero', () => {
    // ARRANGE
    const a = 10;
    const b = 0;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(Infinity);
  });

  it('should_return_negative_value_when_dividing_negative_by_positive', () => {
    // ARRANGE
    const a = -9;
    const b = 3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(-3);
  });

  it('should_throw_error_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '10' as unknown as number;
    const b = 2;

    // ACT + ASSERT
    expect(() => multiply(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_error_when_second_argument_is_not_a_number', () => {
    // ARRANGE
    const a = 10;
    const b = undefined as unknown as number;

    // ACT + ASSERT
    expect(() => multiply(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });
});



