/**
 * Data generators for anonymization.
 * - Valid Israeli ID numbers (pass checksum validation)
 * - Israeli mobile phone numbers (05X-XXXXXXX pattern)
 * - Israeli landline numbers (0X-XXXXXXX pattern)
 * - Random address picker
 * - Fisher-Yates shuffle
 */

import { FAKE_ADDRESSES } from './config.js';

// Track generated IDs to avoid duplicates
const usedIds = new Set();

/**
 * Generate a valid Israeli ID number with correct check digit.
 * Uses alternating 1,2 multiplier algorithm.
 */
export function generateIsraeliId() {
  let id;
  do {
    const digits = [];
    for (let i = 0; i < 8; i++) {
      digits.push(Math.floor(Math.random() * 10));
    }

    let sum = 0;
    for (let i = 0; i < 8; i++) {
      let val = digits[i] * ((i % 2 === 0) ? 1 : 2);
      if (val > 9) val -= 9;
      sum += val;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    digits.push(checkDigit);
    id = digits.join('');
  } while (usedIds.has(id));

  usedIds.add(id);
  return id;
}

/**
 * Generate a random Israeli mobile phone number.
 * Pattern: 05X-XXXXXXX
 */
export function generateMobilePhone() {
  const prefix = Math.floor(Math.random() * 10);
  const number = Math.floor(Math.random() * 9000000) + 1000000;
  return `05${prefix}-${number}`;
}

/**
 * Generate a random Israeli landline phone number.
 * Pattern: 0X-XXXXXXX
 */
export function generateLandlinePhone() {
  const areaCodes = ['2', '3', '4', '8', '9'];
  const area = areaCodes[Math.floor(Math.random() * areaCodes.length)];
  const number = Math.floor(Math.random() * 9000000) + 1000000;
  return `0${area}-${number}`;
}

/**
 * Pick a random fake address.
 */
export function generateAddress() {
  return FAKE_ADDRESSES[Math.floor(Math.random() * FAKE_ADDRESSES.length)];
}

/**
 * Pick a random element from an array.
 */
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a random integer between min and max (inclusive).
 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fisher-Yates shuffle (in-place, returns same array).
 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
