# Byte-matching compiler lab (reverse engineering, not source reconstruction by guess)

## Scope

The goal is to reconstruct **native PS2 C/C++ from behavioral evidence** and prove, where
possible, that specific compiler/linker outputs reproduce the original SLUS instruction
window. A shared portable core may separately compile to WebAssembly for the editor
and browser. WASM and PS2 outputs are two independent targets, **never compared to
each other byte-for-byte**.

The current source `research/ps2/re_00108120.c` is a **negative-control hypothesis**,
NOT a verified function replacement. It injects a callback argument absent from the
observed MIPS call shape and therefore cannot be treated as equivalent to the
original SLUS function. Native compiler output is the acceptance gate, not C-like
code plausibility.

## Verified original facts

- Original local user ELF: `SLUS_275(8).00`; SHA-256:
  `dabf6af7eb84e649e1bdbf40f00597b662607db8dca88a3715dac5327aedcde6`.
- ELF32, little-endian MIPS, `e_flags=0x20924001` (EE R5900,
  EABI64, MIPS3). Its `.text` starts at VA `0x00100000`, file
  offset `0x1000`.
- Existing pilot: original function window VA `0x00108120..0x00108143`,
  36 bytes; current interpretation is only register forwarding and a
  direct call at `0x00108130` to `0x001086E8`.
- **New evidence:** three null-terminated `sv_gravity` occurrences at
  file offsets `0x2511F0`, `0x25D330`, `0x2907C8`, equivalent
  VAs `0x3501F0`, `0x35C330`, `0x38F7C8`.
- In `.text`, `0x0016D4EC` (`lui a0,0x35`) followed by
  `0x0016D4F4` (`addiu a0,a0,0x1F0`) materializes
  the first `sv_gravity` address. This is an **observed literal reference**,
  not a function/class ownership or an equal PC function.
- The reference PC project `oxiKKK/re-goldsrc-won-launcher-1792`
  reconstructed a Win32 x86 WON launcher, not the same PS2 MIPS menu.
  It is a methodological comparison, not a source identity authority.

## An actual negative compiler experiment

Host experiment, on a local Clang 17 with target
`mipsel-none-elf -march=mips3 -mabi=32 -O2 -G0 -ffreestanding`:

```sh
clang --target=mipsel-none-elf -march=mips3 -mabi=32 -O2 -G0     -fno-pic -ffreestanding -c research/ps2/re_00108120.c     -o candidate.o
python3 tools/re/compare_function.py     --map research/ps2/seed-map.v1.json     --candidate candidate.o     --original '/path/to/user-owned/SLUS'
```

Observed: compiler emitted a 56-byte `STT_FUNC`, whereas the original
contains a 36-byte window. The comparator returns `SIZE_MISMATCH`
(`first_difference=0`). The compiled object's flags also describe
an O32 MIPS3 ABI, **not the SLUS's EABI64 R5900 ABI**; this experiment
does not qualify as a true PS2 toolchain attempt.

The CI host test exercises the full **parser and decision engine** with
synthetic MIPS ELF32 artifacts (including intentional byte mismatch,
size mismatch and in-function relocation). It does not include proprietary
game files. `SLUS_ELF_PATH` enables additional local original-ELF tests.

## Comparison contract

`python3 tools/re/compare_function.py --map ... --candidate ...`

| Result | Meaning |
|---|---|
| `SIZE_MISMATCH` | Candidate symbol length differs from known original window |
| `MISMATCH` | Same length but some instruction byte differs |
| `UNRESOLVED_RELOCATIONS` | ET_REL contains relocation(s) in the function: raw comparison is not final |
| `OBJECT_BYTES_EQUAL_UNLINKED` | ET_REL symbol bytes match, but not final linked proof |
| `LINKED_WINDOW_BYTES_EXACT` | ET_EXEC PT_LOAD bytes at the original VA equal original reference window |
| `INVALID` (exit 2) | Malformed file, ambiguous symbol, untrusted map or wrong original fingerprint |

Even `LINKED_WINDOW_BYTES_EXACT` does not establish full original C++ source
identity or the complete function boundary independently. A status of success
is **never** inferred from name, source similarity or working WebAssembly.
`--require-linked-exact` is the hard gate for confirmed linked-window
candidates. The default mode creates research reports and doesn't require a
hypothesis to match.

## Cheap CI / reproducible toolchain

- Always-run host job: standard Python tests and freestanding Clang `wasm32`
  smoke of the portable *hypothesis*, without game assets or dependencies.
- Opt-in, dispatch-only EE job: uses the **same digest-pinned
  `ps2dev/ps2dev:v2.0.0` container** as ps2-pipeline, cross-compiles
  exactly one function to an ET_REL object and publishes a JSON report.
- Compiling with a contemporary ps2dev GCC is **not evidence that the
  original Gearbox vendor/compiler version has been matched**. Compiler
  version, flags, linker, script, ABI, relocation and delay slots are all
  necessary candidate variables.
- Workflow dispatch is available only when its workflow exists on
  the repository's default branch. This PR stays **draft** until reviewed;
  target execution will require an authorized dispatch after adoption.
- No high-cost PCSX2 visual capture, firmware, ISOs or entire-game
  compile in this CI.

## Architectural division

```text
research/evidence/*.json          raw provenance / uncertainties
research/ps2/re_*.c               portable C/C++ hypotheses, individually gated
tools/re/compare_function.py      read-only machine-code comparator
tools/ghidra/import_re_map.py     sidecar map and explicit symbol annotations
site / VS Code                    JS/WASM visualization/inspection
(optional PS2)                    compiled .o / linked experimental ELF
```

A function is promoted only after explicit evidence for semantics, proven
types/ABI boundaries and a reproducible **matching compiler/link context**.
Hardware-dependent code is isolated behind narrow interfaces; it must not
be faked in WASM.

## The appended-debug-map question

**Do not change the retail SLUS yet.** The current JSON sidecar references
absolute addresses, so Ghidra can annotate the original ELF without moving
bytes, VAs, PNACH patch coordinates, or file offsets.

A post-EOF append trailer preserves the original file as a byte-for-byte
prefix, but Ghidra will **not automatically treat an arbitrary trailer as
DWARF** and a PS2 loader or checksum verifier could reject the new length.
Using `objcopy --add-section` can rewrite ELF section tables and file
offsets; it must not be assumed safe just because load addresses remain
unchanged.

A future experimental append must be a **new copy** only, with a pre/post
manifest proving: original-prefix equality; unchanged ELF program headers,
PT_LOAD bytes, VAs and file offsets; unchanged ELF entry point; unchanged
existing section offsets; and successful boot/PNACH and Ghidra tests.
If any invariant fails, leave the original untouched and use the sidecar.
