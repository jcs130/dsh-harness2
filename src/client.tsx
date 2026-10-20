import {useEffect,useState} from 'react';
export const inject=['slots','connection'];

const labels:Record<string,string>={
  'not-started':'尚未运行',running:'运行中',completed:'已完成',blocked:'已阻断',failed:'失败',cancelled:'已取消',unknown:'未知',
  preparing:'准备',propose:'生成候选',probe:'试跑',compose:'组合',select:'筛选',reflect:'反思',holdout:'留出复测',remember:'保存经验',settled:'已结束',
};
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString():'—';
const style={background:'#111b18',color:'#dbe7e0',height:'100%',overflow:'auto' as const,padding:'24px',boxSizing:'border-box' as const,fontFamily:'system-ui,sans-serif'};
const card={border:'1px solid #30483c',background:'#192720',borderRadius:14,padding:18,marginBottom:14};
const row={display:'flex',gap:20,flexWrap:'wrap' as const,marginTop:12,color:'#b8cdc0'};

export function Result({result}:{result:any}){
  const pairs=[{name:'试跑场景',...result.train},...(result.holdout??[]).map((p:any)=>({name:`留出 · ${p.caseId}`,...p}))];
  return <div>
    <p style={{color:result.gate.eligible?'#a5edb8':'#f6d084'}}>{result.gate.eligible?'通过隔离实验门槛':'未通过隔离实验门槛'} · 尚未采用</p>
    <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
      <thead><tr><th>场景 / 指标</th><th>原版</th><th>候选</th></tr></thead>
      <tbody>{pairs.flatMap((p:any)=>Object.keys(p.baseline?.metrics??{}).map(key=><tr key={`${p.name}-${key}`}>
        <td style={{padding:'8px 0'}}>{p.name} / {key}</td><td>{number(p.baseline.metrics[key])}</td><td>{number(p.candidate?.metrics?.[key])}</td>
      </tr>))}</tbody>
    </table></div>
    <p style={{fontSize:12,color:'#9ab3a2'}}>证据 {number(result.evidenceRefs?.length)} 条 · {result.lessonAvailable?'有反思产物':'无反思产物'} · 结果适用范围以试跑场景为限</p>
  </div>;
}

/** Pure native view, also render-tested without starting a browser or model. */
export function ExperimentView({snapshot,error}:{snapshot?:any;error?:string}){
  const jobs=snapshot?.jobs??[],external=snapshot?.external??[];
  return <main style={style}>
    <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
      <div><h2 style={{margin:'0 0 8px'}}>Harness² 实验室</h2><p style={{margin:0,color:'#a8c0b0'}}>候选 → 试跑 → 组合 → 筛选 → 反思</p></div>
      <span style={{color:snapshot?.enabled?'#a5edb8':'#f6d084'}}>{snapshot?.enabled?'允许已配置实验':'新实验未启用'}</span>
    </div>
    <p style={{color:'#9ab3a2',lineHeight:1.7}}>实验不会自动替换线上配置。这里只展示指标和证据引用；提示词、回答、思考正文与凭据不进入此页面。</p>
    {error&&<p role="alert" style={{color:'#f79f97'}}>{error}</p>}
    {!snapshot&&!error&&<p role="status">正在读取本会话实验…</p>}
    {snapshot&&!jobs.length&&!external.length&&<section style={card}><h3 style={{marginTop:0}}>本会话还没有实验</h3><p>在插件配置中绑定本会话的任务、模型与隔离适配器后，使用 harness2_run 启动已配置的 jobId。</p><p style={{color:'#a8c0b0'}}>安装插件或打开此页不会产生模型调用。</p></section>}
    {jobs.map((job:any)=><section key={job.id} style={card}>
      <div style={{display:'flex',justifyContent:'space-between',gap:16}}><strong style={{overflowWrap:'anywhere'}}>{job.id}</strong><span style={{color:['blocked','failed','unknown'].includes(job.status)?'#f79f97':job.status==='running'?'#a5edb8':'#f6d084'}}>{labels[job.status]??'未知'} · {labels[job.phase]??'未知'}</span></div>
      <div style={row}><span>适配器 {job.adapter}</span><span>{job.mode==='parallel'?'并行探索':'顺序改进'} · k={job.k??'—'}</span><span>模型 {number(job.modelCalls)} / {number(job.budget?.modelCalls)}</span><span>试跑 {number(job.trials)} / {number(job.budget?.trials)}</span></div>
      <div style={row}><span>输入 {number(job.usage?.inputTokens)} tok</span><span>输出 {number(job.usage?.outputTokens)} tok</span><span>缓存输入 {number(job.usage?.cachedTokens)} tok</span><span>用量帧 {number(job.usage?.usageSamples)} / {number(job.usage?.returnedCalls)}</span></div>
      {job.result&&<Result result={job.result}/>}
      {job.timeline?.length>0&&<details style={{marginTop:14}}><summary>试跑与阶段记录 · {job.timeline.length}</summary><ol style={{lineHeight:1.9,paddingLeft:22}}>{job.timeline.map((c:any)=><li key={c.id}><span>{c.kind==='model'?'模型':'试跑'} · {c.caseId??'候选与反思'} · {c.group==='holdout'?'留出复测':c.group==='train'?'试跑场景':'生成'} · {c.role==='baseline'?'原版':c.role==='candidate'?'候选':''} · {c.phase==='returned'?'已返回':'结果未确定'}</span></li>)}</ol></details>}
      <p style={{fontSize:12,color:'#9ab3a2',marginBottom:0}}>更新 {typeof job.updatedAt==='number'?new Date(job.updatedAt).toLocaleString():'—'}{job.stale?' · 心跳过期，结果未知':''} · 经验 {job.memory==='stored'?'已写入宿主记忆':job.memory==='pending'?'待确认':job.memory==='disabled'?'未配置宿主记忆':'—'}</p>
    </section>)}
    {external.map((job:any)=><section key={`${job.source}-${job.id}`} style={card}><strong>{job.source} / {job.id}</strong><p>{labels[job.status]??'未知'} · {labels[job.phase]??'未知'} · 证据 {number(job.result?.evidenceCount)} 条 · 尚未采用</p><small style={{color:'#9ab3a2'}}>运行和证据由领域插件维护，此处只读展示。</small></section>)}
  </main>;
}

export function apply(ctx:any){
  function Panel({sessionId}:{sessionId:string}){
    const [state,setState]=useState<{sessionId:string;snapshot?:any;error?:string}>();
    useEffect(()=>{
      const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
      const refresh=async()=>{
        if(controller.signal.aborted)return;
        if(!document.hidden)try{
          const result=await ctx.connection.rpc.call('/api','harness2/experiments',{sessionId},controller.signal);
          if(!controller.signal.aborted)setState(result.ok&&result.value.sessionId===sessionId?{sessionId,snapshot:result.value.snapshot}:{sessionId,error:'实验数据暂不可用。'});
        }catch{if(!controller.signal.aborted)setState({sessionId,error:'实验数据连接中断，当前状态未知。'});}
        if(!controller.signal.aborted)timer=setTimeout(refresh,2000);
      };
      void refresh();
      return ()=>{controller.abort();clearTimeout(timer);};
    },[sessionId]);
    const current=state?.sessionId===sessionId?state:undefined;
    return <ExperimentView snapshot={current?.snapshot} error={current?.error}/>;
  }
  ctx.slots.inject('conversation.view',()=>ctx.slots.register({name:'conversation.view',id:'harness2-lab',order:110,label:()=>'实验室'},Panel));
}
