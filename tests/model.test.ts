import {describe,it,expect} from 'vitest';
import {summarize,counts,type Agent,type Workspace} from '../shared/model';
const w=(id:string):Workspace=>({id,projectId:'p',projectDisplayName:'Project',name:id,status:'active'});
const a=(id:string,workspaceId:string,parentId:string|null=null,status='idle'):Agent=>({id,workspaceId,parentId,status,title:id,needsInput:false,archived:false});
const prefs={enabled:true,projects:['p'],keep:['manual']};
describe('conservative lineage and truthful counters',()=>{
 it('keeps manual workspaces while folding cross-workspace children',()=>{
  const r=summarize([w('manual'),w('child')],[a('root','manual'),a('one','child','root'),a('two','child','root','running')],prefs,true);
  expect(r[0].folded).toBe(false);expect(r[1].folded).toBe(true);expect(r[1].parents).toEqual([{id:'root',title:'root'}]);expect(r[1].counts).toMatchObject({total:2,running:1,idle:1});
 });
 it.each(['empty','orphan','mixed','internal','incomplete','pinned','unselected'])('never hides %s workspaces',kind=>{
  let agents=[a('root','manual'),a('one','child','root')],ws=w('child'),p=prefs;
  if(kind==='empty')agents=[];
  if(kind==='orphan')agents=agents.slice(1);
  if(kind==='mixed')agents.push(a('other','child'));
  if(kind==='internal')agents=[a('root','child'),a('one','child','root')];
  if(kind==='pinned')ws.pinnedAt='2026-10-15';
  if(kind==='unselected')p={...prefs,projects:[]};
  expect(summarize([ws],agents,p,kind!=='incomplete')[0].folded).toBe(false);
 });
 it('counts attention separately and excludes archived agents from rows',()=>{
  const waiting={...a('wait','child',null),needsInput:true};
  expect(counts([a('run','child',null,'running'),waiting,a('err','child',null,'error')])).toMatchObject({total:3,running:1,idle:1,needsInput:1,failed:1});
  expect(summarize([w('child')],[{...waiting,archived:true}],prefs,true)[0].counts.total).toBe(0);
 });
});
it('folds proven delegates across projects by default, not only the first configured project',()=>{
 const row=summarize([{...w('child'),projectId:'another'}],[a('root','manual'),a('one','child','root')],{...prefs,projects:['*']},true)[0];expect(row.folded).toBe(true);
});
it('retains archived parent lineage while excluding it from active counters',()=>{
 const rows=summarize([w('manual'),w('child')],[{...a('root','manual'),archived:true},a('one','child','root')],prefs,true);
 expect(rows[0].counts.total).toBe(0);expect(rows[1].folded).toBe(true);expect(rows[1].parents[0].title).toBe('root');
});
it('project opt-out keeps wildcard defaults for future projects and can be reversed',async()=>{
 const {toggleProject,projectEnabled}=await import('../shared/model');
 const optedOut=toggleProject({...prefs,projects:['*']},'p');
 expect(projectEnabled(optedOut,'p')).toBe(false);expect(projectEnabled(optedOut,'future')).toBe(true);
 expect(projectEnabled(toggleProject(optedOut,'p'),'p')).toBe(true);
});
