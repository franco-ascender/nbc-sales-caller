export function parsePhoneTrial(value:unknown):{requestId:string;phone:string;approvedMaxCents?:number;scenarioId?:string}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter the recipient and confirm this test call.');
 const b=value as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['requestId','phone','confirmed','approvedMaxCents','scenarioId'].includes(k))||b.confirmed!==true||typeof b.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId)||typeof b.phone!=='string'||b.phone.length>40||!/^[+\d\s().-]+$/.test(b.phone))throw Error('Enter a valid phone number and confirm the recipient is expecting the call.');
 if(b.scenarioId!==undefined&&(typeof b.scenarioId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.scenarioId)))throw Error('Choose a saved scenario.');
 const phone=b.phone.replace(/[\s().-]/g,'');
 if(!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone))throw Error('This approved trial supports US numbers. Include +1 and the ten-digit number.');
 if(/^\+1(800|833|844|855|866|877|888|900)/.test(phone))throw Error('Use the recipient’s direct US number, not a toll-free or premium number.');
 if(b.approvedMaxCents!==undefined&&b.approvedMaxCents!==250)throw Error('Review the current maximum cost of $2.50.');
 return {...(b.scenarioId?{scenarioId:b.scenarioId as string}:{}),...(b.approvedMaxCents!==undefined?{approvedMaxCents:b.approvedMaxCents as number}:{}),requestId:b.requestId.toLowerCase(),phone};
}
