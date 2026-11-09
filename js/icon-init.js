/* Mount Tabler SVG symbols on both static and dynamically rendered UI.
   Document output is excluded, preventing accidental edits to the letter content. */
(() => {
  if (typeof AppIcons === 'undefined') return;
  const update = root => AppIcons.apply(root);
  update(document);
  if (typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(changes => {
    for (const change of changes) {
      for (const node of change.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.closest('#surat-preview')) continue;
        if (node.matches('[data-tabler-icon]')) update(node.parentElement || document);
        else if (node.querySelector('[data-tabler-icon]')) update(node);
      }
    }
  });
  observer.observe(document.body, {childList:true, subtree:true});
})();
