import {parseConversationScenario,compileScenarioPrompt} from './caller-knowledge.ts';
export { defaultPhoneScenario } from "./caller-default-scenario.ts";
import { defaultPhoneScenario } from "./caller-default-scenario.ts";
export function phoneScenario(value:unknown){const scenario=value?parseConversationScenario(value):defaultPhoneScenario;const {prompt}=compileScenarioPrompt(scenario);return{title:scenario.title,prompt,firstMessage:value?"Hi, I'm your AI assistant. This test call is being recorded and transcribed. Is now a good time to talk?":"Hi, this is Nalify's AI assistant. This call is being recorded and transcribed. You asked about garage door leads. Is now a good time?"};}
