import type { PilotRow } from './live-pilot.ts';
export interface RegistryEvidence {
  business: string; phone10: string|null; person: string|null; role: string|null;
  registryPhone: string|null; source: string|null; checkedAt: string;
  state: 'association_found'|'ambiguous'|'not_found';
  basis: string; ownerConfirmed: false;
}
const object=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
const text=(x:unknown)=>typeof x==='string'?x.trim():'';
const norm=(x:unknown)=>text(x).toLowerCase().replace(/[^a-z0-9]/g,'');
const phone=(x:unknown)=>{const v=text(x).replace(/\D/g,'').replace(/^1(?=\d{10}$)/,'');return /^[2-9]\d{2}[2-9]\d{6}$/.test(v)?v:null;};
export function matchRegistryEvidence(row:PilotRow,records:unknown[],checkedAt:string):RegistryEvidence {
  const base={business:row.name,phone10:row.phone10,person:null,role:null,registryPhone:null,source:null,checkedAt,ownerConfirmed:false as const};
  const matches=records.map(object).filter(r=>{
    const b=object(r.basic);if(b.status!=='A'||r.enumeration_type!=='NPI-2')return false;
    const addresses=(Array.isArray(r.addresses)?r.addresses:[]).map(object).filter(a=>a.address_purpose==='LOCATION'&&norm(a.city)===norm(row.city)&&text(a.state).toUpperCase()===row.state);
    return addresses.length>0&&(norm(b.organization_name)===norm(row.name)||(row.phone10&&addresses.some(a=>phone(a.telephone_number)===row.phone10)));
  });
  if(matches.length!==1)return {...base,state:matches.length?'ambiguous':'not_found',basis:matches.length?'Multiple registry records match. Human review required.':'No unique matching organization in the queried registry page. This is not proof that no owner record exists.'};
  const record=matches[0],b=object(record.basic),npi=String(record.number??'');
  const person=[text(b.authorized_official_first_name),text(b.authorized_official_last_name)].filter(Boolean).join(' ');
  return {...base,state:'association_found',person:person||null,role:text(b.authorized_official_title_or_position)||null,registryPhone:phone(b.authorized_official_telephone_number),source:/^\d{10}$/.test(npi)?`https://npiregistry.cms.hhs.gov/provider-view/${npi}`:null,basis:'Active NPI organization matched by exact name or published location phone in the same city and state. An authorized official is not necessarily an owner; the registry phone is not verified.'};
}
