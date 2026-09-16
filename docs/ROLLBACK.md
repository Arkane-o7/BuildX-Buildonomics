# Remove AgentPass after the event

This project uses a separate event integration. Your normal Hermes configuration must remain unchanged. Stop the event process and run your usual `hermes` command to return to normal.

**Before changes**

A local backup of the project as it existed before the UPI/card build is stored at `.agentpass-private/before-upi-card-build.tar.gz`. The original Hermes config fingerprint is recorded in `.agentpass-private/upi-card-baseline.json`. These files are private, ignored by Git and must not be uploaded.

**1. Stop the event agent**

Press Ctrl+C in the terminal running `npm run hermes:event`. Its `HERMES_HOME` setting applies only to that process. It does not change your shell profile or normal Hermes home.

Run `npm run hermes:check-original` to compare your normal Hermes config against the recorded fingerprint. A difference does not automatically mean AgentPass caused it; review it before restoring anything. Never overwrite newer personal changes with an old backup.

**2. Disable external access first**

In Vercel, open the `agentpass-buildx` project. Set `EVENT_DISABLED=true` and redeploy to disable event API operations. Then delete **only this event project**, or remove its public deployment using Vercel's dashboard. Revoking credentials alone does not remove an already published static page.

Revoke the AgentPass-scoped agent token and rotate/delete only the Razorpay test/live API key created for this event. Remove its event webhook in the Razorpay dashboard. Do not rotate an existing key shared by unrelated applications.

This event has two Razorpay Test Mode webhook records to remove during cleanup: `TcoBpDr1YBE6Le` is the enabled signed webhook (`/api/webhooks/razorpay?integration=agentpass-test`); `Tcnnew4K2PUrHH` is the disabled original (`/api/webhooks/razorpay`). The original lacked a signing secret and was replaced after its edit form returned a Razorpay JSON-decoding error. Both records belong to this event.

**3. Remove the isolated Hermes files**

Run `npm run hermes:remove-event -- --yes`. It deletes only the project-owned `.hermes-event` folder when its AgentPass marker matches this project. The script must refuse to operate on `~/.hermes` or an unmarked directory. Do not delete your normal Hermes folder, Python environment, model login or existing skills.

**4. Remove event storage**

Export any receipts you want to retain. Delete the Neon database/project only if it was created exclusively for this event. If you used a shared database, remove only the `agentpass_workspaces` and `agentpass_login_attempts` tables after confirming they are event-owned. Do not drop a shared schema or database.

Payments recorded by a payment provider cannot be erased by deleting this app. Any live payment, refund or mandate requires the provider's normal process. The prototype defaults to rehearsal or provider test mode.

**5. Keep or remove the repository**

You can keep the source on GitHub without leaving the service active. The repository is `Arkane-o7/BuildX-Buildonomics`. Deleting or making it private is a separate owner choice; no automatic cleanup command deletes it.

If you want to inspect the original project files, extract the private backup into a **new empty directory** and compare them. Do not extract over the current project. The original remote was empty; the backup records only local files, not a historical remote commit.

After exporting anything needed, remove event-only `.env.local`, `.agentpass-private`, local data and the local project folder if desired. `.env.local` contains event secrets; do not paste it into an issue or share link. Preserve the backup elsewhere if you still need it.

**What stays unchanged**

Normal Hermes model/provider configuration, normal Hermes MCP servers and personal sessions, shell startup files, unrelated Vercel projects, unrelated databases and existing payment accounts. No scheduled task or persistent background service is required.

**Resource ledger**

The build will record event resources in `.agentpass-private/event-resources.json` and list non-secret identifiers in the final setup guide. Only resources explicitly recorded as created for this event should be removed.
