"""Exercise the installed release bundle; capture genuine Android UI, no fixture data."""
import os,pathlib,subprocess,json,time,re,shlex,xml.etree.ElementTree as ET
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'footnation-android-audit'
private=json.loads((root/'private.json').read_text())
screens=root/'screens';screens.mkdir()
hierarchies=root/'hierarchies';hierarchies.mkdir()
checks=[]
stage='install'
def adb(*args,timeout=30):
 r=subprocess.run(['adb',*args],capture_output=True,timeout=timeout)
 if r.returncode:
  detail=(r.stderr+r.stdout).decode(errors='replace')
  for value in [private['email'],private['password']]:detail=detail.replace(value,'[REDACTED]')
  raise RuntimeError('ADB '+args[0]+' failed: '+detail[:800])
 return r.stdout
def tree():
 def snapshot():
  for _ in range(3):
   status=adb('shell','am','instrument','-w','com.footnation.audit/.Hierarchy',timeout=30).decode()
   if 'auditSuccess=true' in status:return adb('shell','run-as','com.footnation.audit','cat','files/hierarchy.xml').decode()
   time.sleep(1)
  raise RuntimeError('Fresh native accessibility snapshot unavailable')
 raw=snapshot()
 result=ET.fromstring(raw)
 if any(n.get('text')=="Pixel Launcher isn't responding" for n in result.iter('node')):
  button=next((n for n in result.iter('node') if n.get('text')=='Wait'),None)
  if button is not None:
   tap(button);time.sleep(4)
   result=ET.fromstring(snapshot())
 return result
def label(node):return (node.get('text','')+' '+node.get('content-desc','')).strip()
def visible(node):
 v=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
 return len(v)==4 and v[2]>v[0] and v[3]-v[1]>35 and v[1]>90 and v[3]<1860
def tap(node):
 v=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
 if len(v)!=4:raise RuntimeError('Missing bounds')
 adb('shell','input','tap',str((v[0]+v[2])//2),str((v[1]+v[3])//2))
def wait_for(test,seconds=40,dismiss=False):
 until=time.time()+seconds
 while time.time()<until:
  if dismiss:dismiss_optional()
  t=tree();found=next((n for n in t.iter('node') if test(n)),None)
  if found is not None:return found
  time.sleep(1)
 raise RuntimeError('Expected native control not found')
def find_in_feed(test):
 for _ in range(8):
  found=next((n for n in tree().iter('node') if test(n) and visible(n)),None)
  if found is not None:return found
  adb('shell','input','swipe','540','1650','540','650','450');time.sleep(2)
 raise RuntimeError('Publication controls unavailable in feed')
def text(value):
 if not value.isascii() or '\n' in value:raise RuntimeError('Unsupported test input')
 adb('shell','input','text',shlex.quote(value.replace(' ','%s')))
def route(value):
 if value.startswith('login?'):
  adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',shlex.quote('footnation://'+value),'com.footnation.app')
  return
 # Use the same real controls as a person, including after the asynchronous
 # post-login redirect, instead of racing it with a second external intent.
 bottom={'home':'Accueil','my-profile':'Mon profil','search':'Rechercher'}
 if value in bottom:
  for _ in range(12):
   dismiss_optional();nodes=list(tree().iter('node'))
   target=next((n for n in nodes if n.get('content-desc')==bottom[value] and visible(n)),None)
   if target is not None:tap(target);time.sleep(2);return
   back=next((n for n in nodes if n.get('content-desc')=='Retour' and visible(n)),None)
   if back is not None:tap(back)
   time.sleep(2)
  raise RuntimeError('Native bottom navigation unavailable: '+value)
 route('home')
 names={'clubs':['Clubs'],'opportunities':['Opportunités'],'matches':['Matchs','Matches']}[value]
 for attempt in range(12):
  nodes=list(tree().iter('node'))
  target=next((n for n in nodes if n.get('content-desc') in names and visible(n)),None)
  if target is not None:tap(target);time.sleep(2);return
  rail=next((n for n in nodes if n.get('content-desc')=='Navigation de l’accueil'),None)
  if rail is None:raise RuntimeError('Native home navigation rail unavailable')
  x1,y1,x2,y2=map(int,re.findall(r'\d+',rail.get('bounds')))
  left=x1+int((x2-x1)*0.15);right=x1+int((x2-x1)*0.85);y=(y1+y2)//2
  start,end=(right,left) if attempt%8<4 else (left,right)
  adb('shell','input','swipe',str(start),str(y),str(end),str(y),'500');time.sleep(1)
 raise RuntimeError('Native home navigation tab unavailable: '+value)
def dismiss_optional():
 for _ in range(3):
  t=tree();button=next((n for n in t.iter('node') if label(n) in ['Fermer','Fermer l’invitation','Plus tard','Pas maintenant','Ne pas autoriser','Don’t allow',"Don't allow"]),None)
  if button is None:return
  tap(button);time.sleep(1)
def capture(name):
 t=tree();rendered='\n'.join(label(n) for n in t.iter('node'))
 if any(x in rendered for x in ['Chargement impossible','HTTP 504','Un problème est survenu']):raise RuntimeError('Native error screen')
 if private['email'] in rendered or private['password'] in rendered:raise RuntimeError('Private login data visible')
 (hierarchies/(name+'.xml')).write_text(ET.tostring(t,encoding='unicode'))
 (screens/(name+'.png')).write_bytes(adb('exec-out','screencap','-p'))
 checks.append(name)
try:
 adb('install',str(root/'universal.apk'),timeout=120)
 adb('install',str(root/'hierarchy.apk'),timeout=60)
 adb('shell','input','keyevent','224')
 adb('shell','wm','dismiss-keyguard')
 adb('shell','wm','size','1080x1920')
 adb('shell','wm','density','420')
 adb('shell','settings','put','system','system_locales','fr-FR')
 adb('shell','settings','put','global','window_animation_scale','0')
 adb('shell','settings','put','global','transition_animation_scale','0')
 stage='open-login'
 route('login?next=%2Fsearch')
 wait_for(lambda n:'Connexion' in label(n),60)
 stage='enter-email'
 tap(find_in_feed(lambda n:n.get('class')=='android.widget.EditText' and n.get('content-desc')=='Adresse e-mail'))
 text(private['email']);adb('shell','input','keyevent','4')
 stage='enter-password'
 tap(find_in_feed(lambda n:n.get('class')=='android.widget.EditText' and 'Mot de passe' in n.get('content-desc','')))
 text(private['password']);adb('shell','input','keyevent','4')
 stage='submit-login'
 tap(find_in_feed(lambda n:n.get('class')=='android.widget.Button' and 'Se connecter' in label(n)))
 time.sleep(6);dismiss_optional()
 stage='authenticated-profile'
 route('my-profile');dismiss_optional()
 for attempt in range(4):
  try:
   wait_for(lambda n:bool(re.search(r'Modifier.*profil|Modifier|Edit profile',label(n))),15,dismiss=True)
   break
  except RuntimeError:
   if attempt==3:raise
   route('my-profile')
 checks.append('authenticated-demo-profile')
 time.sleep(3);capture('02-profil')
 for name,link,expected in [('01-recherche','search','Rechercher'),('03-clubs','clubs','Clubs'),('04-opportunites','opportunities','Opportunités'),('05-matchs','matches','Matchs')]:
  stage=name
  route(link);dismiss_optional();wait_for(lambda n:expected.lower() in label(n).lower(),60,dismiss=True)
  time.sleep(5);capture(name)
 stage='home-controls'
 route('home');dismiss_optional();wait_for(lambda n:'Pour vous' in label(n),60,dismiss=True)
 # Open/close real top controls repeatedly. No posts or social mutations.
 for _ in range(2):
  tap(wait_for(lambda n:'Changer la langue' in label(n)))
  tap(wait_for(lambda n:'Fermer le choix de langue' in label(n)))
 checks.append('language-open-close-twice')
 # Read-only publication interactions: do not send comments or share to a person.
 for _ in range(2):
  tap(find_in_feed(lambda n:label(n)=='Partager'))
  tap(wait_for(lambda n:'Fermer le partage' in label(n)))
  tap(find_in_feed(lambda n:'Ouvrir les commentaires' in label(n)))
  tap(wait_for(lambda n:'Fermer les commentaires' in label(n)))
 checks.append('publication-share-and-comments-open-close-twice')
 (root/'report.json').write_text(json.dumps({'passed':True,'checks':checks,'physicalDevice':False,'signature':'test debug signature derived from release AAB','storeImagesApproved':False}))
 print('Native Android navigation and captures completed.')
except Exception as exc:
 (root/'report.json').write_text(json.dumps({'passed':False,'checks':checks,'stage':stage,'reason':str(exc),'physicalDevice':False,'storeImagesApproved':False}))
 try:
  diagnostics=adb('logcat','-d','-t','200','AndroidRuntime:E','ActivityManager:E','*:S').decode(errors='replace')
  for value in [private['email'],private['password']]:diagnostics=diagnostics.replace(value,'[REDACTED]')
  (root/'native-errors.log').write_text(diagnostics)
  (root/'failure.png').write_bytes(adb('exec-out','screencap','-p'))
  (root/'failure.xml').write_text(ET.tostring(tree(),encoding='unicode'))
 except Exception:pass
 print('Native Android audit failed; private diagnostics retained.')
 raise SystemExit(1)
