import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';
const client=new Client({name:'agentpass-platform-check',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:'python3',args:[resolve('scripts/platform-plugin.py'),'mcp']}));
try {
 const {tools}=await client.listTools();
 const expected=['passport','authorize_purchase','purchase_history','verify_authority','report_order'];
 if (expected.some(name=>!tools.some(t=>t.name===name))) throw Error('Required plugin tools missing');
 console.log('Five scoped platform MCP tools discovered.');
 async function call(name:string,args:Record<string,unknown>={}) {
  const r=await client.callTool({name,arguments:args});
  if(r.isError) throw Error(name+' failed');
  return JSON.parse((r.content as {type:string;text:string}[]).find(c=>c.type==='text')!.text);
 }
 const passport=await call('passport');
 if(passport.paymentExecution.available!==false) throw Error('Unexpected execution capability');
 console.log('Identity lookup passed; account explicitly has no payment execution adapter.');
 if(process.argv.includes('--authorize-demo')) {
  const r=await call('authorize_purchase',{requestId:'mcp-check-umbrella-001',item:'Demo umbrella (authorization test only)',url:'https://www.amazon.in/dp/EXAMPLE',amountPaise:49900});
  if(r.intent.status!=='authorized'||r.paymentExecuted!==false) throw Error('Demo authorization failed');
  const again=await call('authorize_purchase',{requestId:'mcp-check-umbrella-001',item:'Demo umbrella (authorization test only)',url:'https://www.amazon.in/dp/EXAMPLE',amountPaise:49900});
  if(again.intent.id!==r.intent.id) throw Error('Idempotency failed');
  const verify=await call('verify_authority',{intentId:r.intent.id});
  if(!verify.authorized||verify.paymentExecuted!==false) throw Error('Authority verification failed');
  const blocked=await call('authorize_purchase',{requestId:'mcp-check-over-limit-001',item:'Demo over-limit umbrella',url:'https://www.amazon.in/dp/EXAMPLE',amountPaise:90000});
  if(blocked.intent.status!=='blocked') throw Error('Cap enforcement failed');
  console.log('Authorization, exact retry, current-authority verification and cap rejection passed. No payment attempted.');
 }
 await call('purchase_history');
 console.log('Agent-scoped history lookup passed.');
} finally { await client.close(); }
