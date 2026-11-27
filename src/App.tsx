import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type Workflow = {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  actionType?: 'reminder' | 'webhook';
  webhookUrl?: string;
  active: boolean;
  runs: number;
  updatedAt: string;
  intervalMinutes?: number;
  nextRunAt?: number;
};
type ActivityEvent = {
  id: string;
  type: string;
  workflowName: string;
  details: string;
  createdAt: string;
};
type ApiState = { workflows: Workflow[]; activity: ActivityEvent[] };

const KEY='devflow-workflows-v1';
const ACTIVITY_KEY='devflow-activity-v1';

function load(): Workflow[] {
  try {
    const raw=localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function loadActivity(): ActivityEvent[] {
  try {
    const raw=localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
async function apiRequest(path:string, options:RequestInit = {}):Promise<ApiState> {
  const response=await fetch(path,{
    ...options,
    headers:{'Content-Type':'application/json',...(options.headers || {})}
  });
  const result=await response.json().catch(()=>({error:'The backend returned an unreadable response.'}));
  if (!response.ok) throw new Error(result.error || 'The backend request failed.');
  return result as ApiState;
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
  const [actionType,setActionType]=useState<'reminder'|'webhook'>('reminder');
  const [webhookUrl,setWebhookUrl]=useState('');
  const [notificationPermission,setNotificationPermission]=useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [backendStatus,setBackendStatus]=useState<'connecting'|'online'|'offline'>('connecting');
  const seenEvents=useRef<Set<string>>(new Set());

  useEffect(()=>{
    let mounted=true;
    async function connect() {
      try {
        let remote=await apiRequest('/api/state');
        const localWorkflows=load();
        const localActivity=loadActivity();
        if (remote.workflows.length===0 && (localWorkflows.length>0 || localActivity.length>0)) {
          remote=await apiRequest('/api/state/import',{
            method:'POST',
            body:JSON.stringify({workflows:localWorkflows,activity:localActivity})
          });
        }
        if (!mounted) return;
        seenEvents.current=new Set(remote.activity.map(event=>event.id));
        setItems(remote.workflows);
        setLogs(remote.activity);
        setBackendStatus('online');
        setNotice('Connected to the DevFlow backend. Workflows are stored on this computer.');
      } catch {
        if (!mounted) return;
        setBackendStatus('offline');
        setNotice('Backend not connected. Start DevFlow with npm.cmd run dev from the project folder.');
      }
    }
    connect();
    return ()=>{mounted=false;};
  },[]);

  useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(items)); },[items]);
  useEffect(()=>{ localStorage.setItem(ACTIVITY_KEY,JSON.stringify(logs)); },[logs]);

  useEffect(()=>{
    if (backendStatus!=='online') return;
    let mounted=true;
    async function refresh() {
      try {
        const remote=await apiRequest('/api/state');
        if (!mounted) return;
        const freshEvents=remote.activity.filter(event=>
          !seenEvents.current.has(event.id) &&
          (event.type==='Scheduled run' || event.type==='Webhook delivered' || event.type==='Webhook failed')
        );
        if (notificationPermission==='granted' && typeof Notification!=='undefined') {
          freshEvents.forEach(event=>{
            try {
              new Notification(event.type==='Webhook failed'?'DevFlow webhook failed':'DevFlow workflow completed',{
                body:event.workflowName+': '+event.details,
                tag:'devflow-'+event.id
              });
            } catch {
              // Activity remains available even if the browser suppresses a notification.
            }
          });
        }
        seenEvents.current=new Set(remote.activity.map(event=>event.id));
        setItems(remote.workflows);
        setLogs(remote.activity);
      } catch {
        if (mounted) {
          setBackendStatus('offline');
          setNotice('Lost connection to the DevFlow backend. Check the terminal running DevFlow.');
        }
      }
    }
    const timer=window.setInterval(refresh,2500);
    return ()=>{mounted=false;window.clearInterval(timer);};
  },[backendStatus,notificationPermission]);

  const visible=useMemo(()=>items.filter(x=>(x.name+' '+x.description).toLowerCase().includes(query.toLowerCase())),[items,query]);
  const active=items.filter(x=>x.active).length;
  const runs=items.reduce((sum,x)=>sum+x.runs,0);

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      setNotice('This browser does not support desktop notifications.');
      return;
    }
    if (Notification.permission==='granted') {
      setNotificationPermission('granted');
      setNotice('Desktop notifications are already enabled.');
      return;
    }
    if (Notification.permission==='denied') {
      setNotificationPermission('denied');
      setNotice('Notifications are blocked by your browser. Allow them in the site settings, then reload DevFlow.');
      return;
    }
    try {
      const permission=await Notification.requestPermission();
      setNotificationPermission(permission);
      setNotice(permission==='granted'
        ? 'Desktop notifications enabled. Notifications arrive while this page is open and connected to the backend.'
        : 'Desktop notifications were not enabled. Scheduled events will still be saved in Activity.');
    } catch {
      setNotice('Could not request notification permission. Activity will still be saved.');
    }
  }

  async function create(e:FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (actionType==='webhook') {
      try {
        const parsed=new URL(webhookUrl.trim());
        if (parsed.protocol!=='https:' || !parsed.hostname) throw new Error('Enter a valid HTTPS URL.');
      } catch {
        setNotice('Enter a valid public HTTPS webhook URL beginning with https://');
        return;
      }
    }
    const intervalMinutes=trigger==='every-1-minute'?1:trigger==='every-5-minutes'?5:undefined;
    try {
      const remote=await apiRequest('/api/workflows',{
        method:'POST',
        body:JSON.stringify({
          name:name.trim(),
          description:description.trim(),
          intervalMinutes,
          actionType,
          webhookUrl:actionType==='webhook'?webhookUrl.trim():''
        })
      });
      setItems(remote.workflows);
      setLogs(remote.activity);
      seenEvents.current=new Set(remote.activity.map(event=>event.id));
      setName('');
      setDescription('');
      setTrigger('manual');
      setActionType('reminder');
      setWebhookUrl('');
      setCreating(false);
      setNotice(actionType==='webhook'
        ? 'Webhook workflow saved. Click Run to send a test POST to your endpoint.'
        : intervalMinutes
          ? 'Scheduled reminder saved on the backend.'
          : 'Workflow saved on the DevFlow backend.');
    } catch (error) {
      setNotice(error instanceof Error?error.message:'Could not create the workflow.');
    }
  }

  async function run(id:string) {
    try {
      const remote=await apiRequest('/api/workflows/'+encodeURIComponent(id)+'/run',{method:'POST'});
      setItems(remote.workflows);
      setLogs(remote.activity);
      seenEvents.current=new Set(remote.activity.map(event=>event.id));
      const latest=remote.activity[0];
      setNotice(latest?.details || 'Workflow action completed.');
    } catch (error) {
      setNotice(error instanceof Error?error.message:'Could not run the workflow.');
    }
  }

  async function toggle(id:string) {
    const item=items.find(x=>x.id===id);
    if (!item) return;
    try {
      const remote=await apiRequest('/api/workflows/'+encodeURIComponent(id),{
        method:'PATCH',
        body:JSON.stringify({active:!item.active})
      });
      setItems(remote.workflows);
      setLogs(remote.activity);
      seenEvents.current=new Set(remote.activity.map(event=>event.id));
      setNotice(item.active?'Workflow paused on the backend.':'Workflow resumed on the backend.');
    } catch (error) {
      setNotice(error instanceof Error?error.message:'Could not update the workflow.');
    }
  }

  async function remove(id:string) {
    try {
      const remote=await apiRequest('/api/workflows/'+encodeURIComponent(id),{method:'DELETE'});
      setItems(remote.workflows);
      setLogs(remote.activity);
      seenEvents.current=new Set(remote.activity.map(event=>event.id));
      setNotice('Workflow deleted from the backend.');
    } catch (error) {
      setNotice(error instanceof Error?error.message:'Could not delete the workflow.');
    }
  }

  function formatTime(value:string) {
    const date=new Date(value);
    return Number.isNaN(date.getTime())?'Just now':date.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }
  const eventClass=(type:string)=>type.toLowerCase().replace(/\s+/g,'-');
  const eventIcon=(type:string)=>type==='Created'?'＋':type==='Run'?'▶':type==='Scheduled run'?'⏱':type==='Webhook delivered'?'✓':type==='Webhook failed'?'!':type==='Paused'?'Ⅱ':type==='Resumed'?'↻':'×';

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><span className="mark">D</span>devflow</div>
      <p className="side-label">WORKSPACE</p>
      <button className={'nav '+(page==='overview'?'active':'')} onClick={()=>setPage('overview')}>▦ &nbsp; Overview</button>
      <button className={'nav '+(page==='workflows'?'active':'')} onClick={()=>setPage('workflows')}>⌘ &nbsp; Workflows <span>{items.length}</span></button>
      <button className={'nav '+(page==='activity'?'active':'')} onClick={()=>setPage('activity')}>◷ &nbsp; Activity <span>{logs.length}</span></button>
      <div className="side-bottom"><div className="tip"><b>✦ Build better flows</b><p>Start small. Automate the tasks you repeat every day.</p><button onClick={()=>setCreating(true)}>Create a workflow →</button></div><div className="profile"><span className="avatar">D</span><span><b>Demo workspace</b><small>Local server</small></span></div></div>
    </aside>
    <main>
      <header><span>Workspace　/　<b>{page==='activity'?'Activity':page==='workflows'?'Workflows':'Overview'}</b></span><span className={backendStatus==='online'?'saved':'backend-status'}>{backendStatus==='online'?'● Backend online':backendStatus==='connecting'?'◌ Connecting to backend':'● Backend offline'}</span></header>
      {notice&&<div className="notice global-notice" role="status">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
      <section className="content">
        {page!=='activity' ? <>
          <div className="welcome"><div><small className="eyebrow">YOUR WORKSPACE</small><h1>Good work starts with a flow.</h1><p>Create, manage, and keep track of the workflows that save you time.</p></div><div className="welcome-actions">
            <button className="secondary notification-button" onClick={enableNotifications} disabled={notificationPermission==='granted'||notificationPermission==='unsupported'||notificationPermission==='denied'}>
              {notificationPermission==='granted'?'✓ Desktop notifications on':notificationPermission==='denied'?'Notifications blocked':notificationPermission==='unsupported'?'Notifications unavailable':'Enable desktop notifications'}
            </button>
            <button className="primary" onClick={()=>setCreating(true)} disabled={backendStatus!=='online'}>＋ New workflow</button>
          </div></div>
          <div className="stats"><Stat label="Total workflows" value={items.length} note="Saved on this computer"/><Stat label="Active workflows" value={active} note="Ready to be triggered"/><Stat label="Workflow runs" value={runs} note="Manual and scheduled runs"/></div>
          <section className="panel"><div className="panel-head"><div><h2>Your workflows</h2><p>Manage the automations in your workspace.</p></div><div className="tools"><input aria-label="Search workflows" placeholder="⌕  Search workflows" value={query} onChange={e=>setQuery(e.target.value)}/><button className="secondary" onClick={()=>setQuery('')}>Clear</button></div></div>
            <div className="table-head"><span>WORKFLOW</span><span>TRIGGER</span><span>LAST UPDATED</span><span>STATUS</span><span></span></div>
            {visible.length===0?<div className="empty"><b>No workflows found</b><p>Create a workflow to get started.</p></div>:visible.map(x=><article className="workflow" key={x.id}><div><b>{x.name}</b><p>{x.description}</p><small className="workflow-action">{x.actionType==='webhook'?'Action: Send webhook':'Action: Record reminder'}</small><small className="mobile">{x.trigger} · {x.runs} runs</small></div><span>{x.trigger}</span><span>{x.updatedAt}</span><button className={'pill '+(x.active?'on':'off')} onClick={()=>toggle(x.id)} disabled={backendStatus!=='online'}>{x.active?'● Active':'● Paused'}</button><div className="actions"><button onClick={()=>run(x.id)} disabled={backendStatus!=='online'}>Run</button><button onClick={()=>remove(x.id)} disabled={backendStatus!=='online'} aria-label={'Delete '+x.name}>×</button></div></article>)}
            <div className="footnote">Showing {visible.length} of {items.length} workflows <span>Backend storage · Local computer</span></div>
          </section>
          <div className="callout"><b>✦ Real workflow actions</b><p>Reminder workflows add an activity record. Webhook workflows send an HTTP POST to your configured public HTTPS endpoint when manually run or scheduled. Your backend must remain running.</p></div>
        </> : <>
          <div className="welcome"><div><small className="eyebrow">WORKSPACE HISTORY</small><h1>Activity log</h1><p>Review recent workflow actions and scheduled runs.</p></div><button className="secondary" onClick={()=>setPage('overview')}>← Back to overview</button></div>
          <section className="panel activity-panel"><div className="panel-head"><div><h2>Recent activity</h2><p>Your 100 most recent events are saved by the backend.</p></div><span className="activity-count">{logs.length} / 100 events</span></div>
            {logs.length===0 ? <div className="empty"><b>No activity yet</b><p>Create, pause, resume, or run a workflow. Your actions will appear here.</p></div> :
              <div className="activity-list">{logs.map(event=><article className="activity-item" key={event.id}><span className={'activity-icon '+eventClass(event.type)}>{eventIcon(event.type)}</span><div className="activity-copy"><div><b>{event.type}: {event.workflowName}</b><time>{formatTime(event.createdAt)}</time></div><p>{event.details}</p></div></article>)}</div>}
          </section>
          <div className="callout"><b>✦ About backend history</b><p>These records are saved in the project's data folder on this computer. They remain available after closing Chrome or restarting DevFlow.</p></div>
        </>}
        <footer>DEVFLOW · A lightweight workflow workspace <span>Built to make busywork smaller.</span></footer>
      </section>
    </main>
    {creating&&<div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setCreating(false)}}><form className="modal" onSubmit={create}><button type="button" className="close" onClick={()=>setCreating(false)}>×</button><small className="eyebrow">NEW AUTOMATION</small><h2>Create a workflow</h2><p>Choose a trigger and action for this workflow.</p><label>Workflow name<input required maxLength={60} autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Send a weekly update"/></label><label>Description<textarea rows={3} maxLength={180} value={description} onChange={e=>setDescription(e.target.value)} placeholder="What should this workflow help you with?"/></label><div className="fields"><label>When should it run?<select value={trigger} onChange={e=>setTrigger(e.target.value)}><option value="manual">Only when I click Run</option><option value="every-1-minute">Every 1 minute (for testing)</option><option value="every-5-minutes">Every 5 minutes</option></select></label><label>What should it do?<select value={actionType} onChange={e=>setActionType(e.target.value as 'reminder'|'webhook')}><option value="reminder">Record a reminder</option><option value="webhook">Send a webhook (HTTP POST)</option></select></label></div>
      {actionType==='webhook'&&<label>Webhook URL (public HTTPS)<input type="url" required value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} placeholder="https://your-service.com/webhook"/><small className="field-help">DevFlow sends a JSON POST containing the workflow name, ID, trigger, and run time. Use only an endpoint you trust.</small></label>}
      <div className="modal-hint">{actionType==='webhook'?'Webhook endpoints must use a public HTTPS hostname. Private/local network addresses and redirects are blocked.':'This action records a reminder in the backend Activity Log.'} Scheduled workflows run while the DevFlow backend is running.</div><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setCreating(false)}>Cancel</button><button className="primary">Create workflow</button></div></form></div>}
  </div>;
}
function Stat({label,value,note}:{label:string;value:number;note:string}){return <div className="stat"><small>{label}</small><strong>{value}</strong><p>{note}</p></div>}
