import {auditGeneratedLevel} from './generator-engine.mjs';
self.onmessage=async ({data})=>{
 const {jobId,levels}=data,results=[];
 try{
  if(!Array.isArray(levels)||levels.length>960)throw Error('A generation pack must contain at most 960 draft levels.');
  for(let i=0;i<levels.length;i++){
   results.push(auditGeneratedLevel(levels[i]));
   if(i%5===0){self.postMessage({jobId,progress:i+1,total:levels.length});await new Promise(resolve=>setTimeout(resolve,0));}
  }
  self.postMessage({jobId,results});
 }catch(error){self.postMessage({jobId,error:error.message});}
};
