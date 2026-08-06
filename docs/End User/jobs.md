# Jobs

`/jobs` is a direct management surface for OpenClaw native cron jobs. It reads and writes the live
gateway definitions; Falcon Dash does not keep a separate job database.

You can search and sort jobs, create or edit a schedule and payload, enable or disable a job, run it
now, and delete it. Live cron events refresh the list. A disconnected gateway or failed RPC is shown
as an error.

Work → Automations is a different presentation of the same OpenClaw runtime objects, enriched with
Work governance, health, and history. It is not a second scheduler.

The planned v4 Falcon integration lifecycle scheduler is separate from both pages. It will run
credential validation, refresh, and keepalive work and will not create OpenClaw cron jobs behind the
scenes.
