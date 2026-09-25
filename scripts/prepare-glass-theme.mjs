// I05: map legacy literal colors to theme aliases; no component behavior changes.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import postcss from 'postcss';
const files=(dir)=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):e.name.endsWith('.css')?[dir+'/'+e.name]:[]);
const darkVars=new Map(),lightVars=new Map(),changed=[];
function rgb(raw){let h=raw==='white'?'ffffff':raw==='black'?'000000':raw.slice(1);if(h.length===3||h.length===4)h=h.split('').map(c=>c+c).join('');return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:h.length===8?parseInt(h.slice(6),16)/255:1,h};}
for(const file of files('src/components')){
 if(file.includes('WorkspaceAccess'))continue;
 const before=readFileSync(file,'utf8'),root=postcss.parse(before),darkSource=/PlatformHome|CallerAnalytics/.test(file);
 root.walkDecls(d=>{
  let role=d.prop==='color'||d.prop==='fill'?'fg':/^background/.test(d.prop)?'bg':/^border|^outline/.test(d.prop)?'line':null;if(!role)return;
  d.value=d.value.replace(/#[\da-fA-F]{3,8}\b|\bwhite\b|\bblack\b/g,raw=>{
   const c=rgb(raw),max=Math.max(c.r,c.g,c.b),min=Math.min(c.r,c.g,c.b),lum=(c.r*.2126+c.g*.7152+c.b*.0722)/255,sat=max?1-min/max:0;
   if(c.a<.6&&!darkSource)return raw;
   const key=`--nbc-${darkSource?'glass':'legacy'}-${role}-${c.h}`;let light=raw,dark=raw;
   if(darkSource){
    if(role==='bg')light=lum<.5?'var(--glass-surface)':sat>.25?'var(--soft)':'var(--surface)';
    if(role==='fg')light=lum>.72?'var(--ink)':sat>.4&&lum>.4?'var(--brand-blue)':'var(--muted)';
    if(role==='line')light='var(--line)';
    dark=role==='fg'?(lum>.6?'var(--ink)':'var(--muted)'):role==='line'?'var(--line)':lum<.5?'var(--glass-surface)':'var(--soft)';
    if(c.a<.4&&role==='bg'){light='transparent';dark='transparent';}
   }else{
    if(role==='bg'&&lum>.65)dark=lum>.94?'var(--surface)':'var(--soft)';
    else if(role==='fg'&&lum<.6)dark=sat>.55?`rgb(${Math.round(c.r*.5+128)} ${Math.round(c.g*.5+128)} ${Math.round(c.b*.5+128)})`:lum<.22?'var(--ink)':'var(--muted)';
    else if(role==='line'&&lum>.55)dark='var(--line)';else return raw;
   }
   if(darkSource)lightVars.set(key,light);darkVars.set(key,dark);return `var(${key},${raw})`;
  });
 });
 const after=root.toString();if(after!==before){writeFileSync(file,after);changed.push(file);}
}
const tokens=`/* NBC appearance shared by every route. Light is the default. */
:root{--glass-surface:#ffffffd9;--glass-topbar:#ffffffba;--glass-edge:#ffffffeb;--glass-shadow:0 2px 5px #15213e04,0 12px 36px #15213e04;--chart-1:#287cf0;--chart-2:#617ef3;--chart-3:#9876e8;--chart-grid:#e3e8f0;--chart-glow:.08;color-scheme:light;${[...lightVars].map(([k,v])=>`${k}:${v};`).join('')}}
html[data-theme="dark"]{--canvas:#0d1830;--surface:#152440;--soft:#1b2d4a;--ink:#e8eef9;--muted:#a4b2ca;--line:#35435e;--sage:#213554;--lime:#403824;--brand-blue:#8cadf2;--accent:#8cadf2;--accent-dark:#b8cff8;--amber:#e3c183;--glass-surface:#172641e8;--glass-topbar:#12213bc9;--glass-edge:#a0b9df20;--glass-shadow:0 2px 5px #00000010,0 12px 36px #00000018;--chart-1:#81abff;--chart-2:#a2bdfa;--chart-3:#e8c67e;--chart-grid:#31425f;--chart-glow:.18;color-scheme:dark;${[...darkVars].map(([k,v])=>`${k}:${v};`).join('')}}
html,body{background:var(--canvas);color:var(--ink)}
@media(prefers-reduced-transparency:reduce){:root,html[data-theme="dark"]{--glass-surface:var(--surface);--glass-topbar:var(--surface)}*{backdrop-filter:none!important}}
@supports not (backdrop-filter:blur(12px)){:root,html[data-theme="dark"]{--glass-surface:var(--surface);--glass-topbar:var(--surface)}}
`;
writeFileSync('src/styles/appearance.css',tokens);writeFileSync('artifacts/lanes/I05/theme-files.json',JSON.stringify(changed,null,2)+'\n');console.log({files:changed.length,aliases:darkVars.size});
