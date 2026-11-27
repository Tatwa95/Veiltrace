import { describe, expect, it } from 'vitest';
import { passesLuhnCheck } from './luhn';

describe('passesLuhnCheck', () => {
  it.each([
    ['4111111111111111', true],
    ['79927398713', false], // Valid checksum, but too short for the app's 13–19 digit card range.
    ['4111111111111112', false],
    ['1234567890123456', false],
    ['0000000000000000', false],
    ['123456789012', false],
  ])('returns %s → %s', (candidate, expected) => {
    expect(passesLuhnCheck(candidate)).toBe(expected);
  });
});
