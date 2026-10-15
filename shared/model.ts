export interface Workspace { id: string; projectId: string; projectDisplayName: string; name: string; title?: string | null; status: string; pinnedAt?: string | null }
export interface Agent { id: string; workspaceId?: string; title: string | null; status: string; parentId: string | null; needsInput: boolean; archived: boolean }
export interface Preferences { enabled: boolean; projects: string[]; keep: string[]; excludedProjects?: string[] }
export function projectEnabled(p: Preferences, id: string) { return (p.projects.includes('*') || p.projects.includes(id)) && !p.excludedProjects?.includes(id); }
export function toggleProject(p: Preferences, id: string): Preferences {
 const on=projectEnabled(p,id);
 return p.projects.includes('*') ? {...p,excludedProjects:on?[...(p.excludedProjects??[]),id]:(p.excludedProjects??[]).filter(x=>x!==id)}
 : {...p,projects:on?p.projects.filter(x=>x!==id):[...p.projects,id],excludedProjects:(p.excludedProjects??[]).filter(x=>x!==id)};
}
export interface Counts { total: number; running: number; idle: number; failed: number; needsInput: number; initializing: number }
export interface Row extends Workspace { counts: Counts; parents: { id: string; title: string }[]; origin: 'manual' | 'delegated' | 'unknown'; folded: boolean }
export const counts = (agents: Agent[]): Counts => ({total: agents.length, running: agents.filter(a=>a.status==='running').length, idle: agents.filter(a=>a.status==='idle').length, failed: agents.filter(a=>a.status==='error').length, needsInput: agents.filter(a=>a.needsInput).length, initializing: agents.filter(a=>a.status==='initializing').length});
export function summarize(ws: Workspace[], agents: Agent[], prefs: Preferences, complete: boolean): Row[] {
 const live = agents.filter(a=>!a.archived), byId = new Map(agents.map(a=>[a.id,a]));
 const members = new Map<string,Agent[]>();
 for (const a of live) if(a.workspaceId) members.set(a.workspaceId,[...(members.get(a.workspaceId)??[]),a]);
 return ws.map(w=>{
  const own=members.get(w.id)??[];
  const parents=[...new Set(own.map(a=>a.parentId).filter((p):p is string=>!!p))].map(id=>({id,title:byId.get(id)?.title || id.slice(0,8)}));
  const manual=prefs.keep.includes(w.id);
  // Parentage is evidence of delegation, not proof of who created a workspace.
  // Empty, incomplete, mixed-root and internal-parent workspaces stay visible.
  const delegated=complete && own.length>0 && own.every(a=>!!a.parentId && a.parentId!==a.id && byId.get(a.parentId)?.workspaceId && byId.get(a.parentId)!.workspaceId!==w.id);
  const origin=manual?'manual':delegated?'delegated':'unknown';
  return {...w, counts:counts(own),parents,origin,folded:prefs.enabled && projectEnabled(prefs,w.projectId) && origin==='delegated' && !w.pinnedAt};
 });
}
export function countText(c:Counts) {
 return [`${c.total} 个 agent`,`${c.running} 运行中`,c.initializing?`${c.initializing} 启动中`:'',c.needsInput?`${c.needsInput} 待确认`:'',c.failed?`${c.failed} 失败`:''].filter(Boolean).join(' · ');
}
export function sumCounts(rows:Row[]):Counts {
 const c:Counts={total:0,running:0,idle:0,failed:0,needsInput:0,initializing:0};
 for(const r of rows) for(const k of Object.keys(c) as (keyof Counts)[]) c[k]+=r.counts[k];
 return c;
}
