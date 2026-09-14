import './globals.css';
import './responsive.css';
import './redbook.css';
import './semantic-tokens.css';
import Shell from '@/components/Shell';
import {STRATUM_PRODUCT} from '@/lib/redbook/terminology';

export const metadata={
 title:STRATUM_PRODUCT,
 description:'Spatial infrastructure representation, evidence-backed lifecycle, provenance and Digital Immutable Records (DIRs) for STRATUM Electric.'
};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><Shell>{children}</Shell></body></html>
}
