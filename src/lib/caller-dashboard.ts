import {validSessionId} from './caller-validation.ts';
export const widgetCatalog=[
 {id:'leads',name:'Pipeline leads',description:'Your current loaded CRM',kind:'number'},
 {id:'conversations',name:'Conversations',description:'Saved sessions in this period',kind:'number'},
 {id:'completed',name:'Completed',description:'Final conversation results',kind:'number'},
 {id:'minutes',name:'Talk time',description:'Known saved duration, in minutes',kind:'number'},
 {id:'pending',name:'Pending results',description:'Sessions awaiting a final result',kind:'number'},
 {id:'average',name:'Average duration',description:'Mean of sessions with known duration',kind:'number'},
 {id:'activity',name:'Conversation activity',description:'Daily volume · smooth area chart',kind:'curve'},
 {id:'outcomes',name:'Result mix',description:'Completed, pending and unsuccessful',kind:'ring'},
 {id:'stages',name:'Pipeline distribution',description:'Current leads by your custom stages',kind:'bars'},
 {id:'channels',name:'Conversation channels',description:'Phone sessions and browser tests',kind:'bars'},
 {id:'duration',name:'Daily talk time',description:'Saved minutes across the period',kind:'curve'},
 {id:'hours',name:'Activity by hour',description:'When conversations start · local time',kind:'heatmap'},
 {id:'leadSources',name:'Lead sources',description:'Where your loaded leads came from',kind:'bars'},
 {id:'durationMix',name:'Conversation lengths',description:'Distribution of known call durations',kind:'bars'},
 {id:'cumulative',name:'Conversations over time',description:'Cumulative sessions in the selected period',kind:'curve'},
 {id:'weekdays',name:'Activity by weekday',description:'Conversation starts, Monday to Sunday',kind:'bars'},
 {id:'averageDaily',name:'Average talk time by day',description:'Daily mean of known durations',kind:'bars'},
 {id:'outcomesDaily',name:'Completed by day',description:'Final completed conversations per day',kind:'curve'},
] as const;
export type WidgetId=typeof widgetCatalog[number]['id'];
export interface DashboardWidget{id:WidgetId;cols:number;rows:number}
export interface AnalyticsConfig{widgets:DashboardWidget[]}
export interface CrmConfig{order:string[]}
export type ViewConfig=AnalyticsConfig|CrmConfig;
export type ViewScope='analytics'|'crm';
export interface SavedView{version:string|null;config:ViewConfig}
export const defaultWidgets:DashboardWidget[]=widgetCatalog.filter(w=>['leads','conversations','completed','minutes','activity','outcomes','stages','channels','duration','hours'].includes(w.id)).map(w=>({id:w.id,cols:w.kind==='number'?3:w.id==='activity'?8:w.id==='outcomes'?4:6,rows:w.kind==='number'?2:5}));
export const defaultView=(scope:ViewScope):ViewConfig=>scope==='analytics'?{widgets:defaultWidgets.map(w=>({...w}))}:{order:[]};
export function validView(scope:ViewScope,value:unknown):value is ViewConfig{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 if(scope==='crm'){const order=(value as CrmConfig).order;return Array.isArray(order)&&order.length<=1000&&order.every(validSessionId)&&new Set(order.map(s=>s.toLowerCase())).size===order.length;}
 const widgets=(value as AnalyticsConfig).widgets;
 return Array.isArray(widgets)&&widgets.length<=widgetCatalog.length&&new Set(widgets.map(w=>w?.id)).size===widgets.length&&widgets.every(w=>w&&widgetCatalog.some(c=>c.id===w.id)&&Number.isInteger(w.cols)&&w.cols>=3&&w.cols<=12&&Number.isInteger(w.rows)&&w.rows>=2&&w.rows<=6);
}
export function reorder<T>(items:T[],from:number,to:number):T[]{if(from<0||to<0||from>=items.length||to>=items.length)return items;const next=[...items];next.splice(to,0,next.splice(from,1)[0]);return next;}
// Horizontal tangents at each observed value keep each cubic segment within its endpoint range.
export function smoothPath(values:number[],width=680,height=170):string{if(!values.length)return '';const max=Math.max(1,...values),points=values.map((v,i)=>[i*width/Math.max(1,values.length-1),height-Math.max(0,v)/max*height]);return points.reduce((path,[x,y],i)=>{if(!i)return `M ${x} ${y}`;const [px,py]=points[i-1],mid=(px+x)/2;return `${path} C ${mid} ${py}, ${mid} ${y}, ${x} ${y}`;},'');}
