#!/bin/sh
set -eu
cd "$(dirname "$0")"
stage=build/extension
domain=soundlet
mkdir -p "$stage/schemas" "$stage/locale/sv/LC_MESSAGES" dist
cp metadata.json extension.js prefs.js outputs.js LICENSE "$stage/"
cp schemas/*.gschema.xml "$stage/schemas/"
glib-compile-schemas --strict --dry-run "$stage/schemas"
catalog="$stage/locale/sv/LC_MESSAGES/$domain.mo"
if command -v msgfmt >/dev/null; then
    msgfmt --check po/sv.po -o "$catalog"
else
    pybabel compile -D "$domain" -i po/sv.po -o "$catalog"
fi
gnome-extensions pack --force --out-dir=dist --extra-source=outputs.js \
    --extra-source=LICENSE --extra-source=locale "$stage"
# GNOME's packer records local timestamps. Normalize ordering, modes and dates.
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

path = Path('dist/soundlet@hogbergmarkus.github.io.shell-extension.zip')
temp = path.with_suffix('.tmp')
with ZipFile(path) as source, ZipFile(temp, 'w') as target:
    for name in sorted(n for n in source.namelist() if not n.endswith('/')):
        info = ZipInfo(name)
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        target.writestr(info, source.read(name), compress_type=ZIP_DEFLATED)
temp.replace(path)
PY
