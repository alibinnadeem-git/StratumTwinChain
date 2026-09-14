'use client';

import {useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {assets,evidence,projects} from '@/lib/data';

type Command={label:string;meta:string;href:string;keywords:string};

const workspaceCommands:Command[]=[
 {label:'Home',meta:'Workspace',href:'/',keywords:'home command center'},
 {label:'Sites',meta:'Workspace',href:'/sites',keywords:'sites projects locations'},
 {label:'Work',meta:'Workspace',href:'/workflows',keywords:'work tasks approvals workflow'},
 {label:'Verify',meta:'Workspace',href:'/verify',keywords:'verify trust proof validation'},
 {label:'Library',meta:'Workspace',href:'/library',keywords:'library tools engineering evidence admin'},
 {label:'Spatial workspace',meta:'Engineering',href:'/spatial',keywords:'spatial model 3d systems rooms'},
 {label:'Spatial Compiler',meta:'Engineering',href:'/compiler',keywords:'compiler pdf dxf cad drawing import'},
 {label:'Evidence',meta:'Trust',href:'/evidence',keywords:'evidence documents files photos proof'},
 {label:'Provenance',meta:'Trust',href:'/provenance',keywords:'provenance history source approvals'},
 {label:'DIR Explorer',meta:'Trust',href:'/dir',keywords:'dir povi finality plc pfc chain'},
 {label:'Maintenance',meta:'Operations',href:'/maintenance',keywords:'maintenance service work orders'},
 {label:'Administration',meta:'Administration',href:'/admin',keywords:'admin roles access organization'}
];

export default function CommandPalette(){
 const [open,setOpen]=useState(false);
 const [query,setQuery]=useState('');
 const router=useRouter();

 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();
    setOpen(value=>!value);
   }
   if(event.key==='Escape')setOpen(false);
  };
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[]);

 const commands=useMemo<Command[]>(()=>[
  ...workspaceCommands,
  ...projects.map(project=>({label:project.name,meta:`Project · ${project.location}`,href:'/projects',keywords:`${project.id} ${project.client} ${project.status} ${project.location}`})),
  ...assets.map(asset=>({label:asset.name,meta:`Asset · ${asset.site} · ${asset.location}`,href:`/passport/${asset.id}`,keywords:`${asset.id} ${asset.type} ${asset.manufacturer} ${asset.model} ${asset.serial} ${asset.system} ${asset.site} ${asset.location}`})),
  ...evidence.map(item=>({label:item.name,meta:`Evidence · ${item.status}`,href:'/evidence',keywords:`${item.id} ${item.assetId} ${item.kind} ${item.status} ${item.privacy}`}))
 ],[]);

 const results=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  if(!needle)return commands.slice(0,8);
  return commands.filter(command=>`${command.label} ${command.meta} ${command.keywords}`.toLowerCase().includes(needle)).slice(0,10);
 },[commands,query]);

 const go=(href:string)=>{
  setOpen(false);
  setQuery('');
  router.push(href);
 };

 return <>
  <button className="command-trigger" type="button" onClick={()=>setOpen(true)} aria-label="Search STRATUM">
   <span>Search</span><kbd>⌘K</kbd>
  </button>
  {open&&<div className="command-backdrop" role="presentation" onMouseDown={()=>setOpen(false)}>
   <div className="command-palette" role="dialog" aria-modal="true" aria-label="Search STRATUM" onMouseDown={event=>event.stopPropagation()}>
    <div className="command-input-row">
     <span aria-hidden="true">⌕</span>
     <input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search assets, projects, evidence or tools…" aria-label="Search assets, projects, evidence or tools"/>
     <button type="button" onClick={()=>setOpen(false)} aria-label="Close search">Esc</button>
    </div>
    <div className="command-results" role="listbox" aria-label="Search results">
     {results.length?results.map(command=><button type="button" className="command-result" key={`${command.href}-${command.label}`} onClick={()=>go(command.href)}>
      <strong>{command.label}</strong><small>{command.meta}</small>
     </button>):<div className="command-empty">No matching STRATUM records in the current indexed dataset.</div>}
    </div>
   </div>
  </div>}
  <style jsx>{`
   .command-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.04);color:inherit;cursor:pointer;margin:12px 0 4px}
   .command-trigger kbd{font:inherit;font-size:11px;opacity:.65;border:1px solid rgba(255,255,255,.12);border-radius:5px;padding:2px 5px}
   .command-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.56);display:flex;align-items:flex-start;justify-content:center;padding:10vh 18px}
   .command-palette{width:min(680px,100%);background:#111827;border:1px solid rgba(255,255,255,.15);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.55);overflow:hidden}
   .command-input-row{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
   .command-input-row input{flex:1;background:transparent;border:0;outline:0;color:white;font:inherit;font-size:16px;min-width:0}
   .command-input-row button{background:transparent;border:1px solid rgba(255,255,255,.14);border-radius:6px;color:inherit;padding:3px 7px;cursor:pointer}
   .command-results{max-height:54vh;overflow:auto;padding:8px}
   .command-result{display:flex;width:100%;flex-direction:column;align-items:flex-start;gap:3px;padding:11px 12px;border:0;border-radius:10px;background:transparent;color:inherit;text-align:left;cursor:pointer}
   .command-result:hover,.command-result:focus{background:rgba(255,255,255,.08);outline:none}
   .command-result small,.command-empty{opacity:.65}
   .command-empty{padding:18px 12px}
  `}</style>
 </>;
}
