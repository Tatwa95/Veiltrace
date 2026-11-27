/**
 * Validates a digit-only numeric string using the Luhn (mod 10) checksum.
 * Note: Luhn only verifies checksum structure; it does not prove a card is active or real.
 */
export function passesLuhnCheck(digitsOnly: string): boolean {
  if (!/^\d{13,19}$/.test(digitsOnly)) {
    return false;
  }

  // Reject trivial all-identical sequences such as 0000000000000000
  if (/^(\d)\1+$/.test(digitsOnly)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digitsOnly.length - 1; i >= 0; i -= 1) {
    let digit = digitsOnly.charCodeAt(i) - 48;
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}
