import type {PDFPageProxy,TextContent,getTextContentParameters} from 'pdfjs-dist/types/src/display/api';

/** Read text without depending on ReadableStream async iteration, absent in shipping Safari builds. */
export async function readPdfTextContent(
 page:Pick<PDFPageProxy,'isPureXfa'|'streamTextContent'|'getTextContent'>,
 params:getTextContentParameters={},
):Promise<TextContent>{
 // PDF.js handles pure XFA through getXfa(), without iterating a text stream.
 if(page.isPureXfa)return page.getTextContent(params);
 const reader=page.streamTextContent(params).getReader();
 const content:TextContent={items:[],styles:Object.create(null),lang:null};
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)return content;
   content.lang??=value.lang;
   Object.assign(content.styles,value.styles);
   content.items.push(...value.items);
  }
 }catch(error){
  // Stop the producer if aggregation fails, preserving the original exception if cancel rejects.
  try{await reader.cancel(error)}catch{}
  throw error;
 }finally{reader.releaseLock()}
}
