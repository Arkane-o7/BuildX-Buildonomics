#!/usr/bin/env python3
"""Isolated, removable Hermes event profile. Does not edit the original profile."""
import hashlib, json, os, pathlib, shutil, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
EVENT=ROOT/'.hermes-event'
ORIGINAL=pathlib.Path.home()/'.hermes'
PRIVATE=ROOT/'.agentpass-private'
MARKER=EVENT/'.agentpass-event.json'
BASELINE=PRIVATE/'hermes-original-hashes.json'
NAMES=['config.yaml','.env','auth.json']
def hashes():
    return {name:hashlib.sha256((ORIGINAL/name).read_bytes()).hexdigest() if (ORIGINAL/name).exists() else None for name in NAMES}
def safe_event():
    if EVENT.is_symlink() or (EVENT.exists() and EVENT.resolve()!=ROOT/'.hermes-event'):
        raise SystemExit('Refusing a symlink or unexpected event directory.')
def check():
    if not BASELINE.exists(): print('No event profile has been created; no original files have been modified.'); return
    old=json.loads(BASELINE.read_text()); changed=[n for n,v in hashes().items() if old.get(n)!=v]
    if changed: raise SystemExit('Original Hermes files changed since setup (possibly by normal Hermes use): '+', '.join(changed)+'. No automatic overwrite performed.')
    print('Original Hermes config, environment and authentication match the pre-event hashes.')
cmd=sys.argv[1] if len(sys.argv)>1 else 'run'
safe_event()
if cmd=='check': check();sys.exit(0)
if cmd=='remove':
    if '--yes' not in sys.argv: raise SystemExit('Use npm run hermes:remove-event -- --yes after stopping the event process.')
    if not EVENT.exists(): print('Event profile already absent.');sys.exit(0)
    if not MARKER.is_file() or json.loads(MARKER.read_text()).get('project')!=str(ROOT): raise SystemExit('Event marker did not match. Nothing removed.')
    shutil.rmtree(EVENT); print('Only the marked event profile was removed.');check();sys.exit(0)
PRIVATE.mkdir(mode=0o700,exist_ok=True)
if not BASELINE.exists(): BASELINE.write_text(json.dumps(hashes(),indent=2));BASELINE.chmod(0o600)
if EVENT.exists() and not MARKER.exists(): raise SystemExit('Existing unmarked event directory found. Nothing overwritten.')
EVENT.mkdir(mode=0o700,exist_ok=True)
# Load only the project URL and scoped token; never pass database/admin/payment secrets.
node=shutil.which('node')
if not node: raise SystemExit('Node.js 22+ is required.')
result=subprocess.run([node,'--env-file='+str(ROOT/'.env.local'),'-e','process.stdout.write(JSON.stringify({url:process.env.APP_URL,token:process.env.AGENTPASS_AGENT_TOKEN}))'],capture_output=True,text=True,check=True)
values=json.loads(result.stdout)
if not values.get('url') or not values.get('token'): raise SystemExit('Run npm run setup first.')
# Use Hermes virtual environment when available, otherwise a Python with PyYAML.
try:
    import yaml
except ImportError:
    raise SystemExit('PyYAML is needed. Run with the Python environment used by your Hermes install (or install pyyaml in a separate venv).')
config=yaml.safe_load((ORIGINAL/'config.yaml').read_text()) if (ORIGINAL/'config.yaml').exists() else {}
config=config or {}
config['mcp_servers']={'agentpass':{'command':node,'args':[str(ROOT/'node_modules/tsx/dist/cli.mjs'),str(ROOT/'integrations/hermes/server.ts')],'env':{'AGENTPASS_URL':values['url'],'AGENTPASS_AGENT_TOKEN':values['token']},'timeout':35,'connect_timeout':30}}
config['toolsets']=['agentpass']
config['mcp_discovery_timeout']=30
(EVENT/'config.yaml').write_text(yaml.safe_dump(config,sort_keys=False));(EVENT/'config.yaml').chmod(0o600)
for name in ['.env','auth.json']:
    if (ORIGINAL/name).exists() and not (EVENT/name).exists(): shutil.copy2(ORIGINAL/name,EVENT/name);(EVENT/name).chmod(0o600)
MARKER.write_text(json.dumps({'project':str(ROOT),'original':str(ORIGINAL),'purpose':'BuildX AgentPass event'},indent=2));MARKER.chmod(0o600)
(EVENT/'SOUL.md').write_text('You are Atlas, the AgentPass event assistant. Use only AgentPass tools. First check passport and services. Explain whether payments are rehearsal, test or live. Request only what the user asks for. Reuse request IDs on retries. Give the checkout link to the human; never enter payment details, claim an unverified payment succeeded, or bypass owner policy. After the human pays, check payment_status and show the result and receipt. Funding reference rotation is not real bank/card credential rotation.\n')
check();print('Event profile ready. Normal Hermes setup is unchanged.')
if cmd=='prepare': sys.exit(0)
hermes=shutil.which('hermes')
if not hermes: raise SystemExit('Hermes executable not found on PATH.')
env=os.environ.copy()
for key in ['DATABASE_URL','POSTGRES_URL','SESSION_SECRET','OWNER_ACCESS_CODE','RECEIPT_PRIVATE_KEY','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET']: env.pop(key,None)
env['HERMES_HOME']=str(EVENT)
os.chdir(EVENT)
os.execve(hermes,[hermes,'chat','--toolsets','agentpass',*sys.argv[2:]],env)
