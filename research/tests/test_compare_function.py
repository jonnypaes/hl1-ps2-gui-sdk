"""Offline, deterministic MIPS ELF32 comparator tests; no retail game assets."""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tools' / 're' / 'compare_function.py'
MAP = ROOT / 'research' / 'ps2' / 'seed-map.v1.json'
spec = importlib.util.spec_from_file_location('compare_function', SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def header(kind, phoff=0, phnum=0, shoff=0, shnum=0):
    return (b'\x7fELF\x01\x01\x01' + b'\0'*9 +
            struct.pack('<HHIIIIIHHHHHH',kind,8,1,0x100008,phoff,shoff,
                        0,52,32 if phnum else 0,phnum,
                        40 if shnum else 0,shnum,0))

def object_elf(body, symbol, reloc=None):
    # Minimal synthetic ELF32 MIPS object: .text, .strtab, .symtab, .rel.text
    data = bytearray(0x200+5*40)
    data[:52] = header(1,shoff=0x200,shnum=5)
    data[0x80:0x80+len(body)] = body
    names = b'\0'+symbol.encode('ascii')+b'\0'
    data[0xc0:0xc0+len(names)] = names
    data[0x110:0x120] = struct.pack('<IIIBBH',1,0,len(body),2,0,1)
    entries = [
        (0,0,0,0,0,0,0,0,0,0),
        (0,1,6,0,0x80,len(body),0,0,4,0),
        (0,3,0,0,0xc0,len(names),0,0,1,0),
        (0,2,0,0,0x100,32,2,0,4,16),
        (0,9,0,0,0x150,8 if reloc is not None else 0,3,1,4,8)
    ]
    if reloc is not None:
        data[0x150:0x158] = struct.pack('<II',reloc,4)
    for i,row in enumerate(entries):
        data[0x200+40*i:0x200+40*(i+1)] = struct.pack('<10I',*row)
    return bytes(data)

def linked_elf(body, va):
    data = bytearray(0x100+len(body))
    data[:52] = header(2,phoff=52,phnum=1)
    data[52:84] = struct.pack('<8I',1,0x100,va,va,len(body),len(body),5,0x1000)
    data[0x100:] = body
    return bytes(data)

class ComparatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mapping = json.loads(MAP.read_text(encoding='utf-8'))
        cls.f = cls.mapping['functions'][0]
        cls.ref = bytes.fromhex(cls.f['instruction_bytes_hex'])

    def compare_fixture(self, body, linked=False, reloc=None):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'candidate.elf'
            if linked:
                data = linked_elf(body,int(self.f['entry'],16))
            else:
                data = object_elf(body,self.f['symbol_proposal'],reloc)
            path.write_bytes(data)
            return mod.compare(self.mapping,str(path))

    def test_object_bytes_match_but_are_not_linked_proof(self):
        result = self.compare_fixture(self.ref)
        self.assertEqual(result['status'],'OBJECT_BYTES_EQUAL_UNLINKED')
        self.assertFalse(result['window_bytes_exact'])
        self.assertFalse(result['source_identity_proven'])

    def test_linked_window_exact(self):
        result = self.compare_fixture(self.ref,linked=True)
        self.assertEqual(result['status'],'LINKED_WINDOW_BYTES_EXACT')
        self.assertTrue(result['window_bytes_exact'])
        self.assertFalse(result['whole_function_equivalence_proven'])

    def test_one_byte_difference_fails(self):
        r = self.compare_fixture(bytes([self.ref[0]^1])+self.ref[1:],linked=True)
        self.assertEqual(r['status'],'MISMATCH')
        self.assertEqual(r['first_difference'],0)

    def test_size_mismatch_is_not_parser_error(self):
        r = self.compare_fixture(self.ref+b'\0'*20)
        self.assertEqual((r['status'],r['reference_size'],r['candidate_size']),
                         ('SIZE_MISMATCH',36,56))

    def test_relocation_inside_body_blocks_match(self):
        r = self.compare_fixture(self.ref,reloc=16)
        self.assertEqual(r['status'],'UNRESOLVED_RELOCATIONS')
        self.assertEqual(r['relocation_offsets'],[16])

    def test_relocation_outside_body_does_not_block(self):
        self.assertEqual(self.compare_fixture(self.ref,reloc=len(self.ref))['status'],
                         'OBJECT_BYTES_EQUAL_UNLINKED')

    def test_reference_hash_must_match(self):
        mapping = json.loads(json.dumps(self.mapping))
        mapping['functions'][0]['instruction_bytes_sha256'] = '0'*64
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'candidate.elf'
            path.write_bytes(linked_elf(self.ref,int(self.f['entry'],16)))
            with self.assertRaises(mod.Invalid):
                mod.compare(mapping,str(path))

    def test_original_optional(self):
        import os
        original = os.environ.get('SLUS_ELF_PATH')
        if not original:
            self.skipTest('No retail SLUS in CI; supply own ELF locally')
        rec = dict(self.f,_sha256=self.mapping['target']['sha256'])
        self.assertEqual(mod.verify_reference(rec,original),self.ref)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'candidate.elf'
            path.write_bytes(linked_elf(self.ref,int(self.f['entry'],16)))
            self.assertTrue(mod.compare(self.mapping,str(path),original)['window_bytes_exact'])

if __name__ == '__main__':
    unittest.main()
