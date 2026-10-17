import { MAX_BACKUP_BYTES, parseSavedState, serializeBackup } from './data-safety.js';
import { esc, showModal, closeModal, download, toast } from './ui.js';

export function updateSaveStatus(status) {
  const warning = ['blocked', 'warning'].includes(status.kind);
  const pill = document.querySelector('#saved-status');
  pill.textContent = warning ? '⚠ Not saved' : '● Saved on this device';
  const banner = document.querySelector('#storage-warning');
  banner.hidden = !warning;
  document.querySelector('#storage-message').textContent = status.message;
}

export function createDataControls({ store, render, resetTimer }) {
  let pending = null, generation = 0, returnFocus = null;
  function dialog(html) {
    if (!document.querySelector('[data-backup-dialog]')) returnFocus = document.activeElement;
    showModal(html);
    const modal = document.querySelector('#modalhost .modal');
    modal.dataset.backupDialog = '';
    modal.setAttribute('aria-labelledby', 'backup-heading');
    modal.removeAttribute('aria-label');
    (modal.querySelector('[data-initial-focus]') || modal.querySelector('[data-act="close"]'))?.focus();
  }
  function cancel() {
    pending = null;
    generation++;
    returnFocus?.focus();
    returnFocus = null;
  }
  function error(message) {
    dialog(`<h2 id="backup-heading">Your progress has not changed</h2><p role="alert">${esc(message)}</p><button class="btn" data-act="data-menu" data-initial-focus>Back to backups</button>`);
  }
  function menu() {
    pending = null;
    generation++;
    dialog(`<h2 id="backup-heading">Back up & restore</h2>
      <p>Your work stays in this browser. Download a backup regularly and keep it somewhere private. Clearing browser data also clears the recovery copy.</p>
      <div class="stack">
        <button class="btn full" data-act="backup" data-initial-focus>Download full backup</button>
        <div class="field"><label for="backup-file">Import Backup (.json, up to 2 MB)</label><input id="backup-file" type="file" accept=".json,application/json"/><span class="hint">Choose a file to check it first. Nothing changes until you confirm.</span></div>
        <button class="btn line full" data-act="recover-progress">Review recovery copy</button>
        <details><summary>More recovery options</summary><div class="stack" style="margin-top:14px">
          <button class="btn line full" data-act="download-recovery">Download recovery backup</button>
          ${store.originalRaw !== null ? '<button class="btn line full" data-act="download-original">Download original saved data</button>' : ''}
          <button class="btn line full" data-act="download-recovery-originals">Download recovery originals</button>
          <span class="hint">Original data keeps the exact saved text, even if it cannot be opened. Keep this private if you ask someone you trust for help.</span>
          <button class="btn line full" data-act="reload-storage">Reload saved progress</button>
        </div></details>
      </div><p class="small">Before a restore or demo reset, we keep one recovery copy of your current progress on this browser. A new restore replaces that copy. A downloaded backup is the safest way to keep an extra copy.</p>`);
  }
  function preview(prepared, recovery = false) {
    pending = prepared;
    const s = prepared.state;
    dialog(`<h2 id="backup-heading">${recovery ? 'Restore recovery copy?' : 'Restore this backup?'}</h2><p>This will replace your current progress with <b>${s.goals.length} goals</b> and <b>${s.goals.reduce((n, g) => n + g.tasks.length, 0)} actions</b>${s.draft ? ', plus an unfinished goal draft' : ''}.</p>${prepared.warning ? `<p class="data-notice">${esc(prepared.warning)}</p>` : ''}<p>We will keep a recovery copy of your current progress first. Nothing changes if you cancel or the save fails.</p><div class="flex wrap"><button class="btn line" data-act="close" data-initial-focus>Cancel</button><button class="btn" data-act="confirm-restore">Replace my progress</button></div>`);
  }
  async function fileChanged(input) {
    const token = ++generation;
    pending = null;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('This file is too large. Choose a backup smaller than 2 MB.');
      const raw = await file.text();
      if (token !== generation || !input.isConnected) return;
      preview(store.prepareRestore(raw));
    } catch (e) {
      if (token === generation && input.isConnected) error(e.message || 'We could not read this file. Try choosing it again.');
    } finally { input.value = ''; }
  }
  function act(action) {
    if (!['data-menu', 'backup', 'confirm-restore', 'recover-progress', 'download-original', 'download-recovery', 'download-recovery-originals', 'reload-storage'].includes(action)) return false;
    try {
      if (action === 'data-menu') menu();
      else if (action === 'backup') {
        download(store.backup(), 'H4-Goal-Quest-Backup.json', 'application/json');
        toast('Backup download started. Keep the file somewhere private.');
      } else if (action === 'confirm-restore' && pending) {
        if (!store.restore(pending, true)) { error(store.status.message); return true; }
        pending = null;
        resetTimer();
        closeModal();
        cancel();
        render();
        document.querySelector('#main').focus();
        toast('Backup restored. Your previous progress is in the recovery copy.');
      } else if (action === 'recover-progress') {
        const copy = store.recovery();
        const raw = copy.workingState ? JSON.stringify(copy.workingState) : copy.raw;
        if (raw === null) throw new Error('This recovery copy was made before any progress was saved.');
        preview(store.prepareRestore(raw), true);
      } else if (action === 'download-recovery') {
        const copy = store.recovery();
        download(serializeBackup(copy.workingState || parseSavedState(copy.raw)), 'H4-Goal-Quest-Recovery-Backup.json', 'application/json');
      } else if (action === 'download-original' || action === 'download-recovery-originals') {
        const raw = action === 'download-original' ? store.originalRaw : store.recoveryRaw();
        if (raw === null) throw new Error('There is no saved data to download yet.');
        download(raw, action === 'download-original' ? 'H4-Goal-Quest-Original.json' : 'H4-Goal-Quest-Recovery.json', 'application/json');
      } else if (action === 'reload-storage') {
        if (confirm('Reload saved progress? Download a backup first if you have changes that could not be saved. Unsaved changes on this page will be lost.')) location.reload();
      }
    } catch (e) { error(e.message || 'We could not open this backup. Keep the file and try again.'); }
    return true;
  }
  function keydown(e) {
    if (e.key !== 'Tab') return;
    const modal = document.querySelector('[data-backup-dialog]');
    if (!modal) return;
    const controls = [...modal.querySelectorAll('button, input, summary, [tabindex="0"]')].filter(x => !x.disabled && x.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  return { act, fileChanged, cancel, keydown };
}
