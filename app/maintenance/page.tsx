import Link from 'next/link';

const rows=[['TX-04 Annual PM','AI Infrastructure Campus','Sep 03','Assigned'],['EV Charger Bank C Inspection','Autonomous Mobility Hub','Aug 26','Due'],['UPS-2A Battery Test','Data Center West','Sep 11','Scheduled'],['SG-01 Thermal Scan','Santa Teresa Medical Campus','Sep 18','Scheduled']];

export default function Maintenance(){return <>
  <div className="page-head"><div><div className="eyebrow">STRATUM Operate · Lifecycle Management</div><h1 className="title">Maintenance</h1><p className="subtitle">Preventive, corrective and predictive maintenance become part of each asset’s permanent verified history.</p></div><Link href="/predictive" className="badge">Predictive health →</Link></div>
  <div className="grid stats" style={{marginTop:20}}><div className="card"><div className="eyebrow">Preventive</div><h2>Planned work</h2><p className="subtitle">Calendar and usage-driven maintenance.</p></div><div className="card"><div className="eyebrow">Predictive</div><h2>Health & risk</h2><p className="subtitle">Telemetry, baselines, anomaly detection and failure impact.</p></div><div className="card"><div className="eyebrow">Corrective</div><h2>Fault response</h2><p className="subtitle">Issues, repairs, evidence and close-out.</p></div><div className="card"><div className="eyebrow">Trust</div><h2>Verified outcome</h2><p className="subtitle">Approved maintenance events can be anchored to STRATUM Chain.</p></div></div>
  <div className="card" style={{marginTop:20}}><table className="table"><thead><tr><th>Work</th><th>Site</th><th>Due</th><th>Status</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}>{r.map(c=><td key={c}>{c}</td>)}</tr>)}</tbody></table></div>
</>}
