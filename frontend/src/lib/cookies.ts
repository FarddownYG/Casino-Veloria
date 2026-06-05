export function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const AGE_COOKIE = 'veloria_age_ok';

export function hasAgeConsent(): boolean {
  return getCookie(AGE_COOKIE) === '1';
}

export function setAgeConsent() {
  setCookie(AGE_COOKIE, '1', 30);
}
