// Phase 4 task 5: the reviews and about-page owner name extractor, pure and dependency free. Review
// text (Google Maps reviews, signed owner replies) and website copy (home, /about, /team) name the
// owner in a small set of phrasings in English and Spanish. This module finds them deterministically;
// the small-model pass in lead-engine-reviews.service.ts runs only when nothing is found here, so the
// paid call is the exception. Names are first name plus an optional last name; staff titles, generic
// words and honorifics are rejected so "the owner was great" never yields "Great".

export type OwnerLanguage = 'en' | 'es';
export interface OwnerCandidate { first: string; last: string | null; evidence: string; language: OwnerLanguage; confidence: number; pattern: string }
export interface OwnerPick { first: string; last: string | null; votes: number; confidence: number; languages: Record<OwnerLanguage, number>; evidence: string[] }

// A name token: capitalised, letters (with accents), optional hyphen or apostrophe inside, 2 to 20 chars.
const NAME = "[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü]+(?:[-'][A-ZÁÉÍÓÚÑÜ]?[a-záéíóúñü]+)?";
const NAME1 = `(${NAME})`;
const NAME2 = `(${NAME})(?:\\s+(${NAME}))?`;
const NAME2_STRICT = `(${NAME})\\s+(${NAME})`;

// Words that look like names in a sentence start or after a comma and are not.
const REJECT = new Set([
  'the', 'this', 'that', 'our', 'his', 'her', 'their', 'he', 'she', 'they', 'it', 'a', 'an', 'and', 'but', 'so', 'very', 'super', 'really', 'great', 'good', 'nice', 'best', 'amazing', 'awesome',
  'friendly', 'kind', 'rude', 'new', 'old', 'also', 'even', 'was', 'is', 'were', 'came', 'himself', 'herself', 'who', 'which', 'when', 'where', 'here', 'there', 'thank', 'thanks',
  'owner', 'owners', 'manager', 'staff', 'team', 'guy', 'guys', 'lady', 'gentleman', 'man', 'woman', 'person', 'people', 'doctor', 'nurse', 'tech', 'front', 'desk', 'receptionist',
  'business', 'company', 'shop', 'store', 'salon', 'spa', 'clinic', 'office', 'family', 'operated', 'operator', 'llc', 'inc',
  'mr', 'mrs', 'ms', 'miss', 'dr', 'sir', 'madam', 'don', 'doña', 'señor', 'señora', 'sr', 'sra', 'srta',
  'el', 'la', 'los', 'las', 'un', 'una', 'muy', 'es', 'fue', 'era', 'con', 'por', 'para', 'que', 'quien', 'este', 'esta', 'ese', 'esa', 'su', 'sus', 'mi', 'gracias', 'excelente', 'buen', 'buena', 'bueno',
  'dueño', 'dueña', 'propietario', 'propietaria', 'gerente', 'personal', 'equipo', 'negocio', 'tienda', 'local', 'señorita', 'jefe', 'jefa', 'chico', 'chica', 'hombre', 'mujer',
  'founder', 'proprietor', 'ceo', 'president', 'director', 'principal', 'partner', 'co', 'meet', 'about', 'contact', 'hello', 'hi', 'welcome', 'since', 'located', 'call', 'text', 'visit',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
]);
const STAFF_TITLE = /\b(manager|receptionist|technician|tech|assistant|stylist|barber|injector|nurse|hygienist|front desk|gerente|recepcionista|asistente|estilista)\b/i;

interface Rule { name: string; language: OwnerLanguage; confidence: number; regex: RegExp; first: number; last: number | null }
const rule = (name: string, language: OwnerLanguage, confidence: number, source: string, first: number, last: number | null): Rule => ({ name, language, confidence, regex: new RegExp(source, 'giu'), first, last });

// Ordered from most to least explicit. Confidence is per hit; the vote in pickOwnerName adds them up.
const RULES: Rule[] = [
  // About page and team page copy: "Owner: Jane Smith", "Jane Smith, Owner", "Founder Jane Smith", "Jane Smith - Founder & CEO"
  rule('title_colon_name', 'en', 0.9, `\\b(?:owner|founder|co-?founder|proprietor|owner\\s*(?:and|&|/)\\s*operator|owner\\s*(?:and|&|/)\\s*founder)\\s*[:\\-–—]\\s*${NAME2}`, 1, 2),
  rule('name_comma_title', 'en', 0.9, `\\b${NAME2_STRICT}\\s*[,.\\-–—|(]\\s*(?:the\\s+)?(?:owner|founder|co-?founder|proprietor|owner\\s*(?:and|&|/)\\s*(?:operator|founder|lead\\s+\\w+))\\b`, 1, 2),
  rule('owned_by', 'en', 0.85, `\\b(?:owned|founded|established|started)\\s+(?:and\\s+operated\\s+)?by\\s+${NAME2}`, 1, 2),
  rule('name_is_owner', 'en', 0.8, `\\b${NAME2}\\s+(?:is|was)\\s+the\\s+(?:owner|proprietor|founder)\\b`, 1, 2),
  rule('name_owns', 'en', 0.75, `\\b${NAME2}\\s+(?:owns|runs)\\s+(?:the|this)\\b`, 1, 2),
  rule('name_paren_owner', 'en', 0.85, `\\b${NAME2}\\s*\\(\\s*(?:the\\s+)?(?:owner|proprietor|founder)\\s*\\)`, 1, 2),
  // Review language: "the owner, Mike, ...", "owner Mike came out", "Mike the owner"
  rule('the_owner_comma_name', 'en', 0.75, `\\bthe\\s+owner\\s*[,(]\\s*${NAME2}\\s*[,)]`, 1, 2),
  rule('owner_name', 'en', 0.7, `\\b(?:the\\s+)?owner\\s+${NAME2}\\s+(?:came|was|is|who|himself|herself|personally|took|called|helped|did|showed|even|and|greeted|answered|explained|made|went)\\b`, 1, 2),
  rule('name_the_owner', 'en', 0.75, `\\b${NAME2}\\s*,?\\s+the\\s+owner\\b`, 1, 2),
  rule('owner_is_name', 'en', 0.7, `\\bthe\\s+owner\\s+is\\s+${NAME2}\\b`, 1, 2),
  rule('thanks_owner', 'en', 0.55, `\\b(?:thank\\s+you|thanks|shout\\s*out)\\s+(?:to\\s+)?${NAME1}\\s*,?\\s*(?:the\\s+)?owner\\b`, 1, null),
  // Spanish: "el dueño, Miguel, ...", "dueño Miguel", "Miguel el dueño", "propietaria Ana"
  rule('es_dueno_comma_name', 'es', 0.75, `\\b(?:el|la)\\s+(?:dueñ[oa]|propietari[oa])\\s*[,(]\\s*${NAME2}\\s*[,)]`, 1, 2),
  rule('es_dueno_name', 'es', 0.7, `\\b(?:el|la)?\\s*(?:dueñ[oa]|propietari[oa])\\s+${NAME2}\\s+(?:me|nos|es|fue|vino|salió|salio|atendió|atendio|llamó|llamo|ayudó|ayudo|explicó|explico|siempre|muy|personalmente)\\b`, 1, 2),
  rule('es_name_el_dueno', 'es', 0.75, `\\b${NAME2}\\s*,?\\s+(?:el|la)\\s+(?:dueñ[oa]|propietari[oa])\\b`, 1, 2),
  rule('es_name_es_dueno', 'es', 0.8, `\\b${NAME2}\\s+es\\s+(?:el|la)\\s+(?:dueñ[oa]|propietari[oa])\\b`, 1, 2),
  rule('es_dueno_es_name', 'es', 0.7, `\\b(?:el|la)\\s+(?:dueñ[oa]|propietari[oa])\\s+es\\s+${NAME2}\\b`, 1, 2),
  rule('es_title_colon_name', 'es', 0.9, `\\b(?:dueñ[oa]|propietari[oa]|fundador[a]?)\\s*[:\\-–—]\\s*${NAME2}`, 1, 2),
  rule('es_name_comma_title', 'es', 0.9, `\\b${NAME2_STRICT}\\s*[,.\\-–—|(]\\s*(?:dueñ[oa]|propietari[oa]|fundador[a]?)\\b`, 1, 2),
];

const clean = (token: string | undefined): string | null => {
  if (!token) return null;
  const value = token.trim();
  if (value.length < 2 || value.length > 20) return null;
  // Rules match case-insensitively so "Owner" and "owner" both work; the name itself must be capitalised.
  if (!/^[A-ZÁÉÍÓÚÑÜ]/.test(value)) return null;
  if (REJECT.has(value.toLowerCase())) return null;
  return value;
};

export function extractOwnerFromText(text: string, options: { maxCandidates?: number } = {}): OwnerCandidate[] {
  const body = text.replace(/\s+/g, ' ').trim();
  if (!body) return [];
  const limit = options.maxCandidates ?? 20;
  const out: OwnerCandidate[] = [];
  // One mention, one candidate: a name span already claimed by an earlier (more explicit) rule is not
  // counted again by a later one, so "Founder: Carlos Ruiz. Proprietor: Anne" yields two people, not three.
  const claimed: Array<[number, number]> = [];
  for (const item of RULES) {
    item.regex.lastIndex = 0;
    for (const match of body.matchAll(item.regex)) {
      const nameText = match[item.first] ?? '';
      const nameStart = (match.index ?? 0) + match[0].indexOf(nameText), nameEnd = nameStart + nameText.length + (item.last !== null && match[item.last] ? match[item.last].length + 1 : 0);
      if (claimed.some(([start, end]) => nameStart < end && nameEnd > start)) continue;
      // Rules run case-insensitively, so a lowercase word before the name ("with Mike") can land in the
      // first slot; when that happens the capitalised second token is the first name.
      let first = clean(match[item.first]);
      let last = item.last === null ? null : clean(match[item.last]);
      if (!first && last) { first = last; last = null; }
      if (!first) continue;
      const start = Math.max(0, (match.index ?? 0) - 40), end = Math.min(body.length, (match.index ?? 0) + match[0].length + 40);
      const evidence = body.slice(start, end).trim();
      if (STAFF_TITLE.test(match[0]) && !/\b(owner|founder|proprietor|dueñ|propietari|fundador)/i.test(match[0])) continue;
      claimed.push([nameStart, nameEnd]);
      out.push({ first, last, evidence, language: item.language, confidence: last ? Math.min(0.95, item.confidence + 0.05) : item.confidence, pattern: item.name });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// Majority vote across reviews: candidates group on the first name (case and accent insensitive); a
// group's last name is the most frequent one seen. Confidence is the summed confidence capped at 1,
// so one strong about-page hit and three casual review mentions both clear the bar.
export function pickOwnerName(candidates: readonly OwnerCandidate[], minimumConfidence = 0.7): OwnerPick | null {
  if (candidates.length === 0) return null;
  const key = (value: string) => value.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  interface Group { first: string; lasts: Map<string, number>; votes: number; confidence: number; languages: Record<OwnerLanguage, number>; evidence: string[] }
  const groups = new Map<string, Group>();
  for (const item of candidates) {
    const k = key(item.first);
    const group: Group = groups.get(k) ?? { first: item.first, lasts: new Map<string, number>(), votes: 0, confidence: 0, languages: { en: 0, es: 0 }, evidence: [] };
    group.votes++; group.confidence += item.confidence; group.languages[item.language]++;
    if (group.evidence.length < 5) group.evidence.push(item.evidence);
    if (item.last) group.lasts.set(item.last, (group.lasts.get(item.last) ?? 0) + 1);
    groups.set(k, group);
  }
  const ranked = [...groups.values()].sort((a, b) => b.confidence - a.confidence || b.votes - a.votes);
  const best = ranked[0];
  const confidence = Math.min(1, best.confidence);
  // Two different first names with the same weight is a tie: nothing to deliver.
  if (ranked.length > 1 && ranked[1].confidence === best.confidence) return null;
  if (confidence < minimumConfidence) return null;
  const last = [...best.lasts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { first: best.first, last, votes: best.votes, confidence: Math.round(confidence * 100) / 100, languages: best.languages, evidence: best.evidence };
}

// Website copy arrives as HTML. Scripts, styles and tags go; block boundaries become sentence breaks so
// "Jane Smith</h3><p>Owner" reads as "Jane Smith. Owner" and the title rules can see it.
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|header|footer|br)\s*>|<br\s*\/?>/gi, ' . ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').replace(/(?:\s*\.\s*){2,}/g, ' . ').trim();
}

// The review text that goes to the model, bounded: 25 reviews, 600 characters each, owner replies kept
// because a signed reply ("- Mike, owner") is the best evidence of all.
export interface ReviewText { text: string | null; ownerReply: string | null; language: string | null }
export const MAX_REVIEWS_PER_LISTING = 25;
export function reviewCorpus(reviews: readonly ReviewText[]): string {
  return reviews.slice(0, MAX_REVIEWS_PER_LISTING).map((item, index) => {
    const parts = [item.text ? `Review ${index + 1}: ${item.text.slice(0, 600)}` : null, item.ownerReply ? `Owner reply ${index + 1}: ${item.ownerReply.slice(0, 400)}` : null];
    return parts.filter(Boolean).join('\n');
  }).filter(Boolean).join('\n');
}

export type ReviewBucket = 'owner_named' | 'owner_reply' | 'none';
// The score feature: the owner was named in a review, or only signs replies, or neither.
export function reviewBucketOf(candidates: readonly OwnerCandidate[], reviews: readonly ReviewText[]): ReviewBucket {
  if (candidates.length > 0) return 'owner_named';
  return reviews.some(item => item.ownerReply && /\b(owner|dueñ[oa]|propietari[oa])\b/i.test(item.ownerReply)) ? 'owner_reply' : 'none';
}
