import { parentPort, workerData } from 'node:worker_threads';
import { openDatabase } from '../../db/local.ts';
import { pagamentos_despesa } from '../../db/schema.ts';
parentPort.once('message',async()=>{
  const db=openDatabase(workerData.path);
  try {
    await db.transaction({system:'teste-concorrencia'},tx=>tx.insert(pagamentos_despesa).values({despesa_id:workerData.despesaId,data_pagamento:'2026-09-14',valor:'70.00'}));
    parentPort.postMessage({ok:true});
  }catch(error){let message='';for(let e=error;e;e=e.cause)message+=e.message;parentPort.postMessage({ok:false,message});}
  finally{db.close();parentPort.close();}
});
parentPort.postMessage({ready:true});
