(() => {
  function addAccess(){
    const seed=document.getElementById("accesSeedBtn");
    const toolbar=seed?.parentElement;
    if(!toolbar || document.getElementById("accessQrPanelLink"))return;
    const link=document.createElement("a");
    link.id="accessQrPanelLink";
    link.href="/generar-qr.html";
    link.textContent="QR de clientes · 1 hora";
    link.style.cssText="display:inline-flex;align-items:center;padding:10px 15px;border:1px solid #f87817;background:#3b2c20;color:#ffb781;border-radius:9px;font-size:13px;font-weight:800;text-decoration:none";
    toolbar.append(link);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",addAccess);
  else addAccess();
})();