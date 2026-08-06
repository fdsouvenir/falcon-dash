# Heartbeat

`/heartbeat` manages the current OpenClaw heartbeat for the selected/default agent. It is an
OpenClaw runtime feature, not a Falcon Dash scheduler.

The page shows enabled/paused state, interval, recent/next timing, active-hour and delivery
metadata, the agent's `HEARTBEAT.md` template, and recent heartbeat events. The template can be
edited through the gateway agent-files API.

Gateway protocol v4 exposes enable/disable through `set-heartbeats` but does not provide granular
RPCs for interval, active hours, or delivery target. When those fields are unsupported, Falcon Dash
reports that they must be changed in OpenClaw configuration instead of pretending an edit succeeded.

Heartbeat is unrelated to OpenClaw cron jobs and to the future Falcon integration lifecycle
scheduler.
