import { loadEnvFile } from 'node:process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

// Explicit local administration only. Never sends email or prints credentials.
// Input JSON: [{ email, display_name, role }]. Output must remain private.
const [inputPath, outputPath, mode] = process.argv.slice(2);
if (!inputPath || !outputPath || !['--create-auth', '--apply-memberships'].includes(mode)) throw new Error('Usage: node scripts/deploy-member-provision.mjs PRIVATE_INPUT PRIVATE_OUTPUT --create-auth|--apply-memberships');
if (existsSync(outputPath)) throw new Error('Output already exists; preserve it and choose a new private output path.');
if ((statSync(inputPath).mode & 0o077) !== 0) throw new Error('Input permissions must be 0600.');
loadEnvFile('.env.local');
const rows = JSON.parse(readFileSync(inputPath, 'utf8'));
if (!Array.isArray(rows) || !rows.length || rows.length > 20 || rows.some(row => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || !['admin','coach','student'].includes(row.role) || typeof row.display_name !== 'string' || !row.display_name.trim() || row.display_name.length > 120)) throw new Error('Invalid provisioning input.');
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('Missing private configuration.');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
for (let page = 1; ; page++) {
  const result = await db.auth.admin.listUsers({ page, perPage: 100 });
  if (result.error) throw new Error('Cannot inspect existing accounts; no account was created.');
  users.push(...result.data.users); if (result.data.users.length < 100) break;
}
if (mode === '--apply-memberships') {
  const result = await db.from('nbc_members').select('id').limit(1);
  if (result.error) throw new Error('Membership migration is not available. Coordinate integration first.');
}
const output = [];
function checkpoint() { writeFileSync(outputPath, JSON.stringify({ at: new Date().toISOString(), mode, accounts: output }, null, 2) + '\n', { mode: 0o600 }); }
for (const row of rows) {
  const email = row.email.trim().toLowerCase(); let user = users.find(item => item.email?.toLowerCase() === email);
  let password; let created = false;
  if (!user && mode === '--create-auth') {
    password = randomBytes(24).toString('base64url');
    // Save the credential before the network mutation so an ambiguous response is recoverable.
    output.push({ email, requestedRole: row.role, initialPassword: password, state: 'creation_pending' }); checkpoint();
    const result = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: row.display_name } });
    if (result.error || !result.data.user) { output.at(-1).state = 'creation_failed_or_ambiguous'; checkpoint(); throw new Error('Account creation failed or was ambiguous; inspect the private checkpoint before retrying.'); }
    user = result.data.user; created = true; output.pop(); users.push(user);
  }
  if (!user) throw new Error('Account does not exist; create Auth first.');
  let membership = 'pending_migration_and_integration';
  if (mode === '--apply-memberships') {
    const existing = await db.from('nbc_members').select('id,role,status').eq('id', user.id).maybeSingle();
    if (existing.error) throw new Error('Cannot inspect membership.');
    if (existing.data && (existing.data.role !== row.role || existing.data.status !== 'active')) throw new Error('Existing role or status differs. Requires explicit review; not overwritten.');
    if (!existing.data) {
      const result = await db.from('nbc_members').insert({ id: user.id, display_name: row.display_name.trim(), role: row.role, status: 'active' });
      if (result.error) throw new Error('Membership creation failed. Auth account was preserved.');
    }
    membership = 'active';
  }
  output.push({ email, id: user.id, display_name: row.display_name, requestedRole: row.role, authCreated: created, ...(password ? { initialPassword: password } : {}), membership }); checkpoint();
}
console.log(JSON.stringify({ processed: output.length, authCreated: output.filter(row => row.authCreated).length, membershipsActivated: output.filter(row => row.membership === 'active').length, credentials: 'Private output only. No invitations sent.' }));
