"""Read-only evidence validation. Original SLUS is supplied locally, never in CI."""
import hashlib
import json
import os
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
XREFS = ROOT / 'research' / 'ps2' / 'string-xrefs.v1.json'

class StringXrefTests(unittest.TestCase):
    def test_canonical_mapping_without_original(self):
        x = json.loads(XREFS.read_text(encoding='utf-8'))
        self.assertEqual(x['schema'], 'slus-re-xrefs.v1')
        self.assertEqual(len(x['string_probes']), 3)
        for item in x['string_probes']:
            self.assertEqual(item['text'], 'sv_gravity')
            self.assertEqual(int(item['va'],16)-int(item['file_offset'],16),0xff000)
        first = x['string_probes'][0]['code_xref_pair']
        self.assertEqual(bytes.fromhex(first['lui_bytes']), b'\x35\x00\x04\x3c')
        self.assertEqual(bytes.fromhex(first['addiu_bytes']), b'\xf0\x01\x84\x24')
        self.assertEqual(first['semantic'].split('=> ')[-1], '0x003501f0')

    def test_original_slus_literal_and_code_pointers(self):
        original = os.environ.get('SLUS_ELF_PATH')
        if not original:
            self.skipTest('Supply SLUS_ELF_PATH to check original local ELF')
        x = json.loads(XREFS.read_text(encoding='utf-8'))
        buf = Path(original).read_bytes()
        self.assertEqual(hashlib.sha256(buf).hexdigest(), x['target_sha256'])
        for item in x['string_probes']:
            off = int(item['file_offset'],16)
            self.assertEqual(buf[off:off+len(b'sv_gravity\x00')],b'sv_gravity\x00')
            pair = item['code_xref_pair']
            if pair:
                for prefix in ('lui','addiu'):
                    addr = int(pair[prefix+'_va'],16)
                    start = 0x1000+addr-0x100000
                    self.assertEqual(buf[start:start+4],
                                     bytes.fromhex(pair[prefix+'_bytes']))

if __name__ == '__main__':
    unittest.main()
