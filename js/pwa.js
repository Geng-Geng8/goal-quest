import { showModal, esc } from './ui.js';

// Installation and shell status only; no access to student state or storage.
export function createPwa() {
  let registration;
  let status = 'Checking offline setup…';
  const button = document.querySelector('[data-act="pwa-help"]');
  const notice = document.querySelector('#pwa-notice');
  function report(message, useful = false) {
    status = message;
    button.textContent = message.startsWith('Ready') ? 'Install & offline · ready' : 'Install & offline';
    notice.textContent = useful ? message : '';
    notice.hidden = !useful;
    const dialogStatus = document.querySelector('#pwa-dialog-status');
    if (dialogStatus) dialogStatus.textContent = message;
  }
  function watch(worker) {
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' || worker.state === 'activated') refresh();
      if (worker.state === 'redundant') report(registration?.active
        ? 'The update could not finish. Your previous offline version is still available. Reconnect and try again later.'
        : 'Offline setup could not finish. Keep using this page online; reconnect and try again.', true);
    });
  }
  function refresh() {
    if (registration?.waiting) report('An update is ready. When you are finished, close all Goal Quest tabs and app windows, then reopen. Your saved progress stays here.', true);
    else if (registration?.active) report('Ready for offline use. Your goals save in this browser.');
  }
  async function start() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      report('Offline setup is unavailable in this browser. Use HTTPS or localhost and allow browser storage.', true);
      return;
    }
    try {
      const scope = new URL('../', import.meta.url).href;
      registration = await navigator.serviceWorker.getRegistration(scope);
      if (registration?.scope !== scope) {
        registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope, updateViaCache: 'none' });
      }
      watch(registration.installing);
      registration.addEventListener('updatefound', () => watch(registration.installing));
      refresh();
      if (!registration.active) report('Keep this page open online while offline setup finishes.');
    } catch {
      report('Offline setup could not finish. Keep using this page online; allow browser storage and try again when connected.', true);
    }
  }
  function act(action) {
    if (action === 'pwa-help') {
      showModal(`<h2>Install & offline</h2><p id="pwa-dialog-status" role="status">${esc(status)}</p>
        <p>Visit online once and wait for “ready” before going offline. Then your goals, lessons, planner, companions, timer and backups work without internet.</p>
        <ul><li><b>Android Chrome:</b> open the browser menu and choose Install app or Add to Home screen.</li>
        <li><b>iPhone Safari:</b> tap Share, then Add to Home Screen. There is no Android-style install prompt.</li>
        <li><b>Desktop Chrome or Edge:</b> use the install icon in the address bar or the browser menu.</li></ul>
        <p><b>Updates:</b> finish and save any open forms first. Download a backup if saving failed. Close every Goal Quest tab and app window, then reopen when you choose. A normal refresh may keep the current version while another window is open. A running timer keeps its deadline.</p>
        <p>Installing does not protect your data from being cleared. Keep private JSON backups. Installation may use separate storage on some devices; check your progress and restore a backup if needed.</p>
        <button class="btn line" data-act="pwa-retry">Check offline setup & updates</button>`);
      return true;
    }
    if (action === 'pwa-retry') {
      if (registration) registration.update().then(refresh).catch(() => report('Could not check for updates. Reconnect and try again; the current version stays available.', true));
      else void start();
      return true;
    }
    return false;
  }
  // No automatic installation prompts, forced reloads, or offline popups.
  void start();
  return { act };
}
