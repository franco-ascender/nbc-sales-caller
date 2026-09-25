import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brain } from '../src/lib/lead-engine-brain.ts';
import { WORKFLOW_NICHES, CROSS_NICHE_REVIEWS, nicheReview, nicheReviewIds, routeSteps, stateName, STATE_CODES } from '../src/lib/lead-engine-niches.ts';
import { inspectWorkflowRoutes } from '../src/lib/lead-engine-workflow-routing.ts';
const get=(id:string)=>{const found=WORKFLOW_NICHES.find(n=>n.id===id);assert.ok(found);return found;};
test('niche catalog retains all 44 old reviews once without presenting state sources as industries',()=>{
  const ids=[...WORKFLOW_NICHES.flatMap(nicheReviewIds),...CROSS_NICHE_REVIEWS];
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(ids.sort(),brain().industries.map(i=>i.key).sort());
  assert.equal(WORKFLOW_NICHES.length,35);
  assert.ok(WORKFLOW_NICHES.every(n=>! /Minnesota|Florida|Pennsylvania|New York|Texas|contrast|registry/i.test(n.title)));
});
test('contractor state selection resolves the correct existing review without rewriting runtime routes',()=>{
  const n=get('contractors');
  for(const [state,key,recipe]of [['FL','contractor_fl','D'],['MN','contractor_mn','D'],['WA','contractor_registry','C']] as const){
    assert.equal(nicheReview(n,state),key); const r=inspectWorkflowRoutes(key)[state];assert.equal(r.recipe,recipe);assert.equal(r.reason,'register_configured');assert.ok(r.explanation.length>30);
  }
  assert.equal(nicheReview(n,'TX'),'contractor_permits');assert.match(n.scope!.TX,/Austin.*not statewide/);
  assert.equal(inspectWorkflowRoutes(nicheReview(n,'TX')).TX.reason,'register_missing');
});
test('state-specific professions are variants of a niche and city sources disclose their scope',()=>{
  assert.equal(nicheReview(get('attorney'),'NY'),'attorney_ny');
  assert.equal(nicheReview(get('auto_repair'),'NY'),'auto_repair_ny');
  assert.equal(nicheReview(get('insurance_agencies'),'FL'),'insurance_agent_fl');
  assert.equal(nicheReview(get('insurance_agencies'),'TX'),'insurance_agent_tx');
  assert.match(get('str_operator').scope!.LA,/New Orleans/);
  assert.match(get('restaurants').scope!.TX,/liquor/);
});
test('explanations distinguish fallback, restriction and unvalidated legacy routes from executable certification',()=>{
  const a=inspectWorkflowRoutes('childcare_center').FL;assert.equal(a.fallback,true);assert.match(a.explanation,/no fully mapped/i);
  const blocked=inspectWorkflowRoutes('attorney').TX;assert.equal(blocked.blocked,true);assert.ok(blocked.blockers.length>0);assert.equal(routeSteps(blocked).length,1);
  const legacy=inspectWorkflowRoutes('cpa').FL;assert.equal(legacy.legacy,true);assert.match(routeSteps(legacy)[0].body,/not validated/);
  assert.equal(routeSteps(inspectWorkflowRoutes('car_detailing').FL).length,4);
});

test("state names are US subdivisions, not ISO countries",()=>{assert.equal(stateName("MN"),"Minnesota");assert.equal(stateName("CA"),"California");assert.equal(stateName("FL"),"Florida");assert.ok(STATE_CODES.every(code=>stateName(code)!==code));});
