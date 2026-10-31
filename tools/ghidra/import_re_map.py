#@category HL1_PS2.RE
# Ghidra Jython: verified one-function RE map, non-destructive annotation only.
import json
import binascii
from ghidra.program.model.symbol import SourceType
from ghidra.program.model.listing import CodeUnit

def window_hex(address, count):
    memory = currentProgram.getMemory()
    return ''.join('%02x' % (memory.getByte(address.add(i)) & 255)
                   for i in range(count))

def check_bytes(address, expected, label):
    if address is None:
        raise RuntimeError('%s: unmapped address' % label)
    actual = window_hex(address, len(expected)//2)
    if actual.lower() != expected.lower():
        raise RuntimeError('%s: original bytes differ at %s' % (label, address))

map_file = askFile('Choose verified SLUS RE map JSON', 'Open')
with open(str(map_file.getAbsolutePath()), 'rb') as fp:
    manifest = json.load(fp)
if manifest.get('schema') != 'slus-re-map.v1':
    raise RuntimeError('Wrong schema')
if len(manifest.get('functions', [])) != 1:
    raise RuntimeError('This pilot imports only one function')
md5 = currentProgram.getExecutableMD5()
if md5 and md5.lower() != manifest['target']['md5'].lower():
    raise RuntimeError('ELF identity mismatch')

f = manifest['functions'][0]
entry = toAddr(f['entry'])
if entry is None or currentProgram.getMemory().getBlock(entry) is None:
    raise RuntimeError('ELF base is not mapped at the original address')
check_bytes(entry, f['instruction_bytes_hex'], 'Function')
for obs in manifest.get('observations', []):
    text = (obs['text'] + '\x00').encode('ascii')
    check_bytes(toAddr(obs['address']), binascii.hexlify(text), 'Literal')
    for instruction in obs.get('xref_instructions', []):
        check_bytes(toAddr(instruction['address']),
                    instruction['bytes_hex'], 'Reference instruction')
print('Preflight succeeded: seed bytes and nearby anchor match')
print('Candidate at %s: %s' % (entry, f['symbol_proposal']))
print('Source owner unknown; PC WON launcher equivalence unproven')

if askYesNo('Apply SLUS RE annotation?',
            'Verified source bytes. Add bookmark, comment and label? '
            'No existing names or function bodies will be overwritten.'):
    note = ('RE seed: register a1/a2 forwarding to 0x001086e8 verified. '
            'Actual original source owner UNKNOWN; adjacent '
            'Launcher/GUIParser.cpp literal does not prove method identity.')
    currentProgram.getBookmarkManager().setBookmark(
        entry, 'Analysis', 'HL1 PS2 RE verified-seed', note)
    listing = currentProgram.getListing()
    if not listing.getComment(CodeUnit.PLATE_COMMENT, entry):
        listing.setComment(entry, CodeUnit.PLATE_COMMENT, note)
    table = currentProgram.getSymbolTable()
    if not any(s.getName() == f['symbol_proposal']
               for s in table.getSymbols(entry)):
        table.createLabel(entry, f['symbol_proposal'], SourceType.USER_DEFINED)
    print('Annotation applied without inferring function extent or name')
else:
    print('No changes made')
