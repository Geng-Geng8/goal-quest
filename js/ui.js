// Shared browser utilities and one keyboard/focus lifecycle for all dialogs.
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[c]);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function toast(t) {
  const e = document.querySelector('#toast');
  e.textContent = t;
  e.classList.add('show');
  clearTimeout(toast.handle);
  toast.handle = setTimeout(() => e.classList.remove('show'), 2800);
}
let returnFocus = null;
let returnKey = null;
const focusable = root => [...root.querySelectorAll('button, input, select, textarea, summary, a[href], [tabindex]')]
  .filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length &&
    ![...root.querySelectorAll('details:not([open])')].some(d => d.contains(e) && d.querySelector('summary') !== e));
export function focusMain() {
  const target = document.querySelector('#main h1') || document.querySelector('#main');
  target?.setAttribute('tabindex', '-1');
  target?.focus();
}
export function rememberFocus(element) {
  returnFocus = element;
  returnKey = element ? ['done', 'act', 'lesson', 'promptView', 'goal', 'nav'].map(k => [k, element.dataset[k]]).find(([, v]) => v) : null;
}
export function restoreFocus() {
  if (document.querySelector('#modalhost .modal')) return;
  let target = returnFocus;
  if (!target?.isConnected && returnKey) {
    const [key, value] = returnKey;
    target = [...document.querySelectorAll('button')].find(b => b.dataset[key] === value && b.getClientRects().length);
  }
  if (target?.isConnected) target.focus({ preventScroll: true });
  else if (returnFocus) focusMain();
  returnFocus = returnKey = null;
}
function showModal(inner) {
  if (!document.querySelector('#modalhost .modal')) rememberFocus(document.activeElement);
  document.querySelector('#modalhost').innerHTML = `<div class="modalback" id="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Goal Quest dialog" tabindex="-1"><div class="flex between" style="margin-bottom:16px"><span class="micro">H4 GOAL QUEST</span><button class="iconbtn" data-act="close" aria-label="Close dialog">✕</button></div>${inner}</div></div>`;
  const modal = document.querySelector('#modalhost .modal');
  const heading = modal.querySelector('h2');
  if (heading) {
    heading.id ||= 'dialog-heading';
    modal.setAttribute('aria-labelledby', heading.id);
    modal.removeAttribute('aria-label');
  }
  // Every modal uses the same background isolation, focus loop, and close path.
  document.querySelector('.app').inert = true;
  document.querySelector('#bottom-nav').inert = true;
  document.body.classList.add('dialog-open');
  (modal.querySelector('[data-initial-focus], [autofocus]') || focusable(modal)[0] || modal).focus();
}
function closeModal() {
  document.querySelector('#modalhost').innerHTML = '';
  document.querySelector('.app').inert = false;
  document.querySelector('#bottom-nav').inert = false;
  document.body.classList.remove('dialog-open');
  restoreFocus();
}
export function modalKeydown(e) {
  const modal = document.querySelector('#modalhost .modal');
  if (!modal || e.key !== 'Tab') return;
  const controls = focusable(modal), first = controls[0], last = controls.at(-1);
  if (!first) { e.preventDefault(); modal.focus(); }
  else if (!modal.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function copy(t, msg) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(() => toast(msg)).catch(() => selectCopy(t));
  } else selectCopy(t);
}
function selectCopy(t) {
  showModal(`<h2>Copy this text</h2><p>Long-press or select all to copy.</p><textarea readonly id="manual-copy" aria-label="Text to copy" style="width:100%;height:240px;padding:12px;border-radius:12px;border:1px solid #dce1ef">${esc(t)}</textarea><button class="btn full" data-act="select-copy">Select text</button>`);
}
function download(data, name, mime) {
  const url = URL.createObjectURL(new Blob([data], {
    type: mime
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export { esc, clamp, toast, showModal, closeModal, copy, selectCopy, download };
