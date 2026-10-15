import { Platform } from 'react-native';
import { countText, sumCounts, type Preferences, type Row } from '../shared/model';
import type { FocusStore } from './store';
// Browser-only surface. Do not add DOM globals to cross-platform components.
interface Node { nodeType:number; parentElement:Element|null; textContent:string|null; contains(n:Node|null):boolean }
interface Element extends Node {
 isConnected:boolean; children:ArrayLike<Element>; style:{setProperty(k:string,v:string):void};
 querySelector(s:string):Element|null; querySelectorAll(s:string):ArrayLike<Element>;
 closest(s:string):Element|null; matches(s:string):boolean;
 setAttribute(k:string,v:string):void;getAttribute(k:string):string|null;removeAttribute(k:string):void;
 appendChild(n:Element):unknown;remove():void;onclick:((e:{stopPropagation():void})=>void)|null;
}
interface Mutation { target:Node; addedNodes:ArrayLike<Node>; removedNodes:ArrayLike<Node>;type:string }
declare const document:{body:Element;head:Element;activeElement:Element|null;createElement(s:string):Element;querySelectorAll(s:string):ArrayLike<Element>};
declare const window:{localStorage:{getItem(k:string):string|null;setItem(k:string,v:string):void};requestAnimationFrame(f:()=>void):number;cancelAnimationFrame(n:number):void};
declare const MutationObserver:{new(f:(r:Mutation[])=>void):{observe(n:Node,o:unknown):void;disconnect():void}};
const web=()=>Platform.OS==='web' && typeof document!=='undefined';
const key=(host:string)=>`paseo/workspace-focus/v1/${host}`;
export function readPreferences(host:string,fallback:Preferences):Preferences {
 if(!web())return fallback;
 try{const p=JSON.parse(window.localStorage.getItem(key(host))??'null');if(!p||typeof p.enabled!=='boolean'||!Array.isArray(p.projects)||!Array.isArray(p.keep))return fallback;return {enabled:p.enabled,projects:p.projects.filter((x:unknown)=>typeof x==='string'),keep:p.keep.filter((x:unknown)=>typeof x==='string'),excludedProjects:Array.isArray(p.excludedProjects)?p.excludedProjects.filter((x:unknown)=>typeof x==='string'):[]};}catch{return fallback;}
}
export function writePreferences(host:string,prefs:Preferences){if(!web())return;try{window.localStorage.setItem(key(host),JSON.stringify(prefs));}catch{/* Current-page settings still work. */}}
const ROW='[data-testid^="sidebar-workspace-row-"]';
const PROJECT='[data-testid^="sidebar-project-row-"]';
const OWN='data-wf-owned';
export function installSidebar(store:FocusStore,open:(projectId?:string)=>void,colors:{foreground:string;foregroundMuted:string;surface1:string;accent:string;statusDanger:string;statusWarning:string}) {
 if(!web())return()=>{};
 let disposed=false,frame:number|null=null;
 const expanded=new Set<string>(), touched=new Set<Element>(), decorations=new Map<Element,Element>();
 const groups=new Map<Element,{node:Element;button:Element;title:Element;summary:Element;detail:Element;key:string}>();
 const style=document.createElement('style');style.setAttribute(OWN,'true');
 style.textContent='[data-wf-hidden="true"]{display:none!important} [data-wf-owned]{box-sizing:border-box} button[data-wf-owned]{font:inherit;color:inherit;cursor:pointer}';document.head.appendChild(style);
 function owned(tag:string){const n=document.createElement(tag);n.setAttribute(OWN,'true');return n;}
 function setText(n:Element,text:string){if(n.textContent!==text)n.textContent=text;}
 function styleOf(n:Element,values:Record<string,string>){for(const [k,v] of Object.entries(values))n.style.setProperty(k,v);}
 function branchFor(row:Element):{branch:Element;container:Element}|null {
  let branch=row,parent=row.parentElement;
  while(parent && parent!==document.body && parent.querySelectorAll(ROW).length===1 && !parent.querySelector(PROJECT)){branch=parent;parent=parent.parentElement;}
  return parent && parent!==document.body ? {branch,container:parent}:null;
 }
 function apply(){
  frame=null;if(disposed)return;
  const s=store.get();
  const rows=new Map(s.rows.map(r=>[`sidebar-workspace-row-${s.hostId}:${r.id}`,r]));
  const present=new Set<Element>(),buckets=new Map<Element,{items:Array<{row:Row;branch:Element}>;projectId:string}>();
  for(const element of Array.from(document.querySelectorAll(ROW))){
   const data=rows.get(element.getAttribute('data-testid')??'');if(!data)continue;
   const place=branchFor(element);if(!place)continue;
   const {branch,container}=place;present.add(branch);touched.add(branch);
   let label=decorations.get(branch);
   const metaLine=element.querySelector('[data-testid^="host-badge-"]')?.parentElement;
   if(!label||!label.isConnected){label=owned('button');label.setAttribute('type','button');styleOf(label,{background:'transparent',border:'0','text-align':'left',padding:'0',margin:metaLine?'0 0 0 2px':'0 8px 4px 29px',color:colors.foregroundMuted,'font-size':'10px','line-height':'16px','white-space':'nowrap','flex-shrink':'0'});(metaLine??branch).appendChild(label);decorations.set(branch,label);}
   const source=data.origin==='manual'?'已设常驻':data.parents.length?`派生自：${data.parents.map(p=>p.title).join('、')}`:'来源未知';
   const detail=`${countText(data.counts)}${!s.complete?'（数据未完整）':''}`;
   const compact=[data.counts.total>1?`${data.counts.total} agents`:'',data.counts.running?`${data.counts.running} 运行`:'',data.counts.needsInput?`${data.counts.needsInput} 待确认`:'',data.counts.failed?`${data.counts.failed} 失败`:''].filter(Boolean).join(' · ');
   setText(label,compact?`· ${compact}`:'');styleOf(label,{display:compact?'inline-block':'none'});label.setAttribute('title',`${detail}；${source}。点击查看来源与显示设置`);label.setAttribute('aria-label',`${data.title||data.name}：${detail}；${source}；查看来源`);label.onclick=e=>{e.stopPropagation();open(data.projectId);};
   styleOf(label,{color:data.counts.needsInput?colors.statusWarning:data.counts.failed?colors.statusDanger:data.counts.running?colors.accent:colors.foregroundMuted});
   if(data.folded){
    const bucket=buckets.get(container)??{items:[],projectId:data.projectId};bucket.items.push({row:data,branch});buckets.set(container,bucket);
   }else branch.removeAttribute('data-wf-hidden');
  }
  for(const branch of touched)if(!present.has(branch)){branch.removeAttribute('data-wf-hidden');decorations.get(branch)?.remove();decorations.delete(branch);touched.delete(branch);}
  for(const [container,bucket] of buckets){
   // A fold only owns siblings from one project. On incompatible markup fail open.
   if(bucket.items.some(i=>i.row.projectId!==bucket.projectId)){for(const i of bucket.items)i.branch.removeAttribute('data-wf-hidden');continue;}
   let group=groups.get(container);
   if(!group||!group.node.isConnected){
    const node=owned('div'),button=owned('button'),title=owned('span'),summary=owned('span'),detail=owned('button');button.setAttribute('type','button');detail.setAttribute('type','button');
    styleOf(node,{display:'flex','align-items':'center',gap:'6px',margin:'2px 12px 4px 28px',padding:'4px 0',color:colors.foregroundMuted});
    styleOf(button,{display:'flex','align-items':'center','justify-content':'space-between',gap:'8px',flex:'1','min-width':'0',background:'transparent',border:'0',padding:'2px 0','text-align':'left','font-size':'11px','line-height':'20px'});styleOf(title,{'white-space':'nowrap'});styleOf(summary,{'white-space':'nowrap','font-size':'10px'});
    styleOf(detail,{display:'block',background:'transparent',border:'0',padding:'2px 3px','font-size':'14px','line-height':'20px',color:colors.foregroundMuted,'flex-shrink':'0'});
    button.appendChild(title);button.appendChild(summary);node.appendChild(button);node.appendChild(detail);container.appendChild(node);group={node,button,title,summary,detail,key:`${s.hostId}:${bucket.projectId}`};groups.set(container,group);
   }
   const ex=expanded.has(group.key), list=bucket.items.map(i=>i.row), c=sumCounts(list);
   const text=`${ex?'▾':'▸'} Agent 工作区 · ${list.length} 个 · ${countText(c)}`;
   setText(group.title,`${ex?'▾':'▸'} 派生工作区 ${list.length}`);setText(group.summary,[`${c.total} agents`,c.running?`${c.running} 运行`:'',c.needsInput?`${c.needsInput} 待确认`:'',c.failed?`${c.failed} 失败`:''].filter(Boolean).join(' · '));styleOf(group.summary,{color:c.needsInput?colors.statusWarning:c.failed?colors.statusDanger:c.running?colors.accent:colors.foregroundMuted});group.button.setAttribute('aria-expanded',String(ex));group.button.setAttribute('aria-label',`${ex?'收起':'展开'} ${text}`);
   group.button.onclick=e=>{e.stopPropagation();if(expanded.has(group!.key))expanded.delete(group!.key);else expanded.add(group!.key);schedule();};
   const parents=[...new Set(list.flatMap(r=>r.parents.map(p=>p.title)))];setText(group.detail,'⋯');group.detail.setAttribute('aria-label','查看派生来源和常驻设置');group.detail.setAttribute('title',`派生自：${parents.join('、')}；点击管理`);group.button.setAttribute('title',`${text}；派生自：${parents.join('、')}`);group.detail.onclick=e=>{e.stopPropagation();open(bucket.projectId);};
   for(const i of bucket.items){
    // Keep a keyboard-focused or actively selected workspace visible.
    const selected=!!i.branch.querySelector('[aria-selected="true"]')||i.branch.getAttribute('aria-selected')==='true';
    const hidden=!ex&&!selected&&!i.branch.contains(document.activeElement);
    if(hidden)i.branch.setAttribute('data-wf-hidden','true');else i.branch.removeAttribute('data-wf-hidden');
   }
  }
  for(const [container,g] of groups)if(!buckets.has(container)){g.node.remove();groups.delete(container);}
 }
 function schedule(){if(!disposed&&frame===null)frame=window.requestAnimationFrame(apply);}
 function relevant(n:Node){if(n.nodeType!==1)return false;const e=n as Element;return !e.closest(`[${OWN}]`)&&(e.matches(ROW)||e.matches(PROJECT)||!!e.querySelector(ROW)||!!e.querySelector(PROJECT));}
 const observer=new MutationObserver(records=>{
  if(records.some(r=>r.type==='attributes'?relevant(r.target):[...Array.from(r.addedNodes),...Array.from(r.removedNodes)].some(relevant)))schedule();
 });
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected']});
 const unsub=store.subscribe(schedule);schedule();
 return()=>{disposed=true;unsub();observer.disconnect();if(frame!==null)window.cancelAnimationFrame(frame);for(const e of touched)e.removeAttribute('data-wf-hidden');for(const e of decorations.values())e.remove();for(const g of groups.values())g.node.remove();style.remove();};
}
