import { FormEvent, useEffect, useMemo, useState } from 'react';

type Workflow = { id: string; name: string; description: string; trigger: string; action: string; active: boolean; runs: number; updatedAt: string };
type ActivityEvent = { id: string; type: 'Created' | 'Run' | 'Paused' | 'Resumed' | 'Deleted'; workflowName: string; details: string; createdAt: string };

const initial: Workflow[] = [
  { id:'wf-01', name:'Daily task reminder', description:'Create a daily reminder for tasks that are still pending.', trigger:'Every day · 9:00 AM', action:'Create reminder', active:true, runs:24, updatedAt:'Today' },
  { id:'wf-02', name:'New lead follow-up', description:'Prepare a follow-up task when a new lead is added.', trigger:'New lead added', action:'Create follow-up task', active:true, runs:12, updatedAt:'Yesterday' },
  { id:'wf-03', name:'Weekly project summary', description:'Collect project notes into a weekly summary draft.', trigger:'Every Friday', action:'Prepare summary', active:false, runs:6, updatedAt:'2 days ago' }
];
const KEY='devflow-workflows-v1';
const ACTIVITY_KEY='devflow-activity-v1';

function load(): Workflow[] { try { const raw=localStorage.getItem(KEY); return raw ? JSON.parse(raw) as Workflow[] : initial; } catch { return initial; } }
function loadActivity(): ActivityEvent[] { try { const raw=localStorage.getItem(ACTIVITY_KEY); return raw ? JSON.parse(raw) as ActivityEvent[] : []; } catch { return []; } }

export default function App() {
  const [items,setItems]=useState<Workflow[]>(load);
  const [logs,setLogs]=useState<ActivityEvent[]>(loadActivity);
  const [query,setQuery]=useState('');
  const [creating,setCreating]=useState(false);
  const [notice,setNotice]=useState('');
  const [page,setPage]=useState<'overview'|'workflows'|'activity'>('overview');
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [trigger,setTrigger]=useState('When I run it');
  const [action,setAction]=useState('Create a task');

  useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(items)); },[items]);
  useEffect(()=>{ localStorage.setItem(ACTIVITY_KEY,JSON.stringify(logs)); },[logs]);

  const visible=useMemo(()=>items.filter(x=>(x.name+' '+x.description).toLowerCase().includes(query.toLowerCase())),[items,query]);
  const active=items.filter(x=>x.active).length;
  const runs=items.reduce((sum,x)=>sum+x.runs,0);

  function record(type: ActivityEvent['type'], workflowName: string, details: string) {
    setLogs(old=>[{id:typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():String(Date.now()+Math.random()),type,workflowName,details,createdAt:new Date().toISOString()},...old].slice(0,50));
  }
  function create(e:FormEvent) {
    e.preventDefault();
    if(!name.trim()) return;
    const workflowName=name.trim();
    setItems(old=>[{id:typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():String(Date.now()),name:workflowName,description:description.trim()||'A new workflow created in DevFlow.',trigger,action,active:true,runs:0,updatedAt:'Just now'},...old]);
    record('Created',workflowName,'Workflow created and saved in this browser.');
    setName('');setDescription('');setTrigger('When I run it');setAction('Create a task');setCreating(false);setNotice('Workflow created and saved in this browser.');
  }
  function run(id:string) {
    const item=items.find(x=>x.id===id);
    if(!item) return;
    setItems(old=>old.map(x=>x.id===id?{...x,runs:x.runs+1,updatedAt:'Just now'}:x));
    record('Run',item.name,'Workflow run recorded in demo mode. No external service was contacted.');
    setNotice('“'+item.name+'” was run in demo mode. No external service was contacted.');
  }
  function toggle(id:string) {
    const item=items.find(x=>x.id===id);
    if(!item) return;
    const nextActive=!item.active;
    setItems(old=>old.map(x=>x.id===id?{...x,active:nextActive,updatedAt:'Just now'}:x));
    record(nextActive?'Resumed':'Paused',item.name,nextActive?'Workflow reactivated.':'Workflow paused.');
    setNotice(nextActive?'“'+item.name+'” was reactivated.':'“'+item.name+'” was paused.');
  }
  function remove(id:string) {
    const item=items.find(x=>x.id===id);
    if(!item) return;
    setItems(old=>old.filter(x=>x.id!==id));
    record('Deleted',item.name,'Workflow removed from this browser.');
    setNotice('Workflow deleted.');
  }
  function formatTime(value:string) {
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'Just now':date.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }
  const eventClass=(type:ActivityEvent['type'])=>type.toLowerCase();

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark">D</span>devflow</div>
      <p className="side-label">WORKSPACE</p>
      <button className={'nav '+(page==='overview'?'active':'')} onClick={()=>setPage('overview')}>▦ &nbsp; Overview</button>
      <button className={'nav '+(page==='workflows'?'active':'')} onClick={()=>setPage('workflows')}>⌘ &nbsp; Workflows <span>{items.length}</span></button>
      <button className={'nav '+(page==='activity'?'active':'')} onClick={()=>setPage('activity')}>◷ &nbsp; Activity <span>{logs.length}</span></button>
      <div className="side-bottom"><div className="tip"><b>✦ Build better flows</b><p>Start small. Automate the tasks you repeat every day.</p><button onClick={()=>setCreating(true)}>Create a workflow →</button></div><div className="profile"><span className="avatar">D</span><span><b>Demo workspace</b><small>Free plan</small></span></div></div>
    </aside>
    <main>
      <header><span>Workspace　/　<b>{page==='activity'?'Activity':page==='workflows'?'Workflows':'Overview'}</b></span><span className="saved">●　All changes saved</span></header>
      <section className="content">
        {page!=='activity' ? <>
          <div className="welcome"><div><small className="eyebrow">YOUR WORKSPACE</small><h1>Good work starts with a flow.</h1><p>Create, manage, and keep track of the workflows that save you time.</p></div><button className="primary" onClick={()=>setCreating(true)}>＋ New workflow</button></div>
          <div className="stats"><Stat label="Total workflows" value={items.length} note="Across your workspace"/><Stat label="Active workflows" value={active} note="Ready to be triggered"/><Stat label="Demo runs" value={runs} note="Manual test runs"/></div>
          <section className="panel"><div className="panel-head"><div><h2>Your workflows</h2><p>Manage the automations in your workspace.</p></div><div className="tools"><input aria-label="Search workflows" placeholder="⌕  Search workflows" value={query} onChange={e=>setQuery(e.target.value)}/><button className="secondary" onClick={()=>setQuery('')}>Clear</button></div></div>
            {notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
            <div className="table-head"><span>WORKFLOW</span><span>TRIGGER</span><span>LAST UPDATED</span><span>STATUS</span><span></span></div>
            {visible.length===0?<div className="empty"><b>No workflows found</b><p>Try another search or create a workflow.</p></div>:visible.map(x=><article className="workflow" key={x.id}><div><b>{x.name}</b><p>{x.description}</p><small className="mobile">{x.trigger} · {x.runs} demo runs</small></div><span>{x.trigger}</span><span>{x.updatedAt}</span><button className={'pill '+(x.active?'on':'off')} onClick={()=>toggle(x.id)}>{x.active?'● Active':'● Paused'}</button><div className="actions"><button onClick={()=>run(x.id)}>Run</button><button onClick={()=>remove(x.id)} aria-label={'Delete '+x.name}>×</button></div></article>)}
            <div className="footnote">Showing {visible.length} of {items.length} workflows <span>Demo workspace · Data saved locally</span></div>
          </section>
          <div className="callout"><b>✦ This is an early MVP</b><p>Workflow runs are simulated for now. Activity history records actions in this browser. Connectors, scheduled triggers, team accounts, and server-side storage can be added in future releases.</p></div>
        </> : <>
          <div className="welcome"><div><small className="eyebrow">WORKSPACE HISTORY</small><h1>Activity log</h1><p>Review recent workflow actions and demo runs.</p></div><button className="secondary" onClick={()=>setPage('overview')}>← Back to overview</button></div>
          <section className="panel activity-panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Your 50 most recent events are saved in this browser.</p></div><span className="activity-count">{logs.length} / 50 events</span></div>
            {logs.length===0 ? <div className="empty"><b>No activity yet</b><p>Create, pause, resume, or run a workflow. Your actions will appear here.</p></div> :
              <div className="activity-list">{logs.map(event=><article className="activity-item" key={event.id}><span className={'activity-icon '+eventClass(event.type)}>{event.type==='Created'?'＋':event.type==='Run'?'▶':event.type==='Paused'?'Ⅱ':event.type==='Resumed'?'↻':'×'}</span><div className="activity-copy"><div><b>{event.type}: {event.workflowName}</b><time>{formatTime(event.createdAt)}</time></div><p>{event.details}</p></div></article>)}</div>}
          </section>
          <div className="callout"><b>✦ About activity history</b><p>These are local demo records, not server-side execution logs. They stay in this browser and are not synced across devices.</p></div>
        </>}
        <footer>DEVFLOW · A lightweight workflow workspace <span>Built to make busywork smaller.</span></footer>
      </section>
    </main>
    {creating&&<div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false)}}><form className="modal" onSubmit={create}><button type="button" className="close" onClick={()=>setCreating(false)}>×</button><small className="eyebrow">NEW AUTOMATION</small><h2>Create a workflow</h2><p>Give your workflow a name and choose what it should do.</p><label>Workflow name<input required maxLength={60} autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Send a weekly update"/></label><label>Description<textarea rows={3} maxLength={180} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What should this workflow help you with?"/></label><div className="fields"><label>Trigger<input value={trigger} onChange={e=>setTrigger(e.target.value)}/></label><label>Action<input value={action} onChange={e=>setAction(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="primary">Create workflow</button></div></form></div>}
  </div>;
}
function Stat({label,value,note}:{label:string;value:number;note:string}){return <div className="stat"><small>{label}</small><strong>{value}</strong><p>{note}</p></div>}
