import React,{useEffect} from 'react';
import {Pressable,Text,View} from 'react-native';
import {ScrollView} from '@getpaseo/plugin/client/react-native';
import type {PluginScreenProps} from '@getpaseo/plugin/client';
import {countText,sumCounts,projectEnabled,toggleProject} from '../shared/model';
import {type FocusStore,useFocus} from './store';
export function FocusScreen({store,...props}:PluginScreenProps & {store:FocusStore}){
 const s=useFocus(store),c=props.theme.colors;
 useEffect(()=>store.bindHost(props.host.id),[props.host.id]);
 const projects=[...new Set(s.rows.map(r=>r.projectId))].filter(id=>!props.params.projectId||props.params.projectId===id);
 const button=(label:string,onPress:()=>void)=> <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{paddingHorizontal:10,paddingVertical:7,borderRadius:7,backgroundColor:c.surface2}}><Text style={{color:c.foreground,fontSize:12}}>{label}</Text></Pressable>;
 return <ScrollView contentContainerStyle={{padding:props.layout.compact?16:24,gap:16}}>
  <Text style={{color:c.foreground,fontSize:22,fontWeight:'600'}}>工作区聚焦</Text>
  <Text style={{color:c.foregroundMuted,lineHeight:21}}>查看 agent 数量与派生来源，选择侧栏常驻项。来源依据 agent 父子关系，不等同于 workspace 创建者审计；没有证据的保持显示。</Text>
  {button(s.prefs.enabled?'关闭自动折叠':'开启自动折叠',()=>store.setPrefs({...s.prefs,enabled:!s.prefs.enabled}))}
  {s.loading&&<Text style={{color:c.foregroundMuted}}>正在读取工作区和 agent…</Text>}
  {s.error&&<Text style={{color:c.statusDanger}}>读取失败，已停止自动隐藏：{s.error}</Text>}
  {s.error&&button('重新读取',()=>{void store.retry();})}
  {!s.loading&&!s.complete&&<Text style={{color:c.statusWarning}}>数据未完整，自动折叠暂停，计数仅包含已加载记录。</Text>}
  {props.layout.platform!=='web'&&<Text style={{color:c.foregroundMuted}}>此页面支持查看来源；原生手机侧栏暂不自动折叠。此处偏好仅在当前加载期间有效。</Text>}
  {projects.map(id=>{const rows=s.rows.filter(r=>r.projectId===id),on=projectEnabled(s.prefs,id);return <View key={id} style={{gap:10}}>
   <Text style={{color:c.foreground,fontSize:17,fontWeight:'600'}}>{rows[0]?.projectDisplayName}</Text>
   <Text style={{color:c.foregroundMuted}}>{rows.length} 个工作区 · {countText(sumCounts(rows))}</Text>
   {button(on?'此项目：自动折叠已开启':'此项目：开启自动折叠',()=>store.setPrefs(toggleProject(s.prefs,id)))}
   {rows.map(r=><View key={r.id} style={{padding:13,gap:8,borderRadius:10,backgroundColor:c.surface1}}>
    <Text style={{color:c.foreground,fontSize:14,fontWeight:'600'}}>{r.title||r.name}</Text>
    <Text style={{color:r.counts.needsInput?c.statusWarning:r.counts.running?c.accent:c.foregroundMuted}}>{countText(r.counts)} · {r.counts.idle} 空闲</Text>
    <Text style={{color:c.foregroundMuted,fontSize:12}}>{r.origin==='manual'?'你指定的常驻工作区':r.origin==='delegated'?'Agent 派生工作区':'来源未知或混合，保持显示'}</Text>
    {r.parents.map(p=><Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`查看父 agent：${p.title}`} disabled={!props.navigation} onPress={()=>props.navigation?.openAgent({agentId:p.id})}><Text style={{color:c.accent,fontSize:12}}>派生自：{p.title} ↗</Text></Pressable>)}
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
     {props.navigation&&button('打开工作区',()=>props.navigation?.openWorkspace({workspaceId:r.id}))}
     {button(s.prefs.keep.includes(r.id)?'取消常驻':'设为常驻',()=>store.setPrefs({...s.prefs,keep:s.prefs.keep.includes(r.id)?s.prefs.keep.filter(k=>k!==r.id):[...s.prefs.keep,r.id]}))}
    </View>
   </View>)}
  </View>;})}
 </ScrollView>;
}
