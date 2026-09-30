// Published website contacts only. Syntax screening is not mailbox verification.
export function publishedBusinessEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const found = new Set<string>();
  for (const candidate of value.slice(0, 100)) {
    if (typeof candidate !== 'string') continue;
    const email = candidate.trim().toLowerCase();
    if (email.length > 254 || /[\s\x00-\x1f\x7f]/.test(email)) continue;
    const parts = email.split('@');
    if (parts.length !== 2) continue;
    const [local, domain] = parts;
    if (!local || local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
      || local.startsWith('.') || local.endsWith('.') || local.includes('..')) continue;
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
      || /\.(?:png|jpg|jpeg|gif|svg|webp)$/i.test(domain)) continue;
    found.add(email);
    if (found.size === 20) break;
  }
  return [...found];
}
