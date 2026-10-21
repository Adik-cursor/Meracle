const ONES = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
]
const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
]
const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
]
const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
]

function triad(value: number, female: boolean): string {
  const hundred = Math.floor(value / 100)
  const rest = value % 100
  const parts: string[] = []
  if (HUNDREDS[hundred]) {
    parts.push(HUNDREDS[hundred])
  }
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10])
  } else {
    const ten = Math.floor(rest / 10)
    const one = rest % 10
    if (TENS[ten]) {
      parts.push(TENS[ten])
    }
    if (one) {
      if (female && one === 1) {
        parts.push('одна')
      } else if (female && one === 2) {
        parts.push('две')
      } else {
        parts.push(ONES[one])
      }
    }
  }
  return parts.join(' ')
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) {
    return forms[0]
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return forms[1]
  }
  return forms[2]
}

export function amountInWordsRu(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0
  if (safe === 0) {
    return currency === 'KZT' ? 'Ноль тенге' : `Ноль ${currency}`
  }
  const millions = Math.floor(safe / 1_000_000)
  const thousands = Math.floor((safe % 1_000_000) / 1000)
  const rest = safe % 1000
  const parts: string[] = []
  if (millions) {
    parts.push(triad(millions, false), plural(millions, ['миллион', 'миллиона', 'миллионов']))
  }
  if (thousands) {
    parts.push(triad(thousands, true), plural(thousands, ['тысяча', 'тысячи', 'тысяч']))
  }
  if (rest) {
    parts.push(triad(rest, false))
  }
  const unit =
    currency === 'KZT'
      ? plural(safe, ['тенге', 'тенге', 'тенге'])
      : currency
  const text = `${parts.join(' ')} ${unit}`.replace(/\s+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function amountInWordsInvoiceRu(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
  const major = Math.trunc(safe)
  const minor = Math.round(Math.abs(safe - major) * 100)
  const words = amountInWordsRu(major, currency)
  if (currency !== 'KZT') {
    return words
  }
  return `${words} ${String(minor).padStart(2, '0')} тиын`
}
