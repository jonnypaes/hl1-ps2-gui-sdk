# GUIDEF browser inspection — evidence and ownership

## Status: source inspector only (not a PS2 runtime)

The first public site, served from `site/`, accepts a user-supplied `guidef.txt` and
displays its exact decoded source, line-attached blocks/properties and a **schematic**
view of strictly numeric `SCREEN_RECT` declarations. Files are opened using the
browser File API. No file is uploaded, fetched, compiled, or executed by this viewer.

This is deliberately **not** an emulator, PS2 binary compiler, asset renderer,
action evaluator, include resolver, or validator of the true Gearbox GUI grammar.
Do not represent its accepted lines or schema as confirmed game behavior.

### Same inspected representation, two hosts

- `src/core/GuidefInspection.ts` has no Node, VS Code or DOM imports.
- `site/app.ts` and the VS Code command `HL-PS2: Inspect GUIDEF Source`
  both call `inspectGuidef(source)`.
- The older VS Code preview, parser, simulator, and binary exporter are **legacy,
  unverified implementations**. They are not used by the new browser inspector.
  Their results must not be presented as equivalent to the new inspector.

The browser UI recognizes only these lexical shapes:
- a line containing a standalone `GUI_...` marker opens a structural block;
- an `END` line closes the most recent recognized block;
- a `KEY VALUE` line inside a block is recorded **verbatim** as a property;
- `!include` is recorded and explicitly marked unresolved;
- `SCREEN_RECT` with exactly four finite numbers is eligible for schematic
  geometry (no fixed resolution, hardware conversion or Z-plane behavior);
- everything else remains in the original source and inspection line records.

Nested blocks, macro substitution, comment rules, runtime state, field packing,
compressed formats, focus transitions, blend modes and include semantics must be
confirmed independently from evidence before being implemented as behavior.
Current inspection categories are provisional notation, not a reverse-engineered
complete grammar.

## Reproducibility

```sh
npm ci
npm run test:inspector
npm run check-site
npm run build-site
python3 -m http.server 8080 -d site
```

Open `http://localhost:8080/`. Production hosting uses GitHub Pages **Actions**
with `.github/workflows/pages.yml`; enable GitHub Pages with source set to
**GitHub Actions** in repository Settings. A PR runs build checks only; only a
push to `main` can deploy. Until the workflow reports a successful deployment,
do not claim a working public URL.

No copyrighted game assets (including SLUS executables, original GUIDEF files
or PAK contents) are packaged by the site build or tests. The sample is synthetic.

## Clean-room boundary / provenance

Keep separate, dated, reviewable layers:

1. **Raw evidence** (user-owned and local): original bytes, hash, product/disc
   identity, address or offset, capture method, uncertainty. Do not publish
   proprietary input by default.
2. **Observed facts**: token strings, state transitions, file effects, test
   captures and disassembly-derived *behavior descriptions* with citations to
   offsets or captured traces. A named string alone does not establish semantics.
3. **Hypotheses**: architecture proposals and inferred field meanings, with
   explicit confidence and possible falsification conditions.
4. **Portable implementation**: code written from independently reviewable
   behavior specs, not copied or mechanically translated game code.
5. **Conformance**: reproducible input/output and negative cases; compare
   browser and VS Code outputs byte-for-byte for the same decoded text and
   compare actual runtime claims only against verified PS2 evidence.

Suggested evidence record: `{ claim, source_id, source_hash, offset_or_trace,
 observation, interpretation, confidence, validation_status }`.

No runtime feature becomes *verified* based solely on documentation or a
matching keyword in the binary.

## Next adapters — not yet delivered

The separate FILES/PAK VFS of PS2-Strike-Space and the ps2-pipeline may supply
file-entry trees and bounded byte readers later. Their ownership must remain
separate from GUIDEF grammar interpretation. Do not equate a JSON metadata
tree with original PAK bytes. An importer that extracts a file must preserve
its exact source, offset, length, and provenance.
