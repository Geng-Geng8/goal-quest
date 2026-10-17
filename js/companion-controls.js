import { esc, showModal, closeModal, toast, rememberFocus } from './ui.js';
import { companionName, world, mascot, evolutionHTML } from './companions.js';

export function createCompanionControls({ store, render, current }) {
  function dialog(html) {
    showModal(html);
    const modal = document.querySelector('#modalhost .modal');
    modal.dataset.companionDialog = '';
    modal.removeAttribute('aria-label');
    modal.setAttribute('aria-labelledby', 'companion-heading');
    modal.querySelector('[data-act="close"]').focus();
  }
  function unlocked(g, returnTo) {
    dialog(evolutionHTML(g, true));
    rememberFocus(returnTo || document.querySelector('#main [data-act="evolution"], #main h1'));
  }
  function act(action) {
    const g = current();
    if (action === 'evolution') { if (g) dialog(evolutionHTML(g)); }
    else if (action === 'customize-companion') {
      if (!g) return true;
      const c = g.companion || {};
      dialog(`<h2 id="companion-heading">Make this companion yours</h2><p>${esc(world(g.category).name)} belongs to <b>${esc(g.title)}</b>. Every choice is optional and free.</p><div id="companion-preview" class="companion-preview">${mascot({ ...g, id: g.id + '-preview' }, 125)}<b>${esc(companionName(g))}</b></div><form id="companion-form" data-goal-id="${esc(g.id)}"><div class="field"><label for="companion-nickname">Nickname (optional)</label><input id="companion-nickname" name="nickname" maxlength="32" value="${esc(c.nickname || '')}" placeholder="${esc(world(g.category).name)}"/><span class="hint">Leave blank to use the family name.</span></div><div class="field"><label for="companion-accent">Accent colour</label><select id="companion-accent" name="accent">${[['original','Family colour'],['mint','Mint'],['sunset','Sunset']].map(([value,label]) => `<option value="${value}" ${value === (c.accent || 'original') ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label for="companion-accessory">Accessory</label><select id="companion-accessory" name="accessory">${[['none','Just me'],['scarf','Scarf'],['star','Star badge']].map(([value,label]) => `<option value="${value}" ${value === (c.accessory || 'none') ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="flex wrap"><button class="btn line" type="button" data-act="close">Cancel</button><button class="btn" type="submit">Save my companion</button></div></form>`);
    } else if (action === 'celebrate-evolution') {
      const art = document.querySelector('.evolution-step.current .mascot');
      if (art && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        art.getAnimations().forEach(a => a.cancel());
        art.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1) rotate(4deg)' }, { transform: 'scale(1)' }], { duration: 600, iterations: 1 });
      }
    } else return false;
    return true;
  }
  function preview(form) {
    if (form?.id !== 'companion-form') return;
    const g = store.state.goals.find(g => g.id === form.dataset.goalId);
    if (!g) return;
    const copy = { ...g, companion: { ...g.companion, ...Object.fromEntries(new FormData(form)) } };
    document.querySelector('#companion-preview').innerHTML = `${mascot({ ...copy, id: copy.id + '-preview' }, 125)}<b>${esc(companionName(copy))}</b>`;
  }
  function submit(form) {
    if (form.id !== 'companion-form') return false;
    const g = store.state.goals.find(g => g.id === form.dataset.goalId);
    if (!g) return true;
    const data = Object.fromEntries(new FormData(form));
    g.companion = { ...g.companion, nickname: data.nickname.trim().slice(0, 32), accent: data.accent, accessory: data.accessory };
    closeModal(); render();
    toast(store.status.kind === 'saved' ? 'Your companion is ready!' : 'Your changes are on this page but could not be saved. Download a backup before closing it.');
    return true;
  }
  return { act, submit, preview, unlocked };
}
