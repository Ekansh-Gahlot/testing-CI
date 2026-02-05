// 1. MOCKS (before ANY imports)
// (no module mocks required - add is a pure function with no dependencies)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { add, subtract, multiply } from '../math';

// 4. TESTS
// Updated to match new validation logic

describe('add', () => {
  it('should_add_two_integers_when_valid_numbers', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_round_to_two_decimals_when_result_has_more_than_two_decimals', () => {
    // ARRANGE
    const a = 0.1;
    const b = 0.2;

    // ACT
    const result = add(a, b);

    // ASSERT
    // 0.1 + 0.2 = 0.30000000000000004, which should be rounded to 0.3
    expect(result).toBe(0.3);
  });

  it('should_return_negative_sum_when_adding_negative_numbers', () => {
    // ARRANGE
    const a = -10;
    const b = -2.25;

    // ACT
    const result = add(a, b);

    // ASSERT
    expect(result).toBe(-12.25);
  });

  it('should_throw_error_when_first_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '1' as unknown as number;
    const b = 2;

    // ACT / ASSERT
    expect(() => add(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_error_when_second_argument_is_not_a_number', () => {
    // ARRANGE
    const a = 1;
    const b = undefined as unknown as number;

    // ACT / ASSERT
    expect(() => add(a, b)).toThrowError(new Error('Both arguments must be numbers'));
  });
});






describe('subtract', () => {
  it('should_divide_a_by_b_when_valid_numbers', () => {
    // ARRANGE
    const a = 10;
    const b = 2;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(5);
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

  it('should_return_negative_infinity_when_dividing_negative_by_zero', () => {
    // ARRANGE
    const a = -10;
    const b = 0;

    // ACT
    const result = subtract(a, b);

    // ASSERT
    expect(result).toBe(-Infinity);
  });

  it('should_throw_when_a_is_not_a_number', () => {
    // ARRANGE
    const a = '1' as unknown as number;
    const b = 2;

    // ACT
    const act = () => subtract(a, b);

    // ASSERT
    expect(act).toThrow(Error);
    expect(act).toThrow('Both ar guments must be numbers');
  });

  it('should_throw_when_b_is_not_a_number', () => {
    // ARRANGE
    const a = 1;
    const b = null as unknown as number;

    // ACT
    const act = () => subtract(a, b);

    // ASSERT
    expect(act).toThrow(Error);
    expect(act).toThrow('Both ar guments must be numbers');
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



