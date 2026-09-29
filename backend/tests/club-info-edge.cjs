const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('backend/functions/update-club-info/index.ts', 'utf8').replace(/^import .*;\s*$/gm, '');
const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
async function check({user=true, access=true, rpcError=null, expected=200, body={clubId:'club',name:'Fixture'}, row={id:'club',description:'Old',history:null}, inspect}) {
  let handler, writes=0, callerHeader, saved;
  const admin = {auth:{getUser:async()=>({data:{user:user?{id:'caller'}:null},error:null})},from:()=>({update:patch=>{
    const filters=[]; const builder={eq:(key,value)=>{filters.push([key,value]);return builder},is:(key,value)=>{filters.push([key,value]);return builder},select:()=>builder,maybeSingle:async()=>{
      if(filters.some(([key,value])=>row[key]!==value))return {data:null,error:null};
      writes++;saved={...row,...patch};return {data:saved,error:null};
    }};return builder;
  }})};
  const context={Request,Response,URL,console:{error(){}},corsHeaders:{},Deno:{env:{get:()=>''}},serve:fn=>handler=fn,createClient:(_url,_key,options)=>{
    if(!options.global)return admin;
    callerHeader=options.global.headers.Authorization;
    return {rpc:async(name,args)=>{assert.equal(name,'is_club_admin');assert.equal(args.p_club_id,'club');return {data:access,error:rpcError}}};
  }};
  vm.runInNewContext(compiled,context);
  const response=await handler(new Request('https://example.com',{method:'POST',headers:{Authorization:'Bearer verified-token','Content-Type':'application/json'},body:JSON.stringify(body)}));
  assert.equal(response.status,expected,await response.text());
  assert.equal(writes,expected===200?1:0);
  if(expected===403 || expected===200 || expected===409)assert.equal(callerHeader,'Bearer verified-token');
  if(inspect)inspect(saved);
}
(async()=>{
 await check({user:false,expected:401});
 await check({access:false,expected:403});
 await check({access:null,expected:403});
 await check({access:true,rpcError:{message:'failed'},expected:403});
 await check({});
 const body={clubId:'club',section:'about',description:'New',history:'History',expected:{description:'Old',history:null},is_verified:true};
 await check({body,inspect:row=>{assert.equal(row.description,'New');assert.equal(row.history,'History');assert.equal(row.is_verified,undefined)}});
 await check({body:{...body,expected:{description:'Stale',history:null}},expected:409});
 await check({body:{...body,expected:{description:'Old'}},expected:400});
 await check({body:{...body,section:'unknown'},expected:400});
 await check({body:{clubId:'club',name:'X',founded_date:'2025-02-29'},expected:400});
 await check({body:{clubId:'club',name:'X',logo_url:'javascript:alert(1)'},expected:400});
 await check({body:{...body,history:null},inspect:row=>assert.equal(row.history,null)});
 await check({body:{...body,expected:{description:'New',history:'History'}},row:{id:'club',description:'New',history:'History'},inspect:row=>assert.equal(row.description,'New')});
 const contact={address:null,city:'Annecy',postal_code:'74000',phone:null,email:'club@example.com',website:'https://example.com/'};
 await check({body:{clubId:'club',section:'contact',...contact,expected:contact},row:{id:'club',...contact},inspect:row=>assert.equal(row.email,'club@example.com')});
 await check({body:{clubId:'club',section:'contact',...contact,email:'bad',expected:contact},expected:400});
 const identity={name:'Club',short_name:null,logo_url:null,founded_date:null};
 await check({body:{clubId:'club',section:'infos',...identity,type:'club',expected:identity},row:{id:'club',...identity,type:'five_center'},inspect:row=>assert.equal(row.type,'five_center')});
 console.log('16 edge authorization, validation and concurrency cases passed; no real writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
