import {initializeApp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import {getFirestore,doc,getDoc,getDocs,collection,setDoc,updateDoc,onSnapshot,serverTimestamp} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const app=initializeApp({
  apiKey:"AIzaSyCxlX4wWXRkyacBlbwCz0FepRG4li34pac",
  authDomain:"acces-off-road.firebaseapp.com",
  projectId:"acces-off-road",
  storageBucket:"acces-off-road.firebasestorage.app",
  messagingSenderId:"197389972400",
  appId:"1:197389972400:web:6504f900672c2b2d8ddc75"
});
const auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const OWNER_UID="l441Clb8JvSFc6sVtNUdRJJC2402";
const safe=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const cash=n=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n||0);
const notice=message=>{$("status").textContent=message;};
let currentUser=null,currentToken=null,expiresAt=0,timer=null,unsubscribe=null;
function close(){
  if(unsubscribe){unsubscribe();unsubscribe=null;}
  clearInterval(timer);timer=null;currentUser=null;currentToken=null;
  $("privatePanel").hidden=true;$("qrPrint").hidden=true;$("qrActions").hidden=true;
}
$("signIn").addEventListener("click",async()=>{
  notice("Iniciando sesión…");
  try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);}
  catch(error){notice("Inicio de sesión fallido: "+(error.code||"comprueba tus datos"));}
});
$("signOut").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async user=>{
  close();
  if(!user){$("loginPanel").hidden=false;notice("Inicia sesión con tu cuenta autorizada.");return;}
  try{
    const profileSnap=await getDoc(doc(db,"acces_profiles",user.uid));
    const profile=profileSnap.exists()?profileSnap.data():null;
    if(user.uid!==OWNER_UID && (!profile||profile.status!=="active"||!["seller","admin"].includes(profile.role))){
      throw Error("Tu cuenta requiere la autorización del administrador.");
    }
    currentUser=user;$("loginPanel").hidden=true;$("privatePanel").hidden=false;
    notice("Sesión autorizada: "+(profile?.name||user.email));
    unsubscribe=onSnapshot(collection(db,"acces_kiosk_quotes"),snapshot=>{
      const rows=snapshot.docs.map(d=>d.data()).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      $("inbox").innerHTML=rows.length?rows.slice(0,75).map(q=>'<div class="entry"><b>'+safe(q.id)+'</b> · '+safe(q.customer)+
        '<div class="muted">'+safe(q.phone||"Sin teléfono")+' · '+safe(q.vehicle||"Sin vehículo")+' · '+safe(q.status)+'</div>'+
        '<b>'+cash(q.total)+'</b> USD<details><summary>Ver partidas</summary>'+
        (Array.isArray(q.lines)?q.lines.map(l=>'<p>'+safe(l.descripcion)+' · '+Number(l.qty||0)+' × '+cash(l.unitPrice)+'</p>').join(""):"")+
        '</details></div>').join(""):"Todavía no hay cotizaciones de QR.";
    },error=>{$("inbox").textContent="No se pueden leer las cotizaciones QR. Revisa las reglas de Firestore.";});
  }catch(error){$("loginPanel").hidden=false;notice("Acceso restringido: "+error.message);}
});
function randomToken(){
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  return Array.from(bytes,n=>n.toString(16).padStart(2,"0")).join("");
}
function publicProduct(p){
  return {SKU:String(p.SKU||""),Marca:String(p.Marca||""),
    "Descripción":String(p["Descripción"]||""),Categoría:String(p.Categoría||""),
    Zona:String(p.Zona||""),"Aplicación":String(p["Aplicación"]||""),
    "Precio USD":Math.max(0,Number(p["Precio USD"])||0)};
}
function drawTimer(){
  const remaining=Math.max(0,Math.ceil((expiresAt-Date.now())/1000));
  $("remaining").textContent=remaining?"Tiempo de vigencia: "+Math.floor(remaining/60)+" min "+(remaining%60)+" s":"VENCIDO: genera un nuevo QR";
  if(!remaining)clearInterval(timer);
}
$("create").addEventListener("click",async()=>{
  if(!currentUser)return;
  const button=$("create");button.disabled=true;
  try{
    const catalog=await getDocs(collection(db,"acces_catalog"));
    const products=catalog.docs.map(x=>x.data())
      .filter(x=>x.Activo!=="No")
      .map(publicProduct)
      .filter(x=>x.SKU&&x["Descripción"]);
    if(!products.length)throw Error("El catálogo está vacío. Carga primero los productos de muestra desde el panel administrador.");
    if(products.length>250)throw Error("El catálogo tiene más de 250 productos. Hay que habilitar paginación antes de generar QR.");
    const settings=await getDoc(doc(db,"acces_settings","main"));
    let taxPct=Number(settings.exists()?settings.data().tax:16);
    if(!Number.isFinite(taxPct))taxPct=16;
    taxPct=Math.max(0,Math.min(100,taxPct));
    const token=randomToken();
    const ref=doc(db,"acces_kiosk_tokens",token);
    await setDoc(ref,{
      createdAt:serverTimestamp(),createdBy:currentUser.uid,active:true,
      catalog:products,taxPct
    });
    const snapshot=await getDoc(ref);
    const stamp=snapshot.data()?.createdAt?.toMillis();
    if(!stamp)throw Error("No se pudo verificar la hora de creación.");
    currentToken=ref;expiresAt=stamp+3600000;
    const url=new URL("/cliente.html",location.origin);
    url.searchParams.set("token",token);
    $("qr").replaceChildren();
    if(typeof QRCode!=="function")throw Error("No está disponible el generador visual del QR.");
    new QRCode($("qr"),{text:url.href,width:220,height:220,
      colorDark:"#110e0c",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
    $("clientLink").href=url.href;$("clientLink").textContent=url.href;
    $("qrPrint").hidden=false;$("qrActions").hidden=false;
    clearInterval(timer);drawTimer();timer=setInterval(drawTimer,1000);
    notice("Nuevo QR generado. Caduca automáticamente en 60 minutos.");
  }catch(error){notice("No se generó el QR: "+error.message);}
  finally{button.disabled=false;}
});
$("revoke").addEventListener("click",async()=>{
  if(!currentToken)return;
  try{await updateDoc(currentToken,{active:false});
    clearInterval(timer);$("qrPrint").hidden=true;$("qrActions").hidden=true;
    notice("QR revocado. Los clientes ya no podrán utilizarlo.");
  }catch(error){notice("Error al desactivar QR: "+error.message);}
});
$("copy").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText($("clientLink").href);notice("Enlace copiado.");}
  catch{notice("Copia el enlace que aparece debajo del QR.");}
});
$("print").addEventListener("click",()=>window.print());