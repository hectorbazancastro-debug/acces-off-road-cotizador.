import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCxlX4wWXRkyacBlbwCz0FepRG4li34pac",
  authDomain: "acces-off-road.firebaseapp.com",
  projectId: "acces-off-road",
  storageBucket: "acces-off-road.firebasestorage.app",
  messagingSenderId: "197389972400",
  appId: "1:197389972400:web:6504f900672c2b2d8ddc75",
  measurementId: "G-F7D22RFB0T"
};
// Sustituir solo cuando el usuario confirme el UID del administrador principal.
// Nunca conceder privilegios de administrador al primer registro público.
const OWNER_UID = "REEMPLAZAR_UID_MAESTRO";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const gate = document.getElementById("accesAuthGate");
const msg = document.getElementById("accesAuthMsg");
const uidElement = document.getElementById("accesUid");
const sessionPanel = document.getElementById("accesSession");
const loginFields = document.getElementById("accesLoginFields");
const accountHeader = document.getElementById("accesAccount");
const sections = {
  catalog: "acces_catalog",
  clients: "acces_clients",
  vehicles: "acces_vehicles",
  quotes: "acces_quotes",
  settings: "acces_settings"
};
let activeUser = null;
let role = null;
let profile = null;
let unsubscribers = [];
let current = { catalog: [], clients: [], vehicles: [], quotes: [], settings: [] };
let awaiting = new Set();
let serverReady = new Set();
let activeSave = Promise.resolve();
let saveScheduled = false;
let busyCollections = new Set();
const notice = text => { msg.textContent = text; };
const e = text => String(text ?? "").replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const isAdmin = () => role === "owner" || role === "admin";
const isOwner = () => role === "owner";
const mapFor = (section, arr) => new Map(arr.map(x => [section === "catalog" ? String(x.SKU) : section === "settings" ? "main" : String(x.id), x]));
const idFor = key => encodeURIComponent(key);
const cloudRef = (section, key) => doc(db, sections[section], idFor(key));
const clone = v => structuredClone(v);

function closeSubscriptions(){
  unsubscribers.forEach(fn => { try{fn();}catch{} });
  unsubscribers=[];
  serverReady.clear();
  busyCollections.clear();
}

function lockApp(reason){
  document.body.classList.remove("cloud-ready");
  gate.hidden = false;
  notice(reason || "Inicia sesión para acceder al cotizador.");
}

function exposeAccount(){
  if(!activeUser)return;
  uidElement.textContent = activeUser.uid;
  accountHeader.textContent = (profile?.name || activeUser.email || "")+" · "+({owner:"Administrador maestro",admin:"Administrador",seller:"Vendedor"}[role] || "Pendiente");
  sessionPanel.hidden = false;
  loginFields.hidden = true;
}

function roleUI(){
  document.body.classList.toggle("seller-mode", !isAdmin());
  document.getElementById("accesSeedBtn").hidden = !isAdmin();
  document.getElementById("accesUserAdmin").hidden = !isAdmin();
  document.querySelectorAll('[data-p="users"],[data-p="vehicles"],[data-p="settings"]').forEach(b=>b.hidden = !isAdmin());
  document.getElementById("qSeller").readOnly = !isAdmin();
  if(profile?.name)document.getElementById("qSeller").value = profile.name;
  if(typeof window.ACCES_UI !== "undefined")window.ACCES_UI.setRole(role,activeUser?.uid,profile?.name||"");
}

function renderUsers(items){
  const root=document.getElementById("accesUserAdmin");
  if(!isAdmin())return;
  root.innerHTML = "<h3>Control de usuarios</h3><p>Los vendedores quedan pendientes hasta ser aprobados. Solo el administrador maestro puede administrar los administradores.</p>"+
    "<div class='table-scroll'><table><thead><tr><th>Nombre / correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>"+
    items.map(u=>"<tr><td>"+e(u.name||"")+"<br><small>"+e(u.email||"")+"</small></td><td>"+e(u.role||"seller")+"</td><td>"+e(u.status||"pending")+"</td><td>"+
    (u.role==="seller"&&u.uid!==activeUser.uid?
      "<button data-uid='"+e(u.uid)+"' data-status='active'>Aprobar</button> "+
      "<button data-uid='"+e(u.uid)+"' data-status='blocked'>Bloquear</button>": "")+
    (isOwner()&&u.uid!==activeUser.uid?
      "<button data-adminuid='"+e(u.uid)+"' data-role='"+(u.role==="admin"?"seller":"admin")+"'>"+(u.role==="admin"?"Quitar admin":"Hacer admin")+"</button>":"")+
    "</td></tr>").join("")+"</tbody></table></div>";
}

async function manageUser(uid,status){
  if(!isAdmin())throw new Error("Requiere administrador");
  if(uid===activeUser.uid)throw new Error("No puedes modificar tu propia cuenta");
  await updateDoc(doc(db,"acces_profiles",uid),{status});
}
async function manageRole(uid, targetRole){
  if(!isOwner())throw new Error("Solo el administrador maestro puede cambiar administradores");
  if(uid===activeUser.uid)throw new Error("No puedes modificar tu rol");
  await updateDoc(doc(db,"acces_profiles",uid),{role:targetRole,status:"active"});
}
document.getElementById("accesUserAdmin").addEventListener("click",async ev=>{
  const b=ev.target.closest("button");if(!b)return;
  try{
    b.disabled=true;
    if(b.dataset.uid) await updateDoc(doc(db,"acces_profiles",b.dataset.uid),{status:b.dataset.status});
    if(b.dataset.adminuid) await manageRole(b.dataset.adminuid,b.dataset.role);
  }catch(err){window.ACCES_UI.notice(err.message);}finally{b.disabled=false;}
});

async function loadProfile(user){
  activeUser=user;
  closeSubscriptions();
  role=null;
  profile=null;
  window.ACCES_UI.clear();
  lockApp("Validando permisos del usuario...");
  exposeAccount();
  const profileRef=doc(db,"acces_profiles",user.uid);
  let snap;
  try{
    snap=await getDoc(profileRef);
    if(!snap.exists()){
      await setDoc(profileRef,{
        name:sessionStorage.getItem("acces_registration_name") || user.displayName || user.email.split("@")[0],
        email:user.email,
        role:"seller", status:"pending", createdAt:new Date().toISOString()
      });
      snap=await getDoc(profileRef);
      sessionStorage.removeItem("acces_registration_name");
    }
  }catch(err){
    notice("Falta publicar las reglas seguras de Firestore o no hay conexión: "+err.message);
    return;
  }
  profile={...snap.data(),uid:user.uid};
  role = user.uid === OWNER_UID ? "owner" : (profile.role==="admin" && profile.status==="active" ? "admin" : "seller");
  exposeAccount();
  if(user.uid!==OWNER_UID && profile.status!=="active"){
    notice(profile.status==="blocked"?"Acceso bloqueado. Contacta al administrador.":"Cuenta creada. Pendiente de aprobación del administrador.");
    return;
  }
  notice("Cargando información compartida...");
  roleUI();
  subscribeData(user);
}

function subscribeData(user){
  const entries=Object.keys(sections);
  awaiting=new Set(entries);
  const completed=()=>{if(awaiting.size===0){document.body.classList.add("cloud-ready");gate.hidden=true;window.ACCES_UI.ready();}};
  for(const section of entries){
    const path=collection(db,sections[section]);
    const ref = section==="quotes" && !isAdmin() ? query(path,where("ownerUid","==",user.uid)):path;
    const unsubscribe=onSnapshot(ref, snapshot=>{
      const data=snapshot.docs.map(item=>{
        const row={...item.data()};
        if(section==="quotes" && !row.id)row.id=item.id;
        if(section==="catalog" && !row.SKU)row.SKU=decodeURIComponent(item.id);
        return row;
      });
      current[section]=clone(data);
      if(!busyCollections.has(section))window.ACCES_UI.apply(section,data);
      awaiting.delete(section);
      completed();
    },err=>{
      lockApp("Firestore rechazó la consulta de "+section+": "+err.message+". Revisa las reglas.");
    });
    unsubscribers.push(unsubscribe);
  }
  if(isAdmin()){
    unsubscribers.push(onSnapshot(collection(db,"acces_profiles"), snap=>{
      renderUsers(snap.docs.map(x=>({...x.data(),uid:x.id})));
      const mine=snap.docs.find(x=>x.id===activeUser.uid);
      if(mine && !isOwner() && (mine.data().status!=="active" || mine.data().role!=="admin")){
        closeSubscriptions();lockApp("Tu rol cambió. Cierra sesión y vuelve a entrar.");
      }
    },err=>window.ACCES_UI.notice("No se puede consultar usuarios: "+err.message)));
  } else {
    unsubscribers.push(onSnapshot(doc(db,"acces_profiles",user.uid),snap=>{
      if(snap.exists()&&snap.data().status!=="active"){
        closeSubscriptions();lockApp("Tu cuenta ya no está activa. Contacta al administrador.");
      }
    }));
  }
}

async function sync(){
  if(!activeUser || !role || awaiting.size)throw new Error("La sesión y los datos aún no están disponibles");
  const target=clone(window.ACCES_UI.getState());
  const sectionsChanged=Object.keys(sections).filter(section=>{
    if(section==="settings") return isAdmin() && JSON.stringify(target.settings)!==JSON.stringify(current.settings[0]||{});
    return JSON.stringify(target[section])!==JSON.stringify(current[section]);
  });
  for(const section of sectionsChanged){
    if(["catalog","vehicles","settings"].includes(section) && !isAdmin())
      throw new Error("Solo un administrador puede modificar "+section);
    busyCollections.add(section);
    const desired=section==="settings"?[target.settings]:target[section];
    const oldMap=mapFor(section,current[section]||[]);
    const newMap=mapFor(section,desired||[]);
    const writes=[];
    for(const [id,row] of newMap){
      if(!id||id==="undefined")throw new Error("Falta un identificador para "+section);
      if(JSON.stringify(row)!==JSON.stringify(oldMap.get(id))){
        let value=clone(row);
        if(["clients","quotes"].includes(section)){
          const previous=oldMap.get(id);
          value.ownerUid=previous?.ownerUid||value.ownerUid||activeUser.uid;
        }
        writes.push({op:"put",id,value});
      }
    }
    for(const id of oldMap.keys())if(!newMap.has(id))writes.push({op:"delete",id});
    try{
      // 400 cambios por lote, por debajo del máximo permitido en Firestore.
      for(let i=0;i<writes.length;i+=400){
        const batch=writeBatch(db);
        for(const item of writes.slice(i,i+400)){
          const d=cloudRef(section,item.id);
          if(item.op==="delete")batch.delete(d);
          else batch.set(d,item.value);
        }
        await batch.commit();
      }
      current[section]=clone(desired);
      window.ACCES_UI.notice("Datos guardados y sincronizados");
    } finally {
      busyCollections.delete(section);
    }
  }
}
function save(){
  activeSave = activeSave.catch(()=>{}).then(()=>sync()).catch(err=>{
    window.ACCES_UI.notice("No se pudo guardar en Firebase: "+err.message);
    throw err;
  });
  return activeSave;
}
async function seedCatalog(){
  if(!isAdmin())return;
  if(current.catalog.length && !confirm("El catálogo ya tiene productos. ¿Deseas agregar solamente los SKU de muestra que falten?"))return;
  const rows=window.ACCES_UI.getSampleCatalog();
  const currentSKUs=new Set(current.catalog.map(x=>x.SKU));
  const missing=rows.filter(x=>!currentSKUs.has(x.SKU));
  if(!missing.length){window.ACCES_UI.notice("Los 42 productos de muestra ya están cargados");return;}
  const batch=writeBatch(db);
  missing.forEach(p=>batch.set(cloudRef("catalog",p.SKU),p));
  await batch.commit();
  window.ACCES_UI.notice(missing.length+" productos de muestra cargados en la nube");
}

document.getElementById("accesSeedBtn").addEventListener("click",()=>seedCatalog().catch(err=>window.ACCES_UI.notice(err.message)));
document.getElementById("accesLoginButton").addEventListener("click",async()=>{
  try{notice("Iniciando sesión...");await signInWithEmailAndPassword(auth,document.getElementById("accesEmail").value.trim(),document.getElementById("accesPassword").value);}
  catch(err){notice("No se pudo ingresar: "+err.message);}
});
document.getElementById("accesRegisterButton").addEventListener("click",async()=>{
  const name=document.getElementById("accesName").value.trim();
  const email=document.getElementById("accesEmail").value.trim();
  const password=document.getElementById("accesPassword").value;
  if(!name || password.length<8){notice("Escribe tu nombre y una contraseña de al menos 8 caracteres.");return;}
  try{sessionStorage.setItem("acces_registration_name",name);notice("Creando cuenta...");await createUserWithEmailAndPassword(auth,email,password);}
  catch(err){notice("No se pudo crear la cuenta: "+err.message);}
});
document.getElementById("accesResetButton").addEventListener("click",async()=>{
  const email=document.getElementById("accesEmail").value.trim();
  if(!email){notice("Escribe tu correo primero.");return;}
  try{await sendPasswordResetEmail(auth,email);notice("Si el correo está registrado, recibirás instrucciones.");}
  catch(err){notice("No se pudo solicitar el restablecimiento: "+err.message);}
});
document.getElementById("accesLogoutButton").addEventListener("click",()=>signOut(auth));
document.getElementById("accesReloadButton").addEventListener("click",()=>{if(auth.currentUser)loadProfile(auth.currentUser);});
window.accesCloud={persist:save,seedCatalog, get uid(){return activeUser?.uid||null;},get isAdmin(){return isAdmin();},get active(){return !!activeUser && !!role && awaiting.size===0;},get fullName(){return profile?.name||activeUser?.email||"";}};
onAuthStateChanged(auth,user=>{
  if(user){
    loadProfile(user).catch(err=>lockApp("Error al revisar la cuenta: "+err.message));
  }else{
    activeUser=null;role=null;profile=null;closeSubscriptions();
    window.ACCES_UI.clear();
    loginFields.hidden=false;sessionPanel.hidden=true;
    lockApp("Inicia sesión o registra una cuenta. Los vendedores necesitan aprobación.");
  }
});