import React,{useLayoutEffect} from 'react';
import type {PluginClientContext,PluginSidebarItemProps,PluginScreenProps} from '@getpaseo/plugin/client';
import {SidebarRow} from '@getpaseo/plugin/client/ui';
import {createStore,useFocus} from './client/store';
import {createSidebarLifetime} from './client/web';
import {FocusScreen} from './client/screen';
export default function contribute(client:PluginClientContext){
 const store=createStore(client.paseo);
 const sidebar=createSidebarLifetime(store,projectId=>client.openScreen({screenId:'focus',params:projectId?{projectId}:undefined}));
 function Item(props:PluginSidebarItemProps){
  const s=useFocus(store);
  // No per-row cleanup: switching hosts replaces this component, not the plugin.
  useLayoutEffect(()=>{sidebar.update(props.host.id,props.theme.colors);},[props.host.id,props.theme]);
  return <SidebarRow icon="ListFilter" label={s.loading?'工作区聚焦 · 读取中':'工作区聚焦'} onPress={()=>props.openScreen({screenId:'focus'})}/>;
 }
 const Screen=(props:PluginScreenProps)=><FocusScreen {...props} store={store}/>;
 const removeScreen=client.addScreen({id:'focus',title:'工作区聚焦',Component:Screen});
 const removeItem=client.addSidebarHeaderItem({id:'focus',title:'工作区聚焦',Component:Item});
 void store.start();
 return()=>{sidebar.dispose();removeItem();removeScreen();store.dispose();};
}
