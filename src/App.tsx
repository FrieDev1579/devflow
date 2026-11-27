import { FormEvent, useEffect, useMemo, useState } from 'react';

type Workflow = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  active: boolean;
  runs: number;
  updatedAt: string;
  intervalMinutes?: number;
  nextRunAt?: number;
};
type ActivityEvent = {
  id: string;
  type: 'Created' | 'Run' | 'Scheduled run' | 'Paused' | 'Resumed' | 'Deleted';
  workflowName: string;
  details: string;
  createdAt: string;
};

const initial: Workflow[] = [
  { id:'wf-01', name:'Daily task reminder', description:'Create a daily reminder for tasks that are still pending.', trigger:'Manual only', action:'Show an in-app reminder', active:true, runs:24, updatedAt:'Today' },
  { id:'wf-02', name:'New lead follow-up', description:'Prepare a follow-up task when a new lead is added.', trigger:'Manual only', action:'Show an in-app reminder', active:true, runs:12, updatedAt:'Yesterday' },
  { id:'wf-03', name:'Weekly project summary', description:'Collect project notes into a weekly summary draft.', trigger:'Manual only', action:'Show an in-app reminder', active:false, runs:6, updatedAt:'2 days ago' }
];
const KEY='devflow-workflows-v1';
const ACTIVITY_KEY='devflow-activity-v1';

function load(): Workflow[] {
  try {
    const raw=localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : initial;
  } catch { return initial; }
}
function loadActivity(): ActivityEvent[] {
  try {
    const raw=localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function makeId() {
  return typeof crypto!=='undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()+Math.random());
}

export default function App() {
  const [items,setItems]=useState<Workflow[]>(load);
  const [logs,setLogs]=useState<ActivityEvent[]>(loadActivity);
  const [query,setQuery]=useState('');
  const [creating,setCreating]=useState(false);
  const [notice,setNotice]=useState('');
  const [page,setPage]=useState<'overview'|'workflows'|'activity'>('overview');
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [trigger,setTrigger]=useState('manual');
  const [action,setAction]=useState('Show an in-app reminder');
  const [notificationPermission,setNotificationPermission]=useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(items)); },[items]);
  useEffect(()=>{ localStorage.setItem(ACTIVITY_KEY,JSON.stringify(logs)); },[logs]);

  // Lightweight browser-side scheduler. It only runs while this app is open.
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      const now=Date.now();
      const due=items.filter(item=>item.active && item.intervalMinutes && item.nextRunAt && item.nextRunAt<=now);
      if (due.length===0) return;

      const dueIds=new Set(due.map(item=>item.id));
      setItems(current=>current.map(item=>{
        if (!dueIds.has(item.id)) return item;
        const interval=item.intervalMinutes ?? 1;
        return {...item,runs:item.runs+1,updatedAt:'Just now',nextRunAt:now+interval*60_000};
      }));

      const events:ActivityEvent[]=due.map(item=>({
        id:makeId(),
        type:'Scheduled run',
        workflowName:item.name,
        details:'Automatic reminder displayed in DevFlow. A desktop notification is sent when permission is enabled.',
        createdAt:new Date(now).toISOString()
      }));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        due.forEach(item => {
          try {
            new Notification('DevFlow reminder', {
              body: item.name + ' is due.',
              tag: 'devflow-' + item.id
            });
          } catch {
            // Keep the in-app reminder and activity log even if desktop notifications fail.
          }
        });
      }
      setLogs(current=>[...events,...current].slice(0,50));
      setNotice(due.length===1
        ? '⏰ Scheduled reminder: '+due[0].name
        : '⏰ '+due.length+' scheduled workflow reminders are due.');
    },1000);
    return ()=>window.clearInterval(timer);
  },[items,notificationPermission]);

  const visible=useMemo(()=>items.filter(x=>(x.name+' '+x.description).toLowerCase().includes(query.toLowerCase())),[items,query]);
  const active=items.filter(x=>x.active).length;
  const runs=items.reduce((sum,x)=>sum+x.runs,0);

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      setNotice('This browser does not support desktop notifications.');
      return;
    }
    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
      setNotice('Desktop notifications are already enabled.');
      return;
    }
    if (Notification.permission === 'denied') {
      setNotificationPermission('denied');
      setNotice('Notifications are blocked by your browser. Allow them in the site settings, then reload DevFlow.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotice(permission === 'granted'
        ? 'Desktop notifications enabled. You will see a Windows notification when a scheduled workflow is due.'
        : 'Desktop notifications were not enabled. In-app reminders will still work.');
    } catch {
      setNotice('Could not request notification permission. In-app reminders will still work.');
    }
  }

  function record(type:ActivityEvent['type'],workflowName:string,details:string) {
    setLogs(old=>[{id:makeId(),type,workflowName,details,createdAt:new Date().toISOString()},...old].slice(0,50));
  }
  function create(e:FormEvent) {
    e.preventDefault();
    if(!name.trim()) return;
    const intervalMinutes=trigger==='every-1-minute'?1:trigger==='every-5-minutes'?5:undefined;
    const triggerLabel=trigger==='every-1-minute'?'Every 1 minute':trigger==='every-5-minutes'?'Every 5 minutes':'Manual only';
    const workflowName=name.trim();
    const newWorkflow:Workflow={
      id:makeId(),
      name:workflowName,
      description:description.trim()||'A workflow created in DevFlow.',
      trigger:triggerLabel,
      action,
      active:true,
      runs:0,
      updatedAt:'Just now',
      intervalMinutes,
      nextRunAt:intervalMinutes?Date.now()+intervalMinutes*60_000:undefined
    };
    setItems(old=>[newWorkflow,...old]);
    record('Created',workflowName,intervalMinutes
      ? 'Workflow created. It will run '+triggerLabel.toLowerCase()+' while DevFlow is open.'
      : 'Manual workflow created. It runs when you click Run.');
    setName('');
    setDescription('');
    setTrigger('manual');
    setAction('Show an in-app reminder');
    setCreating(false);
    setNotice(intervalMinutes
      ? 'Workflow created. Its first reminder is scheduled in '+intervalMinutes+' minute'+(intervalMinutes===1?'':'s')+'. Keep this tab open.'
      : 'Workflow created. Use Run to trigger it manually.');
  }
  function run(id:string) {
    const item=items.find(x=>x.id===id);
    if(!item) return;
    setItems(old=>old.map(x=>x.id===id?{...x,runs:x.runs+1,updatedAt:'Just now'}:x));
    record('Run',item.name,'Workflow started manually. This MVP displays an in-app reminder; it does not contact external services.');
    setNotice('▶ Workflow run: '+item.name);
  }
  function toggle(id:string) {
    const item=items.find(x=>x.id===id);
    if(!item) return;
    const nextActive=!item.active;
    setItems(old=>old.map(x=>x.id===id?{
      ...x,
      active:nextActive,
      updatedAt:'Just now',
      nextRunAt:nextActive && x.intervalMinutes ? Date.now()+x.intervalMinutes*60_000 : x.nextRunAt
    }:x));
    record(nextActive?'Resumed':'Paused',item.name,nextActive
      ? (item.intervalMinutes?'Workflow reactivated. Its schedule restarts from now.':'Workflow reactivated.')
      : 'Workflow paused. Scheduled runs are stopped.');
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
  const eventClass=(type:ActivityEvent['type'])=>type.toLowerCase().replace(/\s+/g,'-');

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
      {notice&&<div className="notice global-notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      <section className="content">
        {page!=='activity' ? <>
          <div className="welcome"><div><small className="eyebrow">YOUR WORKSPACE</small><h1>Good work starts with a flow.</h1><p>Create, manage, and keep track of the workflows that save you time.</p></div><div className="welcome-actions">
            <button className="secondary notification-button" onClick={enableNotifications} disabled={notificationPermission==='granted' || notificationPermission==='unsupported' || notificationPermission==='denied'}>
              {notificationPermission==='granted'?'✓ Desktop notifications on':notificationPermission==='denied'?'Notifications blocked':notificationPermission==='unsupported'?'Notifications unavailable':'Enable desktop notifications'}
            </button>
            <button className="primary" onClick={()=>setCreating(true)}>＋ New workflow</button>
          </div></div>
          <div className="stats"><Stat label="Total workflows" value={items.length} note="Across your workspace"/><Stat label="Active workflows" value={active} note="Ready to be triggered"/><Stat label="Workflow runs" value={runs} note="Manual and scheduled runs"/></div>
          <section className="panel"><div className="panel-head"><div><h2>Your workflows</h2><p>Manage the automations in your workspace.</p></div><div className="tools"><input aria-label="Search workflows" placeholder="⌕  Search workflows" value={query} onChange={e=>setQuery(e.target.value)}/><button className="secondary" onClick={()=>setQuery('')}>Clear</button></div></div>
            <div className="table-head"><span>WORKFLOW</span><span>TRIGGER</span><span>LAST UPDATED</span><span>STATUS</span><span></span></div>
            {visible.length===0?<div className="empty"><b>No workflows found</b><p>Try another search or create a workflow.</p></div>:visible.map(x=><article className="workflow" key={x.id}><div><b>{x.name}</b><p>{x.description}</p><small className="mobile">{x.trigger} · {x.runs} runs</small></div><span>{x.trigger}</span><span>{x.updatedAt}</span><button className={'pill '+(x.active?'on':'off')} onClick={()=>toggle(x.id)}>{x.active?'● Active':'● Paused'}</button><div className="actions"><button onClick={()=>run(x.id)}>Run</button><button onClick={()=>remove(x.id)} aria-label={'Delete '+x.name}>×</button></div></article>)}
            <div className="footnote">Showing {visible.length} of {items.length} workflows <span>Demo workspace · Data saved locally</span></div>
          </section>
          <div className="callout"><b>✦ Scheduled automation (local MVP)</b><p>New scheduled workflows run while this browser tab is open. They display in-app reminders and write activity events. They do not run when the browser is closed and do not contact external services.</p></div>
        </> : <>
          <div className="welcome"><div><small className="eyebrow">WORKSPACE HISTORY</small><h1>Activity log</h1><p>Review recent workflow actions and scheduled reminders.</p></div><button className="secondary" onClick={()=>setPage('overview')}>← Back to overview</button></div>
          <section className="panel activity-panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Your 50 most recent events are saved in this browser.</p></div><span className="activity-count">{logs.length} / 50 events</span></div>
            {logs.length===0 ? <div className="empty"><b>No activity yet</b><p>Create, pause, resume, or run a workflow. Your actions will appear here.</p></div> :
              <div className="activity-list">{logs.map(event=><article className="activity-item" key={event.id}><span className={'activity-icon '+eventClass(event.type)}>{event.type==='Created'?'＋':event.type==='Run'?'▶':event.type==='Scheduled run'?'⏱':event.type==='Paused'?'Ⅱ':event.type==='Resumed'?'↻':'×'}</span><div className="activity-copy"><div><b>{event.type}: {event.workflowName}</b><time>{formatTime(event.createdAt)}</time></div><p>{event.details}</p></div></article>)}</div>}
          </section>
          <div className="callout"><b>✦ About activity history</b><p>These records are stored in this browser and are not synced across devices. Scheduled runs work only while DevFlow is open.</p></div>
        </>}
        <footer>DEVFLOW · A lightweight workflow workspace <span>Built to make busywork smaller.</span></footer>
      </section>
    </main>
    {creating&&<div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false)}}><form className="modal" onSubmit={create}><button type="button" className="close" onClick={()=>setCreating(false)}>×</button><small className="eyebrow">NEW AUTOMATION</small><h2>Create a workflow</h2><p>Choose a schedule and DevFlow will remind you while this page is open.</p><label>Workflow name<input required maxLength={60} autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Take a screen break"/></label><label>Description<textarea rows={3} maxLength={180} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What should this workflow help you with?"/></label><div className="fields"><label>When should it run?<select value={trigger} onChange={e=>setTrigger(e.target.value)}><option value="manual">Only when I click Run</option><option value="every-1-minute">Every 1 minute (for testing)</option><option value="every-5-minutes">Every 5 minutes</option></select></label><label>What should it do?<select value={action} onChange={e=>setAction(e.target.value)}><option>Show an in-app reminder</option></select></label></div><div className="modal-hint">Scheduled workflows run only while DevFlow is open in this browser.</div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="primary">Create workflow</button></div></form></div>}
  </div>;
}
function Stat({label,value,note}:{label:string;value:number;note:string}){return <div className="stat"><small>{label}</small><strong>{value}</strong><p>{note}</p></div>}
