/**
 * The hand-off.
 *
 * Runs only on the Mind Miles page. Pulls the totals from the extension and
 * posts them into the page, where lib/mm/extension.ts merges them in — labelled
 * as extension data, kept separate from what the page measured itself.
 *
 * Deliberately one-directional: the page can ask, and it receives numbers. It
 * cannot ask the extension to do anything.
 */
(function () {
  const SOURCE = 'mind-miles-extension';

  function push() {
    chrome.runtime.sendMessage({ type: 'mind-miles:pull' }, (reply) => {
      if (chrome.runtime.lastError || !reply) return;
      window.postMessage({ source: SOURCE, days: reply.days }, window.location.origin);
    });
  }

  // Announce ourselves so the page can say the extension is running.
  window.postMessage({ source: SOURCE, hello: true }, window.location.origin);
  push();

  // Refresh while the page is open, and whenever it comes back into view.
  setInterval(push, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') push();
  });
})();
