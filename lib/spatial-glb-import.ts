export const MAX_EMBEDDED_GLB_BYTES=512*1024;

export function inspectStandaloneGlb(bytes:ArrayBuffer){
  if(bytes.byteLength>MAX_EMBEDDED_GLB_BYTES)throw new Error('This GLB exceeds the 512 KB browser/server snapshot limit. Use a smaller self-contained GLB; the file was not added.');
  if(bytes.byteLength<20)throw new Error('GLB file is too short.');
  const view=new DataView(bytes);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)
    throw new Error('Expected a complete binary glTF 2.0 (GLB) file.');
  const length=view.getUint32(12,true);
  if(length<2||length%4!==0||length+20>bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)
    throw new Error('GLB JSON chunk is invalid.');
  let document:Record<string,unknown>;
  try{document=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length))) as Record<string,unknown>}
  catch{throw new Error('GLB scene JSON could not be read.');}
  if((document.asset as {version?:string}|undefined)?.version?.split('.')[0]!=='2')throw new Error('GLB must use glTF 2.0.');
  for(const item of [...(Array.isArray(document.buffers)?document.buffers:[]),...(Array.isArray(document.images)?document.images:[])]){
    const uri=(item as {uri?:unknown})?.uri;
    if(uri!==undefined&&(typeof uri!=='string'||!uri.startsWith('data:')))
      throw new Error('GLB references external resources. Export a self-contained GLB instead.');
  }
  return{bytes:new Uint8Array(bytes),document};
}

export function encodeGlbBase64(bytes:Uint8Array){
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}

export function decodeGlbBase64(encoded:string){
  const binary=atob(encoded);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes.buffer;
}
