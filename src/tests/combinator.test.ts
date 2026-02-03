// 1. MOCKS (before ANY imports)
// (none required - src/combinator.ts has no imports)

// 2. IMPORTS
import { describe, it, expect } from 'vitest';
import { combine } from '../combinator';

// 4. TESTS
describe('combine', () => {
  it('should_add_two_positive_numbers_when_inputs_are_positive', () => {
    // ARRANGE
    const a = 2;
    const b = 3;

    // ACT
    const result = combine(a, b);

    // ASSERT
    expect(result).toBe(5);
  });

  it('should_add_negative_and_positive_numbers_when_inputs_have_mixed_signs', () => {
    // ARRANGE
    const a = -10;
    const b = 4;

    // ACT
    const result = combine(a, b);

    // ASSERT
    expect(result).toBe(-6);
  });

  it('should_add_two_negative_numbers_when_both_inputs_are_negative', () => {
    // ARRANGE
    const a = -7;
    const b = -8;

    // ACT
    const result = combine(a, b);

    // ASSERT
    expect(result).toBe(-15);
  });

  it('should_return_the_same_number_when_adding_zero', () => {
    // ARRANGE
    const a = 0;
    const b = 42;

    // ACT
    const result = combine(a, b);

    // ASSERT
    expect(result).toBe(42);
  });

  it('should_return_nan_when_any_input_is_nan', () => {
    // ARRANGE
    const a = Number.NaN;
    const b = 1;

    // ACT
    const result = combine(a, b);

    // ASSERT
    expect(result).toBeNaN();
  });

  it('should_handle_infinity_when_input_is_infinite', () => {
    // ARRANGE
    const a = Number.POSITIVE_INFINITY;
    const b = 100;

    // ACT
    const result = combine(a, b);

    // ASSERT
    expect(result).toBe(Number.POSITIVE_INFINITY);
  });
});
