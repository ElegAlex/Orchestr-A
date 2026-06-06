#!/usr/bin/env python3
"""Flip BACKLOG entries to DONE / set Closed_by when folding.
Usage:
  .fold-close.py done   <BATCH> <id,id,...>          # Status->DONE, Disposition->FOLDED, Closed_by placeholder
  .fold-close.py closed <sha>  <id,id,...>           # set Closed_by=<sha> on those entries
"""
import re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
BACKLOG = os.path.join(HERE, 'BACKLOG.md')
mode = sys.argv[1]
content = open(BACKLOG, encoding='utf-8').read()

def edit_block(fid, fn):
    global content
    pat = re.compile(r'(?ms)^(### '+re.escape(fid)+r' — .*?)(?=^### |\Z)')
    m = pat.search(content)
    if not m:
        print('NOT FOUND', fid); return False
    blk = m.group(1)
    nb = fn(blk)
    content = content[:m.start()] + nb + content[m.end():]
    return True

if mode == 'done':
    batch = sys.argv[2]; ids = sys.argv[3].split(',')
    def mk(b):
        b = re.sub(r'(?m)^- \*\*Status:\*\* .*$', '- **Status:** DONE', b, count=1)
        b = re.sub(r'(?m)^- \*\*Disposition:\*\* .*$',
                   f'- **Disposition:** FOLDED (was OPEN-FIXABLE, batch {batch})', b, count=1)
        return b
    ok = sum(edit_block(i, mk) for i in ids)
    print(f'done: updated {ok}/{len(ids)}')
elif mode == 'closed':
    sha = sys.argv[2]; ids = sys.argv[3].split(',')
    def mk(b):
        if re.search(r'(?m)^\*\*Closed_by:\*\*', b):
            return re.sub(r'(?m)^\*\*Closed_by:\*\*\s*.*$', f'**Closed_by:** {sha}', b, count=1)
        if re.search(r'(?m)^---\s*$', b):
            return re.sub(r'(?m)^---\s*$', f'**Closed_by:** {sha}\n\n---', b, count=1)
        return b.rstrip()+f'\n\n**Closed_by:** {sha}\n'
    ok = sum(edit_block(i, mk) for i in ids)
    print(f'closed: updated {ok}/{len(ids)}')
open(BACKLOG, 'w', encoding='utf-8').write(content)
