import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
process.umask(0o077);
const here = path.dirname(fileURLToPath(import.meta.url));
const [mode, ...pairs] = process.argv.slice(2);
const options = {};
for (let i=0; i<pairs.length; i+=2) {
 if (!/^--[a-z-]+$/.test(pairs[i]) || !pairs[i+1]) throw Error('Invalid CLI arguments');
 options[pairs[i].slice(2)] = pairs[i+1];
}
let phase = 'validate', credentials, work;
const env = {...process.env};
for (const key of Object.keys(env)) if (/TOKEN|PASSWORD|SECRET|FN_IOS_.*KEY/.test(key)) delete env[key];
function redact(text) {
 let out=String(text||'');
 for (const value of [credentials?.email, credentials?.password].filter(Boolean)) {
  out=out.split(value).join('[REDACTED]');
  out=out.split(JSON.stringify(value).slice(1,-1)).join('[REDACTED]');
 }
 return out;
}
function stage(value) { phase=value; console.log('XCTest fallback: '+value); }
function run(cmd, args, timeout=120000) {
 const result=spawnSync(cmd,args,{env,encoding:'utf8',timeout,killSignal:'SIGKILL',maxBuffer:64*1024*1024,cwd:work});
 if(work)writeFileSync(path.join(work,'redacted.log'),redact(result.stdout)+'\n'+redact(result.stderr),{flag:'a',mode:0o600});
 if(result.error||result.status!==0)throw Error('Command failed');
 return result.stdout||'';
}
function allFiles(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?allFiles(path.join(dir,e.name)):[path.join(dir,e.name)]); }
try {
 if(!['prepare','run','clean','bridge'].includes(mode)||!options.work||!path.isAbsolute(options.work))throw Error('Invalid mode/work');
 work=path.resolve(options.work);
 if(!work.includes('footnation')||work==='/'||work===here)throw Error('Use a distinct private footnation work directory');
 if(mode==='bridge') {
  if(process.platform!=='darwin'||!/^[A-F0-9-]{36}$/i.test(options.udid||'')||!/^\d+$/.test(options.parent||''))throw Error('Invalid bridge parameters');
  const allowedRoutes=new Set(['login?next=%2Fsearch','my-profile','home','search','clubs','matches','opportunities','matching']);
  const began=Date.now(),deadline=began+12*60000;
  let container,previous,lastLookup=0;
  const call=(args)=>spawnSync('xcrun',args,{env,encoding:'utf8',timeout:20000,killSignal:'SIGKILL',maxBuffer:1024*1024});
  while(Date.now()<deadline) {
   try{process.kill(Number(options.parent),0);}catch{break;}
   if(!container||Date.now()-lastLookup>2000){lastLookup=Date.now();const found=call(['simctl','get_app_container',options.udid,'com.footnation.captureUITests.xctrunner','data']);if(found.status===0&&found.stdout.trim().startsWith('/'))container=found.stdout.trim();}
   if(container){
    const control=path.join(container,'Documents/FootNationCaptureControl'),requestPath=path.join(control,'request.json');
    if(existsSync(requestPath)&&statSync(requestPath).size<2048){
     let request;try{request=JSON.parse(readFileSync(requestPath,'utf8'));}catch{}
     if(request&&typeof request.id==='string'&&/^[A-F0-9-]{36}$/i.test(request.id)&&request.id!==previous&&Number.isFinite(request.createdAt)&&request.createdAt>=began-1000&&request.createdAt<=Date.now()+5000){
      previous=request.id;
      let opened=false;
      if(allowedRoutes.has(request.route))opened=call(['simctl','openurl',options.udid,'footnation://'+request.route]).status===0;
      const temporary=path.join(control,'response.'+request.id+'.tmp');
      writeFileSync(temporary,JSON.stringify({id:request.id,opened}),{mode:0o600});renameSync(temporary,path.join(control,'response.json'));
     }
    }
   }
   await new Promise(resolve=>setTimeout(resolve,300));
  }
 } else if(mode==='prepare') {
  if(process.platform!=='darwin'||existsSync(work)||!options.demo||!path.isAbsolute(options.demo))throw Error('Fresh macOS work directory and private demo are required');
  if((statSync(options.demo).mode&0o077)!==0)throw Error('Demo file must not be group/world readable');
  credentials=JSON.parse(readFileSync(options.demo,'utf8'));
  if(!credentials.email||!credentials.password||typeof credentials.email!=='string'||typeof credentials.password!=='string')throw Error('Invalid credentials');
  mkdirSync(work,{recursive:true,mode:0o700});
  cpSync(path.join(here,'FootNationCaptureTests.swift'),path.join(work,'FootNationCaptureTests.swift'));
  writeFileSync(path.join(work,'private-demo.json'),JSON.stringify({email:credentials.email,password:credentials.password}),{mode:0o600});
  stage('generate standalone UI runner');
  run('ruby',[path.join(here,'create-project.rb'),work]);
  stage('compile UI runner only');
  run('xcodebuild',['-project',path.join(work,'FootNationCapture.xcodeproj'),'-scheme','FootNationCapture','-configuration','Debug','-sdk','iphonesimulator','-destination','generic/platform=iOS Simulator','-derivedDataPath',path.join(work,'DerivedData'),'CODE_SIGNING_ALLOWED=NO','ONLY_ACTIVE_ARCH=YES','ARCHS=arm64','build-for-testing'],10*60000);
  const candidates=allFiles(path.join(work,'DerivedData/Build/Products')).filter(f=>f.endsWith('.xctestrun'));
  if(candidates.length!==1)throw Error('Expected exactly one runner product');
  writeFileSync(path.join(work,'runner.json'),JSON.stringify({schema:1,xctestrun:candidates[0],runnerBundle:'com.footnation.captureUITests.xctrunner',appBundle:'com.footnation.app'}),{mode:0o600});
  console.log('Standalone UI runner prepared; FootNation was not compiled or launched.');
 } else if(mode==='run') {
  if(process.platform!=='darwin'||!/^[A-F0-9-]{36}$/i.test(options.udid||'')||!['login','capture'].includes(options.mode)||!['fr-FR','en-US'].includes(options.locale)||!['iphone','ipad'].includes(options.device)||!options.output||!path.isAbsolute(options.output))throw Error('Invalid run parameters');
  credentials=JSON.parse(readFileSync(path.join(work,'private-demo.json'),'utf8'));
  const metadata=JSON.parse(readFileSync(path.join(work,'runner.json'),'utf8'));
  // Inspect the already installed binary; never install or rebuild FootNation.
  const appPath=run('xcrun',['simctl','get_app_container',options.udid,metadata.appBundle,'app']).trim();
  run('python3',['-c',"import plistlib,sys;p=plistlib.load(open(sys.argv[1],'rb'));assert p['CFBundleIdentifier']=='com.footnation.app' and p['CFBundleShortVersionString']=='1.0.4' and p['CFBundleVersion']=='16'",path.join(appPath,'Info.plist')]);
  const stamp=options.mode+'-'+options.locale+'-'+options.device;
  // Keep patched file beside the original so __TESTROOT__ resolves identically.
  const patched=path.join(path.dirname(metadata.xctestrun),'footnation-'+stamp+'.xctestrun');
  run('python3',[path.join(here,'patch-xctestrun.py'),metadata.xctestrun,patched,options.mode,options.locale,options.device]);
  const resultPath=path.join(work,stamp+'.xcresult');rmSync(resultPath,{recursive:true,force:true});
  stage(options.mode==='login'?'real UI login and demo profile proof':'native '+options.locale+' '+options.device+' screenshots');
  let failure;
  const bridge=spawn(process.execPath,[fileURLToPath(import.meta.url),'bridge','--work',work,'--udid',options.udid,'--parent',String(process.pid)],{env,stdio:'ignore'});
  try {
   run('xcodebuild',['test-without-building','-xctestrun',patched,'-destination','platform=iOS Simulator,id='+options.udid,'-parallel-testing-enabled','NO','-maximum-concurrent-test-simulator-destinations','1','-resultBundlePath',resultPath,'-test-timeouts-enabled','YES','-default-test-execution-time-allowance','420','-maximum-test-execution-time-allowance','480'],10*60000);
  } catch(e) { failure=e; }
  finally { bridge.kill('SIGTERM'); rmSync(resultPath,{recursive:true,force:true}); rmSync(path.join(work,'DerivedData/Logs/Test'),{recursive:true,force:true}); }
  if(failure)throw failure;
  const container=run('xcrun',['simctl','get_app_container',options.udid,metadata.runnerBundle,'data']).trim();
  const captures=path.join(container,'Documents/FootNationNativeCaptures');
  const files=readdirSync(captures).filter(name=>options.mode==='login'?name==='authenticated-profile.png':name.startsWith(options.locale+'-'+options.device+'-')&&name.endsWith('.png')).sort();
  if(files.length!==(options.mode==='login'?1:7))throw Error('Incomplete screenshot set');
  mkdirSync(options.output,{recursive:true,mode:0o700});
  const receipt=[];
  for(const filename of files) {
   const target=options.mode==='login'?options.device+'-00-authenticated-profile.png':filename;
   cpSync(path.join(captures,filename),path.join(options.output,target));chmodSync(path.join(options.output,target),0o600);
   const data=readFileSync(path.join(options.output,target));if(!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Expected native PNG');
   receipt.push({filename:target,locale:options.locale,device:options.device,width:data.readUInt32BE(16),height:data.readUInt32BE(20),sha256:createHash('sha256').update(data).digest('hex'),captureMethod:'XCUIScreen.main.screenshot, installed Release app 1.0.4(16), genuine UI authentication',visuallyReviewed:false});
  }
  writeFileSync(path.join(options.output,'xctest-'+stamp+'.json'),JSON.stringify({schema:1,authProof:'Démo FootNation visible in native my-profile',screens:receipt},null,2),{mode:0o600});
  rmSync(captures,{recursive:true,force:true});
  console.log('XCTest phase succeeded; '+files.length+' native PNG saved privately. Visual review is required.');
 } else {
  if(!existsSync(path.join(work,'runner.json'))&&!existsSync(path.join(work,'FootNationCapture.xcodeproj')))throw Error('Not a recognized work directory');
  rmSync(work,{recursive:true,force:true});
  console.log('Private runner build and credential resource removed.');
 }
} catch {
 console.error('XCTest fallback failed during: '+phase+'. No credential values are printed.');
 process.exitCode=1;
}
