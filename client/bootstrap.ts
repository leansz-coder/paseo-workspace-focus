import type { Preferences } from '../shared/model';
// Start with conservative automatic folding; choose always-visible workspaces in the UI.
export function defaults(_hostId:string):Preferences {
 return {enabled:true,projects:['*'],keep:[]};
}
