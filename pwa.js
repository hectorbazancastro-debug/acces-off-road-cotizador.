(() => {
  let installPrompt = null;
  const buttons = [...document.querySelectorAll('[data-install-app]')];
  const hide = () => buttons.forEach(button => { button.hidden = true; });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    installPrompt = event;
    buttons.forEach(button => { button.hidden = false; });
  });
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    hide();
    try { await prompt.prompt(); await prompt.userChoice; }
    catch (error) { console.warn('No se pudo abrir la instalación', error); }
  }));
  window.addEventListener('appinstalled', () => { installPrompt = null; hide(); });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'})
        .catch(error => console.warn('No se pudo registrar la aplicación', error));
    });
  }
})();
