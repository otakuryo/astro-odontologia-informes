import { SITE_NAME } from './site';

export { SITE_NAME };

export const SITE_AUTHOR = 'Agustin';
export const SITE_CONTACT_EMAIL = 'de.agustin.rio@gmail.com';
export const SITE_LICENSE = 'Apache-2.0';
export const SITE_LEGAL_UPDATED_AT = '2026-08-29';

/**
 * Acepta solo HTTPS en el host exacto `github.com`.
 * Rechaza http, otros hosts, javascript:, data:, rutas relativas y trampas de host.
 */
export function normalizeGitHubUrl(raw: string | undefined | null): string | null {
  if (raw == null) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  if (trimmed.startsWith('//') || trimmed.startsWith('\\')) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') {
    return null;
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return null;
  }

  if (parsed.port !== '') {
    return null;
  }

  if (parsed.hostname !== 'github.com') {
    return null;
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  return path === '' || path === '/' ? 'https://github.com' : `https://github.com${path}`;
}

export const SITE_GITHUB_URL = normalizeGitHubUrl(import.meta.env?.PUBLIC_GITHUB_URL);
