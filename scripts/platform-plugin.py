#!/usr/bin/env python3
"""Configure the customer-scoped plugin without changing the user's Hermes profile."""
import getpass, json, os, pathlib, re, shutil, subprocess, sys, urllib.parse, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.agentpass-private'
SETTINGS = PRIVATE / 'platform-plugin.json'
PROFILE = ROOT / '.hermes-platform'
ORIGINAL = pathlib.Path.home() / '.hermes'
MODE = sys.argv[1] if len(sys.argv) > 1 else 'configure'

def save(file, data):
    file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    file.write_text(data)
    file.chmod(0o600)

def config():
    if not SETTINGS.exists():
        raise SystemExit('Run npm run plugin:configure first.')
    return json.loads(SETTINGS.read_text())

node = shutil.which('node')
if not node:
    raise SystemExit('Node.js is required.')
if MODE == 'configure':
    base = input('AgentPass URL [https://agentpass-buildx.vercel.app]: ').strip().rstrip('/') or 'https://agentpass-buildx.vercel.app'
    url = urllib.parse.urlparse(base)
    if url.username or url.password or url.query or url.fragment or (url.scheme != 'https' and not (url.scheme == 'http' and url.hostname in ['localhost','127.0.0.1'])):
        raise SystemExit('Use an HTTPS AgentPass URL, or localhost for development.')
    token = getpass.getpass('Agent credential (hidden): ').strip()
    if not re.fullmatch(r'ap1\.[a-f0-9-]{36}\.[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}', token):
        raise SystemExit('Use the credential shown when registering an agent in your workspace.')
    request = urllib.request.Request(base + '/api/platform/passport', headers={'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            passport = json.load(response)
    except Exception:
        raise SystemExit('Credential validation failed. Check the URL and credential; no configuration saved.')
    save(SETTINGS, json.dumps({'url': base, 'token': token}, indent=2))
    # This file can be merged into an MCP client by its owner. Its launcher loads the
    # credential at runtime, so the client config contains no payment/admin secrets.
    save(PRIVATE / 'agentpass-mcp.json', json.dumps({'mcpServers': {'agentpass': {
        'command': shutil.which('python3'), 'args': [str(ROOT / 'scripts/platform-plugin.py'), 'mcp']
    }}}, indent=2))
    print('Credential verified for agent:', passport['agent']['name'])
    print('Saved privately. Run npm run hermes:platform or use .agentpass-private/agentpass-mcp.json in your MCP client.')
    sys.exit(0)
if MODE == 'remove':
    if '--yes' not in sys.argv:
        raise SystemExit('Use npm run hermes:remove-platform -- --yes after stopping the profile.')
    marker = PROFILE / '.agentpass-platform.json'
    if PROFILE.is_symlink() or not marker.is_file() or json.loads(marker.read_text()).get('project') != str(ROOT):
        raise SystemExit('No matching isolated profile found. Nothing removed.')
    shutil.rmtree(PROFILE)
    print('Removed only the isolated platform profile. Rotate its credential in the dashboard if retiring it.')
    sys.exit(0)
values = config()
env = os.environ.copy()
for key in ['DATABASE_URL','DATABASE_URL_UNPOOLED','POSTGRES_URL','PGPASSWORD','POSTGRES_PASSWORD','SESSION_SECRET','OWNER_ACCESS_CODE','RECEIPT_PRIVATE_KEY','RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET','AGENTPASS_AGENT_TOKEN']:
    env.pop(key, None)
if MODE == 'mcp':
    env['AGENTPASS_URL'] = values['url']
    env['AGENTPASS_AGENT_TOKEN'] = values['token']
    os.execve(node, [node, str(ROOT / 'node_modules/tsx/dist/cli.mjs'), str(ROOT / 'integrations/agentpass/server.ts')], env)
if MODE not in ['run','prepare']:
    raise SystemExit('Unknown command.')
try:
    import yaml
except ImportError:
    raise SystemExit('Use the Python environment with PyYAML used by your existing Hermes installation.')
marker = PROFILE / '.agentpass-platform.json'
if PROFILE.is_symlink() or (PROFILE.exists() and not marker.exists()):
    raise SystemExit('Refusing to overwrite an unmarked profile.')
settings = yaml.safe_load((ORIGINAL / 'config.yaml').read_text()) if (ORIGINAL / 'config.yaml').exists() else {}
settings = settings or {}
settings['mcp_servers'] = {'agentpass': {'command': sys.executable, 'args': [str(ROOT / 'scripts/platform-plugin.py'), 'mcp'], 'timeout': 35, 'connect_timeout': 30}}
settings['toolsets'] = ['agentpass']
settings['mcp_discovery_timeout'] = 30
save(PROFILE / 'config.yaml', yaml.safe_dump(settings, sort_keys=False))
for name in ['.env','auth.json']:
    source, dest = ORIGINAL / name, PROFILE / name
    if source.exists() and not dest.exists():
        shutil.copy2(source, dest)
        dest.chmod(0o600)
save(marker, json.dumps({'project': str(ROOT), 'purpose': 'Customer identity and spending-authority plugin'}))
save(PROFILE / 'SOUL.md', '''You are the user's AgentPass control assistant. Use passport to identify your owner, current binding and spending limits. The plugin authorizes exact EXTERNAL merchant purchases; it does not sell sample research, execute UPI/card payments or browse. A spending allowance is not a funded balance. This isolated profile has only AgentPass control tools. Say when shopping/browser tools are missing instead of inventing product URLs or prices. Use authorize_purchase only for the exact item, URL and final total supplied by the user or observed with merchant tools. Preserve request IDs on retries. Before supported payment execution, verify_authority again. Never fabricate a successful payment or an order reference. report_order is an unverified client report and must have a real observed merchant confirmation. Owner policies cannot be changed by this agent.\n''')
print('Isolated customer-plugin profile ready. Original Hermes settings are unchanged.')
print('This profile tests identity and authorization only. Add the generated MCP config to your normal shopping-capable runtime for browser tasks.')
if MODE == 'prepare':
    sys.exit(0)
hermes = shutil.which('hermes')
if not hermes:
    raise SystemExit('Hermes is not on PATH.')
env['HERMES_HOME'] = str(PROFILE)
os.chdir(PROFILE)
os.execve(hermes, [hermes, 'chat', '--toolsets', 'agentpass', *sys.argv[2:]], env)
