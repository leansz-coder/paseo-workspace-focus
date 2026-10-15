import { Platform } from 'react-native';
import { countText, sumCounts, type Preferences, type Row, type Counts } from '../shared/model';
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
export interface SidebarColors {foreground:string;foregroundMuted:string;surface1:string;accent:string;statusDanger:string;statusWarning:string}
export function installSidebar(store:FocusStore,open:(projectId?:string)=>void,colors:SidebarColors) {
 if(!web())return Object.assign(()=>{},{updateColors:(_colors:SidebarColors)=>{}});
 let disposed=false,frame:number|null=null;
 const expanded=new Set<string>(), touched=new Set<Element>(), decorations=new Map<Element,Element>();
 const hints=new Map<Element,{original:string|null;applied:string}>();
 const groups=new Map<Element,{node:Element;button:Element;title:Element;summary:Element;detail:Element;key:string}>();
 const style=document.createElement('style');style.setAttribute(OWN,'true');
 style.textContent='[data-wf-hidden="true"]{display:none!important} [data-wf-owned]{box-sizing:border-box} button[data-wf-owned]{font:inherit;color:inherit;cursor:pointer}';document.head.appendChild(style);
 function owned(tag:string){const n=document.createElement(tag);n.setAttribute(OWN,'true');return n;}
 function setText(n:Element,text:string){if(n.textContent!==text)n.textContent=text;}
 function styleOf(n:Element,values:Record<string,string>){for(const [k,v] of Object.entries(values))n.style.setProperty(k,v);}
 function renderCounts(node:Element,c:Counts,showTotal:boolean){
  const parts=[
   ...(showTotal?[{kind:'total',text:`${c.total} 个会话`,color:colors.foregroundMuted}]:[]),
   ...(c.running?[{kind:'running',text:`${c.running} 运行中`,color:colors.accent}]:[]),
   ...(c.initializing?[{kind:'initializing',text:`${c.initializing} 启动中`,color:colors.foregroundMuted}]:[]),
   ...(c.needsInput?[{kind:'attention',text:`${c.needsInput} 待确认`,color:colors.statusWarning}]:[]),
   ...(c.failed?[{kind:'failed',text:`${c.failed} 失败`,color:colors.statusDanger}]:[]),
  ];
  const signature=JSON.stringify(parts);
  if(node.getAttribute('data-wf-counts')!==signature){
   node.setAttribute('data-wf-counts',signature);node.textContent='';
   for(const [index,part] of parts.entries()){
    if(index){const dot=owned('span');dot.textContent='·';dot.setAttribute('aria-hidden','true');styleOf(dot,{color:colors.foregroundMuted,opacity:'.55'});node.appendChild(dot);}
    const item=owned('span');item.setAttribute('data-wf-state',part.kind);item.textContent=part.text;styleOf(item,{color:part.color,'white-space':'nowrap'});node.appendChild(item);
   }
  }
  return parts.length>0;
 }
 function hint(element:Element,value:string){
  const prior=hints.get(element),current=element.getAttribute('title');
  const original=prior&&current===prior.applied?prior.original:current;
  if(current!==value)element.setAttribute('title',value);hints.set(element,{original,applied:value});
 }
 function restoreHint(element:Element){const prior=hints.get(element);if(prior&&element.getAttribute('title')===prior.applied){if(prior.original===null)element.removeAttribute('title');else element.setAttribute('title',prior.original);}hints.delete(element);}
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
   if(!label||!label.isConnected){label=owned('button');label.setAttribute('type','button');styleOf(label,{background:'transparent',border:'0','text-align':'left',padding:'0',margin:metaLine?'0 0 0 8px':'0 8px 2px 28px',color:colors.foregroundMuted,'font-size':'11px','line-height':'18px','align-items':'center','flex-wrap':'wrap',gap:'5px','min-width':'0'});(metaLine??branch).appendChild(label);decorations.set(branch,label);}
   const source=data.origin==='manual'?'已设常驻':data.parents.length?`派生自：${data.parents.map(p=>p.title).join('、')}`:'来源未知';
   const detail=`${countText(data.counts)}${!s.complete?'（数据未完整）':''}`;
   const visible=renderCounts(label,data.counts,false);
   styleOf(label,{display:visible?'inline-flex':'none'});
   label.setAttribute('title',`${detail}；${source}。点击查看来源与显示设置`);label.setAttribute('aria-label',`${data.title||data.name}：${detail}；${source}；查看来源`);label.onclick=e=>{e.stopPropagation();open(data.projectId);};
   hint(element,`${data.title||data.name}；${detail}；${source}`);
   if(data.folded){
    const bucket=buckets.get(container)??{items:[],projectId:data.projectId};bucket.items.push({row:data,branch});buckets.set(container,bucket);
   }else branch.removeAttribute('data-wf-hidden');
  }
  for(const element of hints.keys())if(!element.isConnected||!rows.has(element.getAttribute('data-testid')??''))restoreHint(element);
  for(const branch of touched)if(!present.has(branch)){branch.removeAttribute('data-wf-hidden');decorations.get(branch)?.remove();decorations.delete(branch);touched.delete(branch);}
  for(const [container,bucket] of buckets){
   // A fold only owns siblings from one project. On incompatible markup fail open.
   if(bucket.items.some(i=>i.row.projectId!==bucket.projectId)){for(const i of bucket.items)i.branch.removeAttribute('data-wf-hidden');continue;}
   let group=groups.get(container);
   if(!group||!group.node.isConnected){
    const node=owned('div'),button=owned('button'),title=owned('span'),summary=owned('span'),detail=owned('button');button.setAttribute('type','button');detail.setAttribute('type','button');
    styleOf(node,{display:'flex','align-items':'center',gap:'4px',margin:'0 10px 4px 28px',padding:'2px 0',color:colors.foregroundMuted});
    styleOf(button,{display:'flex','align-items':'center','justify-content':'flex-start','flex-wrap':'wrap','column-gap':'10px','row-gap':'2px',flex:'1','min-width':'0',background:'transparent',border:'0',padding:'2px 0','text-align':'left','font-size':'11px','line-height':'20px'});styleOf(title,{'white-space':'nowrap'});styleOf(summary,{display:'inline-flex','align-items':'center','flex-wrap':'wrap',gap:'5px','font-size':'10px','line-height':'18px'});
    styleOf(detail,{display:'block',background:'transparent',border:'0',padding:'2px 5px','border-radius':'5px','font-size':'14px','line-height':'20px',color:colors.foregroundMuted,'flex-shrink':'0'});
    button.appendChild(title);button.appendChild(summary);node.appendChild(button);node.appendChild(detail);container.appendChild(node);group={node,button,title,summary,detail,key:`${s.hostId}:${bucket.projectId}`};groups.set(container,group);
   }
   styleOf(group.node,{color:colors.foregroundMuted});styleOf(group.detail,{color:colors.foregroundMuted});
   const ex=expanded.has(group.key), list=bucket.items.map(i=>i.row), c=sumCounts(list);
   const text=`${ex?'▾':'▸'} Agent 工作区 · ${list.length} 个 · ${countText(c)}`;
   setText(group.title,`${ex?'▾':'▸'} 派生工作区 ${list.length}`);renderCounts(group.summary,c,true);group.button.setAttribute('aria-expanded',String(ex));group.button.setAttribute('aria-label',`${ex?'收起':'展开'} ${text}`);
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
 return Object.assign(()=>{if(disposed)return;disposed=true;unsub();observer.disconnect();if(frame!==null)window.cancelAnimationFrame(frame);for(const e of touched)e.removeAttribute('data-wf-hidden');for(const e of hints.keys())restoreHint(e);for(const e of decorations.values())e.remove();for(const g of groups.values())g.node.remove();style.remove();},{updateColors(next:SidebarColors){if(disposed||JSON.stringify(colors)===JSON.stringify(next))return;colors=next;schedule();}});
}

/** A host installation owns its sidebar decoration, not its transient entry row.
 * Paseo swaps that entry on cross-host navigation; only plugin teardown restores
 * the original sidebar. Each controller still touches matching host rows only.
 */
export function createSidebarLifetime(store:FocusStore,open:(projectId?:string)=>void) {
 let dead=false,host:string|null=null,controller:ReturnType<typeof installSidebar>|null=null;
 return {
  update(hostId:string,colors:SidebarColors){
   if(dead||(host!==null&&host!==hostId))return;
   host=hostId;store.bindHost(hostId);
   if(!controller)controller=installSidebar(store,open,colors);
   else controller.updateColors(colors);
  },
  dispose(){if(dead)return;dead=true;controller?.();controller=null;},
 };
}
