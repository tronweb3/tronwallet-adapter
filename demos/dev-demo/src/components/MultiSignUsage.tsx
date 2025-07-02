import type { Adapter, Transaction } from "@tronweb3/tronwallet-abstract-adapter";
import { useState } from "react";
import { tronWeb } from "../tronweb";

const receiver = 'TMDKznuDWaZwfZHcM61FVFstyYNmK6Njk1';

// update permissionId with yourself permissionId
const permissionId = 2;
// update the first private key with your private key
const privateKey1 = '';
// update the second private key with your private key
const privateKey2 = '';
export function MultiSignUsage({ adapter }: {adapter: Adapter}) { 
  const [ transaction, setTransaction] = useState<Transaction>();

  async function createTransaction() {
    const transaction = await tronWeb.transactionBuilder.sendTrx(receiver, tronWeb.toSun(0.000001) as unknown as number, adapter.address!, { permissionId });
    setTransaction(transaction);
    console.log('Created transaction:', transaction);
    alert('success Created')
  }

  async function signWithAddress1() {
    const signedTransaction = await adapter.multiSign(transaction, privateKey1, permissionId);
    setTransaction(signedTransaction);
    console.log('signedTransaction:', signedTransaction);
    alert('success signed')
  }

  async function signWithAddress2() {
    const signedTransaction = await adapter.multiSign(transaction, privateKey2, permissionId);
    setTransaction(signedTransaction);
    console.log('signedTransaction:', signedTransaction);
    alert('success signed')
  }

  async function broadcast() {
    const result = await tronWeb.trx.sendRawTransaction(transaction as any);
    console.log('broadcast result:', result);
    alert('success broadcast')
  }


  async function getAccounts() {
    const accounts = await tronWeb.trx.getAccount(adapter.address!);
    console.log('accounts:', accounts);
  }

  async function getWeight() {
    const signWeight = await tronWeb.trx.getSignWeight(transaction as any);
    console.log('signWeight:', signWeight);
  }

  return <div>
    <button onClick={createTransaction}>Create Transaction</button>
    <button onClick={signWithAddress1}>sign With Address1</button>
    <button onClick={signWithAddress2}>sign With Address2</button>
    <button onClick={broadcast}>Broadcast</button>

    {/* <button onClick={getAccounts}>getAccount</button>
    <button onClick={getWeight}>getWeight</button> */}
  </div>
}