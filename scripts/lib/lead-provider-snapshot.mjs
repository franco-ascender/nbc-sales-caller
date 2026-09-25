// Refresh only idle accounts. A provider balance cannot reconcile in-flight
// reservations or settle consumption; that requires the individual receipts.
export async function refreshProviderSnapshot(base, headers, snapshot, request = fetch) {
  const url = new URL('/rest/v1/lead_engine_provider_accounts', base);
  url.searchParams.set('provider', `eq.${snapshot.provider}`);
  url.searchParams.set('select', 'reserved_cents,consumed_cents,verified_at');
  const current = await request(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!current.ok) throw new Error('Provider account could not be read; snapshot unchanged.');
  const rows = await current.json();
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('Invalid provider account response.');
  const account = rows[0];
  if (account && (account.reserved_cents !== 0 || account.consumed_cents !== 0 || typeof account.verified_at !== 'string')) {
    throw new Error('Reconcile outstanding reservations and consumption before refreshing the balance.');
  }
  // Deliberately whitelist fields: callers cannot zero the ledger counters.
  const body = JSON.stringify({ provider: snapshot.provider, balance_cents: snapshot.balance_cents,
    verified_at: snapshot.verified_at, valid_until: snapshot.valid_until, evidence_ref: snapshot.evidence_ref });
  url.searchParams.delete('select');
  let method = 'PATCH', prefer = 'return=representation';
  if (account) {
    url.searchParams.set('reserved_cents', 'eq.0');
    url.searchParams.set('consumed_cents', 'eq.0');
    url.searchParams.set('verified_at', `eq.${account.verified_at}`);
  } else {
    method = 'POST';
    url.searchParams.delete('provider');
    url.searchParams.set('on_conflict', 'provider');
    prefer += ',resolution=ignore-duplicates';
  }
  const saved = await request(url, { method, headers: { ...headers, Prefer: prefer }, body,
    redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!saved.ok) throw new Error('Provider snapshot was not confirmed.');
  const result = await saved.json();
  if (!Array.isArray(result) || result.length !== 1) throw new Error('Provider account changed concurrently; inspect before retrying.');
}
