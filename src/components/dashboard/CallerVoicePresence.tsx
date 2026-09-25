"use client";
import {useEffect,useState} from 'react';import type {RefObject,CSSProperties} from 'react';
import styles from './CallerVoicePresence.module.css';
interface Levels{getInputVolume():number;getOutputVolume():number}
export function CallerVoicePresence({client,active,speaking,muted,connecting}:{client:RefObject<Levels|null>;active:boolean;speaking:boolean;muted:boolean;connecting:boolean}){
 const [levels,setLevels]=useState({input:0,output:0});
 useEffect(()=>{if(!active){setLevels({input:0,output:0});return;}const timer=setInterval(()=>{try{setLevels({input:muted?0:Math.max(0,Math.min(1,client.current?.getInputVolume()||0)),output:Math.max(0,Math.min(1,client.current?.getOutputVolume()||0))});}catch{setLevels({input:0,output:0});}},80);return()=>clearInterval(timer);},[active,muted,client]);
 const amplitude=active?Math.max(levels.input,levels.output):0;
 return <div className={styles.presence} data-active={active} data-speaker={speaking?'agent':muted?'muted':'user'} style={{'--energy':amplitude} as CSSProperties} aria-label={connecting?'Connecting voice test':active?speaking?'Agent speaking':muted?'Microphone muted':'Listening to microphone':'Voice test ready. Microphone is off.'}><div className={styles.halo}/><div className={styles.core}><span>NBC<span>.</span></span></div><div className={styles.wave} aria-hidden="true">{Array.from({length:27},(_,i)=><i key={i} style={{transform:`scaleY(${.08+amplitude*(.4+.6*Math.sin((i+1)*1.9)**2)})`}}/>)}</div><span className={styles.state}><i/>{connecting?'Connecting':active?speaking?'Agent speaking':muted?'Mic muted':levels.input>.035?'Microphone active':'Listening':'Ready when you are'}</span></div>;
}
