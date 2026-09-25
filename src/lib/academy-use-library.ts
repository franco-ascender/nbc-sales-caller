'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceAccess } from '@/components/workspace/WorkspaceAccess';
import { academyClient } from '../services/academy-client';
import type { AcademyPage } from './academy-storage-types';

export function useAcademyLibrary() {
  const access = useWorkspaceAccess();
  const token = access.user?.role === 'admin' ? access.token : '';
  const [page, setPage] = useState<AcademyPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => { generation.current++; setPage(null); setError(''); setBusy(false); return () => { generation.current++; }; }, [token]);
  const refresh = useCallback(async (offset = 0): Promise<void> => {
    if (!token) return;
    const attempt = ++generation.current; setBusy(true); setError('');
    try { const result = await academyClient.list(token, offset); if (attempt === generation.current) setPage(result); }
    catch (failure) { if (attempt === generation.current) setError(failure instanceof Error ? failure.message : 'Inventory list could not be loaded.'); }
    finally { if (attempt === generation.current) setBusy(false); }
  }, [token]);
  function logout(): void { generation.current++; setPage(null); setError(''); setBusy(false); }
  return { token, page, busy, error, refresh, logout };
}
