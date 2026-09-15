import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const contract=read('lib/physical-identity.ts');
const resolver=read('app/api/assets/resolve/route.ts');
const scanner=read('components/FieldScanner.tsx');

const checks=[
 ['physical identity assurance remains lookup-only',contract.includes("level:'LOOKUP_ONLY'")],
 ['printed codes have no clone resistance claim',contract.includes("cloneResistance:'NONE_FOR_PRINTED_CODE'")],
 ['printed code physical binding remains unverified',contract.includes("physicalBinding:'UNVERIFIED'")],
 ['challenge-response is explicitly not performed',contract.includes("challengeResponse:'NOT_PERFORMED'")],
 ['future NFC challenge is not claimed active',contract.includes('nfcChallengeCapable:false')],
 ['contract denies physical identity and Verified-state authority',contract.includes('CODE_LOOKUP_DOES_NOT_ESTABLISH_PHYSICAL_IDENTITY_OR_VERIFIED_STATE')],
 ['resolver remains authenticated',resolver.includes('requireSession()')],
 ['resolver remains organization scoped',resolver.includes('a.organization_id=$2')&&resolver.includes('session.organizationId')],
 ['resolver server-determines asset id match',resolver.includes("WHEN a.id::text=$1 THEN 'ASSET_ID'")],
 ['resolver server-determines asset code match',resolver.includes("WHEN a.asset_code=$1 THEN 'ASSET_CODE'")],
 ['resolver server-determines serial match',resolver.includes("WHEN a.serial_number=$1 THEN 'SERIAL_NUMBER'")],
 ['resolver returns lookup-only assurance',resolver.includes('identityAssurance:lookupOnlyAssurance(lookupMatch)')],
 ['scanner distinguishes camera capture from manual entry',scanner.includes("'CAMERA_CODE'")&&scanner.includes("'MANUAL_ENTRY'")],
 ['scanner warns ordinary printed codes can be copied or replayed',scanner.includes('Printed codes can be copied or replayed')],
 ['scanner keeps physical binding unverified in UI',scanner.includes('physical binding')&&scanner.includes('assurance.physicalBinding')],
 ['scanner says challenge response is not active',scanner.includes('Challenge-response:')&&scanner.includes('NFC / secure hardware challenge is not active')],
 ['scanner denies scan authority over physical identity and finality',scanner.includes('does not establish physical identity, Verified state, DIR finality, PoVI finality, or physical truth')],
 ['scanner has no lifecycle approval or chain mutation calls',!scanner.includes("fetch('/api/approvals")&&!scanner.includes("fetch('/api/lifecycle")&&!scanner.includes("fetch('/api/chain")],
];

let failed=0;
for(const [name,ok] of checks){
 console.log(`${ok?'✓':'✗'} ${name}`);
 if(!ok)failed++;
}
if(failed){
 console.error(`\nPhysical identity assurance contract failed: ${failed} assertion(s).`);
 process.exit(1);
}
console.log('\nPhysical identity LOOKUP_ONLY and clone-warning contract passed.');
