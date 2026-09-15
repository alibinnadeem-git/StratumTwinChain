export const PHYSICAL_IDENTITY_TRUTH_BOUNDARY='CODE_LOOKUP_DOES_NOT_ESTABLISH_PHYSICAL_IDENTITY_OR_VERIFIED_STATE' as const;

export type IdentityLookupMatch='ASSET_ID'|'ASSET_CODE'|'SERIAL_NUMBER'|'QR_TOKEN';
export type IdentityCaptureMethod='MANUAL_ENTRY'|'CAMERA_CODE';

export type PhysicalIdentityAssurance={
 level:'LOOKUP_ONLY';
 lookupMatch:IdentityLookupMatch;
 physicalBinding:'UNVERIFIED';
 cloneResistance:'NONE_FOR_PRINTED_CODE';
 challengeResponse:'NOT_PERFORMED';
 nfcChallengeCapable:false;
 truthBoundary:typeof PHYSICAL_IDENTITY_TRUTH_BOUNDARY;
 warning:string;
};

export function lookupOnlyAssurance(lookupMatch:IdentityLookupMatch):PhysicalIdentityAssurance{
 return{
  level:'LOOKUP_ONLY',
  lookupMatch,
  physicalBinding:'UNVERIFIED',
  cloneResistance:'NONE_FOR_PRINTED_CODE',
  challengeResponse:'NOT_PERFORMED',
  nfcChallengeCapable:false,
  truthBoundary:PHYSICAL_IDENTITY_TRUTH_BOUNDARY,
  warning:'Printed QR and barcode values can be copied or replayed. A successful lookup identifies a registry record only; it does not prove that the code is attached to the authentic physical asset.'
 };
}
