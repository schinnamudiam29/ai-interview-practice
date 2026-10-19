"""Test runner executed inside the sandbox.

Usage: python3 run_tests.py <marker> <suite_dir> [<suite_dir> ...]

Runs unittest discovery for each suite directory (relative to the current
working directory, which must be the project root) and prints a single JSON
line prefixed by the marker. The server parses the LAST marker line.
Only the Python standard library is used.
"""

import io
import json
import sys
import time
import traceback
import unittest

MAX_MESSAGE = 2000


def _clip(text, limit=MAX_MESSAGE):
    if len(text) <= limit:
        return text
    return "..." + text[-limit:]


class CollectingResult(unittest.TestResult):
    def __init__(self, suite_name):
        super().__init__()
        self.buffer = True
        self.suite_name = suite_name
        self.records = []
        self._start = 0.0

    def startTest(self, test):
        self._start = time.monotonic()
        super().startTest(test)

    def _record(self, test, status, message=""):
        self.records.append(
            {
                "suite": self.suite_name,
                "name": test.id(),
                "status": status,
                "message": _clip(message),
                "ms": int((time.monotonic() - self._start) * 1000),
            }
        )

    def addSuccess(self, test):
        super().addSuccess(test)
        self._record(test, "passed")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self._record(test, "failed", self.failures[-1][1])

    def addError(self, test, err):
        super().addError(test, err)
        self._record(test, "error", self.errors[-1][1])

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self._record(test, "skipped", reason)

    def addExpectedFailure(self, test, err):
        super().addExpectedFailure(test, err)
        self._record(test, "passed")

    def addUnexpectedSuccess(self, test):
        super().addUnexpectedSuccess(test)
        self._record(test, "failed", "unexpected success")


def run_suite(suite_dir):
    loader = unittest.TestLoader()
    result = CollectingResult(suite_dir)
    try:
        suite = loader.discover(start_dir=suite_dir, pattern="test*.py", top_level_dir=".")
    except Exception:  # noqa: BLE001 - report anything that breaks discovery
        result.records.append(
            {
                "suite": suite_dir,
                "name": f"{suite_dir} (discovery)",
                "status": "error",
                "message": _clip(traceback.format_exc()),
                "ms": 0,
            }
        )
        return result.records
    suite.run(result)
    return result.records


def main():
    if len(sys.argv) < 3:
        print("usage: run_tests.py <marker> <suite_dir>...", file=sys.stderr)
        return 2
    marker, suites = sys.argv[1], sys.argv[2:]
    sys.path.insert(0, ".")
    records = []
    real_stdout = sys.stdout
    for suite_dir in suites:
        captured = io.StringIO()
        sys.stdout = captured
        try:
            records.extend(run_suite(suite_dir))
        finally:
            sys.stdout = real_stdout
    summary = {
        "total": len(records),
        "passed": sum(1 for r in records if r["status"] == "passed"),
        "failed": sum(1 for r in records if r["status"] == "failed"),
        "errors": sum(1 for r in records if r["status"] == "error"),
        "skipped": sum(1 for r in records if r["status"] == "skipped"),
        "tests": records,
    }
    real_stdout.write("\n" + marker + json.dumps(summary) + "\n")
    real_stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
