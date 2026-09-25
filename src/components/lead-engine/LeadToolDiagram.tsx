'use client';
import { ArrowDown, GitBranch, Info } from 'lucide-react';
import type { ToolFlow, ToolNode } from '@/lib/lead-engine-tool-flow';
import styles from './LeadToolDiagram.module.css';

function Connector({label}:{label?:string}) {return <div className={styles.connector}>{label&&<span>{label}</span>}<ArrowDown aria-hidden="true" size={21}/></div>;}
function ToolCard({item}:{item:ToolNode}) {return <article className={styles.card} data-tone={item.tone} aria-label={item.title}>
  <div className={styles.tool}>{item.tool}</div><h5>{item.title}</h5>
  <dl><div><dt>IN</dt><dd>{item.input}</dd></div><div><dt>OUT</dt><dd>{item.output}</dd></div></dl>
  <details><summary>What happens here?</summary><p>{item.why}</p></details>
</article>;}
export function LeadToolDiagram({flow,title}:{flow:ToolFlow;title:string}) {return <section className={styles.diagram} aria-label={`${title} tool diagram`}>
  <header className={styles.header}><div><span>TOOLS & DATA FLOW</span><h4>What runs, and in what order</h4></div><GitBranch size={23}/></header>
  <p className={styles.caption}>Follow the arrows. Each box names the tool and the data it receives and returns. This is the code path, not a live run.</p>
  {flow.blocked&&<div className={styles.blocked}><Info size={17}/><span><strong>This state is blocked.</strong> The diagram explains the configured method; its steps cannot run until the quote blockers are resolved.</span></div>}
  {flow.sourceScope&&<p className={styles.scope}>{flow.sourceScope}</p>}
  <div className={styles.canvas}>
    {flow.start.map((item,index)=><div key={item.id} className={styles.stage}>{index>0&&<Connector/>}<ToolCard item={item}/></div>)}
    {flow.yes.length>0&&<><Connector/>
      <div className={styles.decision}><span className={styles.diamond} aria-hidden="true"/><strong>{flow.question}</strong></div>
      {flow.branchNote&&<p className={styles.branchNote}>{flow.branchNote}</p>}
      <div className={styles.fork} aria-hidden="true"/>
      <div className={styles.branches}>
        <div className={styles.branch} aria-label="Yes branch"><div className={styles.branchLabel}>YES · phone available <ArrowDown size={18}/></div>{flow.yes.map(item=><ToolCard key={item.id} item={item}/>)}</div>
        <div className={styles.branch} aria-label="No branch"><div className={styles.branchLabel} data-no>NO · phone missing <ArrowDown size={18}/></div>{flow.no.map(item=><ToolCard key={item.id} item={item}/>)}</div>
      </div>
      <div className={flow.noJoins?styles.merge:styles.continueOnly} aria-hidden="true"/>
      <Connector label={flow.noJoins?'Only a returned phone result continues':'Only the YES branch continues'}/>
      {flow.final.map((item,index)=><div key={item.id} className={styles.stage}>{index>0&&<Connector/>}<ToolCard item={item}/></div>)}
    </>}
    {flow.optional.map(item=><div key={item.id} className={styles.optional}><Connector label="IF the owner name is still missing"/><ToolCard item={item}/></div>)}
  </div>
  <footer className={styles.footer}><strong>Tools referenced by this route</strong><div>{flow.tools.map(tool=><span key={tool}>{tool}</span>)}</div><p>Telnyx is not part of the current runner. A tool shown here does not certify its account connection or a successful result.</p></footer>
</section>;}
