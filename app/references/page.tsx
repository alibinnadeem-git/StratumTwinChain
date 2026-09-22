import EngineeringReferencesPanel from '@/components/EngineeringReferencesPanel';

export const dynamic='force-dynamic';

export default function EngineeringReferencesPage(){return <>
 <div className="page-head"><div><div className="eyebrow">Engineering</div><h1 className="title">Standards & OEM references.</h1><p className="subtitle">Keep publisher references, project/AHJ applicability and OEM/project authority explicit and traceable.</p></div></div>
 <EngineeringReferencesPanel/>
 </>}
