import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WORKFLOW_NICHES,STATE_CODES,matchingStates,nicheReview,stateRouteStatus} from '../src/lib/lead-engine-niches.ts';
import {inspectWorkflowRoutes} from '../src/lib/lead-engine-workflow-routing.ts';
import {citiesFor} from '../src/lib/lead-engine-jobs.ts';
test('every niche has a route inspection for all 50 states and DC, including blocked routes',()=>{
 const cache=new Map<string,ReturnType<typeof inspectWorkflowRoutes>>();let pairs=0;
 assert.equal(new Set(STATE_CODES).size,51);
 for(const niche of WORKFLOW_NICHES)for(const state of STATE_CODES){const key=nicheReview(niche,state);if(!cache.has(key))cache.set(key,inspectWorkflowRoutes(key));const route=cache.get(key)![state];assert.ok(route,`${niche.id}/${state}`);assert.ok(stateRouteStatus(route));pairs++;}
 assert.equal(pairs,1785);assert.ok(STATE_CODES.every(s=>citiesFor(s).length>0));
 assert.equal(inspectWorkflowRoutes('contractor_registry').AK.recipe,'A');
 assert.equal(inspectWorkflowRoutes('contractor_registry').WY.fallback,true);
 assert.equal(inspectWorkflowRoutes('attorney').AK.blocked,true);
});
test('state search supports exact codes, names, DC and recoverable empty results',()=>{
 assert.deepEqual(matchingStates(''),STATE_CODES);
 assert.deepEqual(matchingStates('ca'),['CA']);
 assert.deepEqual(matchingStates('D.C.'),['DC']);
 assert.deepEqual(matchingStates(' wyoming '),['WY']);
 assert.deepEqual(matchingStates('Alaska'),['AK']);
 assert.deepEqual(matchingStates('Atlantis'),[]);
});
test('state labels never equate unresolved or legacy configurations with successful coverage',()=>{
 assert.equal(stateRouteStatus(),'Route not inspected');
 assert.match(stateRouteStatus(inspectWorkflowRoutes('attorney').AK),/^Blocked/);
 assert.match(stateRouteStatus(inspectWorkflowRoutes('realtor').IL),/not validated/);
 assert.match(stateRouteStatus(inspectWorkflowRoutes('contractor_registry').WY),/fallback/);
});
