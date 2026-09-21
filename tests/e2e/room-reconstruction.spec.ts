import {expect,test} from '@playwright/test';

test('automatic room proposal remains review-only until explicit human confirmation',async({page})=>{
 await page.goto('/compiler');
 await page.evaluate(()=>{
  const sha='b'.repeat(64);
  localStorage.setItem('stratum_compiled_graph',JSON.stringify({
   version:'1.1',createdAt:new Date().toISOString(),
   sources:[{name:'A-101.pdf',ext:'pdf',sha256:sha,discipline:'Architectural',floor:'UNRESOLVED',elevation:0}],
   entities:[
    {id:'candidate-1',source:'A-101.pdf',layer:'L1',kind:'vector-boundary-candidate',name:'PDF closed path · page 1',x:5,y:3,z:0,floor:'UNRESOLVED',confidence:.76,vertices:[{x:0,y:0},{x:10,y:0},{x:10,y:6},{x:0,y:6}],meta:{sourceSha256:sha,page:1,reviewRequired:true,geometryValidated:false,coordinateUnits:'sheet'}},
    {id:'label-1',source:'A-101.pdf',layer:'L1',kind:'room-label',name:'Electrical Room 101',x:5,y:3,z:0,floor:'UNRESOLVED',confidence:.82,meta:{sourceSha256:sha,page:1,coordinateUnits:'sheet'}}
   ],links:[],stats:{L0:1,L1:2,L2:0,L3:0,L4:0}
  }));
  window.dispatchEvent(new Event('stratum:graph-updated'));
 });

 await page.getByText('Review exceptions',{exact:true}).click();
 const proposals=page.getByRole('region',{name:'Automatic room reconstruction review'});
 await expect(proposals).toContainText('Electrical Room 101');
 await expect(proposals).toContainText('ROOM PROPOSAL');

 const before=await page.evaluate(()=>{
  const entity=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities.find((item:any)=>item.id==='candidate-1');
  return {kind:entity.kind,validated:entity.meta.geometryValidated,reviewRequired:entity.meta.reviewRequired,proposal:entity.meta.automaticRoomProposal};
 });
 expect(before.kind).toBe('vector-boundary-candidate');
 expect(before.validated).toBe(false);
 expect(before.reviewRequired).toBe(true);
 expect(before.proposal.eligible).toBe(true);

 await page.getByText('Advanced compiler details',{exact:true}).click();
 const review=page.getByRole('region',{name:'Drawing review'});
 await expect(review).toBeVisible();
 await review.getByText('Review drawing geometry',{exact:true}).click();
 await review.getByLabel('Drawing sheet').selectOption({label:'A-101.pdf · page 1'});
 await review.getByRole('combobox',{name:'Boundary'}).selectOption('candidate-1');
 await expect(review.getByLabel('Reviewed room name')).toHaveValue('Electrical Room 101');
 await expect(review).toContainText('AUTOMATIC ROOM PROPOSAL');

 await review.getByRole('button',{name:'Confirm selected boundary as room'}).click();
 await expect(review.getByRole('status')).toContainText(/Drawing review saved/i);
 const after=await page.evaluate(()=>{
  const entity=JSON.parse(localStorage.getItem('stratum_compiled_graph')||'{}').entities.find((item:any)=>item.id==='candidate-1');
  return {kind:entity.kind,validated:entity.meta.geometryValidated,reviewRequired:entity.meta.reviewRequired,accepted:entity.meta.automaticProposalAccepted};
 });
 expect(after).toEqual({kind:'room-boundary',validated:true,reviewRequired:false,accepted:true});
});