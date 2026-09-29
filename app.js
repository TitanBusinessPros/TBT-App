(() => {
  const installButton = document.getElementById('install-app');
  const updateButton = document.getElementById('update-app');
  const status = document.getElementById('app-status');
  if (!installButton || !updateButton || !status) return;

  let installPrompt = null;
  let registration = null;
  let updateRequested = false;
  let reloading = false;
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (installed) installButton.hidden = true;

  function showStatus(message) {
    status.textContent = message;
  }

  function reloadFresh() {
    if (reloading) return;
    reloading = true;
    const url = new URL(window.location.href);
    url.searchParams.set('app-update', Date.now().toString());
    window.location.replace(url.href);
  }

  function activateUpdate() {
    if (!registration || !registration.waiting) return false;
    showStatus('Installing the latest version...');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(reloadFresh, 5000);
    return true;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    if (!installed) installButton.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
    showStatus('App installed.');
  });

  installButton.addEventListener('click', async () => {
    if (!installPrompt) {
      showStatus('To install, choose “Install app” or “Add to Home Screen” from your browser menu.');
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    await prompt.prompt();
  });

  updateButton.addEventListener('click', async () => {
    if (!navigator.onLine) {
      showStatus('Connect to the internet to update the app.');
      return;
    }
    updateRequested = true;
    updateButton.disabled = true;
    showStatus('Checking for the latest version...');
    try {
      if (registration) {
        await registration.update();
        if (activateUpdate()) return;
        if (registration.installing) {
          showStatus('Installing the latest version...');
          setTimeout(reloadFresh, 5000);
          return;
        }
      }
      reloadFresh();
    } catch {
      updateRequested = false;
      updateButton.disabled = false;
      showStatus('Could not update right now. Please try again.');
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) reloadFresh();
    });
    navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then((workerRegistration) => {
      registration = workerRegistration;
      if (registration.waiting && navigator.serviceWorker.controller) showStatus('An update is ready. Press Update App.');
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'installed' || !registration.waiting || !navigator.serviceWorker.controller) return;
          if (updateRequested) activateUpdate();
          else showStatus('An update is ready. Press Update App.');
        });
      });
    }).catch(() => showStatus('App installation is unavailable right now.'));
  }
})();
