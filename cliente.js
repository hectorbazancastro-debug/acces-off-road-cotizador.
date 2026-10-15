import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";

const app = initializeApp({
  apiKey:"AIzaSyCxlX4wWXRkyacBlbwCz0FepRG4li34pac",
  authDomain:"acces-off-road.firebaseapp.com",
  projectId:"acces-off-road",
  storageBucket:"acces-off-road.firebasestorage.app",
  messagingSenderId:"197389972400",
  appId:"1:197389972400:web:6504f900672c2b2d8ddc75"
});
const db=getFirestore(app);
const auth=getAuth(app);
const $=id=>document.getElementById(id);
const token=new URL(location.href).searchParams.get("token")||"";
const money=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
let expiresAt=0,products=[],cart=new Map(),taxPct=16,submitted=false;
let activeSection="all";
const SECTIONS=[
  ["all","Todas las partes"],["defensas","Defensas"],["luces","Luces y faros"],
  ["suspension","Suspensión"],["amortiguadores","Amortiguadores"],["direccion","Dirección"],
  ["rines","Rines"],["llantas","Llantas"],["winch","Winch"],
  ["recuperacion","Recuperación"],["tren","Diferenciales y ejes"],
  ["proteccion","Protección lateral"],["rack","Racks y carga"],
  ["electrico","Eléctrico"],["otros","Otros accesorios"]
];
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function productSections(p){
  const category=normalize(p.Categoría),zone=normalize(p.Zona),description=normalize(p["Descripción"]);
  const sections=new Set();
  if(/defensa|bumper/.test(description)||(/defensa/.test(zone)&&!/winch|malacate/.test(description)))sections.add("defensas");
  if(/iluminacion/.test(category)||/faros|luces/.test(zone)||/led|faro|luz|reflector/.test(description))sections.add("luces");
  if(/suspension|amortiguadores/.test(category+" "+zone))sections.add("suspension");
  if(/amortiguador|shock/.test(zone+" "+description))sections.add("amortiguadores");
  if(/direccion/.test(zone+" "+description))sections.add("direccion");
  if(/rines/.test(zone)||/\brin\b/.test(description))sections.add("rines");
  if(/llantas/.test(zone)||/\bllanta\b/.test(description))sections.add("llantas");
  if(/winch|malacate/.test(description))sections.add("winch");
  if(/recuperacion/.test(category+" "+zone))sections.add("recuperacion");
  if(/diferencial|tren motriz|ruedas/.test(category+" "+zone))sections.add("tren");
  if(/proteccion lateral/.test(zone)||/rock slider|estribo/.test(description))sections.add("proteccion");
  if(/rack|equipamiento/.test(category+" "+zone))sections.add("rack");
  if(/electrico/.test(category+" "+zone))sections.add("electrico");
  if(!sections.size)sections.add("otros");
  return sections;
}
function drawSections(){
  const rows=allowedProducts();
  const options=SECTIONS.map(([id,label])=>({
    id,label,count:id==="all"?rows.length:rows.filter(p=>productSections(p).has(id)).length
  })).filter(x=>x.id==="all"||x.count>0);
  $("categories").innerHTML=options.map(x=>
    '<button type="button" data-section="'+x.id+'" aria-pressed="'+(activeSection===x.id)+'" class="'+(activeSection===x.id?'selected':'')+'"><span>'+esc(x.label)+'</span><span class="qty">'+x.count+'</span></button>'
  ).join("");
  $("sectionHeading").textContent=SECTIONS.find(x=>x[0]===activeSection)?.[1]||"Todos los productos";
}
const round=n=>Math.round(n*100)/100;
function expired(){return !expiresAt||Date.now()>=expiresAt;}
function block(reason){
  $("app").hidden=true;$("loading").hidden=true;$("blocked").hidden=false;
  $("blockedMessage").textContent=reason||"Solicita un nuevo QR en la tienda.";
}
function tick(){
  if(expired()){block("Este QR venció después de una hora. Solicita uno nuevo al vendedor.");return;}
  const sec=Math.max(0,Math.floor((expiresAt-Date.now())/1000));
  $("clock").textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
}
function allowedProducts(){return products.filter(p=>p.Activo!=="No"&&Number(p["Precio USD"])>=0);}
function drawProducts(){
  const q=$("search").value.trim().toLocaleLowerCase("es");
  const rows=allowedProducts().filter(p=>
    (activeSection==="all"||productSections(p).has(activeSection)) &&
    (!q||[p.SKU,p.Marca,p["Descripción"],p["Aplicación"],p.Categoría,p.Zona].some(v=>String(v||"").toLocaleLowerCase("es").includes(q)))
  );
  $("productsCount").textContent=rows.length+" producto(s) en esta selección";
  $("products").innerHTML=rows.map(p=>'<div class="item"><div class="sku">'+esc(p.SKU)+' · '+esc(p.Marca)+'</div><div class="name">'+esc(p["Descripción"])+'</div><div class="muted">'+esc(p["Aplicación"]||"")+'</div><div class="row"><b class="price">'+money(Number(p["Precio USD"]))+'</b><button class="primary add" data-sku="'+esc(p.SKU)+'">Agregar</button></div></div>').join("")||'<p class="muted">No se encontraron productos. Solicita ayuda en el mostrador.</p>';
}
function totals(){
  const lines=[...cart].map(([sku,qty])=>{const p=products.find(p=>p.SKU===sku);return{sku,descripcion:p["Descripción"],marca:p.Marca,qty,unitPrice:Number(p["Precio USD"]),amount:round(qty*Number(p["Precio USD"]))};});
  const subtotal=round(lines.reduce((sum,l)=>sum+l.amount,0));
  const tax=round(subtotal*taxPct/100);
  return {lines,subtotal,taxPct,tax,total:round(subtotal+tax)};
}
function drawCart(){
  const t=totals();
  $("cart").innerHTML=t.lines.length?t.lines.map(l=>'<div class="cart-line"><div><b>'+esc(l.descripcion)+'</b><div class="muted">'+esc(l.sku)+' · '+money(l.unitPrice)+'</div></div><div><input aria-label="Cantidad" data-qty="'+esc(l.sku)+'" type="number" min="1" max="20" value="'+l.qty+'"><button class="remove" aria-label="Quitar producto" data-remove="'+esc(l.sku)+'">×</button></div></div>').join(""):'<p class="muted">Selecciona un producto para comenzar.</p>';
  $("subtotal").textContent=money(t.subtotal);$("taxLabel").textContent="IVA ("+taxPct+"%)";
  $("tax").textContent=money(t.tax);$("total").textContent=money(t.total);
}
$("search").addEventListener("input",drawProducts);
$("categories").addEventListener("click",event=>{
  const button=event.target.closest("button[data-section]");
  if(!button||expired())return;
  activeSection=button.dataset.section;
  $("search").value="";
  drawSections();
  drawProducts();
});
$("clearFilters").addEventListener("click",()=>{
  activeSection="all";$("search").value="";drawSections();drawProducts();
});
$("products").addEventListener("click",event=>{
  const sku=event.target.closest("[data-sku]")?.dataset.sku;
  if(!sku||expired()||submitted)return;
  cart.set(sku,Math.min(20,(cart.get(sku)||0)+1));drawCart();
});
$("cart").addEventListener("change",event=>{
  const sku=event.target.dataset.qty;if(!sku||submitted)return;
  const n=Math.max(1,Math.min(20,Math.floor(Number(event.target.value)||1)));
  cart.set(sku,n);drawCart();
});
$("cart").addEventListener("click",event=>{
  const sku=event.target.closest("[data-remove]")?.dataset.remove;
  if(sku&&!submitted){cart.delete(sku);drawCart();}
});
$("submit").addEventListener("click",async()=>{
  if(submitted||expired()){block();return;}
  const customer=$("customer").value.trim();
  if(customer.length<2){$("result").hidden=false;$("result").textContent="Escribe tu nombre para enviar la cotización.";return;}
  const t=totals();
  if(!t.lines.length){$("result").hidden=false;$("result").textContent="Agrega al menos un producto.";return;}
  const button=$("submit");button.disabled=true;button.textContent="Enviando…";
  try{
    // La regla Firestore vuelve a comprobar el vencimiento al guardar.
    const ref="QR-"+crypto.randomUUID().replaceAll("-","").slice(0,16).toUpperCase();
    const guestUid=auth.currentUser?.uid;
    if(!guestUid)throw new Error("La sesión temporal no está disponible.");
    await setDoc(doc(db,"acces_kiosk_quotes",token+"-"+guestUid),{
      id:ref,kioskToken:token,guestUid,createdAt:serverTimestamp(),customer:customer.slice(0,100),
      phone:$("phone").value.trim().slice(0,30),vehicle:$("vehicle").value.trim().slice(0,100),
      lines:t.lines,subtotal:t.subtotal,taxPct:t.taxPct,tax:t.tax,total:t.total,
      status:"Pendiente de validar"
    });
    submitted=true;
    $("result").hidden=false;
    $("result").innerHTML="<b>Cotización enviada.</b> Muestra este folio al vendedor:<br><strong>"+esc(ref)+"</strong>";
    button.textContent="Enviada";$("customer").readOnly=true;$("phone").readOnly=true;$("vehicle").readOnly=true;
  }catch(error){
    $("result").hidden=false;$("result").textContent="No fue posible enviar. Verifica tu conexión y que el QR no haya vencido. "+(error.code||"");
    if(expired())block();else{button.disabled=false;button.textContent="Reintentar envío";}
  }
});
async function init(){
  if(!/^[a-f0-9]{64}$/i.test(token)){block("Este enlace no tiene un código de tienda válido.");return;}
  try{
    // Inicio invisible de sesión anónima; el cliente no crea una cuenta ni contraseña.
    if(!auth.currentUser || !auth.currentUser.isAnonymous)await signInAnonymously(auth);
    const snap=await getDoc(doc(db,"acces_kiosk_tokens",token));
    if(!snap.exists()||snap.data().active!==true)throw new Error("QR no disponible");
    const stamp=snap.data().createdAt?.toMillis();
    if(!stamp)throw new Error("Fecha no disponible");
    expiresAt=stamp+60*60*1000;
    if(expired()){block();return;}
    products=Array.isArray(snap.data().catalog)?snap.data().catalog:[];
    if(!products.length)throw new Error("Sin productos publicados en este QR");
    const v=Number(snap.data().taxPct);
    if(Number.isFinite(v)&&v>=0&&v<=100)taxPct=v;
    $("loading").hidden=true;$("app").hidden=false;
    drawSections();drawProducts();drawCart();tick();setInterval(tick,1000);
  }catch(error){block("No se pudo validar el QR o cargar el catálogo. Pide al vendedor que genere otro acceso.");}
}
init();