export type DatabaseTlsRuntime={
 connectionString:string;
 ssl:{rejectUnauthorized:boolean}|undefined;
};

export function resolveDatabaseTlsRuntime(
 connectionString:string,
 production=process.env.NODE_ENV==='production',
):DatabaseTlsRuntime{
 try{
  const parsed=new URL(connectionString);
  if(!/^postgres(?:ql)?:$/i.test(parsed.protocol)){
   return{connectionString,ssl:production?{rejectUnauthorized:false}:undefined};
  }

  const mode=(parsed.searchParams.get('sslmode')||'').trim().toLowerCase();
  const neon=/\.neon\.tech$/i.test(parsed.hostname);

  if(mode==='disable')return{connectionString:parsed.toString(),ssl:undefined};

  if(mode==='prefer'||mode==='require'||mode==='verify-ca'){
   parsed.searchParams.set('sslmode','verify-full');
   return{connectionString:parsed.toString(),ssl:{rejectUnauthorized:true}};
  }

  if(mode==='verify-full'){
   return{connectionString:parsed.toString(),ssl:{rejectUnauthorized:true}};
  }

  if(!mode&&production&&neon){
   parsed.searchParams.set('sslmode','verify-full');
   return{connectionString:parsed.toString(),ssl:{rejectUnauthorized:true}};
  }

  return{
   connectionString:parsed.toString(),
   ssl:production?{rejectUnauthorized:false}:undefined,
  };
 }catch{
  return{connectionString,ssl:production?{rejectUnauthorized:false}:undefined};
 }
}
