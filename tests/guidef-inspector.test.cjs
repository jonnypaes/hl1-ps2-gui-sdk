const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectGuidef } = require('../out/core/GuidefInspection.js');

test('source and unknown fields remain untouched, including CRLF', () => {
  const src = '!define X 1\r\nGUI_SCREEN\r\n  NAME "Demo"\r\n  NONSTANDARD_KEY a/b:foo.psi # text\r\nEND\r\n';
  const r = inspectGuidef(src);
  assert.equal(r.source, src);
  assert.equal(r.blocks.length, 1);
  assert.equal(r.blocks[0].properties[1].value, 'a/b:foo.psi # text');
  assert.equal(r.lines[3].raw, '  NONSTANDARD_KEY a/b:foo.psi # text');
  assert.equal(r.blocks[0].startLine, 2);
  assert.equal(r.blocks[0].endLine, 5);
});

test('nested markers and END are recorded without interpreting runtime behavior', () => {
  const r = inspectGuidef('GUI_SCREEN\nGUI_ELEMENT_STATE\nSCREEN_RECT -1 2.5 30 40\nEND\nEND');
  assert.equal(r.blocks[1].parentId, 0);
  assert.deepEqual(r.blocks[1].rect, { x: -1, y: 2.5, width: 30, height: 40, line: 3 });
  assert.equal(r.blocks[0].endLine, 5);
  assert.equal(r.blocks[1].endLine, 4);
});

test('unknown or malformed syntax is preserved rather than guessed', () => {
  const r = inspectGuidef('END\nGUI_SCREEN\nSCREEN_RECT 0 2 N 4\n!include "menu.inc"\nEND\nunmapped ???');
  assert.deepEqual(r.diagnostics.map(d => d.code), [
    'UNMATCHED_END', 'UNPARSED_SCREEN_RECT', 'INCLUDE_UNRESOLVED'
  ]);
  assert.equal(r.blocks[0].rect, null);
  assert.equal(r.lines[5].kind, 'opaque');
  assert.equal(r.lines[5].raw, 'unmapped ???');
});

test('empty source is valid; incomplete blocks are reported', () => {
  assert.equal(inspectGuidef('').blocks.length, 0);
  const r = inspectGuidef('GUI_ACTION\nTEXT "x"');
  assert.equal(r.diagnostics[0].code, 'UNCLOSED_BLOCK');
});
