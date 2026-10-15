// @vitest-environment jsdom
import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('react-native',()=>({Platform:{OS:'web'}}));
import {installSidebar} from '../client/web';
import {summarize} from '../shared/model';
import type {FocusStore} from '../client/store';
declare const document:any;declare const window:any;
let queue:Array<()=>void>=[];
beforeEach(()=>{document.body.innerHTML='';document.head.innerHTML='';queue=[];vi.spyOn(window,'requestAnimationFrame').mockImplementation((cb:any)=>{queue.push(cb);return queue.length;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});});
const flush=()=>{const q=queue;queue=[];q.forEach(f=>f());};
function setup(){
 document.body.innerHTML='<section><button data-testid="sidebar-project-row-p">P</button><div id="list">'+['manual','child','unknown'].map(id=>`<div id="branch-${id}"><div><button data-testid="sidebar-workspace-row-host:${id}" aria-selected="false">${id}</button></div></div>`).join('')+'</div></section><section><button data-testid="sidebar-workspace-row-other:child">Other host</button></section><article id="chat"></article>';
 const ws=['manual','child','unknown'].map(id=>({id,projectId:'p',projectDisplayName:'P',name:id,status:'active'}));
 const rows=summarize(ws,[{id:'root',workspaceId:'manual',title:'Root',status:'idle',parentId:null,archived:false,needsInput:false},{id:'kid',workspaceId:'child',title:'Kid',status:'running',parentId:'root',archived:false,needsInput:false}],{enabled:true,keep:['manual'],projects:['p']},true);
 const listeners=new Set<()=>void>();const s={hostId:'host',rows,complete:true};
 const store={get:()=>s,subscribe:(f:()=>void)=>{listeners.add(f);return()=>listeners.delete(f);}} as unknown as FocusStore;
 const open=vi.fn();const cleanup=installSidebar(store,open,{foreground:'#fff',foregroundMuted:'#888',surface1:'#222',accent:'#3af',statusDanger:'#f44',statusWarning:'#fa4'});flush();return {cleanup,open,s,listeners};
}
it('folds only proven children on the matching host; expand and cleanup restore rows',()=>{
 const {cleanup,open}=setup();expect(document.querySelectorAll('[data-wf-hidden]').length).toBe(1);
 expect(document.getElementById('branch-child').getAttribute('data-wf-hidden')).toBe('true');
 const button=document.querySelector('[aria-expanded]');expect(button.textContent).toContain('1 agents · 1 运行');button.click();flush();expect(document.querySelectorAll('[data-wf-hidden]').length).toBe(0);
 document.querySelector('[data-wf-owned][title]').click();expect(open).toHaveBeenCalledWith('p');
 cleanup();expect(document.querySelectorAll('[data-wf-owned],[data-wf-hidden]').length).toBe(0);expect(document.querySelectorAll('[data-testid^="sidebar-workspace-row"]').length).toBe(4);
});
it('keeps selected workspaces visible and updates status counts',async()=>{
 const {cleanup,s,listeners}=setup();document.querySelector('[data-testid="sidebar-workspace-row-host:child"]').setAttribute('aria-selected','true');await Promise.resolve();flush();expect(document.querySelectorAll('[data-wf-hidden]').length).toBe(0);
 s.rows[1].counts.running=0;listeners.forEach(f=>f());flush();expect(document.querySelector('[aria-expanded]').textContent).not.toContain('运行');expect(document.querySelector('[aria-expanded]').getAttribute('aria-label')).toContain('0 运行中');cleanup();
});
it('does not scan the sidebar for ordinary streamed chat text',async()=>{
 const {cleanup}=setup();await Promise.resolve();flush();document.getElementById('chat').appendChild(document.createElement('span'));await Promise.resolve();expect(queue.length).toBe(0);cleanup();
});
