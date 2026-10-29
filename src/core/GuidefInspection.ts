/**
 * GUIDEF source inspector, intentionally independent from runtimes and file I/O.
 *
 * This is a lossless *source-text* inspection layer, NOT a Gearbox compiler,
 * complete grammar, emulator, or binary format claim. Unknown syntax is retained.
 */
export type GuidefLineKind =
  | 'blank' | 'comment' | 'directive' | 'block' | 'end' | 'property' | 'opaque';
export type GuidefSeverity = 'info' | 'warning';
export interface GuidefLine {
  number: number;
  raw: string;
  kind: GuidefLineKind;
  blockId: number | null;
}
export interface GuidefProperty {
  key: string;
  value: string;
  raw: string;
  line: number;
}
export interface GuidefRect {
  x: number;
  y: number;
  width: number;
  height: number;
  line: number;
}
export interface GuidefBlock {
  id: number;
  type: string;
  startLine: number;
  endLine: number | null;
  parentId: number | null;
  properties: GuidefProperty[];
  rect: GuidefRect | null;
}
export interface GuidefDiagnostic {
  line: number;
  severity: GuidefSeverity;
  code: string;
  message: string;
}
export interface GuidefInspection {
  source: string;
  lines: GuidefLine[];
  blocks: GuidefBlock[];
  diagnostics: GuidefDiagnostic[];
}
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function rectFrom(value: string, line: number): GuidefRect | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 4 || parts.some(p => !numeric.test(p))) return null;
  const coords = parts.map(Number);
  if (coords.some(n => !Number.isFinite(n))) return null;
  return { x: coords[0], y: coords[1], width: coords[2], height: coords[3], line };
}
export function inspectGuidef(source: string): GuidefInspection {
  const lines: GuidefLine[] = [];
  const blocks: GuidefBlock[] = [];
  const diagnostics: GuidefDiagnostic[] = [];
  const stack: number[] = [];
  // A line-based structural view: no macro expansion or inferred runtime semantics.
  const sourceLines = source.split(/\r\n|\n|\r/);
  for (let i = 0; i < sourceLines.length; i++) {
    const number = i + 1;
    const raw = sourceLines[i];
    const trimmed = raw.trim();
    const current = stack.length ? stack[stack.length - 1] : null;
    let kind: GuidefLineKind = 'opaque';
    let lineBlock = current;
    if (trimmed.length === 0) kind = 'blank';
    else if (trimmed.startsWith('#')) kind = 'comment';
    else if (/^![A-Za-z_][A-Za-z_0-9]*(?:\s|$)/.test(trimmed)) {
      kind = 'directive';
      if (/^!include(?:\s|$)/i.test(trimmed)) {
        diagnostics.push({
          line: number, severity: 'info', code: 'INCLUDE_UNRESOLVED',
          message: 'Include recorded but not resolved. This inspection reads only the selected file.'
        });
      }
    } else if (/^GUI_[A-Za-z0-9_]+$/.test(trimmed)) {
      kind = 'block';
      const id = blocks.length;
      blocks.push({
        id, type: trimmed, startLine: number, endLine: null,
        parentId: current, properties: [], rect: null
      });
      stack.push(id);
      lineBlock = id;
    } else if (/^END(?:\s+#.*)?$/.test(trimmed)) {
      kind = 'end';
      if (current === null) diagnostics.push({
        line: number, severity: 'warning', code: 'UNMATCHED_END',
        message: 'END without a recognized open GUI_ block.'
      });
      else {
        blocks[current].endLine = number;
        stack.pop();
      }
    } else {
      const property = /^([A-Za-z_][A-Za-z0-9_]*)[ \t]+(.+)$/.exec(trimmed);
      if (current !== null && property) {
        kind = 'property';
        const item: GuidefProperty = {
          key: property[1], value: property[2], raw, line: number
        };
        blocks[current].properties.push(item);
        if (item.key === 'SCREEN_RECT') {
          const rect = rectFrom(item.value, number);
          if (rect) blocks[current].rect = rect;
          else diagnostics.push({
            line: number, severity: 'warning', code: 'UNPARSED_SCREEN_RECT',
            message: 'SCREEN_RECT was preserved as text; exactly four finite numeric values are needed for a schematic rectangle.'
          });
        }
      }
    }
    lines.push({ number, raw, kind, blockId: lineBlock });
  }
  for (const id of stack) diagnostics.push({
    line: blocks[id].startLine, severity: 'warning', code: 'UNCLOSED_BLOCK',
    message: 'Recognized GUI_ block has no matching END in this source.'
  });
  return { source, lines, blocks, diagnostics };
}
