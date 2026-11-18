# Progress snapshot: grades-unt (20261118)

The local checkout `~/Programming Projects/grades-unt` was removed on 2026-11-18 to free disk space on Sam's Mac, after everything in it was pushed here. This file records where the work stood.

## What it is

grades-unt: You do not always know what you are signing up for until it is too late. `grades-unt` makes UNT grade distributions easier to browse by course and instructor.



## State

- Checkout branch: `feat/mcp-browser-cors` at `5d87bbac54`
- Snapshot branch: `archive/progress-20261118-grades-unt` (HEAD plus the uncommitted work listed below)
- Last commits:
- 5d87bbac 2026-10-13 refactor(mcp): reduce browser CORS to an origin allowlist in the proxy
- b6ffbff7 2026-10-13 feat(mcp): allow only UNTangle's origin by default
- fa1809da 2026-10-13 feat(mcp): allow browser clients with configurable CORS
- 1fca1e68 2026-10-05 fix: stop instructor chart flashing a different fallback UI (#52)
- 419c9771 2026-10-02 Apply the approved theme and white stars across all pages (#40)
- 15825130 2026-10-02 Follow system light and dark theme preferences (#45)
- df4bde0d 2026-10-02 ci: request Codex reviews for allowlisted authors (#44)
- fee4a8de 2026-10-02 fix(extension): correct instructor course grouping, site link, and detail races (#43)

The working tree was clean; nothing uncommitted was captured.

Git-ignored files that can't be rebuilt (.env files, local data) were copied to `~/MacSetup/worktree-leftovers-20261118/grades-unt` on the Mac. They are not on GitHub or Drive.

## What's left

Nothing recorded beyond the commits above.

## How to resume

```sh
git clone https://github.com/SamGu-NRX/grades-unt.git "$HOME/Programming Projects/grades-unt"
git -C "$HOME/Programming Projects/grades-unt" checkout archive/progress-20261118-grades-unt
```

Then copy the kept ignored files back: `cp -R "$HOME/MacSetup/worktree-leftovers-20261118/grades-unt/." "$HOME/Programming Projects/grades-unt/"`, and reinstall dependencies.

## Thread

No T3 thread was found for this checkout.
