import {it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({effects:[] as Array<undefined|(()=>void)>,owners:[] as any[]}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useLayoutEffect:(effect:()=>undefined|(()=>void))=>{state.effects.push(effect());}}));
vi.mock('@getpaseo/plugin/client/ui',()=>({SidebarRow:()=>null}));
vi.mock('../client/screen',()=>({FocusScreen:()=>null}));
vi.mock('../client/store',()=>({createStore:()=>({start:vi.fn(),get:()=>({loading:false}),dispose:vi.fn()}),useFocus:(s:any)=>s.get()}));
vi.mock('../client/web',()=>({createSidebarLifetime:(_store:any,open:any)=>{const owner={update:vi.fn(),dispose:vi.fn(),open};state.owners.push(owner);return owner;}}));
import contribute from '../index.client';
it('route entry unmount does not release host folding; plugin teardown does, and navigation stays installation-bound',()=>{
 state.effects=[];state.owners=[];const items:any[]=[];
 const client=()=>({paseo:{},openScreen:vi.fn(),addScreen:()=>()=>{},addSidebarHeaderItem:(item:any)=>{items.push(item.Component);return()=>{};}});
 const a=client(),b=client(),disposeA=contribute(a as any),disposeB=contribute(b as any);
 const theme={colors:{}};items[0]({host:{id:'a'},theme,openScreen:vi.fn()});
 // Host navigation unmounts A's entry, then mounts B's. No sidebar cleanup runs.
 for(const effect of state.effects)effect?.();state.effects=[];items[1]({host:{id:'b'},theme,openScreen:vi.fn()});
 expect(state.owners[0].dispose).not.toHaveBeenCalled();expect(state.owners[1].dispose).not.toHaveBeenCalled();
 items[0]({host:{id:'a'},theme:{...theme},openScreen:vi.fn()});expect(state.owners).toHaveLength(2);
 state.owners[0].open('project-a');expect(a.openScreen).toHaveBeenCalledWith({screenId:'focus',params:{projectId:'project-a'}});expect(b.openScreen).not.toHaveBeenCalled();
 disposeA();expect(state.owners[0].dispose).toHaveBeenCalledOnce();expect(state.owners[1].dispose).not.toHaveBeenCalled();disposeB();expect(state.owners[1].dispose).toHaveBeenCalledOnce();
});
