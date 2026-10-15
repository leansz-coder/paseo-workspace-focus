import {it,expect,vi} from 'vitest';
import {createDirectory,type Page} from '../client/directory';
type Item={id:string;value:number};
const page=(entries:Item[],next?:string):Page<Item>=>({entries,pageInfo:{hasMore:!!next,nextCursor:next}});
const deferred=()=>{let resolve!:(p:Page<Item>)=>void;const promise=new Promise<Page<Item>>(r=>{resolve=r;});return {promise,resolve};};
it('collects every page and preserves updates/removals received during pagination',async()=>{
 const later=deferred(),load=vi.fn(()=>later.promise),d=createDirectory(load,vi.fn());
 const scan=d.snapshot(page(Array.from({length:200},(_,i)=>({id:String(i),value:0})),'next'));
 expect(d.state.complete).toBe(false);
 d.update('200',{id:'200',value:9});d.update('201',null);
 later.resolve(page([{id:'200',value:0},{id:'201',value:0},{id:'202',value:0}]));await scan;
 expect(load).toHaveBeenCalledWith('next');expect(d.values()).toHaveLength(202);
 expect(d.values().find(x=>x.id==='200')?.value).toBe(9);expect(d.values().some(x=>x.id==='201')).toBe(false);expect(d.state.complete).toBe(true);
});
it('ignores late old pages after a reconnect snapshot or disposal',async()=>{
 const later=deferred(),d=createDirectory(()=>later.promise,vi.fn());const scan=d.snapshot(page([],'old'));
 await d.snapshot(page([{id:'fresh',value:1}]));later.resolve(page([{id:'stale',value:1}]));await scan;
 expect(d.values().map(x=>x.id)).toEqual(['fresh']);
 const other=deferred(),notify=vi.fn(),e=createDirectory(()=>other.promise,notify);const pending=e.snapshot(page([],'next'));e.dispose();notify.mockClear();other.resolve(page([{id:'late',value:0}]));await pending;
 expect(e.values()).toEqual([]);expect(notify).not.toHaveBeenCalled();
});
it('invalidates in-flight pages on errors and clears errors only on a new snapshot',async()=>{
 const later=deferred(),d=createDirectory(()=>later.promise,vi.fn());const pending=d.snapshot(page([],'next'));d.fail(Error('offline'));later.resolve(page([{id:'old',value:0}]));await pending;
 expect(d.state).toMatchObject({complete:false,error:'offline'});expect(d.values()).toEqual([]);
 await d.snapshot(page([{id:'fresh',value:1}]));expect(d.state).toMatchObject({complete:true,error:null});
});
it('fails open on missing/repeated pagination cursors',async()=>{
 const d=createDirectory(async()=>page([],'repeat'),vi.fn());await d.snapshot(page([],'repeat'));expect(d.state.complete).toBe(false);expect(d.state.error).toContain('游标');
 await d.snapshot({entries:[],pageInfo:{hasMore:true}});expect(d.state.complete).toBe(false);
});
