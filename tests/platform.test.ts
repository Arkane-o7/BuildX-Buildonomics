import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authorizeIntent, bindWallet, createManagedAgent, currentAuthority, customerCookie, hashPassword, checkPassword, principal, publicAccount, reportOrder } from '../src/lib/platform';
import { createAccount, readAccount, updateAccount } from '../src/lib/platform-store';
import { digest } from '../src/lib/auth';
import { POST, GET } from '../src/app/api/platform/[...path]/route';
import type { OwnerAccount } from '../src/lib/platform-types';
const original = process.cwd(); let dir: string;
before(() => {
 dir=mkdtempSync(join(tmpdir(),'agentpass-platform-')); process.chdir(dir);
 delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL; delete process.env.VERCEL; delete process.env.EVENT_DISABLED;
 process.env.SESSION_SECRET='platform-test-secret-'.repeat(3);
 process.env.RECEIPT_PRIVATE_KEY=generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'}).toString();
});
after(() => { process.chdir(original); rmSync(dir,{recursive:true,force:true}); });
function fixture() {
 const a:OwnerAccount={id:randomUUID(),name:'Owner',email:randomUUID()+'@example.com',createdAt:new Date().toISOString(),subscription:{plan:'event_trial',status:'trial',billingConnected:false},agents:[],wallets:[],intents:[],events:[]};
 const {agent,token}=createManagedAgent(a,'Atlas','Hermes','agent-avatar-crab.gif');
 a.wallets.push({id:randomUUID(),label:'Example account',kind:'upi',maskedReference:'de•••@bank',connection:'reference_only',createdAt:new Date().toISOString()});
 bindWallet(a,a.agents[0],a.wallets[0].id);
 return {a,agent:a.agents[0],token,auth:{accountId:a.id,agentId:agent.id,tokenHash:digest(token)},input:{agentId:agent.id,requestId:'umbrella-001',item:'Example umbrella',url:'https://www.amazon.in/dp/EXAMPLE',amount:49900}};
}
test('customer password hashes and owner sessions verify without plaintext storage',async()=>{
 const hash=await hashPassword('a long test password'); assert.ok(!hash.includes('password')); assert.equal(await checkPassword('a long test password',hash),true); assert.equal(await checkPassword('incorrect password',hash),false);
 const {a}=fixture(); const p=await principal(new Request('https://app.test',{headers:{cookie:customerCookie(a.id)}})); assert.equal(p.accountId,a.id); assert.equal(p.agentId,null);
 await assert.rejects(principal(new Request('https://app.test',{headers:{cookie:customerCookie(a.id).replace('ap_customer=','ap_customer=x')}})));
});
test('concurrent purchase intents reserve atomically and never overspend',async()=>{
 const {a,agent,auth,input}=fixture(); agent.budget=100000; agent.perPurchase=50000; await createAccount(a,'unused');
 const results=await Promise.all(Array.from({length:12},(_,i)=>updateAccount(a.id,s=>authorizeIntent(s,auth,{...input,requestId:'parallel-'+i,amount:20000}))));
 assert.equal(results.filter(i=>i.status==='authorized').length,5); const saved=await readAccount(a.id); assert.equal(saved.agents[0].reserved,100000); assert.equal(saved.agents[0].spent,0);
});
test('duplicate intents reserve once and altered parameters are rejected',()=>{
 const {a,agent,auth,input}=fixture(); const first=authorizeIntent(a,auth,input); assert.equal(authorizeIntent(a,auth,input).id,first.id); assert.equal(agent.reserved,input.amount);
 for(const change of [{amount:50000},{url:'https://amazon.in/dp/OTHER'},{item:'Different item'}]) assert.throws(()=>authorizeIntent(a,auth,{...input,...change}),/different purchase/);
});
test('merchant allowlists, purchase limits, revocation and HTTPS enforced',()=>{
 for(const [patch,reason] of [[{url:'https://amazon.in.evil.test/item'},'Merchant'],[{amount:90000},'per-purchase']] as const) {
  const {a,auth,input}=fixture(); assert.match(authorizeIntent(a,auth,{...input,...patch}).reason,new RegExp(reason)); assert.equal(a.agents[0].reserved,0);
 }
 const {a,agent,auth,input}=fixture(); assert.throws(()=>authorizeIntent(a,auth,{...input,url:'http://amazon.in/item'}),/HTTPS/);
 agent.status='revoked'; assert.equal(authorizeIntent(a,auth,input).status,'blocked');
});
test('wallet rebinding preserves identity and allowance and invalidates old authority',()=>{
 const {a,agent,auth,input}=fixture(); const intent=authorizeIntent(a,auth,input); const originalId=agent.id,originalBudget=agent.budget;
 assert.equal(currentAuthority(a,intent.proof!).authorized,true);
 a.wallets.push({...a.wallets[0],id:randomUUID(),label:'Replacement'}); bindWallet(a,agent,a.wallets[1].id);
 assert.equal(agent.id,originalId); assert.equal(agent.budget,originalBudget); assert.equal(agent.reserved,input.amount); assert.equal(currentAuthority(a,intent.proof!).authorized,false);
});
test('current authority rejects tampering, policy changes, expiry and revocation',()=>{
 const {a,agent,auth,input}=fixture(); const i=authorizeIntent(a,auth,input); assert.equal(currentAuthority(a,i.proof!).paymentExecuted,false);
 assert.equal(currentAuthority(a,{...i.proof!,payload:{...i.proof!.payload,amountPaise:1}}).authentic,false);
 assert.equal(currentAuthority(a,i.proof!,Date.parse(i.expiresAt)).authorized,false);
 agent.policyVersion++; assert.equal(currentAuthority(a,i.proof!).authorized,false); agent.policyVersion--;
 agent.status='revoked'; assert.equal(currentAuthority(a,i.proof!).authorized,false);
});
test('credentials isolate owners and agents and owner-only routes reject bearer tokens',async()=>{
 const {a,token,auth,input}=fixture(); await createAccount(a,'unused'); const b=fixture();
 assert.throws(()=>authorizeIntent(b.a,auth,{...b.input}),/cannot access/);
 const other=createManagedAgent(a,'Other','Hermes','bori-waving.gif'); assert.throws(()=>authorizeIntent(a,auth,{...input,agentId:other.agent.id}),/cannot access/);
 const req=new Request('https://app.test',{headers:{authorization:'Bearer '+token}}); assert.equal((await principal(req)).agentId,auth.agentId); await assert.rejects(principal(req,true),/owner/);
 await updateAccount(a.id,s=>{s.agents[0].tokenHash=digest('rotated');}); await assert.rejects(principal(req),/rotated/);
 assert.ok(!JSON.stringify(publicAccount(a)).includes('tokenHash'));
});
test('agent sprites must be unique among active agents, and revoking one frees its sprite',()=>{
 const {a,agent}=fixture();
 assert.throws(()=>createManagedAgent(a,'Duplicate','Hermes','agent-avatar-crab.gif'),/already used/);
 const second=createManagedAgent(a,'Second','Hermes','bori-waving.gif').agent; assert.equal(second.avatar,'bori-waving.gif');
 agent.status='revoked';
 const third=createManagedAgent(a,'Third','Hermes','agent-avatar-crab.gif').agent; assert.equal(third.avatar,'agent-avatar-crab.gif');
});
test('order reports are idempotent client evidence, never settlement proofs',()=>{
 const {a,agent,auth,input}=fixture(); const i=authorizeIntent(a,auth,input); reportOrder(a,auth,i.id,'EXAMPLE-ORDER'); reportOrder(a,auth,i.id,'EXAMPLE-ORDER');
 assert.equal(i.evidenceSource,'agent_report'); assert.match(i.reason,/No provider-verified/); assert.equal(agent.reserved,0); assert.equal(agent.spent,input.amount); assert.equal(currentAuthority(a,i.proof!).authorized,false);
 assert.throws(()=>reportOrder(a,auth,i.id,'different'),/different order/);
});
test('HTTP routes isolate accounts, mask references, reject CSRF and distinguish authorization from payment',async()=>{
 const {a,token}=fixture(); await createAccount(a,'unused'); const b=fixture(); await createAccount(b.a,'unused');
 const cookie=customerCookie(a.id),otherCookie=customerCookie(b.a.id);
 async function call(path:string,body?:unknown,headers:Record<string,string>={cookie,origin:'https://app.test'}) {
  const response=await (body===undefined?GET:POST)(new Request('https://app.test/api/platform/'+path,{method:body===undefined?'GET':'POST',headers:{...headers,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  return {status:response.status,data:await response.json()};
 }
 assert.equal((await call('account',undefined,{cookie:otherCookie})).data.account.id,b.a.id);
 assert.equal((await call('agents/'+b.agent.id+'/revoke',{})).status,404);
 assert.equal((await call('agents', {name:'Unauthorized',runtime:'Hermes'}, {authorization:'Bearer '+token})).status,403);
 assert.equal((await call('wallets',{label:'UPI',kind:'upi',reference:'private-name@bank'})).data.wallet.maskedReference,'pr•••@bank');
 assert.equal((await call('wallets',{label:'Card',kind:'card',reference:'4111111111111111'})).status,400);
 assert.equal((await call('agents/'+a.agents[0].id+'/revoke',{}, {cookie,origin:'https://evil.test'})).status,403);
 const result=await call('authorize',{requestId:'http-intent',item:'Test umbrella',url:'https://amazon.in/dp/EXAMPLE',amount:40000},{authorization:'Bearer '+token});
 assert.equal(result.data.paymentExecuted,false); assert.equal(result.data.intent.status,'authorized');
 assert.equal((await call('cancel',{intentId:result.data.intent.id,confirmNoPayment:true})).status,200);
 assert.equal((await call('passport',undefined,{authorization:'Bearer '+token})).data.paymentExecution.available,false);
});
test('same-origin requests use browser-facing Host when Next normalizes localhost',async()=>{
 const {checkOrigin}=await import('../src/lib/auth');
 assert.doesNotThrow(()=>checkOrigin(new Request('http://localhost:3010/api/platform/logout',{headers:{host:'127.0.0.1:3010',origin:'http://127.0.0.1:3010'}})));
 assert.throws(()=>checkOrigin(new Request('http://localhost:3010/api/platform/logout',{headers:{host:'127.0.0.1:3010',origin:'http://evil.test'}})),/origin/);
});
