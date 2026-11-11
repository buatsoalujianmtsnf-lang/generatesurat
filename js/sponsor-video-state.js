/* MON-04: pure finite-state transitions, independent of editor and browser. */
const SponsorVideoState = (() => {
  const transitions = Object.freeze({
    idle: { BEGIN: 'starting' },
    starting: { READY: 'ready', FAIL: 'error', CANCEL: 'cancelled' },
    ready: { PLAY: 'playing', FAIL: 'error', CANCEL: 'cancelled' },
    playing: { PAUSE: 'paused', ENDED: 'verifying', FAIL: 'error', CANCEL: 'cancelled' },
    paused: { PLAY: 'playing', ENDED: 'verifying', FAIL: 'error', CANCEL: 'cancelled' },
    verifying: { AUTHORIZED: 'authorized', FAIL: 'error', CANCEL: 'cancelled' },
    error: { RETRY: 'starting', CANCEL: 'cancelled' },
    authorized: {},
    cancelled: {},
  });
  function transition(state, event) {
    if (event === 'RESET') return 'idle';
    const next = transitions[state]?.[event];
    if (!next) throw new Error('Invalid sponsor transition: ' + state + ' -> ' + event);
    return next;
  }
  return Object.freeze({ transition, states: Object.freeze(Object.keys(transitions)) });
})();
