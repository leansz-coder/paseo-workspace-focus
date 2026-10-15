import React,{useEffect} from 'react';
import type {PluginClientContext,PluginSidebarItemProps,PluginScreenProps} from '@getpaseo/plugin/client';
import {SidebarRow} from '@getpaseo/plugin/client/ui';
import {createStore,useFocus} from './client/store';
import {installSidebar} from './client/web';
import {FocusScreen} from './client/screen';
export default function contribute(client:PluginClientContext){
 const store=createStore(client.paseo);
 function Item(props:PluginSidebarItemProps){
  const s=useFocus(store);
  useEffect(()=>{store.bindHost(props.host.id);return installSidebar(store,projectId=>props.openScreen({screenId:'focus',params:projectId?{projectId}:undefined}),props.theme.colors);},[props.host.id,props.theme]);
  return <SidebarRow icon="ListFilter" label={s.loading?'工作区聚焦 · 读取中':'工作区聚焦'} onPress={()=>props.openScreen({screenId:'focus'})}/>;
 }
 const Screen=(props:PluginScreenProps)=><FocusScreen {...props} store={store}/>;
 const removeScreen=client.addScreen({id:'focus',title:'工作区聚焦',Component:Screen});
 const removeItem=client.addSidebarHeaderItem({id:'focus',title:'工作区聚焦',Component:Item});
 void store.start();
 return()=>{removeItem();removeScreen();store.dispose();};
}
