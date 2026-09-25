export type DropEdge='before'|'after';
export function placeItem<T>(items:T[],item:T,target:T|null,edge:DropEdge='before'):T[]{if(item===target)return items;const next=items.filter(value=>value!==item);const index=target===null?next.length:next.indexOf(target);if(index<0)return items;next.splice(index+(target!==null&&edge==='after'?1:0),0,item);return next;}
export function edgeAt(y:number,top:number,height:number):DropEdge{return y<top+height/2?'before':'after';}
export function edgeVelocity(position:number,start:number,end:number,zone=64):number{if(position<start||position>end)return 0;return position<start+zone?-Math.min(1,(start+zone-position)/zone):position>end-zone?Math.min(1,(position-end+zone)/zone):0;}
