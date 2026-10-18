import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrypt, encrypt, releaseKey } from './envelope.mjs';
process.umask(0o077);
const scripts=path.dirname(fileURLToPath(import.meta.url));
const work=path.join(process.env.RUNNER_TEMP||'', 'footnation-native-screenshots');
const source=path.join(work,'source'), output=path.join(work,'captures');
const deliverables=path.join(process.env.RUNNER_TEMP||'','footnation-screenshot-artifacts');
const env={...process.env}; delete env.FN_IOS_SCREENSHOT_KEY; delete env.GITHUB_TOKEN; delete env.GH_TOKEN;
let log,key,phase='configuration',created=false;
const devices=[];
function run(command,args,{cwd=source,capture=false,allowFailure=false,commandEnv=env}={}) {
 const r=spawnSync(command,args,{cwd,env:commandEnv,encoding:'utf8',maxBuffer:32*1024*1024,stdio:capture?['ignore','pipe','pipe']:['ignore',log,log]});
 if((r.error||r.status!==0)&&!allowFailure){if(capture&&log!==undefined)writeFileSync(log,r.stderr||'Command failed');throw Error('Native capture command failed');}return r.stdout||'';
}
function stage(name){phase=name;console.log('Native screenshots: '+name);}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function screenshot(udid,filename){run('xcrun',['simctl','io',udid,'screenshot',path.join(output,filename)]);}
function maestro(udid,flow,name,allowFailure=false) {
 const flowPath=path.join(work,name+'.yaml');writeFileSync(flowPath,flow);
 return run(path.join(process.env.HOME,'.maestro/bin/maestro'),['--device',udid,'test','--test-output-dir',path.join(work,'maestro-output'),flowPath],{allowFailure});
}
try {
 if(process.platform!=='darwin'||!process.env.RUNNER_TEMP||!process.env.GITHUB_WORKSPACE||existsSync(work)||existsSync(deliverables))throw Error('Fresh GitHub macOS runner required');
 mkdirSync(work,{mode:0o700});created=true;mkdirSync(deliverables,{mode:0o700});mkdirSync(output,{mode:0o700});log=openSync(path.join(work,'capture.log'),'wx',0o600);
 key=releaseKey(process.env.FN_IOS_SCREENSHOT_KEY);
 const payload=process.env.FN_PAYLOAD_PATH,expected=process.env.FN_PAYLOAD_SHA256;
 if(!payload||path.isAbsolute(payload)||payload.split(/[\\/]/).includes('..')||!/^[a-zA-Z0-9_./-]+$/.test(payload)||!/^[a-f0-9]{64}$/.test(expected||''))throw Error('Invalid encrypted snapshot');
 const ciphertext=readFileSync(path.join(process.env.GITHUB_WORKSPACE,payload));if(createHash('sha256').update(ciphertext).digest('hex')!==expected)throw Error('Snapshot integrity mismatch');
 writeFileSync(path.join(work,'source.tar.gz'),decrypt(ciphertext,key),{mode:0o600});
 run('python3',[path.join(scripts,'safe-extract-screenshots.py'),path.join(work,'source.tar.gz'),source],{cwd:work});rmSync(path.join(work,'source.tar.gz'));
 const buildEnv=JSON.parse(readFileSync(path.join(source,'release-private/build-env.json')));
 for(const [name,value] of Object.entries(buildEnv)){if(!/^EXPO_PUBLIC_[A-Z0-9_]+$/.test(name)||typeof value!=='string')throw Error('Unexpected build setting');env[name]=value;}
 Object.assign(env,{CI:'1',EXPO_NO_TELEMETRY:'1',EXPO_NO_DOTENV:'1',EXPO_PUBLIC_SUPPORTERS_ENABLED:'false',EAS_BUILD_PLATFORM:'ios',NODE_ENV:'production',MAESTRO_CLI_NO_ANALYTICS:'1'});
 const app=JSON.parse(readFileSync(path.join(source,'app.json')));if(app.expo.ios.bundleIdentifier!=='com.footnation.app')throw Error('Unexpected app');app.expo.version='1.0.4';app.expo.ios.buildNumber='16';writeFileSync(path.join(source,'app.json'),JSON.stringify(app,null,2));
 const demo=JSON.parse(readFileSync(path.join(source,'release-private/demo.json')));if(typeof demo.email!=='string'||typeof demo.password!=='string'||!demo.email||!demo.password)throw Error('Missing private demo credentials');
 const reuse=process.env.FN_REUSE_RUN_ID||'';if(reuse&&!/^\d+$/.test(reuse))throw Error('Invalid reuse run id');
 if(!reuse){stage('install dependencies');run('npm',['ci','--include=dev','--legacy-peer-deps','--no-audit','--no-fund']);
 stage('generate native iOS project');run('npx',['--no-install','expo','prebuild','--platform','ios','--no-install']);run('pod',['install'],{cwd:path.join(source,'ios')});}
 stage('prepare simulator devices');
 const runtimes=JSON.parse(run('xcrun',['simctl','list','runtimes','-j'],{capture:true})).runtimes.filter(r=>r.isAvailable&&r.name.startsWith('iOS ')).sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}));if(!runtimes.length)throw Error('No iOS simulator runtime');
 const runtime=runtimes[0];const types=JSON.parse(run('xcrun',['simctl','list','devicetypes','-j'],{capture:true})).devicetypes;
 const preferred=[{kind:'iphone',names:['iPhone 16 Pro Max','iPhone 17 Pro Max','iPhone 15 Pro Max']},{kind:'ipad',names:['iPad Pro 13-inch (M4)','iPad Pro 13-inch (M5)','iPad Pro (12.9-inch) (6th generation)']}];
 const selectedDevice=process.env.FN_CAPTURE_DEVICE||'all';if(!['all','iphone','ipad'].includes(selectedDevice))throw Error('Invalid capture device');
 for(const spec of preferred.filter(d=>selectedDevice==='all'||d.kind===selectedDevice)){const type=spec.names.map(n=>types.find(t=>t.name===n)).find(Boolean);if(!type)throw Error('Required screenshot device unavailable');const udid=run('xcrun',['simctl','create','FootNation '+spec.kind,type.identifier,runtime.identifier],{capture:true}).trim();devices.push({...spec,udid,name:type.name,runtime:runtime.name});}
 const iphone=devices[0];run('xcrun',['simctl','boot',iphone.udid]);run('xcrun',['simctl','bootstatus',iphone.udid,'-b']);
 let nativeApp,products,appName,compiledSourceSha256=expected,compiledGithubCommit=process.env.GITHUB_SHA,nativeArchiveSha256;
 if(reuse){
  stage('restore authenticated native simulator build');
  const encrypted=readFileSync(path.join(process.env.RUNNER_TEMP,'footnation-reuse-simulator/simulator-app.tar.gz.enc'));
  nativeArchiveSha256=createHash('sha256').update(encrypted).digest('hex');
  const previousCaptures=path.join(process.env.RUNNER_TEMP,'footnation-reuse-simulator/captures.tar.gz.enc');
  if(existsSync(previousCaptures)){const archive=path.join(work,'previous-captures.tar.gz');writeFileSync(archive,decrypt(readFileSync(previousCaptures),key));const previous=JSON.parse(run('tar',['-xOf',archive,'./manifest.json'],{capture:true}));if(previous.app!=='com.footnation.app'||previous.version!=='1.0.4'||previous.buildNumber!=='16')throw Error('Native source provenance mismatch');compiledSourceSha256=previous.compiledSourceSha256||previous.sourceSha256;compiledGithubCommit=previous.compiledGithubCommit||previous.githubCommit;rmSync(archive);}
  else throw Error('Missing original native build provenance');
  const archive=path.join(work,'reuse-app.tar.gz');writeFileSync(archive,decrypt(encrypted,key));products=path.join(work,'restored-native-app');
  run('python3',[path.join(scripts,'safe-extract-screenshots.py'),archive,products]);
  appName=readdirSync(products).find(n=>n.endsWith('.app'));if(!appName)throw Error('Missing reused app');nativeApp=path.join(products,appName);
  writeFileSync(path.join(deliverables,'simulator-app.tar.gz.enc'),encrypted);
 }else{
  const project=readdirSync(path.join(source,'ios')).find(n=>n.endsWith('.xcworkspace'));if(!project)throw Error('Missing generated workspace');
  const workspace=path.join(source,'ios',project);const scheme=project.replace('.xcworkspace','');
  stage('compile authentic Release app for iOS Simulator');run('xcodebuild',['-workspace',workspace,'-scheme',scheme,'-configuration','Release','-sdk','iphonesimulator','-destination','id='+iphone.udid,'-derivedDataPath',path.join(work,'DerivedData'),'CODE_SIGNING_ALLOWED=NO','build']);
  products=path.join(work,'DerivedData/Build/Products/Release-iphonesimulator');appName=readdirSync(products).find(n=>n.endsWith('.app'));if(!appName)throw Error('Native app product missing');nativeApp=path.join(products,appName);
  run('tar',['-czf',path.join(work,'simulator-app.tar.gz'),'-C',products,appName]);writeFileSync(path.join(deliverables,'simulator-app.tar.gz.enc'),encrypt(readFileSync(path.join(work,'simulator-app.tar.gz')),key));
 }
 nativeArchiveSha256 ||= createHash('sha256').update(readFileSync(path.join(deliverables,'simulator-app.tar.gz.enc'))).digest('hex');
 const nativeIdentity=JSON.parse(run('python3',['-c',`import plistlib,json,sys
p=plistlib.load(open(sys.argv[1],'rb'))
assert p['CFBundleIdentifier']=='com.footnation.app' and p['CFBundleShortVersionString']=='1.0.4' and p['CFBundleVersion']=='16'
print(json.dumps({k:p[k] for k in ['CFBundleIdentifier','CFBundleShortVersionString','CFBundleVersion']}))`,path.join(nativeApp,'Info.plist')],{capture:true}));
 stage('install native UI automation');run('curl',['-fsSL','https://get.maestro.mobile.dev','-o',path.join(work,'install-maestro.sh')]);run('bash',[path.join(work,'install-maestro.sh')]);
 const manifest={app:'com.footnation.app',version:'1.0.4',buildNumber:'16',sourceSha256:compiledSourceSha256,compiledSourceSha256,compiledGithubCommit,capturePayloadSha256:expected,nativeArchiveSha256,nativeIdentity,reusedNativeBuildRun:reuse||null,githubCommit:process.env.GITHUB_SHA,native:true,method:'Release iOS Simulator build from submitted source; native screenshot capture via simctl',capturedAt:new Date().toISOString(),devices:[],screens:[]};
 const routes=[['01-accueil','home'],['02-recherche','search'],['03-clubs','clubs'],['04-matchs','matches'],['05-opportunites','opportunities'],['06-profil','my-profile'],['07-matching','matching']];
 for(const device of devices){
  stage('capture '+device.kind+' native interface');if(device!==iphone){run('xcrun',['simctl','boot',device.udid]);run('xcrun',['simctl','bootstatus',device.udid,'-b']);}
  run('xcrun',['simctl','ui',device.udid,'appearance','light']);run('xcrun',['simctl','status_bar',device.udid,'override','--time','9:41','--dataNetwork','wifi','--wifiMode','active','--wifiBars','3','--batteryState','charged','--batteryLevel','100']);
  run('xcrun',['simctl','install',device.udid,nativeApp]);
  const container=run('xcrun',['simctl','get_app_container',device.udid,'com.footnation.app','data'],{capture:true}).trim();const storage=path.join(container,'Library/Application Support/com.footnation.app/RCTAsyncLocalStorage_V1');mkdirSync(storage,{recursive:true});const preferences={'footnation:language:v1':'fr','footnation:appearance:v1':'light'};if(/^[0-9a-f-]{36}$/.test(demo.userId||'')){preferences['footnation:first-login-onboarding:v1:'+demo.userId]='seen';preferences['footnation:invitation-prompt-until:v1:'+demo.userId]=String(Date.now()+7*86400000);}writeFileSync(path.join(storage,'manifest.json'),JSON.stringify(preferences));
  run('xcrun',['simctl','launch',device.udid,'com.footnation.app','-AppleLanguages','(fr)','-AppleLocale','fr_FR']);await wait(15000);
  run('xcrun',['simctl','openurl',device.udid,'footnation://login?next=%2Fsearch']);await wait(8000);
  const loginFlow=`appId: com.footnation.app\n---\n- scrollUntilVisible:\n    element: "joueur@example.com"\n    direction: DOWN\n    timeout: 20000\n- tapOn: "joueur@example.com"\n- inputText: ${JSON.stringify(demo.email)}\n- pressKey: Enter\n- inputText: ${JSON.stringify(demo.password)}\n- pressKey: Enter\n- extendedWaitUntil:\n    notVisible: "Connexion rapide"\n    timeout: 60000\n- tapOn:\n    text: "Fermer l’invitation"\n    optional: true\n- tapOn:\n    text: "Plus tard"\n    optional: true\n`;
  maestro(device.udid,loginFlow,device.kind+'-login',true);await wait(12000);
  screenshot(device.udid,device.kind+'-00-login-result.png');
  run('xcrun',['simctl','openurl',device.udid,'footnation://my-profile']);await wait(10000);
  maestro(device.udid,`appId: com.footnation.app\n---\n- tapOn:\n    text: "Fermer l’invitation"\n    optional: true\n- tapOn:\n    text: "Plus tard"\n    optional: true\n- extendedWaitUntil:\n    visible: ".*Démo FootNation.*"\n    timeout: 60000\n`,device.kind+'-authenticated-profile');
  screenshot(device.udid,device.kind+'-00-authenticated-profile.png');
  for(const locale of ['fr-FR','en-US']) {
   if(locale==='en-US') {
    run('xcrun',['simctl','terminate',device.udid,'com.footnation.app'],{allowFailure:true});
    const settings=JSON.parse(readFileSync(path.join(storage,'manifest.json'),'utf8'));settings['footnation:language:v1']='en';writeFileSync(path.join(storage,'manifest.json'),JSON.stringify(settings));
    run('xcrun',['simctl','launch',device.udid,'com.footnation.app','-AppleLanguages','(en)','-AppleLocale','en_US']);await wait(10000);
   }
   for(const [name,route] of routes){
    run('xcrun',['simctl','openurl',device.udid,'footnation://'+route]);await wait(18000);
    if(route==='home')maestro(device.udid,`appId: com.footnation.app\n---\n- tapOn:\n    text: "Fermer l’invitation"\n    optional: true\n- tapOn:\n    text: "Plus tard"\n    optional: true\n- tapOn:\n    text: "Close invitation"\n    optional: true\n- tapOn:\n    text: "Later"\n    optional: true\n`,device.kind+'-dismiss',true);await wait(3000);
    const filename=locale+'-'+device.kind+'-'+name+'.png';screenshot(device.udid,filename);manifest.screens.push({filename,route,device:device.name,runtime:device.runtime,locale,sha256:createHash('sha256').update(readFileSync(path.join(output,filename))).digest('hex'),visuallyReviewed:false});
   }
  }
  manifest.devices.push({kind:device.kind,name:device.name,runtime:device.runtime});run('xcrun',['simctl','terminate',device.udid,'com.footnation.app'],{allowFailure:true});run('xcrun',['simctl','shutdown',device.udid]);
 }
 writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
 stage('encrypt native capture archive');run('tar',['-czf',path.join(work,'captures.tar.gz'),'-C',output,'.']);writeFileSync(path.join(deliverables,'captures.tar.gz.enc'),encrypt(readFileSync(path.join(work,'captures.tar.gz')),key));
 // The encrypted simulator binary was preserved immediately after compilation.
 console.log('Genuine native screenshots encrypted; human review is required before App Store upload.');
} catch { console.error('Native screenshots failed during: '+phase+'. Diagnostics encrypted.'); process.exitCode=1; }
finally {
 try{if(log!==undefined)closeSync(log);if(key&&existsSync(path.join(work,'capture.log'))){const entries=['capture.log'];if(existsSync(path.join(work,'maestro-output')))entries.push('maestro-output');if(existsSync(output))entries.push('captures');const archive=path.join(work,'diagnostics.tar.gz');const r=spawnSync('tar',['-czf',archive,'-C',work,...entries],{stdio:'ignore'});if(r.status===0)writeFileSync(path.join(deliverables,'diagnostics.tar.gz.enc'),encrypt(readFileSync(archive),key));}}catch{console.error('Encrypted diagnostics unavailable');}
 for(const device of devices)spawnSync('xcrun',['simctl','delete',device.udid],{stdio:'ignore'});
 if(created&&process.env.RUNNER_TEMP&&work.startsWith(process.env.RUNNER_TEMP+path.sep))rmSync(work,{recursive:true,force:true});key?.fill(0);
}
