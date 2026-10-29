# Pages compatibility note

The repository has a pre-existing Jekyll branch-based Pages deployment that can
publish *after* an Actions Pages deployment, overwriting the new root. The site
build now commits its generated `site/app.js` to the default branch on main
pushes (only if changed), so both publication modes can serve `/site/`.

After this compiled bundle appears on main, add a small root `index.html`
redirect to `./site/` so branch-based Pages displays the inspector from the
canonical repository URL. The original browser source is still `site/app.ts`;
`site/app.js` is generated and must never be manually edited. No SLUS or game
assets are committed.

Once GitHub Pages is explicitly changed to source **GitHub Actions**, the old
branch-based publisher should cease competing and the generated bundle commit
step can be retired in a separately reviewed cleanup.
