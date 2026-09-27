# 0.3.208

- Serialize manual projector actions and display recovery; later actions supersede stale completions.
- Match displays by their OS names, hide projection on disconnect, and recover when the selected external display returns. Stop cancels recovery.
- Track download cancellation per task and place background processes in Windows kill-on-close jobs.
- Preserve authorization state when device information is temporarily unavailable.
- Require a verified completion marker and full slide set before reusing PowerPoint conversion output.
- Drain PowerPoint output concurrently with a bounded error tail to prevent pipe-buffer stalls.
- Export allowlisted diagnostics; preserve corrupt logs and replace valid logs through a flushed temporary file.
- Add Windows CI compilation and Rust tests for codex branch pushes and master pull requests.

## Validation

Local checks: frontend quality gate (37 tests, lint, build, Chinese text checks) and 21 Rust tests, including process cleanup, high-volume stdout/stderr, cancellation ordering, cache completeness, diagnostics integrity and authorization rules.

Physical acceptance remains: HDMI unplug/reconnect, sleep/wake, conversion with installed PowerPoint, download cancellation, and upgrading the installed app without losing user data. OS monitor names are not guaranteed permanent hardware identifiers.
