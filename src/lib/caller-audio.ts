export const MAX_SAMPLE_BYTES=3*1024*1024;
export const audioTypes=['audio/webm','audio/ogg','audio/wav','audio/x-wav','audio/mpeg','audio/mp4','video/webm'];
export function audioFileType(bytes:Uint8Array):'webm'|'ogg'|'wav'|'mp3'|'mp4'|null{
 const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
 if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)return 'webm';
 if(ascii(0,4)==='OggS')return 'ogg';if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE')return 'wav';
 if(ascii(0,3)==='ID3'||bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0)return 'mp3';
 if(ascii(4,8)==='ftyp')return 'mp4';return null;
}
