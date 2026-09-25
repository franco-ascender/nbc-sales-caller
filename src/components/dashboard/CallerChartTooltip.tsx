"use client";
import {useEffect,useId,useRef,useState} from 'react';
import type {FocusEvent,KeyboardEvent,MouseEvent,PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import styles from './CallerChartTooltip.module.css';
interface Detail{label:string;value:string;note?:string}
export function useCallerChartTooltip(){
 const id=useId(),[tip,setTip]=useState<(Detail&{x:number;y:number})|null>(null),pinned=useRef(false),target=useRef<EventTarget|null>(null),detailRef=useRef<Detail|null>(null);
 function hide(){pinned.current=false;target.current=null;detailRef.current=null;setTip(null);}
 useEffect(()=>{const close=(event:Event)=>{if(event.type==='scroll'&&target.current===document.activeElement&&target.current instanceof Element&&detailRef.current){const box=target.current.getBoundingClientRect();setTip({...detailRef.current,x:Math.max(8,Math.min(innerWidth-228,box.left+box.width/2+14)),y:Math.max(8,Math.min(innerHeight-160,box.top+Math.min(box.height,40)+16))});return;}if(event.type==='pointerdown'&&target.current instanceof Element&&target.current.contains(event.target as Node))return;hide();};const key=(e:globalThis.KeyboardEvent)=>{if(e.key==='Escape')hide();};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};},[]);
 function show(detail:Detail,x:number,y:number,element?:EventTarget){target.current=element||null;detailRef.current=detail;setTip({...detail,x:Math.max(8,Math.min(innerWidth-228,x+14)),y:Math.max(8,Math.min(innerHeight-160,y+16))});}
 function focus(detail:Detail,event:FocusEvent<Element>|KeyboardEvent<Element>){const box=event.currentTarget.getBoundingClientRect();show(detail,box.left+box.width/2,box.top+Math.min(box.height,40),event.currentTarget);}
 const bind=(detail:Detail)=>({'aria-describedby':tip?id:undefined,tabIndex:0,onPointerMove:(e:PointerEvent<Element>)=>{if(e.pointerType!=='touch'){pinned.current=false;show(detail,e.clientX,e.clientY,e.currentTarget);}},onPointerLeave:()=>{if(!pinned.current)setTip(null);},onFocus:(e:FocusEvent<Element>)=>focus(detail,e),onBlur:hide,onClick:(e:MouseEvent<Element>)=>{pinned.current=true;const box=e.currentTarget.getBoundingClientRect();show(detail,e.clientX||box.left,e.clientY||box.top,e.currentTarget);}});
 return{bind,show,hide,focus,id,tip:tip?createPortal(<div id={id} role="tooltip" className={styles.tooltip} style={{left:tip.x,top:tip.y}}><span>{tip.label}</span><strong>{tip.value}</strong>{tip.note&&<small>{tip.note}</small>}</div>,document.body):null};
}
