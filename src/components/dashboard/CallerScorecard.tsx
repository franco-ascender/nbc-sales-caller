import type { ReactNode } from "react";
import { Gauge, Timer } from "lucide-react";
import type { TranscriptTurn } from "@/lib/caller-types";
import { scoreCallerConversation } from "@/lib/caller-scorecard";
import styles from "./CallerScorecard.module.css";

export function CallerScorecard({ transcript }: { transcript: readonly TranscriptTurn[] }): ReactNode {
  const scorecard = scoreCallerConversation(transcript);
  if (!transcript.length) return null;
  return <section className={styles.card} aria-label="Caller quality scorecard">
    <header><div><span>CONVERSATION SCORECARD</span><h3>Measured coaching signals</h3></div><div className={styles.score} data-band={scorecard.overall >= 80 ? "strong" : scorecard.overall >= 60 ? "developing" : "weak"}><Gauge size={18} /><strong>{scorecard.overall}</strong><small>/100</small></div></header>
    {!scorecard.completeEnough && <p className={styles.notice}>This conversation ended too early for a representative score. The mechanics below are still measured.</p>}
    <div className={styles.metrics}>{scorecard.metrics.map(metric => <article key={metric.id}><div><span>{metric.label}</span><strong>{metric.score}%</strong></div><div className={styles.track}><i style={{ width: `${metric.score}%` }} /></div><p>{metric.detail}</p></article>)}</div>
    <footer><span><Timer size={14} />Observed response gap: {scorecard.averageResponseSeconds === null ? "not enough turns" : `${scorecard.averageResponseSeconds}s average`}</span><span>{scorecard.agentTurns} agent turns · {scorecard.userTurns} prospect turns</span></footer>
    {scorecard.coaching.length > 0 && <div className={styles.coaching}><strong>Next coaching focus</strong>{scorecard.coaching.slice(0, 3).map(item => <p key={item}>{item}</p>)}</div>}
  </section>;
}
