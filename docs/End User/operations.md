# Operations

`/ops` is an observer for recent tool activity across OpenClaw sessions. It combines process/tool
entries, refreshes periodically, and provides:

- a Processes list with running, success, and error state;
- per-entry arguments, result, duration, working directory, and session identity when available;
- an Activity view for chronological scanning;
- aggregate counts for calls, exec activity, errors, and sessions.

The page observes recent gateway/session activity; it is not the Work Event Log and it is not a
permanent audit store. Use Work history for domain mutations and OpenClaw logs/session records for
runtime investigation.
