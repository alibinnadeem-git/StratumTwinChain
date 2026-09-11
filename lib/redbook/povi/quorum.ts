export function requiredPoviQuorum(activeValidatorCount:number):number{
 if(!Number.isInteger(activeValidatorCount)||activeValidatorCount<1){
  throw new Error('activeValidatorCount must be a positive integer');
 }
 return Math.floor((2*activeValidatorCount)/3)+1;
}

export function hasPoviQuorum(activeValidatorCount:number,uniqueValidSignerCount:number):boolean{
 if(!Number.isInteger(uniqueValidSignerCount)||uniqueValidSignerCount<0){
  throw new Error('uniqueValidSignerCount must be a non-negative integer');
 }
 return uniqueValidSignerCount>=requiredPoviQuorum(activeValidatorCount);
}

export function assertPoviQuorum(activeValidatorIds:Iterable<string>,signerIds:Iterable<string>):void{
 const active=new Set(activeValidatorIds);
 if(active.size<1)throw new Error('PoVI requires at least one ACTIVE validator');
 const validSigners=new Set([...signerIds].filter(id=>active.has(id)));
 const required=requiredPoviQuorum(active.size);
 if(validSigners.size<required){
  throw new Error(`PoVI quorum not met: ${validSigners.size}/${active.size} valid signatures; ${required} required`);
 }
}
