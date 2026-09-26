export function parseVerificationRate(value:unknown):{unitMicrousd:number;source:string}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter the price shown in your verification account.');
 const b=value as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['rateUsd','source','confirmed'].includes(k))||b.confirmed!==true||typeof b.rateUsd!=='string'||!/^0\.(?:\d{1,6})$/.test(b.rateUsd)||typeof b.source!=='string'||b.source.trim().length<5||b.source.length>300)throw Error('Enter a USD price per phone, its account pricing source, and confirm the rate.');
 const unitMicrousd=Math.round(Number(b.rateUsd)*1e6);
 if(unitMicrousd<1||unitMicrousd>100000)throw Error('This round supports a confirmed verification rate up to $0.10 per phone.');
 return {unitMicrousd,source:b.source.trim()};
}
