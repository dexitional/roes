import { randomInt } from 'node:crypto'

// Unambiguous characters only (no 0/O, 1/I/L), easy to read out over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const code = (length: number) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

/** Order reference customers quote when paying by MoMo, e.g. RO-7KQ4M2. */
export const orderReference = () => `RO-${code(6)}`
export const paymentReference = () => `RP-${Date.now().toString(36).toUpperCase()}-${code(4)}`
