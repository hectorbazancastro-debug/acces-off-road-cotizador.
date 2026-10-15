import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getFirestore, doc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
const db=getFirestore(initializeApp(firebaseConfig));
const token=location.hash.slice(1);
const el=id=>document.getElementById(id);
const money=value=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'USD'}).format(value)+' USD';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let session=null,expires=0,allowed=false,cart=new Map(),checking=null;
const folio='CLIENTE-'+crypto.randomUUID().slice(0,8).toUpperCase();
el('folio').textContent=folio;
function lock(text,terminal=false){allowed=false;el('shop').hidden=true;el('status').hidden=false;el('status').textContent=text;el('retry').hidden=terminal;if(terminal){session=null;cart.clear();el('products').replaceChildren();el('lines').replaceChildren();el('clock').textContent='Acceso finalizado';}}
async function validate(){
 if(checking)return checking;
 if(!/^[a-f0-9]{48}$/.test(token)){lock('Este enlace no es válido. Solicita al vendedor un nuevo QR.',true);return false;}
 checking=(async()=>{
  try{
   const snap=await getDocFromServer(doc(db,'acces_guest_sessions',token));
   if(!snap.exists())throw Object.assign(new Error(),{code:'permission-denied'});
   const value=snap.data();expires=value.createdAt.toMillis()+3600000;
   if(!value.active||Date.now()>=expires){lock('El QR venció. Solicita un nuevo acceso al vendedor.',true);return false;}
   session=value;allowed=true;el('business').textContent=value.business;el('status').hidden=true;el('retry').hidden=true;el('shop').hidden=false;renderProducts();renderCart();tick();return true;
  }catch(error){const terminal=error.code==='permission-denied';lock(terminal?'Este QR venció o fue desactivado. Solicita uno nuevo al vendedor.':'No pudimos validar el acceso. Revisa tu conexión a Internet.',terminal);return false;}
  finally{checking=null;}
 })();return checking;
}
function tick(){if(!allowed)return;const seconds=Math.max(0,Math.floor((expires-Date.now())/1000));if(!seconds){lock('Tu hora de acceso terminó. Solicita otro QR al vendedor.',true);return;}el('clock').textContent='Acceso disponible: '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
function renderProducts(){if(!session)return;const term=el('search').value.trim().toLowerCase();el('products').innerHTML=session.products.filter(p=>[p.sku,p.name,p.brand,p.category,p.fit].some(v=>String(v||'').toLowerCase().includes(term))).map(p=>'<article class="card"><small>'+esc(p.sku)+' · '+esc(p.brand)+'</small><h3>'+esc(p.name)+'</h3><p class="muted">'+esc(p.fit)+'</p><div class="row"><b>'+money(p.price)+'</b><button data-sku="'+esc(p.sku)+'">Agregar</button></div></article>').join('')||'<p>No se encontraron productos.</p>';}
function summary(){const lines=[...cart].map(([sku,qty])=>({...session.products.find(p=>p.sku===sku),qty}));const subtotal=Math.round(lines.reduce((sum,p)=>sum+p.price*p.qty,0)*100)/100;const tax=Math.round(subtotal*session.tax)/100;return{lines,subtotal,tax,total:Math.round((subtotal+tax)*100)/100};}
function renderCart(){if(!session)return;const s=summary();el('lines').innerHTML=s.lines.map(p=>'<div class="cart-line"><b>'+esc(p.name)+'</b><div class="row"><span>'+p.qty+' × '+money(p.price)+'</span><label>Cantidad<input aria-label="Cantidad de '+esc(p.name)+'" data-qty="'+esc(p.sku)+'" type="number" min="1" max="99" step="1" value="'+p.qty+'"></label><button class="remove" data-remove="'+esc(p.sku)+'">Quitar</button></div></div>').join('')||'<p>Agrega productos para cotizar.</p>';el('subtotal').textContent='Subtotal: '+money(s.subtotal);el('tax').textContent='IVA ('+session.tax+'%): '+money(s.tax);el('total').textContent='Total: '+money(s.total);el('print').disabled=el('download').disabled=!s.lines.length;}
el('search').addEventListener('input',renderProducts);
el('products').addEventListener('click',async event=>{const b=event.target.closest('[data-sku]');if(!b)return;const sku=b.dataset.sku;if(!await validate())return;if(!session.products.some(p=>p.sku===sku))return;cart.set(sku,Math.min(99,(cart.get(sku)||0)+1));renderCart();});
el('lines').addEventListener('change',async event=>{const sku=event.target.dataset.qty;if(!sku)return;const qty=Math.min(99,Math.max(1,Math.floor(Number(event.target.value)||1)));if(!await validate())return;cart.set(sku,qty);renderCart();});
el('lines').addEventListener('click',async event=>{const b=event.target.closest('[data-remove]');if(!b)return;const sku=b.dataset.remove;if(!await validate())return;cart.delete(sku);renderCart();});
el('print').addEventListener('click',async()=>{if(await validate())window.print();});
el('download').addEventListener('click',async()=>{if(!await validate())return;const s=summary();const text=[session.business,folio,'Cotización orientativa · '+new Date().toLocaleString('es-MX'),...s.lines.map(p=>p.qty+' × '+p.name+' ('+p.sku+'): '+money(p.qty*p.price)),'Subtotal: '+money(s.subtotal),'IVA ('+session.tax+'%): '+money(s.tax),'Total: '+money(s.total),'Sujeta a confirmación en mostrador. No es una compra ni reserva.'].join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=folio+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
el('retry').addEventListener('click',validate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)validate();});
setInterval(tick,1000);setInterval(()=>{if(allowed&&!document.hidden)validate();},30000);
validate();
