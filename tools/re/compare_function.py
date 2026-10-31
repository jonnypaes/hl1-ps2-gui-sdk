#!/usr/bin/env python3
"""Strict ELF32 little-endian MIPS function byte comparator (stdlib only).

ET_REL: extract named STT_FUNC; any relocation touching its body blocks equality.
ET_EXEC: compare original virtual-address window using PT_LOAD, not section names.
No claim of original-source identity or full runtime equivalence is made.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

class Invalid(ValueError):
    pass

def region(blob, off, length):
    if off < 0 or length < 0 or off + length > len(blob):
        raise Invalid('ELF truncated or section bounds invalid')
    return blob[off:off+length]

class Elf:
    def __init__(self, raw):
        self.raw = raw
        if raw[:6] != b'\x7fELF\x01\x01':
            raise Invalid('Requires ELF32 little-endian (MIPS EE)')
        if len(raw) < 52:
            raise Invalid('ELF header truncated')
        fields = struct.unpack_from('<HHIIIIIHHHHHH', raw, 16)
        self.kind, self.machine = fields[:2]
        if self.kind not in (1, 2) or self.machine != 8:
            raise Invalid('Requires MIPS ET_REL or ET_EXEC')
        self.phoff, self.shoff = fields[4], fields[5]
        self.flags = fields[6]
        self.phentsz, self.phnum = fields[8], fields[9]
        self.shentsz, self.shnum = fields[10], fields[11]
        self.sections = []
        if self.shnum:
            if self.shentsz < 40:
                raise Invalid('Invalid section header entry size')
            for i in range(self.shnum):
                row = region(raw, self.shoff + i*self.shentsz, 40)
                name, typ, flags, addr, off, size, link, info, align, entsize = struct.unpack('<10I', row)
                if typ != 8 and size:
                    region(raw, off, size)
                self.sections.append(dict(type=typ, offset=off, size=size,
                                          link=link, info=info, entsize=entsize, addr=addr))
        self.loads = []
        if self.phnum:
            if self.phentsz < 32:
                raise Invalid('Invalid program header entry size')
            for i in range(self.phnum):
                p = struct.unpack('<8I', region(raw, self.phoff + i*self.phentsz, 32))
                if p[0] == 1:
                    region(raw, p[1], p[4])
                    self.loads.append(dict(offset=p[1], vaddr=p[2], filesz=p[4]))

    def at_va(self, va, size):
        for p in self.loads:
            if va >= p['vaddr'] and va + size <= p['vaddr'] + p['filesz']:
                return region(self.raw, p['offset']+va-p['vaddr'], size)
        raise Invalid('Target VA not entirely backed by PT_LOAD bytes')

    def at_symbol(self, name):
        matches = []
        for sec in self.sections:
            if sec['type'] != 2:
                continue
            if sec['entsize'] < 16 or sec['entsize'] == 0 or sec['size'] % sec['entsize']:
                raise Invalid('Invalid symtab entry layout')
            if sec['link'] >= len(self.sections):
                raise Invalid('Symbol string table index out of bounds')
            strings = self.sections[sec['link']]
            table = region(self.raw, strings['offset'], strings['size'])
            for i in range(sec['size']//sec['entsize']):
                st = struct.unpack('<IIIBBH', region(self.raw, sec['offset']+i*sec['entsize'], 16))
                nameidx, value, symsize, info, other, idx = st
                if nameidx >= len(table):
                    raise Invalid('Symbol name outside string table')
                end = table.find(b'\x00', nameidx)
                if end < 0:
                    raise Invalid('Unterminated symbol name')
                if (info & 0xf) == 2 and table[nameidx:end] == name.encode('ascii'):
                    matches.append((idx, value, symsize))
        if len(matches) != 1:
            raise Invalid('Expected exactly one STT_FUNC symbol: %s (found %d)' % (name, len(matches)))
        idx, value, symsize = matches[0]
        if idx <= 0 or idx >= len(self.sections) or symsize <= 0 or symsize > 65536:
            raise Invalid('Invalid candidate function size or section mapping')
        section = self.sections[idx]
        if section['type'] == 8 or value + symsize > section['size']:
            raise Invalid('Symbol does not have file-backed bytes')
        relocated = []
        for relocation in self.sections:
            if relocation['type'] not in (4, 9) or relocation['info'] != idx:
                continue
            step = 12 if relocation['type'] == 4 else 8
            if relocation['entsize'] != step or relocation['size'] % step:
                raise Invalid('Invalid MIPS REL/RELA entry layout')
            for i in range(relocation['size']//step):
                roff = struct.unpack('<I', region(self.raw, relocation['offset']+i*step, 4))[0]
                if value <= roff < value+symsize:
                    relocated.append(roff-value)
        return region(self.raw, section['offset']+value, symsize), relocated

def verify_reference(record, original=None):
    raw = bytes.fromhex(record['instruction_bytes_hex'])
    size = int(record['end_exclusive'], 16)-int(record['entry'], 16)
    if len(raw) != size or len(raw) == 0 or (size % 4):
        raise Invalid('Reference bytes or function extent inconsistent')
    if hashlib.sha256(raw).hexdigest() != record['instruction_bytes_sha256']:
        raise Invalid('Reference bytes do not match their own checksum')
    if original is not None:
        original_bytes = Path(original).read_bytes()
        elf = Elf(original_bytes)
        if hashlib.sha256(original_bytes).hexdigest() != record['_sha256']:
            raise Invalid('Original SLUS full-image SHA256 mismatch')
        if elf.kind != 2 or elf.at_va(int(record['entry'], 16), size) != raw:
            raise Invalid('Reference window does not match original ELF')
    return raw

def compare(mapping, candidate, original=None, function_id=None):
    if mapping.get('schema') != 'slus-re-map.v1':
        raise Invalid('Unknown mapping schema')
    functions = mapping.get('functions', [])
    if function_id is not None:
        functions = [f for f in functions if f['entry'].lower() == function_id.lower()]
    if len(functions) != 1:
        raise Invalid('Specify a unique function entry')
    record = dict(functions[0]); record['_sha256'] = mapping['target']['sha256']
    ref = verify_reference(record, original)
    elf = Elf(Path(candidate).read_bytes())
    if elf.kind == 1:
        if not record.get('symbol_proposal'):
            raise Invalid('Map needs a symbol_proposal for ET_REL')
        actual, reloc = elf.at_symbol(record['symbol_proposal'])
        stage = 'object'
    else:
        actual = elf.at_va(int(record['entry'], 16), len(ref))
        reloc = []; stage = 'linked'
    diff = next((i for i,(x,y) in enumerate(zip(ref,actual)) if x != y), None)
    if reloc:
        status = 'UNRESOLVED_RELOCATIONS'
    elif len(actual) != len(ref):
        status = 'SIZE_MISMATCH'
    elif diff is not None:
        status = 'MISMATCH'
    elif stage == 'object':
        status = 'OBJECT_BYTES_EQUAL_UNLINKED'
    else:
        status = 'LINKED_WINDOW_BYTES_EXACT'
    return dict(status=status,stage=stage,function_entry=record['entry'],
                original_sha256=mapping['target']['sha256'],
                expected_sha256=hashlib.sha256(ref).hexdigest(),
                actual_sha256=hashlib.sha256(actual).hexdigest(),
                reference_size=len(ref),candidate_size=len(actual),
                first_difference=diff,relocation_offsets=reloc,
                candidate_elf_flags='0x%08x' % elf.flags,
                window_bytes_exact=(status=='LINKED_WINDOW_BYTES_EXACT'),
                whole_function_equivalence_proven=False,
                source_identity_proven=False)

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--map',required=True)
    ap.add_argument('--candidate',required=True)
    ap.add_argument('--original',help='Optional local user-owned original ELF')
    ap.add_argument('--function-entry')
    ap.add_argument('--output',help='Write optional JSON report')
    ap.add_argument('--require-linked-exact',action='store_true',
                    help='Hard gate: fail unless linked reference window matches')
    args = ap.parse_args(argv)
    try:
        report = compare(json.loads(Path(args.map).read_text(encoding='utf-8')),
                         args.candidate,args.original,args.function_entry)
    except (Invalid,OSError,KeyError,ValueError) as exc:
        print('INVALID: %s' % exc,file=sys.stderr)
        return 2
    output = json.dumps(report,sort_keys=True,indent=2)
    print(output)
    if args.output:
        Path(args.output).write_text(output+'\n',encoding='utf-8')
    return 1 if args.require_linked_exact and not report['window_bytes_exact'] else 0

if __name__ == '__main__':
    sys.exit(main())
