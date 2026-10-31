# HL1 PS2 — reverse-engineering seed 001

## Goal

Work *backwards* from a user-owned retail ELF to one independently verified,
small function at a time. The recorded bytes and call graph are the authority.
The portable reconstruction is a falsifiable model, never automatic evidence
that original Gearbox C++ source has been recovered.

The GitHub repo [oxiKKK/re-goldsrc-won-launcher-1792](https://github.com/oxiKKK/re-goldsrc-won-launcher-1792)
is a useful **methodology** for address maps and agent-assisted research,
but it is a 2001 Win32/x86 WON launcher and its README acknowledges reconstructed,
approximate source. The PS2 SLUS is a MIPS/R5900 ELF with separate GUI systems.
Do not transfer names, addresses, signatures, or PC code into our map as facts.

## First verified observation

Input binary: local user-provided `SLUS_275(8).00`
(size 2,781,176 bytes; SHA-256
`dabf6af7eb84e649e1bdbf40f00597b662607db8dca88a3715dac5327aedcde6`).

- `.text` virtual address `0x00100000`, file offset `0x00001000`.
- Function entry `0x00108120`, file offset `0x00009120`;
  36 verified bytes through delay slot `0x00108140`, exclusive end `0x00108144`.
- It rearranges the **MIPS register arguments** so outgoing `a1` receives
  incoming `a2` and outgoing `a2` receives incoming `a1`.
  `a0` and `a3` remain unmodified at the call site.
- Direct `jal` at `0x00108130` targets `0x001086e8`.
  The function preserves/restores `ra`, changes/restores `sp` by 16 bytes
  and returns via `jr ra` without overwriting returned `v0`.
- Nearby, **in a different function at `0x00108070`**, the instructions
  at `0x00108074` and `0x0010807c` construct a pointer to
  `Launcher/GUIParser.cpp` at `0x00337788`. That string establishes
  a location-dependent observation, NOT a reliable assignment of this
  function to a method or class.

The simple C implementation in `research/ps2/re_00108120.c` models the
argument-forwarding behavior via an injected test target. It is **not**
the original C++ code, an executable-equivalent PS2 recompile, or a proof
of runtime behavior beyond the observed register flow.

## Evidence tiers

| Claim | Status | Basis |
|---|---|---|
| ELF identity / instruction window | Verified | Original byte comparison, full SHA-256 |
| Function entry, return and direct call | High confidence | MIPS disassembly + bytes |
| Register forwarding `a0,a2,a1,a3` | High confidence | Decoded instructions |
| Function's original C++ owner | Unknown | No authoritative symbol/debug map |
| `GUIParser.cpp` related function | Provisional proximity | A different function references that filename |
| Same function in PC WON launcher | Not established | Different platform/source reconstruction |
| Binary-exact recompilation | Not attempted | No PS2 compiler/linker equivalence test |

## Run locally

No original SLUS bytes or copyrighted game assets are placed in Git.

```sh
python -m unittest discover -s research/tests -v
SLUS_ELF_PATH='/path/to/SLUS_275(8).00' python -m unittest discover -s research/tests -v

cc -std=c11 -Wall -Wextra -Werror -pedantic \
  research/ps2/re_00108120.c research/tests/test_forwarding.c -o re-test
./re-test
```

The source-free unit test checks the 9 instruction words, window checksum,
JAL destination and that uncertainty is explicit; with `SLUS_ELF_PATH`
it also checks the *exact* user-owned ELF and its literal references.

## Ghidra handoff

1. Load a copy of the exact original ELF using its original virtual addresses:
   `.text` at `0x00100000`, `.rodata` at `0x00336c80`.
2. Run `tools/ghidra/import_re_map.py` from Ghidra Script Manager.
3. Select `research/ps2/seed-map.v1.json`.
4. The script verifies ELF MD5 where available, the complete 36-byte
   function instruction window, source filename bytes and its two anchor
   instruction windows **before** changing anything.
5. Approve the optional bookmark, plate comment and neutral proposed
   symbol; refusing applies **no changes**. The importer never overrides
   names or invents function boundaries.

The map is JSON by design: future Ghidra MCP agents can read it, correlate
callers, annotate exact addresses, and issue proposed source mappings. MCP
must not silently promote a guess to a verified name.

## Next function procedure

For each seed, demand: exact binary SHA and build, VA/file offset, function
start/end and byte fingerprint, code/data xrefs, call targets, observed
inputs/outputs/side effects, disassembly caveats (R5900 and delay slots),
candidate interpretation with a confidence per claim, a portable isolated
model, deterministic tests, and optional runtime traces. Keep **observed**,
**inferred**, **implemented**, and **matched** as distinct statuses.

A symbol name seen in a string, allocator diagnostics, or a PC project is
not sufficient proof of ownership. Compare through MIPS instruction and
behavioral evidence. A future "exact clone" requires an explicit
equivalence definition (observable behavior, ABI or binary identity) and a
repeatable qualification gate; do not use the phrase as a general claim.
