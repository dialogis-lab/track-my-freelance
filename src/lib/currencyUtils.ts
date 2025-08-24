export type Currency = 'USD' | 'CHF' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
export const CURRENCIES: Currency[] = ['USD', 'CHF', 'EUR', 'GBP', 'CAD', 'AUD'];

export function toMinor(value: number, currency: Currency) {
  const factor = 100; // all these currencies have 2 decimal places
  return Math.round(value * factor);
}

export function fromMinor(minor: number, currency: Currency) {
  const factor = 100;
  return minor / factor;
}

export function formatMoney(minor: number, currency: Currency, locale?: string) {
  const major = fromMinor(minor, currency);
  return new Intl.NumberFormat(locale ?? undefined, { 
    style: 'currency', 
    currency 
  }).format(major);
}