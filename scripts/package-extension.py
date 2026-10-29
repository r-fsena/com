"""Empacota a extensão a partir do repositório oficial e mantém o espelho do CRM."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
source = root.parent / 'brokiva-chrome-extension'
manifest = json.loads((source / 'manifest.json').read_text())
version = manifest['version']
files = ['manifest.json', 'background.js', 'content.js', 'content.css', 'crm-bridge.js', 'wa-bridge.js', 'popup.html', 'popup.js', 'README.md']
files += [str(file.relative_to(source)) for file in sorted((source / 'icons').glob('*')) if file.is_file()]
output = root / 'public/downloads'
output.mkdir(parents=True, exist_ok=True)
archive = output / f'brokiva-extension-v{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
    for name in files:
        bundle.write(source / name, name)
        target = root / 'chrome-extension' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, target)
shutil.copyfile(archive, output / 'brokiva-extension-latest.zip')
release = {'version': version, 'file': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
           'sourceCommit': subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()}
(output / 'brokiva-extension-release.json').write_text(json.dumps(release, indent=2) + '\n')
with zipfile.ZipFile(archive) as bundle:
    assert all(bundle.read(name) == (source / name).read_bytes() for name in files)
print(f'Extensão {version} empacotada e comparada com a fonte oficial ({len(files)} arquivos).')
