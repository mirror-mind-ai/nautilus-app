[< RS027](index.md)

# CR164: The Hung-Append Test Races Its Own Stderr

**Status:** dismissed 2026-11-13 (RS027 verdict): the race was removed with the rewrite of the test
**Driver:** —
**Delivery:** —

## Where This Comes From

Found on 2026-10-28 while gating CV-010.DS-005 phase 0, which did not touch this code. Captured under
the Refinement Suspension: recorded, not started.

## What Was Measured

`cr163_mirror_append_bound_tests::a_hung_append_returns_timed_out_and_records_its_stderr_but_never_the_messages`
(`src-tauri/src/main.rs`) failed once in three full `cargo test --locked` runs, at:

```text
assertion failed: record["stderrTail"].as_str().unwrap().contains("database is locked")
```

The same test passed 8 of 8 times run alone, and the two following full runs passed (383 passed).

## Reading

The fake child is `sh -c "cat >/dev/null; echo '...database is locked' >&2; sleep 60"`, and the test
deadline is 400 ms. Under a full parallel run, the shell can still be starting, or `cat` can still be
draining stdin, when the deadline kills the process group, so nothing has been written to stderr yet.
The production path is not implicated: the 30 s bound and the recorded tail behave as CR163 measured.
The defect is that the test assumes the child reaches its `echo` within 400 ms.

This reading is a hypothesis. It has not been confirmed by making the race deterministic.

## Possible Direction

Write the stderr line before reading stdin, or wait for a readiness marker before the deadline can
fire. The test should keep proving that the tail is recorded and that no message content is.

## Scope Boundary

Test-only. No change to `bounded_child.rs` or to the 30 s production bound.

## Verdict (RS027, 2026-11-13)

Dismissed. On 2026-10-29 (`99ae983e`, CV-010.DS-005 phase 2d-2) the test moved to the Mirror host
and its fake child became `echo ... >&2; /bin/sleep 60`: the stderr line is written before anything
else, which is the direction this CR proposed. The test has passed in every CI run since CI began
(the one native failure on record, 2026-11-12, was `turn_start_timing`, a different test).
