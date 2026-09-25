"use client";
import {useEffect,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,RefObject} from 'react';
import {edgeAt,edgeVelocity} from '@/lib/caller-drag';import type {DropEdge} from '@/lib/caller-drag';
export interface DragState{source:string;target:string|null;edge:DropEdge;x:number;y:number;width:number;height:number}
export function useCallerDrag(root:RefObject<HTMLElement|null>,drop:(source:string,target:string,edge:DropEdge)=>void,freezeTargets=false){
 const [drag,setDrag]=useState<DragState|null>(null),cleanup=useRef<()=>void>(()=>{}),callback=useRef(drop);callback.current=drop;
 useEffect(()=>()=>cleanup.current(),[]);
 function start(event:ReactPointerEvent<HTMLElement>,source:string){if(event.button!==0)return;event.preventDefault();cleanup.current();const sx=event.clientX,sy=event.clientY,pointer=event.pointerId,handle=event.currentTarget,container=root.current,card=handle.closest<HTMLElement>('[data-drag-card]')||handle,rect=card.getBoundingClientRect();let active=false,target:string|null=null,edge:DropEdge='before',x=sx,y=sy,frame=0,last=performance.now();
  window.scrollTo({top:scrollY,left:scrollX,behavior:'instant'});container?.querySelectorAll<HTMLElement>('[data-drop-id]').forEach(el=>el.getAnimations().forEach(a=>a.cancel()));
  const targets=freezeTargets?Array.from(container?.querySelectorAll<HTMLElement>('[data-drop-id]')||[]).map(el=>{const r=el.getBoundingClientRect();return{id:el.dataset.dropId!,left:r.left+scrollX,top:r.top+scrollY,width:r.width,height:r.height};}):[];
  try{handle.setPointerCapture(pointer);}catch{/* Synthetic test events do not own a browser pointer. */}
  const locate=()=>{if(freezeTargets){const hit=targets.find(r=>x+scrollX>=r.left-8&&x+scrollX<=r.left+r.width+8&&y+scrollY>=r.top-8&&y+scrollY<=r.top+r.height+8);target=hit?.id||null;edge=hit?edgeAt(y+scrollY,hit.top,hit.height):'after';}else{const hit=document.elementFromPoint(x,y)?.closest<HTMLElement>(source.startsWith('stage:')?'[data-drop-id^="stage:"]':'[data-drop-id]');target=hit&&container?.contains(hit)?hit.dataset.dropId||null:null;const r=hit?.getBoundingClientRect();edge=r?(source.startsWith('stage:')?edgeAt(x,r.left,r.width):edgeAt(y,r.top,r.height)):'after';}setDrag({source,target,edge,x,y,width:rect.width,height:rect.height});};
  const tick=(time:number)=>{if(!active)return;const dt=Math.min(32,time-last)/1000;last=time;let scrolled=false;const el=document.elementFromPoint(x,y);let parent=el as HTMLElement|null;
   while(parent&&container?.contains(parent)){const r=parent.getBoundingClientRect();if(parent.scrollWidth>parent.clientWidth+5&&/(auto|scroll)/.test(getComputedStyle(parent).overflowX)){const delta=edgeVelocity(x,r.left,r.right)*650*dt;if(delta){parent.scrollLeft+=delta;scrolled=true;break;}}parent=parent.parentElement;}
   const dy=edgeVelocity(y,70,innerHeight,85)*750*dt;if(dy){window.scrollBy(0,dy);scrolled=true;}if(scrolled)locate();frame=requestAnimationFrame(tick);};
  const stop=()=>{cancelAnimationFrame(frame);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',end);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key);window.removeEventListener('blur',cancel);try{if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer);}catch{}setDrag(null);};
  const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;x=e.clientX;y=e.clientY;if(Math.hypot(x-sx,y-sy)<5&&!active)return;if(!active){active=true;last=performance.now();frame=requestAnimationFrame(tick);}locate();};
  const end=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;const destination=target,placement=edge;stop();if(active&&destination&&destination!==source)callback.current(source,destination,placement);};const cancel=()=>stop();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();stop();}};
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',end);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key);window.addEventListener('blur',cancel);cleanup.current=stop;
 }
 return {drag,start,cancel:()=>cleanup.current()};
}
