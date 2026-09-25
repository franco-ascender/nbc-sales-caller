"use client";
import { ArrowUpRight, Check, Flag } from 'lucide-react';
import styles from './RoadmapPreview.module.css';
const steps = [
  { title: 'Build your foundation', detail: 'Mindset · goals · your offer', status: 'done' },
  { title: 'Master the conversation', detail: 'Discovery · active listening', status: 'done' },
  { title: 'Handle objections', detail: 'Roleplay with your coach', status: 'current' },
  { title: 'Close with confidence', detail: 'Practice · feedback · refine', status: 'next' },
  { title: 'Build your sales system', detail: 'Pipeline · consistency · scale', status: 'next' },
] as const;
export function RoadmapPreview({ onClose }: { onClose(): void }) {
  return <section className={styles.preview} aria-label="Example roadmap">
    <div className={styles.intro}><span className={styles.badge}>DEMO ROADMAP</span><span>2 of 5 milestones</span></div>
    <div className={styles.progress} role="progressbar" aria-label="Example roadmap progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={40}><span /></div>
    <ol className={styles.steps}>{steps.map((step,index)=><li key={step.title} data-state={step.status} aria-current={step.status==='current'?'step':undefined}>
      <span className={styles.marker} aria-label={step.status==='done'?'Complete':step.status==='current'?'In progress':'Upcoming'}>{step.status==='done'?<Check size={13}/>:index===4?<Flag size={12}/>:index+1}</span>
      <div><strong>{step.title}</strong><small>{step.detail}</small></div>
      {step.status==='current'&&<span className={styles.now}>NEXT UP</span>}
    </li>)}</ol>
    <footer><span>Sample journey · for preview</span><button onClick={onClose}>View my roadmap<ArrowUpRight size={14}/></button></footer>
  </section>;
}
