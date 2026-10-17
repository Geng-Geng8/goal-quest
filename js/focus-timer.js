// One wall-clock deadline; intervals only refresh the display. No per-tick writes.
export function createFocusTimer({ read, write, now = Date.now, schedule = setInterval, unschedule = clearInterval, update = () => {}, complete = () => {} }) {
  let handle = null;
  const remaining = () => {
    const f = read();
    return f.status === 'running' ? Math.max(0, Math.min(f.minutes * 60000, f.deadline - now())) : (f.remainingMs ?? f.minutes * 60000);
  };
  function stop() { if (handle !== null) unschedule(handle); handle = null; }
  function refresh() {
    const f = read();
    if (f.status === 'running' && remaining() === 0) {
      stop();
      write({ ...f, status: 'complete', remainingMs: 0, deadline: null });
      complete();
    }
    update({ ...read(), remainingMs: remaining() });
  }
  function reload() {
    stop();
    refresh();
    if (read().status === 'running') handle = schedule(refresh, 250);
  }
  function reset(minutes = read().minutes) {
    stop();
    write({ ...read(), minutes, status: 'ready', remainingMs: minutes * 60000, deadline: null });
    refresh();
  }
  function toggle() {
    refresh();
    const f = read();
    const ms = remaining();
    stop();
    if (f.status === 'running') write({ ...f, status: 'paused', remainingMs: ms, deadline: null });
    else if (ms > 0) write({ ...f, status: 'running', remainingMs: ms, deadline: now() + ms });
    reload();
  }
  return { reload, refresh, toggle, reset, stop, remaining };
}
