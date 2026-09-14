import type {Role} from '@/lib/auth/permissions';

export type HomeAction={href:string;label:string;description:string};
export type HomeSurface={eyebrow:string;title:string;description:string;actions:HomeAction[]};

const surfaces:Record<Role,HomeSurface>={
 SUPER_ADMIN:{
  eyebrow:'Program command',
  title:'See what needs attention across STRATUM.',
  description:'Start with delivery exceptions, verification state and the infrastructure context behind them. Specialist tools stay one level deeper in Library.',
  actions:[
   {href:'/sites',label:'Open sites',description:'Review active infrastructure and project context.'},
   {href:'/workflows',label:'Review work',description:'See execution, approvals and exceptions.'},
   {href:'/verify',label:'Verify records',description:'Inspect trust and verification outcomes.'},
   {href:'/library',label:'Open Library',description:'Reach engineering, evidence and administration tools.'}
  ]
 },
 ORG_ADMIN:{
  eyebrow:'Organization operations',
  title:'Manage delivery without losing infrastructure context.',
  description:'Focus on sites, active work and exceptions first; configuration and specialist tools remain available through Library.',
  actions:[
   {href:'/sites',label:'Open sites',description:'Review site status and infrastructure scope.'},
   {href:'/workflows',label:'Review work',description:'Manage active execution and approvals.'},
   {href:'/verify',label:'Verification status',description:'Review trust outcomes and unresolved evidence.'},
   {href:'/admin',label:'Administration',description:'Manage organization access and settings.'}
  ]
 },
 PROJECT_MANAGER:{
  eyebrow:'Project delivery',
  title:'Move the project forward from one operating view.',
  description:'See site context, assigned work, verification blockers and closeout readiness without switching between separate products.',
  actions:[
   {href:'/sites',label:'Project sites',description:'Open the physical and system context.'},
   {href:'/workflows',label:'Active work',description:'Review tasks, approvals and blockers.'},
   {href:'/handover',label:'Turnover readiness',description:'See evidence-backed closeout readiness.'},
   {href:'/verify',label:'Verification status',description:'Resolve trust and evidence gaps.'}
  ]
 },
 TECHNICIAN:{
  eyebrow:'My field work',
  title:'Do the next job, capture the evidence, move on.',
  description:'Field work is task-first: open assigned work, identify the asset, capture evidence and submit without navigating the wider platform.',
  actions:[
   {href:'/workflows',label:'My work',description:'Open assigned and due field tasks.'},
   {href:'/assets',label:'Find asset',description:'Open the asset and its current context.'},
   {href:'/evidence',label:'Evidence',description:'Capture and review task evidence.'},
   {href:'/verify',label:'Submission status',description:'See what is accepted or still needs review.'}
  ]
 },
 CLIENT:{
  eyebrow:'Client assurance',
  title:'See what exists, what changed and what is verified.',
  description:'Client access prioritizes understandable site status, asset history, evidence and verification rather than internal execution controls.',
  actions:[
   {href:'/sites',label:'Sites',description:'Review delivered infrastructure by site.'},
   {href:'/assets',label:'Assets',description:'Inspect asset identity and lifecycle history.'},
   {href:'/handover',label:'Handover',description:'Review turnover readiness and closeout evidence.'},
   {href:'/verify',label:'Verify',description:'Inspect verification outcomes.'}
  ]
 },
 INSPECTOR:{
  eyebrow:'Inspection & approval',
  title:'Review the evidence that requires qualified judgment.',
  description:'Inspection work starts with pending decisions and keeps the affected asset, source evidence and trust state in context.',
  actions:[
   {href:'/workflows',label:'Pending reviews',description:'Open inspection and approval work.'},
   {href:'/evidence',label:'Evidence',description:'Review source evidence for the decision.'},
   {href:'/assets',label:'Affected assets',description:'Inspect asset and system context.'},
   {href:'/verify',label:'Verification',description:'Confirm resulting trust state.'}
  ]
 },
 VIEWER:{
  eyebrow:'Verified infrastructure',
  title:'Understand the infrastructure without operational controls.',
  description:'Read-only access focuses on sites, assets and verification outcomes with advanced tooling kept out of the way.',
  actions:[
   {href:'/sites',label:'Sites',description:'Browse available site context.'},
   {href:'/assets',label:'Assets',description:'Inspect infrastructure records.'},
   {href:'/verify',label:'Verify',description:'Review public verification outcomes.'},
   {href:'/library',label:'Library',description:'Open available read-only specialist views.'}
  ]
 }
};

export const homeSurfaceFor=(role:Role)=>surfaces[role];
