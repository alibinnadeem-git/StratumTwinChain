import './globals.css';
import './responsive.css';
import './redbook.css';
import './task-ui.css';
import './accessibility.css';
import Shell from '@/components/Shell';
import SpatialPersistenceGuard from '@/components/SpatialPersistenceGuard';
import {STRATUM_PRODUCT} from '@/lib/redbook/terminology';

export const metadata={
 title:STRATUM_PRODUCT,
 description:'Spatial infrastructure representation, evidence-backed lifecycle, provenance and Digital Immutable Records (DIRs) for STRATUM Power.'
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><SpatialPersistenceGuard/><Shell>{children}</Shell></body></html>
}
