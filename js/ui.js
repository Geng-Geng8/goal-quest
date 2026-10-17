// Shared browser utilities; the V4 templates and messages are unchanged.
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
function showModal(inner) {
  document.querySelector('#modalhost').innerHTML = `<div class="modalback" id="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="Goal Quest dialog"><div class="flex between" style="margin-bottom:16px"><span class="micro">H4 GOAL QUEST</span><button class="iconbtn" data-act="close" aria-label="Close dialog">✕</button></div>${inner}</div></div>`;
}
function closeModal() {
  document.querySelector('#modalhost').innerHTML = '';
}
function copy(t, msg) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(() => toast(msg)).catch(() => selectCopy(t));
  } else selectCopy(t);
}
function selectCopy(t) {
  showModal(`<h2>Copy this text</h2><p>Long-press or select all to copy.</p><textarea readonly id="manual-copy" style="width:100%;height:240px;padding:12px;border-radius:12px;border:1px solid #dce1ef">${esc(t)}</textarea><button class="btn full" data-act="select-copy">Select text</button>`);
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
