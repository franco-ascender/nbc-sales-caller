"use client";
import {useEffect,useRef,useState} from 'react';
import {salesRequest} from '@/lib/caller-request';
import {defaultView,validView} from '@/lib/caller-dashboard';
import type {SavedView,ViewConfig,ViewScope} from '@/lib/caller-dashboard';
export function useCallerView(token:string,demo:boolean,scope:ViewScope){
 const [view,setView]=useState<SavedView>({version:null,config:defaultView(scope)}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const live=useRef(true),epoch=useRef(0),context=useRef(''),lock=useRef(false),pending=useRef<{key:string;requestId:string}|null>(null);const key=token+demo+scope;context.current=key;
 useEffect(()=>{live.current=true;return()=>{live.current=false;epoch.current++;};},[]);
 async function refresh(){const turn=++epoch.current;const result=await salesRequest<SavedView>(token,`/api/caller/views/${scope}?demo=${demo}`);if(!validView(scope,result.config))throw new Error('Your saved layout could not load. Please retry.');if(live.current&&context.current===key&&turn===epoch.current){setView(result);setError('');setLoading(false);}return result;}
 useEffect(()=>{setView({version:null,config:defaultView(scope)});setLoading(true);setBusy(false);setError('');void refresh().catch(e=>{if(live.current&&context.current===key){setError(e.message);setLoading(false);}});return()=>{epoch.current++;};},[key]);
 async function save(config:ViewConfig){if(lock.current)throw new Error('Wait for the current layout to finish saving.');if(loading||context.current!==key)throw new Error('Reload your current layout first.');lock.current=true;setBusy(true);const turn=++epoch.current,payload={version:view.version,demo,config},signature=key+JSON.stringify(payload);if(pending.current?.key!==signature)pending.current={key:signature,requestId:crypto.randomUUID()};try{const result=await salesRequest<SavedView>(token,`/api/caller/views/${scope}`,'PUT',{...payload,requestId:pending.current.requestId});if(live.current&&context.current===key&&turn===epoch.current){setView(result);setError('');}return result;}finally{lock.current=false;if(live.current&&context.current===key)setBusy(false);}}
 return {view,loading,error,busy,save,refresh};
}
