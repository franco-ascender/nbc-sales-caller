export function parsePhoneTrial(value:unknown):{requestId:string;phone:string}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter the recipient and confirm this test call.');
 const b=value as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['requestId','phone','confirmed'].includes(k))||b.confirmed!==true||typeof b.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.requestId)||typeof b.phone!=='string'||b.phone.length>40||!/^[+\d\s().-]+$/.test(b.phone))throw Error('Enter a valid phone number and confirm the recipient is expecting the call.');
 const phone=b.phone.replace(/[\s().-]/g,'');
 if(!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(phone))throw Error('This approved trial supports US numbers. Include +1 and the ten-digit number.');
 if(/^\+1(800|833|844|855|866|877|888|900)/.test(phone))throw Error('Use the recipient’s direct US number, not a toll-free or premium number.');
 return {requestId:b.requestId.toLowerCase(),phone};
}
