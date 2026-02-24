// 1. MOCKS (before ANY imports)
// (no module mocks required - add is a pure function with no dependencies)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { add, subtract, multiply } from '../math';

// 4. TESTS
// Updated to match new validation logic

describe('add', () => {
  it('should_add_two_positive_integers_when_given_valid_numbers', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_add_two_negative_numbers_when_given_valid_numbers', () => {
    // ARRANGE
    const a = -2;
    const b = -3;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(-5);
  });

  it('should_round_to_two_decimal_places_when_result_has_more_than_two_decimals', () => {
    // ARRANGE
    const a = 0.1;
    const b = 0.2;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(0.3);
  });

  it('should_round_half_up_to_two_decimal_places_when_third_decimal_is_five', () => {
    // ARRANGE
    const a = 1.005;
    const b = 0;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(1);
  });

  it('should_throw_error_when_a_is_not_a_number', () => {
    // ARRANGE
    const a = '1' as unknown as number;
    const b = 2;

    // ACT
    const act = () => add(a, b);

    // ASSERT
    expect(act).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_error_when_b_is_not_a_number', () => {
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
  it('should_return_division_result_when_given_two_numbers', () => {
    // ARRANGE
    const a = 10;
    const b = 2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_throw_error_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '10' as unknown as number;
    const b = 2;

    // ACT + ASSERT
    expect(() => subtract(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_error_when_second_argument_is_not_a_number', () => {
    // ARRANGE
    const a = 10;
    const b = null as unknown as number;

    // ACT + ASSERT
    expect(() => subtract(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_return_infinity_when_dividing_by_zero', () => {
    // ARRANGE
    const a = 10;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(Infinity);
  });

  it('should_return_negative_one_when_a_is_positive_and_b_is_negative', () => {
    // ARRANGE
    const a = 5;
    const b = -2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(-1);
  });
});





describe('multiply', () => {
  it('should_return_product_when_given_positive_numbers', () => {
    // ARRANGE
    const a = 3;
    const b = 4;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(12);
  });

  it('should_return_zero_when_first_argument_is_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 999;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(0);
  });

  it('should_return_positive_product_when_both_arguments_are_negative', () => {
    // ARRANGE
    const a = -3;
    const b = -4;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(12);
  });

  it('should_throw_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '3' as unknown as number;
    const b = 4;

    // ACT
    const act = () => multiply(a, b);

    // ASSERT
    expect(act).toThrow(Error);
    expect(act).toThrow('Both arguments must be numbers');
  });

  it('should_throw_when_a_is_positive_and_b_is_negative', () => {
    // ARRANGE
    const a = 2;
    const b = -3;

    // ACT
    const act = () => multiply(a, b);

    // ASSERT
    expect(act).toThrow(Error);
    expect(act).toThrow('Both arguments must be numbers');
  });
});





