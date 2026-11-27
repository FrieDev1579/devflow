import { FormEvent, useEffect, useMemo, useState } from 'react';

type Workflow = { id: string; name: string; description: string; trigger: string; action: string; active: boolean; runs: number; updatedAt: string };
const initial: Workflow[] = [
  { id:'wf-01', name:'Daily task reminder', description:'Create a daily reminder for tasks that are still pending.', trigger:'Every day · 9:00 AM', action:'Create reminder', active:true, runs:24, updatedAt:'Today' },
  { id:'wf-02', name:'New lead follow-up', description:'Prepare a follow-up task when a new lead is added.', trigger:'New lead added', action:'Create follow-up task', active:true, runs:12, updatedAt:'Yesterday' },
  { id:'wf-03', name:'Weekly project summary', description:'Collect project notes into a weekly summary draft.', trigger:'Every Friday', action:'Prepare summary', active:false, runs:6, updatedAt:'2 days ago' }
];
const KEY='devflow-workflows-v1';
function load(): Workflow[] { try { const raw=localStorage.getItem(KEY); return raw ? JSON.parse(raw) as Workflow[] : initial; } catch { return initial; } }

export default function App() {
  const [items,setItems]=useState<Workflow[]>(load);
  const [query,setQuery]=useState('');
  const [creating,setCreating]=useState(false);
  const [notice,setNotice]=useState('');
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [trigger,setTrigger]=useState('When I run it');
  const [action,setAction]=useState('Create a task');
  useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(items)); },[items]);
  const visible=useMemo(()=>items.filter(x=>(x.name+' '+x.description).toLowerCase().includes(query.toLowerCase())),[items,query]);
  const active=items.filter(x=>x.active).length;
  const runs=items.reduce((sum,x)=>sum+x.runs,0);
  function create(e:FormEvent){ e.preventDefault(); if(!name.trim()) return; setItems(old=>[{id:crypto.randomUUID(),name:name.trim(),description:description.trim()||'A new workflow created in DevFlow.',trigger,action,active:true,runs:0,updatedAt:'Just now'},...old]); setName('');setDescription('');setTrigger('When I run it');setAction('Create a task');setCreating(false);setNotice('Workflow created and saved in this browser.'); }
  function run(id:string){const item=items.find(x=>x.id===id);setItems(old=>old.map(x=>x.id===id?{...x,runs:x.runs+1,updatedAt:'Just now'}:x));if(item)setNotice('“'+item.name+'” was run in demo mode. No external service was contacted.');}
  function remove(id:string){setItems(old=>old.filter(x=>x.id!==id));setNotice('Workflow deleted.');}
  return <div className="shell">
    <aside className="sidebar"><div className="brand"><span className="mark">D</span>devflow</div><p className="side-label">WORKSPACE</p><div className="nav active">▦ &nbsp; Overview</div><div className="nav">⌘ &nbsp; Workflows <span>{items.length}</span></div><div className="nav">◷ &nbsp; Activity</div><div className="side-bottom"><div className="tip"><b>✦ Build better flows</b><p>Start small. Automate the tasks you repeat every day.</p><button onClick={()=>setCreating(true)}>Create a workflow →</button></div><div className="profile"><span className="avatar">D</span><span><b>Demo workspace</b><small>Free plan</small></span></div></div></aside>
    <main><header><span>Workspace　/　<b>Overview</b></span><span className="saved">●　All changes saved</span></header><section className="content">
      <div className="welcome"><div><small className="eyebrow">YOUR WORKSPACE</small><h1>Good work starts with a flow.</h1><p>Create, manage, and keep track of the workflows that save you time.</p></div><button className="primary" onClick={()=>setCreating(true)}>＋ New workflow</button></div>
      <div className="stats"><Stat label="Total workflows" value={items.length} note="Across your workspace"/><Stat label="Active workflows" value={active} note="Ready to be triggered"/><Stat label="Demo runs" value={runs} note="Manual test runs"/></div>
      <section className="panel"><div className="panel-head"><div><h2>Your workflows</h2><p>Manage the automations in your workspace.</p></div><div className="tools"><input aria-label="Search workflows" placeholder="⌕  Search workflows" value={query} onChange={e=>setQuery(e.target.value)}/><button className="secondary" onClick={()=>setQuery('')}>Clear</button></div></div>
      {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      <div className="table-head"><span>WORKFLOW</span><span>TRIGGER</span><span>LAST UPDATED</span><span>STATUS</span><span></span></div>
      {visible.length===0?<div className="empty"><b>No workflows found</b><p>Try another search or create a workflow.</p></div>:visible.map(x=><article className="workflow" key={x.id}><div><b>{x.name}</b><p>{x.description}</p><small className="mobile">{x.trigger} · {x.runs} demo runs</small></div><span>{x.trigger}</span><span>{x.updatedAt}</span><button className={'pill '+(x.active?'on':'off')} onClick={()=>setItems(old=>old.map(y=>y.id===x.id?{...y,active:!y.active}:y))}>{x.active?'● Active':'● Paused'}</button><div className="actions"><button onClick={()=>run(x.id)}>Run</button><button onClick={()=>remove(x.id)} aria-label={'Delete '+x.name}>×</button></div></article>)}
      <div className="footnote">Showing {visible.length} of {items.length} workflows <span>Demo workspace · Data saved locally</span></div></section>
      <div className="callout"><b>✦ This is an early MVP</b><p>Workflow runs are simulated for now. Connectors, scheduled triggers, team accounts, and server-side storage can be added in future releases.</p></div>
      <footer>DEVFLOW · A lightweight workflow workspace <span>Built to make busywork smaller.</span></footer>
    </section></main>
    {creating&&<div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false)}}><form className="modal" onSubmit={create}><button type="button" className="close" onClick={()=>setCreating(false)}>×</button><small className="eyebrow">NEW AUTOMATION</small><h2>Create a workflow</h2><p>Give your workflow a name and choose what it should do.</p><label>Workflow name<input required maxLength={60} autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Send a weekly update"/></label><label>Description<textarea rows={3} maxLength={180} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What should this workflow help you with?"/></label><div className="fields"><label>Trigger<input value={trigger} onChange={e=>setTrigger(e.target.value)}/></label><label>Action<input value={action} onChange={e=>setAction(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="primary">Create workflow</button></div></form></div>}
  </div>;
}
function Stat({label,value,note}:{label:string;value:number;note:string}){return <div className="stat"><small>{label}</small><strong>{value}</strong><p>{note}</p></div>}
