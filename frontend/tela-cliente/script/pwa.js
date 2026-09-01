
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[PWA] Service Worker registrado:', reg.scope))
      .catch((err) => console.warn('[PWA] Falha ao registrar Service Worker:', err));
  });
}

let deferredPrompt = null;

function criarBotaoInstalar() {
  if (document.getElementById('btnInstalarPWA')) return;

  const btn = document.createElement('button');
  btn.id = 'btnInstalarPWA';
  btn.type = 'button';
  btn.textContent = '⬇ Instalar app';
  btn.setAttribute('aria-label', 'Instalar GoodWe ChargeGrid');

  Object.assign(btn.style, {
    position: 'fixed',
    left: '50%',
    bottom: '100px',
    transform: 'translateX(-50%)',
    zIndex: '1500',
    padding: '10px 18px',
    borderRadius: '24px',
    border: 'none',
    background: 'linear-gradient(180deg, #db3931 0%, #f71612 100%)',
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
    fontSize: '0.85rem',
    boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
    cursor: 'pointer'
  });

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    btn.disabled = true;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Resultado da instalação:', outcome);
    deferredPrompt = null;
    btn.remove();
  });

  document.body.appendChild(btn);
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  criarBotaoInstalar();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = document.getElementById('btnInstalarPWA');
  if (btn) btn.remove();
  console.log('[PWA] GoodWe ChargeGrid instalado com sucesso.');
});
