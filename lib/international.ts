export type Market = { country: string; locales: string[]; currency: string; currencyDigits: number; timeZone: string };
export const initialMarkets: Market[] = [{country:'BG',locales:['bg-BG','en-GB'],currency:'EUR',currencyDigits:2,timeZone:'Europe/Sofia'}];
export function formatMoney(amountMinor: number, market: Market, locale: string) {
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Amount must be a safe integer in minor units');
  if (!Number.isInteger(market.currencyDigits) || market.currencyDigits<0 || market.currencyDigits>4) throw new Error('Invalid currency precision');
  return new Intl.NumberFormat(locale,{style:'currency',currency:market.currency,minimumFractionDigits:market.currencyDigits,maximumFractionDigits:market.currencyDigits}).format(amountMinor/10**market.currencyDigits);
}
export function formatTime(iso: string, market: Market, locale: string) {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(iso) || !Number.isFinite(Date.parse(iso))) throw new Error('Timestamp must have an explicit timezone');
  return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:market.timeZone}).format(new Date(iso));
}
