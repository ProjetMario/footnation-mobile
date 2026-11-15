"""Exercise the installed release bundle; capture genuine Android UI, no fixture data."""
import os,pathlib,subprocess,json,time,re,shlex,xml.etree.ElementTree as ET
root=pathlib.Path(os.environ['RUNNER_TEMP'])/'footnation-android-audit'
private=json.loads((root/'private.json').read_text())
screens=root/'screens';screens.mkdir()
hierarchies=root/'hierarchies';hierarchies.mkdir()
checks=[]
def adb(*args,timeout=30):
 r=subprocess.run(['adb',*args],capture_output=True,timeout=timeout)
 if r.returncode:raise RuntimeError('ADB command failed')
 return r.stdout
def tree():
 adb('shell','uiautomator','dump','/sdcard/footnation-audit.xml')
 raw=adb('shell','cat','/sdcard/footnation-audit.xml').decode()
 return ET.fromstring(raw)
def label(node):return (node.get('text','')+' '+node.get('content-desc','')).strip()
def tap(node):
 v=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
 if len(v)!=4:raise RuntimeError('Missing bounds')
 adb('shell','input','tap',str((v[0]+v[2])//2),str((v[1]+v[3])//2))
def wait_for(test,seconds=40):
 until=time.time()+seconds
 while time.time()<until:
  t=tree();found=next((n for n in t.iter('node') if test(n)),None)
  if found is not None:return found
  time.sleep(1)
 raise RuntimeError('Expected native control not found')
def find_in_feed(test):
 for _ in range(8):
  found=next((n for n in tree().iter('node') if test(n)),None)
  if found is not None:return found
  adb('shell','input','swipe','540','1650','540','650','450');time.sleep(2)
 raise RuntimeError('Publication controls unavailable in feed')
def text(value):
 if not value.isascii() or '\n' in value:raise RuntimeError('Unsupported test input')
 adb('shell','input','text',shlex.quote(value.replace(' ','%s')))
def route(value):
 adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',shlex.quote('footnation://'+value),'com.footnation.app')
def dismiss_optional():
 for _ in range(3):
  t=tree();button=next((n for n in t.iter('node') if label(n) in ['Fermer','Plus tard','Pas maintenant','Ne pas autoriser','Don’t allow',"Don't allow"]),None)
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
 adb('shell','wm','size','1080x1920')
 adb('shell','wm','density','420')
 adb('shell','settings','put','system','system_locales','fr-FR')
 adb('shell','settings','put','global','window_animation_scale','0')
 adb('shell','settings','put','global','transition_animation_scale','0')
 route('login?next=%2Fsearch')
 wait_for(lambda n:n.get('class')=='android.widget.EditText',60)
 edits=[n for n in tree().iter('node') if n.get('class')=='android.widget.EditText']
 if len(edits)<2:raise RuntimeError('Login inputs unavailable')
 tap(edits[0]);text(private['email']);adb('shell','input','keyevent','4')
 edits=[n for n in tree().iter('node') if n.get('class')=='android.widget.EditText']
 tap(edits[1]);text(private['password']);adb('shell','input','keyevent','4')
 tap(wait_for(lambda n:label(n)=='Se connecter'))
 time.sleep(6);dismiss_optional()
 route('my-profile');dismiss_optional()
 wait_for(lambda n:bool(re.search(r'Modifier.*profil|Modifier|Edit profile',label(n))),60)
 checks.append('authenticated-demo-profile')
 for name,link,expected in [('01-recherche','search','Rechercher'),('02-clubs','clubs','Clubs'),('03-opportunites','opportunities','Opportunités'),('04-matchs','matches','Matchs')]:
  route(link);dismiss_optional();wait_for(lambda n:expected.lower() in label(n).lower(),60)
  time.sleep(5);capture(name)
 route('home');dismiss_optional();wait_for(lambda n:'Pour vous' in label(n),60)
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
 (root/'report.json').write_text(json.dumps({'passed':False,'checks':checks,'reason':str(exc),'physicalDevice':False,'storeImagesApproved':False}))
 try:
  (root/'failure.png').write_bytes(adb('exec-out','screencap','-p'))
  (root/'failure.xml').write_text(ET.tostring(tree(),encoding='unicode'))
 except Exception:pass
 print('Native Android audit failed; private diagnostics retained.')
 raise SystemExit(1)
