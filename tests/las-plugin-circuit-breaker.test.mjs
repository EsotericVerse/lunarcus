import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../plugins/chrome/background.js',import.meta.url),'utf8');
const helpers=code.slice(code.indexOf('async function readCircuit(){'),code.indexOf('function openDb(){'));
function setup(){
 const data={},calls=[];
 const chrome={storage:{local:{
  get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).map(x=>[x,data[x]])),
  set:async obj=>Object.assign(data,obj),
  remove:async keys=>{for(const k of Array.isArray(keys)?keys:[keys])delete data[k];}
 }},alarms:{create:async(n,o)=>calls.push({name:n,...o}),
  clear:async n=>calls.push({clear:n})}};
 const ctx=vm.createContext({chrome,Date,logDiagnostic:async()=>{},
  QUEUE_ALARM:'lunarcus-queue-window',QUEUE_WINDOW_MS:600000,CIRCUIT_KEY:'locQueueCircuit'});
 vm.runInContext(helpers+';globalThis.f={readCircuit,scheduleQueueTimer,tripCircuit,resetCircuitAfterReceipt};',ctx);
 return {data,calls,...ctx.f};
}
test('one fixed ten-minute Queue window is not postponed by new capture',async()=>{
 const x=setup();x.data.locOAuth={refresh_token:'TEST'};
 await x.scheduleQueueTimer();
 const when=x.data.locQueueNextSendAt;
 assert.ok(when>Date.now()+9*60*1000);
 await x.scheduleQueueTimer();
 assert.equal(x.data.locQueueNextSendAt,when);
});
test('first error latches durable circuit and cancels schedule',async()=>{
 const x=setup();x.data.locOAuth={refresh_token:'TEST'};
 await x.scheduleQueueTimer();
 await x.tripCircuit({httpStatus:503});
 assert.equal(x.data.locQueueCircuit.open,true);
 assert.equal(x.data.locQueueCircuit.status,503);
 assert.equal(x.data.locImportPaused,true);
 assert.equal(await x.scheduleQueueTimer(),false);
 assert.equal(x.data.locQueueNextSendAt,undefined);
});
test('network error locks without storing payload or OAuth details',async()=>{
 const x=setup();await x.tripCircuit(Error('Failed to fetch'));
 assert.deepEqual(Object.keys(x.data.locQueueCircuit).sort(),['category','open','since','status']);
});
test('verified acknowledgement closes latched circuit',async()=>{
 const x=setup();await x.tripCircuit({httpStatus:500});
 await x.resetCircuitAfterReceipt();
 assert.equal(await x.readCircuit(),null);
});
test('no immediate capture, periodic retry, or second 401 write',()=>{
 assert.doesNotMatch(code,/periodInMinutes:5/);
 assert.doesNotMatch(code,/if\(pendingCount\)void flush\(false\)/);
 assert.doesNotMatch(code,/await activeToken\(true\)/);
 // Explicit user actions may call flush(true); only automatic recursion is banned.
 assert.doesNotMatch(code,/try\{await inFlight\}catch\{\}/);
 assert.match(code,/if\(await readCircuit\(\)&&!force\)/);
 assert.match(code,/await tripCircuit\(e\)/);
});
