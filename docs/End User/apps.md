# Canvas Apps

Falcon Dash can display plugin-created canvas surfaces. An active surface appears as a floating
panel across the desktop shell and may be opened directly at `/apps/<surface-id>`.

The current canvas route:

- renders A2UI or HTML canvas content received through the Falcon Dash gateway plugin;
- allows a surface to be pinned or unpinned where that control is available;
- shows loading, no-content, missing-surface, and bridge failure states;
- is desktop-only; narrow viewports show an explicit Desktop Only message.

Canvas surfaces are gateway/plugin runtime state. A gateway restart or cleared surface may make a
direct URL unavailable. Pinning is a navigation convenience, not durable application storage.

This current canvas bridge is not the v5 contextual conversation product. v5 will wire optional
canvas experiences into a rich project/object conversation interface rather than claiming that a
standalone canvas surface is already a chat system.
