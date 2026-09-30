'use client';
import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {useWorkspaceAccess} from '@/components/workspace/WorkspaceAccess';
import type {PilotView} from '@/lib/live-pilot';
import {LeadRunControls} from './LeadRunControls';
import {LeadRunResults} from './LeadRunResults';
import styles from './LeadListWorkspace.module.css';
export function LeadRunWorkspace(){const {token}=useWorkspaceAccess(),[pilot,setPilot]=useState<PilotView|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState('');
 async function load(){setError('');try{const r=await fetch('/api/lead-engine/runs',{headers:{Authorization:'Bearer '+token},cache:'no-store'}),b=await r.json();if(!r.ok)throw Error(b.error??'Your workspace could not be loaded.');setPilot(b.pilot);}catch(e){setError(e instanceof Error?e.message:'Unable to load.');}}
 useEffect(()=>{if(token)void load();},[token]);const chosen=pilot?.slots.find(s=>s.key===selected&&s.kind==='scrape');
 return <div className={styles.workspace}>{error&&<div role="alert" className={styles.card}>{error}<button onClick={()=>void load()}><RefreshCw size={15}/>Retry</button></div>}{pilot?<><LeadRunControls token={token} pilot={pilot} selectedKey={selected} onUpdate={(p,k)=>{setPilot(p);if(k)setSelected(k);}}/>{chosen&&(chosen.result.rows?.length??0)>0&&<LeadRunResults slot={chosen} token={token}/>}</>:!error&&<p role="status">Loading your search workspace…</p>}</div>;
}
