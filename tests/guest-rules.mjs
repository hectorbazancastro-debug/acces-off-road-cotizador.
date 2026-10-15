import fs from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,collection,getDocs,updateDoc,serverTimestamp,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-acces-qr',firestore:{host:'127.0.0.1',port:8088,rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
const owner='l441Clb8JvSFc6sVtNUdRJJC2402';
const token='a'.repeat(48), expired='b'.repeat(48), revoked='c'.repeat(48);
const payload={ownerUid:'seller1',createdAt:serverTimestamp(),active:true,business:'ACCES',tax:16,products:[{sku:'X',name:'Producto',price:100}]};
await env.withSecurityRulesDisabled(async context=>{
 const db=context.firestore();
 for(const [id,data] of Object.entries({seller1:{role:'seller',status:'active'},seller2:{role:'seller',status:'active'},pending:{role:'seller',status:'pending'}}))await setDoc(doc(db,'acces_profiles',id),data);
 await setDoc(doc(db,'acces_clients','private'),{name:'Private'});
 await setDoc(doc(db,'acces_catalog','X'),{SKU:'X'});
 await setDoc(doc(db,'acces_quotes','other'),{id:'other',ownerUid:'seller2'});
 await setDoc(doc(db,'acces_guest_sessions',expired),{...payload,createdAt:Timestamp.fromMillis(Date.now()-3601000)});
 await setDoc(doc(db,'acces_guest_sessions',revoked),{...payload,createdAt:Timestamp.now(),active:false});
});
const seller=env.authenticatedContext('seller1').firestore(), guest=env.unauthenticatedContext().firestore(), pending=env.authenticatedContext('pending').firestore(), admin=env.authenticatedContext(owner).firestore();
let passed=0;async function test(label,fn){await fn();console.log('PASS',label);passed++;}
try{
await test('Seller creates time-limited QR',()=>assertSucceeds(setDoc(doc(seller,'acces_guest_sessions',token),payload)));
await test('Guest reads active QR',()=>assertSucceeds(getDoc(doc(guest,'acces_guest_sessions',token))));
await test('Guest cannot list tokens',()=>assertFails(getDocs(collection(guest,'acces_guest_sessions'))));
await test('Expired QR denied by server',()=>assertFails(getDoc(doc(guest,'acces_guest_sessions',expired))));
await test('Revoked QR denied',()=>assertFails(getDoc(doc(guest,'acces_guest_sessions',revoked))));
await test('Guest cannot read inventory',()=>assertFails(getDoc(doc(guest,'acces_catalog','X'))));
await test('Guest cannot read clients',()=>assertFails(getDoc(doc(guest,'acces_clients','private'))));
await test('Guest cannot write quotes',()=>assertFails(setDoc(doc(guest,'acces_quotes','hack'),{id:'hack'})));
await test('Seller cannot access clients',()=>assertFails(getDoc(doc(seller,'acces_clients','private'))));
await test('Seller can view inventory',()=>assertSucceeds(getDoc(doc(seller,'acces_catalog','X'))));
await test('Seller cannot edit inventory',()=>assertFails(updateDoc(doc(seller,'acces_catalog','X'),{price:1})));
await test('Seller creates own quote',()=>assertSucceeds(setDoc(doc(seller,'acces_quotes','own'),{id:'own',ownerUid:'seller1'})));
await test('Seller cannot read others quotes',()=>assertFails(getDoc(doc(seller,'acces_quotes','other'))));
await test('Seller cannot extend QR',()=>assertFails(updateDoc(doc(seller,'acces_guest_sessions',token),{createdAt:serverTimestamp()})));
await test('Pending seller cannot create QR',()=>assertFails(setDoc(doc(pending,'acces_guest_sessions','d'.repeat(48)),{...payload,ownerUid:'pending'})));
await test('Future timestamp cannot extend expiry',()=>assertFails(setDoc(doc(seller,'acces_guest_sessions','e'.repeat(48)),{...payload,createdAt:Timestamp.fromMillis(Date.now()+86400000)})));
await test('Guest cannot create own access',()=>assertFails(setDoc(doc(guest,'acces_guest_sessions','f'.repeat(48)),payload)));
await test('Admin retains clients access',()=>assertSucceeds(getDoc(doc(admin,'acces_clients','private'))));
await test('Seller can revoke own QR',()=>assertSucceeds(updateDoc(doc(seller,'acces_guest_sessions',token),{active:false})));
await test('Revocation blocks subsequent guest reads',()=>assertFails(getDoc(doc(guest,'acces_guest_sessions',token))));
console.log('RESULT',passed,'tests passed');
}finally{await env.cleanup();}
