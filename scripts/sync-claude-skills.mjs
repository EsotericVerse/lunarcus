#!/usr/bin/env node
// LAS has one source of truth: .agents/skills/<name>/SKILL.md.
// Claude receives per-skill directory links; never copy, erase or re-install skills.
import {existsSync,lstatSync,mkdirSync,readdirSync,realpathSync,symlinkSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=join(root,'.agents','skills');
const dest=join(root,'.claude','skills');
if(!existsSync(source)){console.warn('LAS skills source missing; preserving existing links');process.exit(0)}
const names=readdirSync(source,{withFileTypes:true})
 .filter(entry=>entry.isDirectory()&&existsSync(join(source,entry.name,'SKILL.md')))
 .map(entry=>entry.name).sort();
mkdirSync(dest,{recursive:true});
let linked=0,unchanged=0,warnings=0;
for(const name of names){
 const target=join(source,name),link=join(dest,name);
 if(existsSync(link)){
  try{if(realpathSync(link)===realpathSync(target)){unchanged++;continue;}}
  catch{}
  // This could be another extension, junction or a real user folder.
  // Do not delete it or follow it; preserve it and report a diagnostic.
  console.warn('LAS skill link occupied, preserving: '+name);
  warnings++;continue;
 }
 try{
  const to=process.platform==='win32'?target:relative(dest,target);
  symlinkSync(to,link,process.platform==='win32'?'junction':'dir');
  linked++;
 }catch(error){console.warn('LAS cannot link '+name+': '+String(error?.message||error));warnings++}
}
console.log('LAS skills: '+names.length+' source skills; '+linked+' linked, '+unchanged+
 ' existing, '+warnings+' warnings; no existing directories removed');
