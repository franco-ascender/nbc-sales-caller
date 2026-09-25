import { unscoredLeadConfidence } from '@/lib/lead-engine-confidence';
import type { ConfidenceStatus } from '@/lib/lead-engine-confidence';
import type { LeadConfidenceProps } from './LeadConfidence.types';
import styles from './LeadConfidence.module.css';
const labels: Record<ConfidenceStatus, string> = { not_scored: 'Not checked', needs_review: 'More evidence needed', strong_evidence: 'Strong evidence', conflicting: 'Conflicting sources', wrong_contact: 'Contact mismatch', inactive: 'Phone inactive', not_mobile: 'Not a mobile number' };
export function LeadConfidence({ confidence, example = false }: LeadConfidenceProps) {
  const score = confidence ?? unscoredLeadConfidence();
  return <details className={styles.card}>
    <summary aria-label={`Lead confidence: ${score.value === null ? 'Not checked' : `${score.value} out of 100`}`}>
      <span><span className={styles.label}>{example ? 'Example confidence score' : 'Confidence score'}</span><strong>{score.value === null ? 'Not checked' : <>{score.value}<small>/100</small></>}</strong></span>
      {score.value !== null && <span className={styles.status} data-status={score.status}>{labels[score.status]}</span>}
    </summary>
    <div className={styles.detail}>
      <p>{score.value === null ? 'Owner and phone checks have not been completed. A business listing alone does not earn a confidence score.' : 'The score summarizes the evidence supporting this owner and phone match.'}</p>
      <dl>{score.checks.map(check => <div key={check.key}><dt>{check.label}</dt><dd>{check.state === 'passed' ? `${check.points}/${check.maximum}` : check.state === 'failed' ? 'Not matched' : 'Not checked'}</dd></div>)}</dl>
      {['conflicting', 'wrong_contact', 'inactive', 'not_mobile'].includes(score.status) && <p className={styles.warning}>{labels[score.status]}. The total is limited even if other checks passed.</p>}
      <p><strong>100 is the highest evidence score, not 100% certainty.</strong> It does not confirm permission to call.</p>
      {score.sourceUrls.length > 0 && <ul>{score.sourceUrls.map((url, index) => <li key={url}><a href={url} target="_blank" rel="noreferrer">Evidence source {index + 1}</a></li>)}</ul>}
    </div>
  </details>;
}
