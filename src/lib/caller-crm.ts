export const leadStages = ["new", "queued", "contacted", "qualified", "booked", "won", "lost", "do_not_call"] as const;
export type LeadStage = typeof leadStages[number];
export interface LeadInput { name: string; phone: string; email: string; company: string; source: string }
export interface CallerLead extends LeadInput { bucket_id?: string | null; do_not_call?: boolean; latest_activity_at?: string | null; latest_activity_preview?: string | null; is_demo?: boolean; id: string; stage: LeadStage; notes: string; created_at: string; updated_at: string }
export const stageLabel = (stage: LeadStage): string => ({ new: "New leads", queued: "Ready to call", contacted: "Contacted", qualified: "Qualified", booked: "Booked", won: "Won", lost: "Lost", do_not_call: "Do not call" })[stage];
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s().+-]/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new Error("Use a valid US phone number, including area code.");
  return `+1${national}`;
}
export function validateLead(value: unknown): LeadInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A lead must have a name and phone number.");
  const row = value as Record<string, unknown>;
  const field = (key: string, limit: number): string => {
    const text = row[key] ?? "";
    if (typeof text !== "string" || text.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error(`Check the ${key} field (${limit} characters maximum).`);
    return text.trim();
  };
  const name = field("name", 160), phone = normalizePhone(field("phone", 40)), email = field("email", 254);
  if (!name) throw new Error("Name is required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Check the email address.");
  return { name, phone, email, company: field("company", 160), source: field("source", 120) || "CSV import" };
}
export function parseLeadCsv(text: string): { leads: LeadInput[]; errors: { row: number; message: string }[]; duplicates: number } {
  if (new TextEncoder().encode(text).length > 512 * 1024) throw new Error("Choose a CSV smaller than 512 KB.");
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false, closed = false;
  const finishCell = (): void => { row.push(cell); cell = ""; closed = false; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) { if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += char; continue; }
    if (char === '"' && !cell && !closed) { quoted = true; continue; }
    if (char === ",") { finishCell(); continue; }
    if (char === "\n" || char === "\r") { if (char === "\r" && text[i + 1] === "\n") i++; finishCell(); if (row.some(value => value.trim())) rows.push(row); row = []; if (rows.length > 501) throw new Error("Import up to 500 leads at a time."); continue; }
    if (closed && char.trim()) throw new Error("The CSV has text after a closing quote.");
    if (char === '"') throw new Error("The CSV contains an unescaped quote.");
    cell += char;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  finishCell(); if (row.some(value => value.trim())) rows.push(row);
  if (rows.length > 501) throw new Error("Import up to 500 leads at a time.");
  const header = rows.shift()?.map(value => value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[ -]/g, "_"));
  if (!header || new Set(header).size !== header.length || !header.includes("phone") || !header.includes("name")) throw new Error("Use unique CSV columns: name, phone, email, company, source. Name and phone are required.");
  const leads: LeadInput[] = [], errors: { row: number; message: string }[] = [], seen = new Set<string>(); let duplicates = 0;
  rows.forEach((cells, index) => {
    try {
      if (cells.length !== header.length) throw new Error("Column count does not match the header.");
      const lead = validateLead(Object.fromEntries(header.map((key, i) => [key, cells[i]])));
      if (seen.has(lead.phone)) { duplicates++; return; } seen.add(lead.phone); leads.push(lead);
    } catch (error) { errors.push({ row: index + 2, message: error instanceof Error ? error.message : "Check this row." }); }
  });
  if (!rows.length) throw new Error("Add at least one lead below the header.");
  return { leads, errors, duplicates };
}
export function pipelineStats(leads: readonly CallerLead[]): { total: number; ready: number; qualified: number; booked: number; won: number; excluded: number } {
  return { total: leads.length, ready: leads.filter(lead => lead.stage === "new" || lead.stage === "queued").length, qualified: leads.filter(lead => lead.stage === "qualified").length, booked: leads.filter(lead => lead.stage === "booked").length, won: leads.filter(lead => lead.stage === "won").length, excluded: leads.filter(lead => lead.stage === "do_not_call").length };
}
