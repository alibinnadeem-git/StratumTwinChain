import './globals.css';
import './responsive.css';
import Shell from '@/components/Shell';

export const metadata={title:'STRATUM Verified',description:'Verified infrastructure lifecycle, digital twin and Digital Immutable Records (DIR)'};

export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body><Shell>{children}</Shell></body></html>
}
