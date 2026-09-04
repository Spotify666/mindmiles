# Photon — Everywhere

A web page can only see itself. This extension does the one thing the page
genuinely cannot: notice which tab is in front, and for how long.

## Install it

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. **Load unpacked**, and pick this folder.
4. Open Photon. It will say "Every tab" instead of "This tab only".

## What it records

Per minute: how many seconds you were active, and the **domain** you were on.

That is the whole list. The path, the query string and the page title are
thrown away the moment a URL is seen — `hostOf()` in `background.js` reduces it
to a hostname and nothing else is kept. Nothing you type is recorded. Nothing on
the page is read.

## Where it goes

`chrome.storage.local`, on your machine. There is no network call anywhere in
this extension and no server for one to reach. When you open Photon,
`bridge.js` hands the totals to the page. That is the only way data leaves, and
it only ever goes to the Photon page on the same computer.

## Removing it

Uninstalling deletes everything it stored. Photon goes back to counting only
its own tab, and says so.
