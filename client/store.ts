import type { PluginClientContext } from '@getpaseo/plugin/client';
type PaseoApi = PluginClientContext['paseo'];
type PaseoAgent = Awaited<ReturnType<PaseoApi['agents']['list']>>['entries'][number]['agent'];
type PaseoWorkspace = Awaited<ReturnType<PaseoApi['workspaces']['list']>>['entries'][number];
import { useSyncExternalStore } from 'react';
import { summarize, type Agent, type Workspace, type Preferences, type Row } from '../shared/model';
import { defaults } from './bootstrap';
import { readPreferences, writePreferences } from './web';
import { createDirectory } from './directory';
export interface State { rows:Row[]; loading:boolean; error:string|null; complete:boolean; prefs:Preferences; hostId:string }
export function createStore(api:PaseoApi) {
 let state:State={rows:[],loading:true,error:null,complete:false,prefs:{enabled:false,projects:[],keep:[]},hostId:''};
 let disposed=false, generation=0;
 const listeners=new Set<()=>void>(), releases:Array<()=>void>=[];
 const agent=(a:PaseoAgent):Agent=>({id:a.id,workspaceId:a.workspaceId,title:a.title,status:a.status,parentId:a.labels?.['paseo.parent-agent-id']||null,needsInput:!!a.pendingPermissions?.length || a.attentionReason==='permission',archived:!!a.archivedAt});
 const workspace=(w:PaseoWorkspace):Workspace=>({id:w.id,projectId:w.projectId,projectDisplayName:w.projectDisplayName,name:w.name,title:w.title,status:w.status,pinnedAt:w.pinnedAt});
 const agentQuery={filter:{includeArchived:true},sort:[{key:'created_at' as const,direction:'asc' as const}]};
 const workspaceQuery={sort:[{key:'name' as const,direction:'asc' as const}]};
 function emit(force=false) {
  if(disposed)return;
  const complete=agents.state.complete&&workspaces.state.complete;
  const error=[agents.state.error&&`Agent：${agents.state.error}`,workspaces.state.error&&`工作区：${workspaces.state.error}`].filter(Boolean).join('；')||null;
  const next={...state,complete,error,loading:!agents.state.ready||!workspaces.state.ready,rows:summarize(workspaces.values(),agents.values(),state.prefs,complete)};
  if(force||JSON.stringify(next)!==JSON.stringify(state)){state=next;listeners.forEach(f=>f());}
 }
 const agents=createDirectory<Agent>(async cursor=>{
  const p=await api.agents.list({...agentQuery,page:{limit:200,cursor}});
  return {entries:p.entries.map(e=>agent(e.agent)),pageInfo:p.pageInfo};
 },emit);
 const workspaces=createDirectory<Workspace>(async cursor=>{
  const p=await api.workspaces.list({...workspaceQuery,page:{limit:200,cursor}});
  return {entries:p.entries.map(workspace),pageInfo:p.pageInfo};
 },emit);
 async function start(){
  if(disposed)return;
  const current=++generation;
  for(const release of releases.splice(0).reverse())release();
  agents.invalidate();workspaces.invalidate();
  await Promise.allSettled([
   api.agents.list({...agentQuery,page:{limit:200},subscribe:{}}).then(result=>{
    if(disposed||current!==generation){void result.subscription.release().catch(()=>{});return;}
    releases.push(()=>{void result.subscription.release().catch(()=>{});});
    releases.push(result.subscription.subscribe({snapshot(s){if(current===generation)void agents.snapshot({entries:s.entries.map(e=>agent(e.agent)),pageInfo:s.pageInfo});},update(m){if(current!==generation||m.type!=='agent_update')return;const p=m.payload;if(p.kind==='upsert')agents.update(p.agent.id,agent(p.agent));else agents.update(p.agentId,null);},error:e=>{if(current===generation)agents.fail(e);}}));
   }).catch(e=>{if(current===generation)agents.fail(e);}),
   api.workspaces.list({...workspaceQuery,page:{limit:200},subscribe:{}}).then(result=>{
    if(disposed||current!==generation){void result.subscription.release().catch(()=>{});return;}
    releases.push(()=>{void result.subscription.release().catch(()=>{});});
    releases.push(result.subscription.subscribe({snapshot(s){if(current===generation)void workspaces.snapshot({entries:s.entries.map(workspace),pageInfo:s.pageInfo});},update(m){if(current!==generation||m.type!=='workspace_update')return;const p=m.payload;if(p.kind==='upsert')workspaces.update(p.workspace.id,workspace(p.workspace));else workspaces.update(p.id,null);},error:e=>{if(current===generation)workspaces.fail(e);}}));
   }).catch(e=>{if(current===generation)workspaces.fail(e);})
  ]);
 }
 return {
  start,retry:start,get:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>{listeners.delete(f);};},
  bindHost(id:string){if(state.hostId===id)return;state={...state,hostId:id,prefs:readPreferences(id,defaults(id))};emit(true);},
  setPrefs(prefs:Preferences){state={...state,prefs};writePreferences(state.hostId,prefs);emit(true);},
  dispose(){disposed=true;generation++;agents.dispose();workspaces.dispose();for(const r of releases.splice(0).reverse())r();listeners.clear();}
 };
}
export type FocusStore=ReturnType<typeof createStore>;
export function useFocus(store:FocusStore){return useSyncExternalStore(store.subscribe,store.get,store.get);}
