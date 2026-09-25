"use client";
import { useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Compass, Flag, MessageCircle, Target } from 'lucide-react';
import styles from './MemberRoadmapPreview.module.css';
const phases = [
  { title: 'Build your foundation', weeks: 'Week 01', description: 'Get clear on who you help, what you offer, and the kind of salesperson you want to become.', tasks: ['Define your ideal client and offer', 'Set your 90-day learning goals', 'Record your first practice conversation'], coaching: 'Turn your goals into a focused practice plan.' },
  { title: 'Master the conversation', weeks: 'Week 02', description: 'Lead a discovery conversation with curiosity, structure, and a clear understanding of what your prospect needs.', tasks: ['Build your discovery question bank', 'Practice active listening and follow-ups', 'Review a discovery roleplay with your coach'], coaching: 'Ask better questions before presenting a solution.' },
  { title: 'Handle objections', weeks: 'Weeks 03–04', description: 'Build the confidence to explore objections, understand the real concern, and keep the conversation moving.', tasks: ['Map your five most common objections', 'Practice price and timing scenarios', 'Review one roleplay with your coach'], coaching: 'Slow down, acknowledge the concern, and ask one useful follow-up question.' },
  { title: 'Close with confidence', weeks: 'Weeks 05–06', description: 'Connect the prospect’s priorities to a clear recommendation and agree on the right next step.', tasks: ['Practice a clear offer presentation', 'Run three closing roleplays', 'Refine your follow-up approach'], coaching: 'Make the next step feel clear, specific, and natural.' },
  { title: 'Build your sales system', weeks: 'Weeks 07–12', description: 'Turn good conversations into a repeatable process you can review, improve, and sustain.', tasks: ['Organize your pipeline stages', 'Build your weekly practice routine', 'Review your progress and set your next goals'], coaching: 'Create a routine you can keep, then improve it each week.' },
] as const;
export function MemberRoadmapPreview() {
  const [selected, setSelected] = useState(2);
  const phase = phases[selected], complete = selected < 2;
  return <div className={styles.roadmap}>
    <header className={styles.hero}>
      <div><span className={styles.demo}>DEMO ROADMAP</span><h2>Your path to confident selling.</h2><p>A sample 90-day journey through the NBC Sales experience.</p></div>
      <div className={styles.progressCard}><div><span>Example progress</span><strong>40<span>%</span></strong></div><div className={styles.track} role="progressbar" aria-label="Sample roadmap progress" aria-valuenow={40} aria-valuemin={0} aria-valuemax={100}><span/></div><small>2 of 5 phases complete</small></div>
    </header>
    <p className={styles.notice}>Preview only · These milestones, timelines, and progress are sample content. Your personalized roadmap has not been assigned yet.</p>
    <div className={styles.layout}>
      <nav className={styles.phases} aria-label="Sample roadmap phases">{phases.map((item,index)=><button key={item.title} type="button" aria-pressed={selected===index} onClick={()=>setSelected(index)} data-state={index<2?'complete':index===2?'current':'upcoming'}>
        <span className={styles.marker}>{index<2?<Check size={17}/>:index===4?<Flag size={16}/>:String(index+1).padStart(2,'0')}</span>
        <span className={styles.phaseText}><small>{item.weeks} · {index<2?'Complete':index===2?'In progress':'Upcoming'}</small><strong>{item.title}</strong></span><ArrowRight size={16}/>
      </button>)}</nav>
      <section className={styles.detail} aria-labelledby="sample-phase-title">
        <div className={styles.detailTop}><span className={styles.kicker}>PHASE {String(selected+1).padStart(2,'0')} · {phase.weeks.toUpperCase()}</span><span className={styles.status}>{complete?'Completed':selected===2?'Your next chapter':'Coming up'}</span></div>
        <span className={styles.detailIcon}>{complete?<CheckCircle2 size={27}/>:selected===4?<Flag size={27}/>:<Compass size={27}/>}</span>
        <h3 id="sample-phase-title">{phase.title}</h3><p className={styles.description}>{phase.description}</p>
        <div className={styles.objectiveHeading}><Target size={16}/><h4>Your milestones</h4><span>{complete?'3 / 3':'0 / 3'}</span></div>
        <ul className={styles.tasks}>{phase.tasks.map((task,index)=><li key={task}><span className={complete?styles.taskDone:styles.taskNumber}>{complete?<Check size={13}/>:index+1}</span><span>{task}</span></li>)}</ul>
        <aside className={styles.coaching}><MessageCircle size={19}/><div><strong>Coaching focus</strong><p>{phase.coaching}</p></div></aside>
      </section>
    </div>
  </div>;
}
