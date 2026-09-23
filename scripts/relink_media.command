#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Double-click to repoint every media reference in the site to
# the file that is ACTUALLY on disk.
#
# Covers .md, .json, .html and .css — so images that live only in
# a project's .md file are kept in sync too, not just projects.json.
#
# What it does, in order:
#   1. BROKEN     a reference whose file is gone, but a sibling with
#                 the same name and another extension exists
#                 (…_1.jpg missing, …_1.webp there)  →  repointed
#   2. UPGRADE    the file is there, but a better one sits next to it
#                 (.jpg/.png with a .webp beside it, .gif with an .mp4)
#   3. UNFIXABLE  a reference with nothing to point at  →  listed
#   4. UNUSED     media on disk that nothing references  →  listed
#
# Nothing is written until you confirm, and nothing is ever deleted.
# Requires: python3 (already on macOS)
# ─────────────────────────────────────────────────────────────

cd "$(dirname "$0")" || exit 1

python3 - "$(pwd)" <<'PY'
import json, os, re, sys

# ---- find the site root: this file may sit in the root or in scripts/ ----
here = os.path.abspath(sys.argv[1])
root = here
for _ in range(4):
    if os.path.isdir(os.path.join(root, "assets")) and os.path.isdir(os.path.join(root, "content")):
        break
    parent = os.path.dirname(root)
    if parent == root:
        break
    root = parent
else:
    root = here

if not os.path.isdir(os.path.join(root, "assets")):
    print("Could not find the site root (no assets/ folder above this script).")
    sys.exit(1)

SKIP_DIRS   = {".git", "node_modules", ".github", "fonts", ".vscode"}
SCAN_EXT    = (".md", ".json", ".html", ".htm", ".css", ".js")
IMAGE_EXT   = ["webp", "avif", "png", "jpg", "jpeg", "gif", "tif", "tiff", "heic", "bmp"]
VIDEO_EXT   = ["mp4", "webm", "mov", "m4v", "ogv", "avi"]
MEDIA_EXT   = IMAGE_EXT + VIDEO_EXT
# what a missing reference should be repointed to, best first
PREFER_IMG  = ["webp", "avif", "png", "jpg", "jpeg", "gif"]
PREFER_VID  = ["mp4", "webm", "mov", "m4v"]
# a reference pointing at one of these, with the target beside it, is an upgrade
UPGRADES    = [(["jpg", "jpeg", "png", "tif", "tiff", "heic", "bmp"], "webp"),
               (["gif"], "mp4"),
               (["mov", "m4v", "avi"], "mp4")]

# any slash-containing path ending in a media extension — works for
# ![](a/b.jpg), "a/b.jpg", src="a/b.jpg" and url(a/b.jpg) alike
REF_RE = re.compile(r'(?<![\w/])((?:\.{0,2}/)?(?:[\w.\-]+/)+[\w.\-]+\.(?:' +
                    "|".join(MEDIA_EXT) + r'))(?![\w])', re.IGNORECASE)

def walk_files():
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name.lower().endswith(SCAN_EXT) and not name.startswith("."):
                yield os.path.join(dirpath, name)

def rel(p):
    return os.path.relpath(p, root)

def ext_of(ref):
    return ref.rsplit(".", 1)[1].lower()

def siblings(ref):
    """Files in the reference's folder sharing its name, keyed by extension."""
    abs_ref = os.path.join(root, ref)
    folder, base = os.path.dirname(abs_ref), os.path.basename(abs_ref)
    stem = base.rsplit(".", 1)[0].lower()
    if not os.path.isdir(folder):
        return {}
    out = {}
    for name in os.listdir(folder):
        if "." not in name:
            continue
        s, e = name.rsplit(".", 1)
        if s.lower() == stem and e.lower() in MEDIA_EXT:
            out[e.lower()] = os.path.join(folder, name)
    return out

def replacement(ref):
    """(new_ref, kind) or (None, reason) for a reference that needs attention."""
    abs_ref = os.path.join(root, ref)
    sibs = siblings(ref)
    e = ext_of(ref)
    here_ok = os.path.isfile(abs_ref)

    if not here_ok:
        order = PREFER_VID if e in VIDEO_EXT else PREFER_IMG
        for cand in order + sorted(sibs):
            if cand in sibs and cand != e:
                return swap_ext(ref, sibs[cand]), "broken"
        return None, "unfixable"

    for froms, to in UPGRADES:
        if e in froms and to in sibs:
            return swap_ext(ref, sibs[to]), "upgrade"
    return None, "ok"

def swap_ext(ref, abs_target):
    """Keep the reference's own spelling, swap in the real file's name."""
    prefix = ref.rsplit("/", 1)[0]
    return prefix + "/" + os.path.basename(abs_target)

# ---- pass 1: collect every reference and decide what to do with it ----
plans, referenced, unfixable = {}, set(), {}
for path in walk_files():
    with open(path, encoding="utf-8", errors="replace") as f:
        text = f.read()
    for m in REF_RE.finditer(text):
        ref = m.group(1)
        if re.search(r'(?:^|["\'(=\s])(?:https?:)?//', text[max(0, m.start() - 10):m.end()]):
            continue                                   # external URL — leave alone
        new, kind = replacement(ref)
        if kind == "unfixable":
            unfixable.setdefault(ref, set()).add(rel(path))
            continue
        if new and new != ref:
            plans.setdefault(rel(path), {}).setdefault(kind, {})[ref] = new
            referenced.add(os.path.normpath(os.path.join(root, new)))
        else:
            referenced.add(os.path.normpath(os.path.join(root, ref)))

n_broken  = sum(len(k.get("broken", {}))  for k in plans.values())
n_upgrade = sum(len(k.get("upgrade", {})) for k in plans.values())

# ---- the preview ----
def show(kind, heading):
    shown = False
    for path in sorted(plans):
        items = plans[path].get(kind, {})
        if not items:
            continue
        if not shown:
            print("\n" + heading)
            print("─" * 62)
            shown = True
        print("  " + path)
        for old in sorted(items):
            print("      %s\n        → %s" % (old, items[old]))

show("broken",  "BROKEN references that can be fixed  (%d)" % n_broken)
show("upgrade", "UPGRADES available  (%d)" % n_upgrade)

if unfixable:
    print("\nNOT FIXABLE — nothing on disk to point at  (%d)" % len(unfixable))
    print("─" * 62)
    for ref in sorted(unfixable):
        print("  %s\n      used in: %s" % (ref, ", ".join(sorted(unfixable[ref]))))

# ---- unused media on disk ----
unused = []
assets = os.path.join(root, "assets")
for dirpath, dirnames, filenames in os.walk(assets):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    for name in filenames:
        if name.startswith(".") or "." not in name:
            continue
        if name.rsplit(".", 1)[1].lower() not in MEDIA_EXT:
            continue
        p = os.path.normpath(os.path.join(dirpath, name))
        if p not in referenced:
            unused.append(rel(p))
if unused:
    print("\nUNUSED — on disk, referenced nowhere  (%d)" % len(unused))
    print("─" * 62)
    print("  (listed only — this script never deletes anything)")
    for p in sorted(unused):
        print("  %s" % p)

if not n_broken and not n_upgrade:
    print("\nEvery reference already points at a file on disk. Nothing to change.")
    sys.exit(0)

# ---- confirm ----
print("\n" + "═" * 62)
print("  %d broken reference(s) to fix, %d upgrade(s) available." % (n_broken, n_upgrade))
print("  [y] apply everything   [f] fix broken only   [n] cancel")
sys.stdout.write("  > ")
sys.stdout.flush()
try:                                   # stdin is the heredoc — ask the terminal
    with open("/dev/tty") as tty:
        answer = tty.readline().strip().lower()
except (IOError, OSError):
    answer = "n"
    print("(no terminal to ask — cancelling)")
if answer not in ("y", "f"):
    print("\nCancelled. Nothing was changed.")
    sys.exit(0)
kinds = ("broken", "upgrade") if answer == "y" else ("broken",)

# ---- write ----
written = changed = 0
for path in sorted(plans):
    items = {}
    for k in kinds:
        items.update(plans[path].get(k, {}))
    if not items:
        continue
    full = os.path.join(root, path)
    with open(full, encoding="utf-8") as f:
        text = f.read()
    new_text = text
    for old in sorted(items, key=len, reverse=True):   # longest first, so no partial hits
        new_text = new_text.replace(old, items[old])
    if new_text == text:
        continue
    if path.lower().endswith(".json"):
        try:
            json.loads(new_text)
        except ValueError as e:
            print("  ✗ %s: skipped, result would be invalid JSON (%s)" % (path, e))
            continue
    with open(full, "w", encoding="utf-8") as f:
        f.write(new_text)
    written += 1
    changed += len(items)
    print("  ✓ %s — %d reference(s)" % (path, len(items)))

print("\nDone: %d reference(s) updated across %d file(s)." % (changed, written))
PY

echo ""
read -n 1 -s -r -p "Press any key to close this window..."
echo ""
