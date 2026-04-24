# Half-Life PS2 (Gearbox) UI Reverse Engineering SDK 🕹️

A toolkit for reverse-engineering, documenting, and recompiling the User Interface system used by **Gearbox Software** in the PlayStation 2 port of **Half-Life**.

---

## 📚 Table of Contents

* [🔍 Reverse Engineering Scope](#-reverse-engineering-scope)
* [✨ Features](#-features)
* [🛠️ Project Structure](#️-project-structure)
* [📄 Binary Format (Current Understanding)](#-binary-format-current-understanding)
* [📦 Container Formats](#-container-formats)
* [📝 Usage](#-usage)
* [🧪 Validation Strategy](#-validation-strategy)
* [⚠️ Disclaimer](#️-disclaimer)
* [🧠 Project Status](#-project-status)

---

This project targets the proprietary `guidef.txt` (GUI Definition) pipeline and its compiled binary counterparts, enabling reconstruction of original menus, layout behavior, and runtime state logic.

---

## 🔍 Reverse Engineering Scope

The Gearbox PS2 UI system is not a conventional retained-mode UI. It is a **state-driven renderer** designed around the constraints of the **Emotion Engine (MIPS R5900)** and the PS2 **Graphics Synthesizer (GS)**.

This SDK reproduces:

* **State Machine Behavior**
  Reverse-engineered handling of `GUI_DEPENDENCY` and conditional element visibility.

* **Render Ordering (Z-Plane)**
  Accurate layering and filtering consistent with engine behavior.

* **Coordinate Mapping**
  Translation to PS2 framebuffer targets:
  `640×448 (NTSC)` / `640×512 (PAL)`

* **DMA-Oriented Memory Layout**
  Strict **32-byte struct alignment** for efficient transfer to GS memory.

---

## ✨ Features

* **Gearbox-Compatible Parser**
  Supports `!define`, `!include`, and nested UI state blocks.

* **Deterministic Binary Exporter**
  Produces stable, engine-compatible binaries using Zlib compression.

* **Multi-Format Container Support**
  Handles known wrapper variants:

  * `.MPC` (12-byte header)
  * `CMP.` canonical header (16-byte variant)
  * `"COMPRESSED"` string-prefixed format

* **Simulation Layer**
  Recreates runtime filtering and element activation logic.

* **Title-Safe Validation**
  Highlights CRT-safe regions (~10% margin).

---

## 🛠️ Project Structure

* `src/core/Scanner.ts`
  Tokenizer for Gearbox-specific syntax (`SCREEN_RECT`, `Z_PLANE`, etc.)

* `src/core/Parser.ts`
  Builds UI structures and resolves nested state blocks

* `src/core/Simulator.ts`
  Emulates runtime evaluation (visibility, ordering, dependencies)

* `src/core/BinarySDK.ts`
  Deterministic encoder/decoder for binary formats (no heuristics)

---

## 📄 Binary Format (Current Understanding)

Each UI element compiles into a fixed **32-byte structure**:

| Offset | Type   | Description                  |
| -----: | ------ | ---------------------------- |
|   0x00 | uint16 | Element Type ID              |
|   0x02 | int16  | X Position                   |
|   0x04 | int16  | Y Position                   |
|   0x06 | int16  | Width                        |
|   0x08 | int16  | Height                       |
|   0x0A | uint32 | Color (Packed, likely ABGR)  |
|   0x0E | uint32 | Hover Color                  |
|   0x12 | int16  | Z-Plane                      |
|   0x14 | int16  | Dependency Index (-1 = none) |
|   0x16 | uint16 | Blend Mode ID                |
|   0x18 | uint16 | Fade In (ms)                 |
|   0x1A | uint16 | Fade Out (ms)                |
|   0x1C | uint32 | Padding (DMA alignment)      |

### Notes

* Struct size and alignment are **high confidence**
* Color packing is **observed as ABGR**, but may vary by pipeline
* Blend modes and type IDs are **reverse-engineered mappings**

---

## 📦 Container Formats

The engine uses multiple compression wrappers:

### 1. `.MPC` (Standard)

```
[4] Magic ".MPC"
[4] Decompressed Size
[4] Compressed Size
[Zlib stream]
```

### 2. `CMP.` (Canonical Gearbox TXT)

```
[4] "CMP."
[4] Decompressed Size
[4] Compressed Size
[4] Unknown/flags
[Zlib stream]
```

### 3. `"COMPRESSED"` (String Header)

```
[10] ASCII "COMPRESSED"
[Zlib stream]
```

All variants rely on **Zlib (DEFLATE)** streams.

---

## 📝 Usage

1. Place a `guidef` (or any other Gearbox Text) file in the workspace
2. Parse → simulate → export
3. Output binary is ready for:

   * emulator testing
   * asset injection
   * engine-side validation

---

## 🧪 Validation Strategy

To ensure correctness:

1. Load original asset
2. Decompress → parse
3. Re-export
4. Compare **decompressed buffers**

Differences usually indicate:

* color packing mismatch
* dependency index errors
* struct misalignment

---

## ⚠️ Disclaimer

This project is a reverse-engineering effort for research and preservation.

All original assets and IP belong to **Valve Corporation** and **Gearbox Software**.

---

## 🧠 Project Status

* ✅ Binary structure: stable
* ✅ Compression pipeline: verified (Zlib)
* ⚠️ Header variants: partially documented
* ⚠️ Some field semantics: inferred

The current project status is available on the [Project Board](projects?query=is%3Aopen).

For more information about the GUI system, see the [GUI Specification](docs/gui_spec.md).
