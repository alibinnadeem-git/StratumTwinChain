export type PdfIngestionMode='STANDARD'|'LARGE_SOURCE';

export const PDF_NATIVE_STANDARD_MAX_BYTES=64*1024*1024;
export const PDF_NATIVE_ABSOLUTE_MAX_BYTES=250*1024*1024;

export type PdfIngestionProfile={
 mode:PdfIngestionMode;
 accepted:boolean;
 maxBytes:number;
 maxPages:number;
 maxTextItems:number;
 maxOperatorsPerPage:number;
 maxTotalOperators:number;
 maxAnalysisSegmentsPerPage:number;
 maxAnalysisSegmentsTotal:number;
 maxPolygonsPerPage:number;
 maxActivePathPoints:number;
 maxSourcePlanSegmentsPerPage:number;
 maxSourcePlanSegmentsTotal:number;
 reason:string;
};

export function pdfIngestionProfile(byteSize:number):PdfIngestionProfile{
 const size=Number(byteSize);
 const accepted=Number.isFinite(size)&&size>0&&size<=PDF_NATIVE_ABSOLUTE_MAX_BYTES;
 const large=size>PDF_NATIVE_STANDARD_MAX_BYTES;
 if(large){
  return{
   mode:'LARGE_SOURCE',
   accepted,
   maxBytes:PDF_NATIVE_ABSOLUTE_MAX_BYTES,
   maxPages:240,
   maxTextItems:180000,
   maxOperatorsPerPage:600000,
   maxTotalOperators:3500000,
   maxAnalysisSegmentsPerPage:18000,
   maxAnalysisSegmentsTotal:120000,
   maxPolygonsPerPage:3000,
   maxActivePathPoints:18000,
   maxSourcePlanSegmentsPerPage:2500,
   maxSourcePlanSegmentsTotal:30000,
   reason:accepted
    ?'Large-source mode: preserve the original source, parse sequentially off the UI thread, and retain bounded semantic/vector geometry per page.'
    :`PDF exceeds the ${Math.round(PDF_NATIVE_ABSOLUTE_MAX_BYTES/1024/1024)} MB protected native-ingestion ceiling.`
  };
 }
 return{
  mode:'STANDARD',
  accepted,
  maxBytes:PDF_NATIVE_STANDARD_MAX_BYTES,
  maxPages:120,
  maxTextItems:120000,
  maxOperatorsPerPage:600000,
  maxTotalOperators:2500000,
  maxAnalysisSegmentsPerPage:30000,
  maxAnalysisSegmentsTotal:180000,
  maxPolygonsPerPage:6000,
  maxActivePathPoints:25000,
  maxSourcePlanSegmentsPerPage:4000,
  maxSourcePlanSegmentsTotal:40000,
  reason:accepted?'Standard off-thread native PDF parse.':'PDF size is invalid or exceeds the supported protected-ingestion ceiling.'
 };
}
