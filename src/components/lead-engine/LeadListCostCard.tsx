import type {LeadListCosts} from '@/lib/lead-list-costs';
import {listCostMoney} from '@/lib/lead-list-costs';
import styles from './LeadListCostCard.module.css';
export function LeadListCostCard({costs:c}:{costs?:LeadListCosts}){
 if(!c)return <p className={styles.pending}>List cost is pending. Missing receipts are not a zero cost.</p>;
 return <section className={styles.card} aria-label="List cost summary">
  <div className={styles.totals}><div><span>Total list cost</span><strong>{listCostMoney(c.totalMicrousd)}</strong><small>{c.status==='partial'?'Partial total · some costs pending':'Estimated total · receipt + saved check rates + data allowance'}</small></div><div><span>Cost / verified mobile</span><strong>{c.verifiedMobiles?listCostMoney(c.perMobileMicrousd):'—'}</strong><small>{c.verifiedMobiles?`${c.verifiedMobiles} unique verified mobiles · same ${c.status==='partial'?'partial':'estimated'} cost basis`:'No verified mobiles yet'}</small></div></div>
  <details><summary>Cost breakdown</summary><dl><div><dt>Discovery & website emails</dt><dd>{listCostMoney(c.discoveryMicrousd)} <small>provider receipt</small></dd></div><div><dt>Phone verification · {c.newChecks} new checks</dt><dd>{listCostMoney(c.verificationMicrousd)} <small>saved account rates</small></dd></div><div><dt>Data delivery & storage</dt><dd>{listCostMoney(c.dataAllowanceMicrousd)} <small>estimated allowance</small></dd></div></dl><p>{c.reusedChecks} previous checks reused without adding their cost again. {c.pendingChecks>0?`${c.pendingChecks} phone checks have not run yet. `:''}{c.missingCharges>0?`${c.missingCharges} charges still need a result or saved price. `:''}Cost per mobile = this list’s total ÷ unique verified mobiles, across the entire list. Reservations are not charges. Shared subscriptions, taxes and infrastructure are not allocated here; final billing may differ.</p></details>
 </section>;
}
