#!/usr/bin/env python3
"""Rewrite BACKLOG.md to record terminal dispositions for the 183 open findings.
Usage: python3 .record-dispositions.py <anchor_sha> [--write]
Without --write: dry-run (reports counts + a sample), makes no changes.
"""
import json, re, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
BACKLOG = os.path.join(HERE, 'BACKLOG.md')
ANCHOR = sys.argv[1]
WRITE = '--write' in sys.argv

verdicts = json.load(open(os.path.join(HERE, '.verdicts.json')))
foldplan = json.load(open(os.path.join(HERE, '.foldplan.json')))

# id -> batch tag for FOLD items
fold_batch = {}
for b, ids in foldplan['fold'].items():
    for i in ids:
        fold_batch[i] = b

P3_LIVE = ['COR-023','SEC-032','SEC-033','DAT-014','OBS-001','SEC-002','SEC-001',
           'TST-001','SEC-063','SEC-064','SA-OBS-013','SA-SEC-014','SA-SEC-018']

def clean(s, n=240):
    s = re.sub(r'\s+', ' ', (s or '').strip())
    return s[:n]

# Build id -> (status, disposition_label, rationale, closed_by)
plan = {}
for x in verdicts:
    i = x['id']; disp = x['final_disposition']; reason = clean(x.get('reason',''))
    if disp == 'ALREADY-DONE':
        up = (x.get('upstream_sha','') or '').strip()
        plan[i] = ('DONE', 'ALREADY-DONE',
                   f"ALREADY-DONE / superseded (verified vs current code; upstream {up}). {reason}",
                   ANCHOR)
    elif disp == 'FALSE-POSITIVE':
        plan[i] = ('FALSE_POSITIVE', 'FALSE-POSITIVE', f"FALSE-POSITIVE. {reason}", None)
    elif disp == 'NEEDS-LIVE-VERIFY':
        plan[i] = ('NEEDS_LIVE_VERIFY', 'NEEDS-LIVE-VERIFY',
                   f"NEEDS-LIVE-VERIFY (depends on runtime/build state). {reason}", None)
    elif disp == 'WONT-FIX':
        plan[i] = ('WONTFIX', 'WONT-FIX', f"WONT-FIX (consciously declined). {reason}", None)
    elif disp == 'OPEN-FIXABLE':
        if i in fold_batch:
            plan[i] = ('TODO', 'OPEN-FIXABLE',
                       f"OPEN-FIXABLE — scheduled to FOLD (batch {fold_batch[i]}). {clean(x.get('fix_sketch',''),200)}",
                       None)
        else:
            # downgraded to WONT-FIX by foldplan
            plan[i] = ('WONTFIX', 'WONT-FIX',
                       f"WONT-FIX (real but lower-priority/cosmetic/large-refactor/test-debt; deferred). {clean(x.get('fix_sketch',''),160)}",
                       None)
# 13 P3-live (dropped shard) -> NEEDS-LIVE-VERIFY
for i in P3_LIVE:
    plan[i] = ('NEEDS_LIVE_VERIFY', 'NEEDS-LIVE-VERIFY',
               "NEEDS-LIVE-VERIFY (cycle tag 'requires-live-verification'): truth depends on runtime/deploy/CI/TLS/nginx/env state — routed to a separate live pass, not rated from static evidence.",
               None)

content = open(BACKLOG, encoding='utf-8').read()
# split into blocks keeping headings
parts = re.split(r'(?m)^(### [A-Z][A-Z0-9-]*-\d+ — .*)$', content)
# parts[0] = preamble, then alternating (heading, body)
out = [parts[0]]
updated = []; missing = []
i = 1
while i < len(parts):
    heading = parts[i]; body = parts[i+1] if i+1 < len(parts) else ''
    m = re.match(r'^### ([A-Z][A-Z0-9-]*-\d+) — ', heading)
    fid = m.group(1) if m else None
    if fid in plan:
        status, label, rationale, closed_by = plan[fid]
        # 1) replace Status line
        new_body, n = re.subn(r'(?m)^- \*\*Status:\*\*\s*.*$',
                              f"- **Status:** {status}", body, count=1)
        if n == 0:
            missing.append(fid+'(no-status)')
        # 2) insert Disposition line right after Status (remove any prior one first)
        new_body = re.sub(r'(?m)^- \*\*Disposition:\*\*.*\n', '', new_body)
        new_body = re.sub(r'(?m)^(- \*\*Status:\*\* .*)$',
                          lambda mm: mm.group(1) + f"\n- **Disposition:** {label} — {rationale}",
                          new_body, count=1)
        # 3) Closed_by for DONE
        if closed_by:
            if re.search(r'(?m)^\*\*Closed_by:\*\*', new_body):
                new_body = re.sub(r'(?m)^\*\*Closed_by:\*\*\s*.*$',
                                  f"**Closed_by:** {closed_by}", new_body, count=1)
            else:
                # insert before the trailing '---' of the block
                if re.search(r'(?m)^---\s*$', new_body):
                    new_body = re.sub(r'(?m)^---\s*$',
                                      f"**Closed_by:** {closed_by}\n\n---", new_body, count=1)
                else:
                    new_body = new_body.rstrip()+f"\n\n**Closed_by:** {closed_by}\n"
        body = new_body
        updated.append(fid)
    out.append(heading); out.append(body)
    i += 2

new_content = "".join(out)
print(f"blocks updated: {len(updated)} (expected 183)")
print(f"missing-status: {missing}")
notfound = [k for k in plan if k not in updated]
print(f"plan ids not found in backlog: {notfound}")
from collections import Counter
print("status distribution applied:", dict(Counter(plan[k][0] for k in plan)))
if WRITE:
    open(BACKLOG, 'w', encoding='utf-8').write(new_content)
    print("WROTE backlog.")
else:
    # show one sample of each status
    print("\n--- SAMPLE (dry-run) ---")
    for want in ('DONE','WONTFIX','FALSE_POSITIVE','NEEDS_LIVE_VERIFY','TODO'):
        for k in plan:
            if plan[k][0]==want:
                blk = re.search(r'(?ms)^### '+re.escape(k)+r' — .*?(?=^### |\Z)', new_content)
                seg = blk.group(0)
                lines = [l for l in seg.splitlines() if l.startswith('### ') or '**Status' in l or '**Disposition' in l or l.startswith('**Closed_by')]
                print('\n'.join(lines[:4])); print('  ...')
                break
