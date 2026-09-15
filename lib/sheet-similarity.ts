export type Point2={x:number;y:number};
export type SheetSimilarity={scale:number;rotationRadians:number;rotationDegrees:number;translateX:number;translateY:number;rmsResidual:number};

export function fitSheetSimilarity(moving:Point2[],reference:Point2[]):SheetSimilarity|null{
 if(moving.length!==reference.length||moving.length<2)return null;
 const mc=moving.reduce((sum,p)=>({x:sum.x+p.x/moving.length,y:sum.y+p.y/moving.length}),{x:0,y:0});
 const rc=reference.reduce((sum,p)=>({x:sum.x+p.x/reference.length,y:sum.y+p.y/reference.length}),{x:0,y:0});
 let a=0,b=0,denom=0;
 for(let i=0;i<moving.length;i++){
  const mx=moving[i].x-mc.x,my=moving[i].y-mc.y,rx=reference[i].x-rc.x,ry=reference[i].y-rc.y;
  a+=mx*rx+my*ry;b+=mx*ry-my*rx;denom+=mx*mx+my*my;
 }
 if(denom<1e-8)return null;
 const scale=Math.hypot(a,b)/denom;if(!Number.isFinite(scale)||scale<=0)return null;
 const cos=a/(scale*denom),sin=b/(scale*denom);if(!Number.isFinite(cos)||!Number.isFinite(sin))return null;
 const translateX=rc.x-scale*(cos*mc.x-sin*mc.y),translateY=rc.y-scale*(sin*mc.x+cos*mc.y);
 const rmsResidual=Math.sqrt(moving.reduce((sum,p,i)=>{const x=scale*(cos*p.x-sin*p.y)+translateX,y=scale*(sin*p.x+cos*p.y)+translateY,dx=x-reference[i].x,dy=y-reference[i].y;return sum+dx*dx+dy*dy},0)/moving.length);
 const rotationRadians=Math.atan2(sin,cos);
 return{scale,rotationRadians,rotationDegrees:rotationRadians*180/Math.PI,translateX,translateY,rmsResidual};
}

export function transformSheetPoint(point:Point2,transform:SheetSimilarity):Point2{
 const cos=Math.cos(transform.rotationRadians),sin=Math.sin(transform.rotationRadians);
 return{x:transform.scale*(cos*point.x-sin*point.y)+transform.translateX,y:transform.scale*(sin*point.x+cos*point.y)+transform.translateY};
}
