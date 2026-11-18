"""Export committed source plus public pronunciation files; never export keys or classroom data."""
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else root / 'outputs' / 'LeVo-source.zip'
manifest_path = root / '.local/pronunciations-v2/manifest.json'
if not manifest_path.exists():
    manifest_path = root / 'audio/pronunciations-v2/manifest.json'
manifest = json.loads(manifest_path.read_text())
wave_dir = manifest_path.parent
legacy_dir = wave_dir.parent / wave_dir.name.removesuffix('-v2')
entries = manifest['entries']
for entry in entries:
    if not re.fullmatch(r'[a-f0-9]{24}', entry['key']):
        raise SystemExit('Invalid audio key')
    if not (wave_dir / (entry['key'] + '.wav')).is_file():
        raise SystemExit('Missing pronunciation: ' + entry['en'])
tracked = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', 'HEAD'], cwd=root, text=True).splitlines()
for name in tracked:
    if name.startswith(('.local/', '.env')) or '/.env' in name or name.endswith('.sqlite'):
        raise SystemExit('Refusing to export runtime or secret files')
out.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['git', 'archive', '--format=zip', '--prefix=LeVo/', '-o', str(out), 'HEAD'], cwd=root, check=True)
with zipfile.ZipFile(out, 'a', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for entry in entries:
        name = entry['key']
        archive.write(wave_dir / (name + '.wav'), 'LeVo/audio/pronunciations-v2/' + name + '.wav')
        legacy = legacy_dir / (name + '.m4a')
        if legacy.exists():
            archive.write(legacy, 'LeVo/audio/pronunciations/' + name + '.m4a')
    public_manifest = {'entries': [{k: e[k] for k in ['en', 'key', 'seconds', 'rms', 'peak'] if k in e} for e in entries]}
    archive.writestr('LeVo/audio/pronunciations-v2/manifest.json', json.dumps(public_manifest, ensure_ascii=False))
    for name in archive.namelist():
        if '/.local/' in name or '/.env' in name or name.endswith('.sqlite') or '/.git/' in name:
            raise SystemExit('Refusing to export runtime or secret files')
print(json.dumps({'archive': str(out), 'pronunciations': len(entries), 'bytes': out.stat().st_size, 'secretsIncluded': False}))
