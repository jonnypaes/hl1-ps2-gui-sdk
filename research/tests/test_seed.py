"""Deterministic evidence tests. Original ELF remains private/local to the user.

python -m unittest discover -s research/tests -v
SLUS_ELF_PATH='/path/to/SLUS' python -m unittest discover -s research/tests -v
"""
import hashlib
import json
import os
from pathlib import Path
import struct
import unittest

MAP = Path(__file__).resolve().parents[1] / "ps2" / "seed-map.v1.json"

class SeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MAP.read_text(encoding="utf-8"))

    def test_verified_instruction_window(self):
        f = self.manifest["functions"][0]
        window = bytes.fromhex(f["instruction_bytes_hex"])
        self.assertEqual(len(window), int(f["end_exclusive"], 16) - int(f["entry"], 16))
        self.assertEqual(hashlib.sha256(window).hexdigest(), f["instruction_bytes_sha256"])
        self.assertEqual(struct.unpack("<9I", window), (
            0x00a0102d, 0x27bdfff0, 0x00c0282d,
            0x7fbf0000, 0x0c0421ba, 0x0040302d,
            0x7bbf0000, 0x03e00008, 0x27bd0010))
        call = struct.unpack_from("<I", window, 16)[0]
        target = (((int(f["entry"],16)+0x14) & 0xf0000000) |
                  ((call & 0x03ffffff) << 2))
        self.assertEqual(target, int(f["calls"][0]["target"], 16))

    def test_claims_do_not_promote_hypotheses(self):
        f = self.manifest["functions"][0]
        obs = self.manifest["observations"][0]
        self.assertEqual(f["source_owner"], "unknown")
        self.assertFalse(f["matches_pc_launcher"])
        self.assertIn("unverified", obs["status"])
        self.assertEqual(int(obs["address"],16) - int(obs["file_offset"],16), 0xff000)

    def test_original_user_elf_when_available(self):
        path = os.environ.get("SLUS_ELF_PATH")
        if not path:
            self.skipTest("Provide user-owned original ELF via SLUS_ELF_PATH")
        original = Path(path).read_bytes()
        m = self.manifest
        self.assertEqual(len(original), m["target"]["size_bytes"])
        self.assertEqual(hashlib.sha256(original).hexdigest(), m["target"]["sha256"])
        f = m["functions"][0]
        at = int(f["file_offset"], 16)
        expected = bytes.fromhex(f["instruction_bytes_hex"])
        self.assertEqual(original[at:at+len(expected)], expected)
        for obs in m["observations"]:
            off = int(obs["file_offset"], 16)
            expected = (obs["text"]+"\0").encode("ascii")
            self.assertEqual(original[off:off+len(expected)], expected)
            for x in obs["xref_instructions"]:
                off = 0x1000+int(x["address"],16)-0x100000
                expected = bytes.fromhex(x["bytes_hex"])
                self.assertEqual(original[off:off+len(expected)], expected)

if __name__ == "__main__":
    unittest.main()
