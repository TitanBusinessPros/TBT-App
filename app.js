(() => {
  const installButton = document.getElementById('install-app');
  const updateButton = document.getElementById('update-app');
  const status = document.getElementById('app-status');
  if (!installButton || !updateButton || !status) return;

  let installPrompt = null;
  let registration = null;
  let updateRequested = false;
  let reloading = false;
  const loadedMarkup = document.documentElement.outerHTML;
  const loadedModified = Date.parse(document.lastModified);
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  installButton.hidden = installed;
  updateButton.hidden = true;

  function showStatus(message) {
    status.textContent = message;
  }

  function showAvailableUpdate() {
    if (!installed || updateRequested) return;
    updateButton.hidden = false;
    showStatus('A new version is available.');
  }

  async function checkForUpdates() {
    if (!installed || !navigator.onLine || updateRequested) return;
    try {
      const url = new URL(window.location.pathname, window.location.origin);
      url.searchParams.set('update-check', Date.now().toString());
      const response = await fetch(url.href, { cache: 'no-store' });
      if (!response.ok) return;
      const remoteModified = Date.parse(response.headers.get('Last-Modified'));
      const remoteMarkup = new DOMParser().parseFromString(await response.text(), 'text/html').documentElement.outerHTML;
      if ((Number.isFinite(loadedModified) && Number.isFinite(remoteModified) && remoteModified > loadedModified + 1000) || remoteMarkup !== loadedMarkup) {
        showAvailableUpdate();
      } else if (!registration || !registration.waiting) {
        updateButton.hidden = true;
        if (status.textContent === 'A new version is available.') showStatus('');
      }
    } catch {
      // Keep the current app available when an update check cannot reach the site.
    }
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
    if (!installed || updateButton.hidden || updateRequested) return;
    if (!navigator.onLine) {
      showStatus('Connect to the internet to update the app.');
      return;
    }
    updateRequested = true;
    updateButton.hidden = true;
    updateButton.disabled = true;
    showStatus('Updating the app...');
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
      updateButton.hidden = false;
      showStatus('Could not update right now. Please try again.');
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (updateRequested) reloadFresh();
    });
    navigator.serviceWorker.register('sw.js', { scope: './', updateViaCache: 'none' }).then((workerRegistration) => {
      registration = workerRegistration;
      if (installed && registration.waiting && navigator.serviceWorker.controller) showAvailableUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'installed' || !registration.waiting || !navigator.serviceWorker.controller || !installed) return;
          if (updateRequested) activateUpdate();
          else showAvailableUpdate();
        });
      });
    }).catch(() => showStatus('App installation is unavailable right now.'));
  }

  if (installed) {
    checkForUpdates();
    setInterval(checkForUpdates, 5 * 60 * 1000);
    window.addEventListener('online', checkForUpdates);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkForUpdates();
    });
  }
})();
