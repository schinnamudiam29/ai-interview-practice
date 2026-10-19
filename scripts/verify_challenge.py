"""Authoring check for a challenge package (run locally, not in production).

    python3 scripts/verify_challenge.py challenges/<slug>

Checks:
  1. Starter code: at least one visible test fails, and hidden tests fail.
  2. Starter + reference solution: visible, hidden and twist suites all pass,
     three runs in a row (catches flaky tests).
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RUNNER = os.path.join(ROOT, "runner", "run_tests.py")
MARKER = "@@VERIFY@@"


def copy_tree(src, dst):
    if os.path.isdir(src):
        shutil.copytree(src, dst, dirs_exist_ok=True)


def run(workdir, suites):
    proc = subprocess.run(
        [sys.executable, "-I", RUNNER, MARKER, *suites],
        cwd=workdir,
        capture_output=True,
        text=True,
        timeout=60,
    )
    lines = [l for l in proc.stdout.splitlines() if l.startswith(MARKER)]
    if not lines:
        raise SystemExit(f"runner produced no result:\n{proc.stdout}\n{proc.stderr}")
    return json.loads(lines[-1][len(MARKER):])


def build(pkg, with_solution):
    tmp = tempfile.mkdtemp(prefix="verify-")
    copy_tree(os.path.join(pkg, "starter"), tmp)
    copy_tree(os.path.join(pkg, "hidden"), tmp)
    copy_tree(os.path.join(pkg, "twist", "tests"), os.path.join(tmp, "tests"))
    if with_solution:
        copy_tree(os.path.join(pkg, "solution"), tmp)
    return tmp


def describe(res):
    return f"{res['passed']}/{res['total']} passed"


def main():
    pkg = os.path.abspath(sys.argv[1])
    meta = json.load(open(os.path.join(pkg, "challenge.json")))
    s = meta["suites"]
    ok = True

    starter = build(pkg, with_solution=False)
    vis = run(starter, s["visible"])
    hid = run(starter, s["hidden"])
    print(f"starter  visible: {describe(vis)}   hidden: {describe(hid)}")
    for t in vis["tests"] + hid["tests"]:
        if t["status"] != "passed":
            print(f"   - {t['status']:6} {t['name']}")
    if vis["passed"] == vis["total"]:
        ok = False
        print("FAIL: starter passes every visible test; the bug isn't reproduced")
    if hid["passed"] == hid["total"]:
        ok = False
        print("FAIL: starter passes every hidden test")
    shutil.rmtree(starter)

    for i in range(3):
        sol = build(pkg, with_solution=True)
        res = run(sol, s["visible"] + s["hidden"] + s["twist"])
        print(f"solution run {i + 1}: {describe(res)}")
        for t in res["tests"]:
            if t["status"] != "passed":
                ok = False
                print(f"   - {t['status']:6} {t['name']}\n{t['message']}")
        shutil.rmtree(sol)

    print("OK" if ok else "CHALLENGE NOT READY")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
