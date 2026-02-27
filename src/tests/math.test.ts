// 1. MOCKS (before ANY imports)
// (no module mocks required - add is a pure function with no dependencies)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, nestedFunction } from '../math';
import { isEven } from '../math';
import { isOdd } from '../math';



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
  // This function: validates numeric inputs (and a specific sign combination) then returns the product.
  // It calls: no dependencies (pure function).
  // I will only mock: nothing (no external effects).
  // Edge cases to cover: non-number args, a>0 with b<0 branch, zero, negative*negative, decimal multiplication.

  it('should_return_product_when_inputs_are_positive_integers', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(6);
  });

  it('should_return_zero_when_one_argument_is_zero', () => {
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
    const a = -4;
    const b = -5;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(20);
  });

  it('should_return_product_when_argument_is_decimal', () => {
    // ARRANGE
    const a = 2.5;
    const b = 2;

    // ACT
    const result = multiply(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_throw_error_when_any_argument_is_not_a_number', () => {
    // ARRANGE
    const a = '2' as unknown as number;
    const b = 3;

    // ACT
    const act = () => multiply(a, b);

    // ASSERT
    expect(act).toThrowError(new Error('Both arguments must be numbers'));
  });

  it('should_throw_error_when_a_is_positive_and_b_is_negative', () => {
    // ARRANGE
    const a = 1;
    const b = -1;

    // ACT
    const act = () => multiply(a, b);

    // ASSERT
    expect(act).toThrowError(new Error('Both arguments must be numbers'));
  });
});


describe('nestedFunction', () => {
  it('should_return_negativeOne_when_aPositiveAndbNegative', () => {
    // ARRANGE
    const a = 2;
    const b = -3;

    // ACT
    const result = nestedFunction(a, b);

    // ASSERT
    expect(result).toBe(-1);
  });

  it('should_return_sum_when_aNegativeAndbPositive', () => {
    // ARRANGE
    const a = -2;
    const b = 3;

    // ACT
    const result = nestedFunction(a, b);

    // ASSERT
    expect(result).toBe(1);
  });

  it('should_return_sum_when_bothPositive', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = nestedFunction(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_return_sum_when_bothNegative', () => {
    // ARRANGE
    const a = -2;
    const b = -3;

    // ACT
    const result = nestedFunction(a, b);

    // ASSERT
    expect(result).toBe(-5);
  });

  it('should_return_sum_when_aZeroAndbPositive', () => {
    // ARRANGE
    const a = 0;
    const b = 7;

    // ACT
    const result = nestedFunction(a, b);

    // ASSERT
    expect(result).toBe(7);
  });
});

describe('isEven', () => {
  // This function: returns true when the provided number is even (divisible by 2), otherwise false.
  // It calls: no dependencies (pure arithmetic).
  // I will only mock: nothing (pure function).
  // Edge cases to cover: 0, negative numbers, non-integers, large numbers.

  it('should_return_true_when_number_is_even', () => {
    // ARRANGE
    const input = 4;

    // ACT
    const result = isEven(input);

    // ASSERT
    expect(result).toBe(true);
  });

  it('should_return_false_when_number_is_odd', () => {
    // ARRANGE
    const input = 5;

    // ACT
    const result = isEven(input);

    // ASSERT
    expect(result).toBe(false);
  });

  it('should_return_true_when_number_is_zero', () => {
    // ARRANGE
    const input = 0;

    // ACT
    const result = isEven(input);

    // ASSERT
    expect(result).toBe(true);
  });

  it('should_return_true_when_number_is_negative_even', () => {
    // ARRANGE
    const input = -12;

    // ACT
    const result = isEven(input);

    // ASSERT
    expect(result).toBe(true);
  });

  it('should_return_false_when_number_is_negative_odd', () => {
    // ARRANGE
    const input = -7;

    // ACT
    const result = isEven(input);

    // ASSERT
    expect(result).toBe(false);
  });

  it('should_return_false_when_number_is_non_integer_and_not_divisible_by_two', () => {
    // ARRANGE
    const input = 2.5;

    // ACT
    const result = isEven(input);

    // ASSERT
    expect(result).toBe(false);
  });
});

describe('isOdd', () => {
  // This function: returns true when a number is odd (a % 2 !== 0).
  // It calls: no dependencies (pure arithmetic).
  // I will only mock: nothing (pure function).
  // Edge cases to cover: 0, negative numbers, fractional numbers, NaN/Infinity.

  it('should_return_true_when_input_is_odd_positive_integer', () => {
    // ARRANGE
    const a = 3;

    // ACT
    const result = isOdd(a);

    // ASSERT
    expect(result).toBe(true);
  });

  it('should_return_false_when_input_is_even_positive_integer', () => {
    // ARRANGE
    const a = 4;

    // ACT
    const result = isOdd(a);

    // ASSERT
    expect(result).toBe(false);
  });

  it('should_return_false_when_input_is_zero', () => {
    // ARRANGE
    const a = 0;

    // ACT
    const result = isOdd(a);

    // ASSERT
    expect(result).toBe(false);
  });

  it('should_return_true_when_input_is_odd_negative_integer', () => {
    // ARRANGE
    const a = -5;

    // ACT
    const result = isOdd(a);

    // ASSERT
    expect(result).toBe(true);
  });

  it('should_return_true_when_input_is_fractional_with_odd_remainder', () => {
    // ARRANGE
    const a = 3.5;

    // ACT
    const result = isOdd(a);

    // ASSERT
    expect(result).toBe(true);
  });

  it('should_return_true_when_input_is_NaN', () => {
    // ARRANGE
    const a = Number.NaN;

    // ACT
    const result = isOdd(a);

    // ASSERT
    expect(result).toBe(true);
  });
});

