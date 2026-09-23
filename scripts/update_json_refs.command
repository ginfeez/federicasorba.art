#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Double-click to update every .json file in the folder where this
# file sits (and all subfolders): any text value ending in
# .jpg / .jpeg / .png becomes .webp — whatever the key is called.
#
# Formatting of the JSON files is left exactly as it was.
# ─────────────────────────────────────────────────────────────

cd "$(dirname "$0")" || exit 1

python3 - "$(pwd)" <<'PY'
import json, os, re, sys

root = sys.argv[1]
SKIP_DIRS = {".git", "node_modules", ".github"}

# A JSON string (between quotes) that ends in .jpg / .jpeg / .png (any case)
pattern = re.compile(r'("(?:[^"\\]|\\.)*?)\.(?:jpe?g|png)"', re.IGNORECASE)

total = 0
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for name in filenames:
        if not name.lower().endswith(".json"):
            continue
        path = os.path.join(dirpath, name)
        rel = os.path.relpath(path, root)
        with open(path, encoding="utf-8") as f:
            text = f.read()

        changes = []
        def repl(m):
            if re.match(r'"(https?:)?//', m.group(0), re.IGNORECASE):
                return m.group(0)         # leave external URLs alone
            changes.append(m.group(0))
            return m.group(1) + '.webp"'
        new_text = pattern.sub(repl, text)

        if not changes:
            continue

        try:
            json.loads(new_text)          # safety check: still valid JSON
        except ValueError as e:
            print(f"✗ {rel}: skipped, result would be invalid JSON ({e})")
            continue

        with open(path, "w", encoding="utf-8") as f:
            f.write(new_text)
        total += len(changes)
        print(f"✓ {rel}: {len(changes)} reference(s) updated")
        for c in changes:
            print(f"    {c.strip(chr(34))}  →  .webp")

print()
print(f"Done: {total} reference(s) updated." if total else "No .jpg / .jpeg / .png references found.")
PY

echo ""
read -n 1 -s -r -p "Press any key to close this window..."
echo ""
