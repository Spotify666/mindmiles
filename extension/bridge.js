/**
 * The hand-off.
 *
 * Runs only on the Photon page. Pulls the totals from the extension and
 * posts them into the page, where lib/mm/extension.ts merges them in — labelled
 * as extension data, kept separate from what the page measured itself.
 *
 * Deliberately one-directional: the page can ask, and it receives numbers. It
 * cannot ask the extension to do anything.
 */
(function () {
  const SOURCE = 'photon-extension';
  const PAGE = 'photon-page';

  function push() {
    chrome.runtime.sendMessage({ type: 'photon:pull' }, (reply) => {
      if (chrome.runtime.lastError || !reply) return;
      window.postMessage({ source: SOURCE, days: reply.days }, window.location.origin);
    });
  }

  function announce() {
    window.postMessage({ source: SOURCE, hello: true }, window.location.origin);
    push();
  }

  /*
   * The page asks; we answer.
   *
   * This ran the other way round to begin with, and it never once worked. The
   * content script fires at document_idle and announced itself about six
   * milliseconds later; the app registers its listener after React hydrates,
   * which is always after that. So both messages were posted into a page with
   * nobody listening, the next attempt was thirty seconds away, and somebody
   * who had installed the extension was told to go and install the extension.
   *
   * Whoever is ready last has to start the exchange, and only the page knows
   * when it is ready. So the page says so, and we reply. The announcement below
   * stays as well, for the case where the content script is the late one.
   */
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== window.location.origin) return;
    if (e.data && e.data.source === PAGE && e.data.type === 'ready') announce();
  });

  announce();

  // Refresh while the page is open, and whenever it comes back into view.
  setInterval(push, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') push();
  });
})();
