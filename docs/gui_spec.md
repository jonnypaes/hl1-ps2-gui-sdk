# 🧩 GUI System – Reverse Engineered Documentation

## 📑 Index

* [📁 Modules Overview](#-modules-overview)
* [🧱 GUI Element System](#-gui-element-system)

  * [GUIElementDependency.cpp](#guielementdependencycpp)
  * [GUIElementCaption.cpp](#guielementcaptioncpp)
  * [Generic Element Model](#-generic-element-model)
* [🎮 Input System](#-input-system)
* [🎨 Rendering](#-rendering)
* [🖥️ Screen System](#️-screen-system-guiscreencpp)
* [⚙️ Command System](#️-command-system-guicommandcpp)
* [📊 Variable System](#-variable-system)
* [🎬 Action System](#-action-system)
* [🔁 Execution Model](#-execution-model)
* [🧾 Script Syntax](#-script-syntax)
* [🧠 Notes & Quirks](#-notes--quirks)
* [🧩 Summary](#-summary)

---

## 📁 Modules Overview

### Core Files

* `Launcher/GUI.cpp` → runtime entry / coordinator
* `Launcher/GUIParser.cpp` → DSL parser
* `Launcher/GUIScreen.cpp` → screen + focus management
* `Launcher/GUIVariableManager.cpp` → variable storage

---

## 🧱 GUI Element System

### `GUIElementDependency.cpp`

Defines structure, rendering, and behavior of elements.

#### Properties

* `Z_PLANE` → draw order
* `SCREEN_RECT` → position + size
* `TEXTURE`, `TEXTURE_RECT` → rendering
* `COLOR_MODULATE` → tint

#### Links

* `GUI_CAPTION` → text layer
* `GUI_INPUT` → input binding

#### Lifecycle Hooks

* `GET_FOCUS` → on enter
* `LOSE_FOCUS` → on exit
* `WHILE_FOCUS` → per-frame update
* `ON_RENDER` → draw step

#### Control

* `DEPENDS_VALUE` → conditional activation

---

### `GUIElementCaption.cpp`

Handles text rendering.

#### Properties

* `TEXT`
* `PARAMS`
* `SCALE`
* `COLORS`
* `WRAP`

---

### 🧩 Generic Element Model

Shared across all elements:

#### Core

* `NAME`
* `Z_PLANE`
* `SCREEN_RECT`
* `TEXTURE`, `TEXTURE_RECT`

#### Rendering

* `BLEND_FUNC`
* `TEX_ENV`

#### Behavior

* `GET_FOCUS`
* `LOSE_FOCUS`
* `WHILE_FOCUS`
* `ON_RENDER`

#### Composition

* `GUI_DEPENDENCY`
* `GUI_INPUT`
* `GUI_CAPTION`

---

## 🎮 Input System

Centralized input abstraction layer.

```txt
Hardware → Input Mapper → GUI_COMMAND → Element
```

### Sources

* DualShock controllers
* Keyboard
* Mouse

### Commands

**General**

* `ANY`, `GUI_COMMAND`

**Directional**

* `UP`, `DOWN`, `LEFT`, `RIGHT`

**Buttons**

* `TRIANGLE`, `CIRCLE`, `X`, `SQUARE`

**Shoulders / Sticks**

* `LEFTSHOULDER1/2`, `RIGHTSHOULDER1/2`
* `L3`, `R3`

**System**

* `SELECT`, `START`

**Namespaced**

* `P1_*`, `P2_*`

**Other**

* `MOUSE1`, `DEL`

### Features

* Device-independent
* Multi-player support
* Runtime rebinding via actions

---

## 🎨 Rendering

Fixed-function style pipeline.

### Blend Modes

* `GL_ONE`, `GL_ZERO`
* `GL_SRC_ALPHA`, `GL_ONE_MINUS_SRC_ALPHA`
* `GL_DST_COLOR`, `GL_SRC_COLOR`

### Texture Modes

* `GL_MODULATE`
* `GL_REPLACE`
* `GL_ALPHA`

### Notes

* No shaders
* Ordered by `Z_PLANE`
* Deterministic output

---

## 🖥️ Screen System (`GUIScreen.cpp`)

Controls screen transitions and conditions.

### Properties

* `FADE_IN_TIME`
* `FADE_OUT_TIME`

### Operators

* `EQUALS`, `NOTEQUALS`
* `GREATERTHAN`, `LESSTHAN`

---

## ⚙️ Command System (`GUICommand.cpp`)

Defines parameterized execution.

### Parameters

* `$param0`, `$param1`, ..., `$param%d`

### Types

* `Numeric`, `Float`, `Integer`, `String`

### Attributes

* `INITIAL_VALUE`
* `MIN_VALUE`, `MAX_VALUE`
* `VALUE`

### Flags

* `TRUE`, `LOOP`, `RUNNING`
* `WRAP`, `LERP_TIME`

---

## 📊 Variable System

Managed by `GUIVariableManager.cpp`

### Types

* `GUI_VARIABLE_FLOAT`
* `GUI_VARIABLE_STRING`

### Usage

* UI state
* Conditional logic
* Animation (`LERP_TIME`)

---

## 🎬 Action System

Defined in:

* `GUIActionTable.cpp`
* `GUIActionUserDefined.cpp`

### Model

```txt
Action ID → Dispatch → Native Function
```

---

### Core Actions

* `GUI_ACTION_PLAY_SOUND($param0, $param1)`
* `GUI_ACTION_SET_FOCUS($param0)`
* `GUI_ACTION_EXIT`
* `GUI_ACTION_REFRESH`

---

### Variable Actions

* `GUI_ACTION_SET_VARIABLE($param0, $param1)`
* `GUI_ACTION_SET_VARIABLE_VARIABLE($param0, $param1)`
* `GUI_ACTION_ADD_VARIABLE($param0, $param1)`

---

### Rendering / Debug

* `GUI_ACTION_MODIFY_VIEWPORT($param0)`
* `GUI_ACTION_PRINTF($param0)`
* `GUI_ACTION_COPY_ATTRIBUTE($param0, $param1, $param2)`

---

### System / Game

* `GUI_ACTION_SET_GAME($param0, $param1)`
* `GUI_ACTION_SET_FRONT_END(...)`
* `GUI_ACTION_SET_PAUSE_MENU(...)`

---

### Timeline Control

* `GUI_ACTION_VCR_VARIABLE($param0, $param1)`

States:

* `PLAY`, `PAUSE`, `REWIND`

---

### Save System

#### Game

* `CreateSave`
* `LoadSave`
* `DeleteSave`
* `FormatCard`
* `VerifySpace`
* `UpdateListing`

#### System

* `GUI_ACTION_SYSTEM_SAVE_MANUAL_USE(...)`

---

### Device

* `GUI_ACTION_IS_DEVICE_CONNECTED(...)`

Devices:

* `DUALSHOCK1`, `DUALSHOCK2`
* `KEYBOARD`, `MOUSE`
* `ANY`, `ALL_DEVICE_HASH`

---

### Input Binding

* `GUI_ACTION_BIND_HELPER(...)`

Modes:

* `CONTROLLER1_MODE`, `CONTROLLER2_MODE`
* `KEYBOARD_MODE`, `MOUSE_MODE`

Ops:

* `UPDATE_BIND`, `UNBIND_ACTION`
* `APPLY_PRESET`, `SAVE_SETTINGS`

---

### Audio / Feedback

* `GUI_ACTION_SET_VOLUME($param0)`

  * `BGMVolume`, `EffectVolume`
* `GUI_ACTION_VIBRATE(...)`

---

### Memory / Display

* `GUI_ACTION_MEMORY_SAVE(...)`
* `GUI_ACTION_DISPLAY_MODE($param0)`

  * `NTSC`, `PAL`

---

## 🔁 Execution Model

Frame-driven execution.

```txt
for each frame:
    poll input
    resolve focus

    if focus changed:
        LOSE_FOCUS (old)
        GET_FOCUS (new)

    WHILE_FOCUS (current)

    execute actions

    ON_RENDER
```

### Properties

* Deterministic
* No async/event queue
* Script-controlled behavior

---

## 🧾 Script Syntax

### Directives

* `!include`
* `!define`

### Blocks

* `GUI_SCREEN`
* `GUI_ACTION`

### Structure

```txt
BLOCK_NAME
    PROPERTY value
END
```

---

## 🧠 Notes & Quirks

* `END` = block terminator
* `$paramX` = weakly typed arguments
* Likely string-based dispatch
* Composition over inheritance
* Fixed-function rendering

---

## 🧩 Summary

* Data-driven UI system
* Command-dispatch architecture
* Focus-based state machine
* Frame-driven execution
