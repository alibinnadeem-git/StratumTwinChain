/// <reference lib="webworker" />

type XY={x:number;y:number};
type Segment={x:number;y:number;x2:number;y2:number};
type Polygon={vertices:XY[];confidence:number};
type Ops={
 save:number;restore:number;transform:number;paintFormXObjectBegin:number;paintFormXObjectEnd:number;
 constructPath:number;moveTo:number;lineTo:number;rectangle:number;closePath:number;
};
type VectorWorkerRequest={
 type:'NORMALIZE';
 fnArray:number[];
 argsArray:unknown[][];
 viewport:{width:number;height:number;transform:number[]};
 ops:Ops;
 maxOps:number;
 maxSegments:number;
};
type VectorWorkerResponse=
 |{type:'DONE';pageOps:number;segments:Segment[];polygons:Polygon[]}
 |{type:'ERROR';code:'OP_BUDGET'|'SEGMENT_BUDGET'|'INVALID_INPUT'|'WORKER_ERROR';message:string};

const ctx=self as unknown as DedicatedWorkerGlobalScope;

function postError(code:'OP_BUDGET'|'SEGMENT_BUDGET'|'INVALID_INPUT'|'WORKER_ERROR',message:string){
 const payload:Extract<VectorWorkerResponse,{type:'ERROR'}>={type:'ERROR',code,message};
 ctx.postMessage(payload);
}

ctx.onmessage=(event:MessageEvent<VectorWorkerRequest>)=>{
 try{
  const data=event.data;
  if(!data||data.type!=='NORMALIZE'||!Array.isArray(data.fnArray)||!Array.isArray(data.argsArray)){
   postError('INVALID_INPUT','PDF vector normalization received invalid operator data.');
   return;
  }
  const pageOps=data.fnArray.length;
  if(pageOps>data.maxOps){
   postError('OP_BUDGET',`PDF page contains ${pageOps.toLocaleString()} drawing operators, above the safe per-page budget of ${data.maxOps.toLocaleString()}.`);
   return;
  }

  const {width,height}=data.viewport,vt=data.viewport.transform;
  if(!Number.isFinite(width)||!Number.isFinite(height)||!Array.isArray(vt)||vt.length<6){
   postError('INVALID_INPUT','PDF viewport metadata was incomplete.');
   return;
  }

  const segments:Segment[]=[],polygons:Polygon[]=[];
  const active:XY[]=[];
  let matrix=[1,0,0,1,0,0];
  const stack:number[][]=[];
  const transform=(b:number[])=>{
   const a=matrix;
   matrix=[
    a[0]*b[0]+a[2]*b[1],
    a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4],
    a[1]*b[4]+a[3]*b[5]+a[5]
   ];
  };
  const viewportPoint=(x:number,y:number)=>{
   const tx=matrix[0]*x+matrix[2]*y+matrix[4],ty=matrix[1]*x+matrix[3]*y+matrix[5];
   return{x:vt[0]*tx+vt[2]*ty+vt[4],y:vt[1]*tx+vt[3]*ty+vt[5]};
  };
  const addSegment=(segment:Segment)=>{
   if(segments.length>=data.maxSegments)throw Object.assign(new Error(`PDF page exceeded the safe vector-segment budget of ${data.maxSegments.toLocaleString()}.`),{code:'SEGMENT_BUDGET'});
   segments.push(segment);
  };
  const add=(x:number,y:number,connect=true)=>{
   const point=viewportPoint(x,y),max=Math.max(width,height,1);
   const next={x:(point.x-width/2)*20/max,y:(height/2-point.y)*20/max};
   if(connect&&active.length){
    const prev=active[active.length-1];
    if(Math.hypot(next.x-prev.x,next.y-prev.y)>.015)addSegment({x:prev.x,y:prev.y,x2:next.x,y2:next.y});
   }
   active.push(next);
  };
  const finish=()=>{
   if(active.length>=3){
    const first=active[0],last=active[active.length-1];
    if(Math.hypot(first.x-last.x,first.y-last.y)<.08)polygons.push({vertices:[...active],confidence:.74});
   }
   active.length=0;
  };
  const close=()=>{
   if(active.length>=2){
    const first=active[0],last=active[active.length-1];
    if(Math.hypot(first.x-last.x,first.y-last.y)>.015)addSegment({x:last.x,y:last.y,x2:first.x,y2:first.y});
    active.push(first);
   }
   finish();
  };

  for(let k=0;k<data.fnArray.length;k++){
   const fn=data.fnArray[k],a=(data.argsArray[k]||[]) as any[];
   if(fn===data.ops.save){stack.push([...matrix])}
   else if(fn===data.ops.restore){matrix=stack.pop()||[1,0,0,1,0,0]}
   else if(fn===data.ops.transform){transform(a.map(Number))}
   else if(fn===data.ops.paintFormXObjectBegin){
    stack.push([...matrix]);
    if(a[0])transform(Array.from(a[0] as ArrayLike<number>).map(Number));
   }
   else if(fn===data.ops.paintFormXObjectEnd){matrix=stack.pop()||[1,0,0,1,0,0]}
   else if(fn===data.ops.constructPath){
    for(const command of (a[1]||[])){
     const c=Array.from(command as ArrayLike<number>).map(Number);
     for(let j=0;j<c.length;){
      const code=c[j++];
      if(code===0){finish();add(c[j++],c[j++],false)}
      else if(code===1){add(c[j++],c[j++])}
      else if(code===2){j+=6;active.length=0}
      else if(code===3){j+=4;active.length=0}
      else if(code===4){close()}
      else{active.length=0;break}
     }
    }
    finish();
   }
   else if(fn===data.ops.moveTo){finish();add(Number(a[0]),Number(a[1]),false)}
   else if(fn===data.ops.lineTo){add(Number(a[0]),Number(a[1]))}
   else if(fn===data.ops.rectangle){
    finish();
    const [x,y,w,h]=a.map(Number);
    add(x,y,false);add(x+w,y);add(x+w,y+h);add(x,y+h);close();
   }
   else if(fn===data.ops.closePath){close()}
  }

  const payload:Extract<VectorWorkerResponse,{type:'DONE'}>={type:'DONE',pageOps,segments,polygons};
  ctx.postMessage(payload);
 }catch(error){
  const code=(error as {code?:string})?.code==='SEGMENT_BUDGET'?'SEGMENT_BUDGET':'WORKER_ERROR';
  postError(code,error instanceof Error?error.message:'PDF vector normalization failed.');
 }
};
