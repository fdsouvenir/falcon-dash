# Documents

The Documents route is a browser for the file root exposed by the connected OpenClaw Gateway. It is
not a document database and does not duplicate files into Falcon Dash.

Current actions include:

- browse folders with breadcrumbs, search, and sorting;
- open supported files in the Falcon editor;
- create files and folders;
- upload by picker or drag and drop;
- download, rename, move, and delete;
- select ranges or all visible entries for bulk move, download, or delete.

Actions operate on the path shown by the gateway-backed file API. Confirm the current directory and
selection before destructive or bulk operations. Gateway disconnection and filesystem errors are
reported as errors, not as empty folders.

The narrow-viewport route uses a separate mobile document browser with the same underlying file
ownership. Dedicated v6 mobile product work may change the presentation later, not the current
filesystem semantics.
