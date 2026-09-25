import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolFlow } from '../src/lib/lead-engine-tool-flow.ts';
import { inspectWorkflowRoutes } from '../src/lib/lead-engine-workflow-routing.ts';
import { WORKFLOW_NICHES,nicheReview } from '../src/lib/lead-engine-niches.ts';
test('Illinois real estate shows IDFPR, missing phone, Cook County dependency and distinct BatchData branches',()=>{
  const route=inspectWorkflowRoutes('realtor').IL;
  const flow=toolFlow(route,'realtor');
  assert.match(flow.start[0].tool,/Illinois IDFPR/);
  assert.match(flow.start[0].output,/No phone field/);
  assert.match(flow.sourceScope!,/managing brokers.*Cook County/);
  assert.match(flow.yes[0].tool,/BatchData.*verification/);
  assert.match(flow.no[0].tool,/Cook County.*BatchData lookup/);
  assert.ok(flow.noJoins);
  assert.ok(!flow.tools.includes('Apify'));
  assert.equal(flow.optional.length,0);
});
test('A/C/D show the actual providers and distinguish discovery, comparison and optional name extraction',()=>{
  const a=toolFlow(inspectWorkflowRoutes('car_detailing').FL,'car_detailing');
  assert.match(a.start[0].tool,/Apify/);assert.equal(a.noJoins,false);
  assert.match(a.optional[0].tool,/Website reader.*Apify.*Anthropic Haiku/);
  const c=toolFlow(inspectWorkflowRoutes('contractor_registry').WA,'contractors');
  assert.ok(!c.tools.includes('Apify'));assert.equal(c.optional.length,0);assert.match(c.yes[0].tool,/BatchData/);
  const d=toolFlow(inspectWorkflowRoutes('contractor_mn').MN,'contractors');
  assert.ok(d.start.some(n=>n.id==='compare'));assert.ok(d.tools.includes('Apify'));
});
test('blocked routes retain explanatory topology without claiming execution; all niches have tool IO',()=>{
  const blocked=toolFlow(inspectWorkflowRoutes('attorney').TX,'attorney');assert.equal(blocked.blocked,true);assert.ok(blocked.start.length>1);assert.ok(blocked.no.length>0);
  for(const niche of WORKFLOW_NICHES){const flow=toolFlow(inspectWorkflowRoutes(nicheReview(niche,'FL')).FL,niche.id);for(const node of [...flow.start,...flow.yes,...flow.no,...flow.final,...flow.optional]){assert.ok(node.tool&&node.input&&node.output&&node.why);}}
  assert.equal(toolFlow(undefined,'unknown').blocked,true);
});
