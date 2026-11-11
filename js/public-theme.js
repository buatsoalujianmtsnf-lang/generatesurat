/* Theme setup for the static public-information routes.
   The editor initializes Theme in app.js; these pages do not load app.js. */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof Theme !== 'undefined') Theme.init();
});
