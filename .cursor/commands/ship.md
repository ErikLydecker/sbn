---
name: ship
description: Stage, commit, push, clean up open PRs, and monitor the Render deploy until it's live.
---

# Ship changes

## Git

1. Run `git status` and `git diff --stat` to see what changed.
2. Analyze the changes and write a clear, concise commit message in imperative mood (e.g., "Add autonomous agent workflow rules"). If the changes span multiple concerns, summarize the overall intent.
3. Stage all changes with `git add -A`.
4. Commit with the message.
5. Push to origin with `git push -u origin HEAD`. If rejected, `git pull --rebase origin main` first.
6. Show the final `git log --oneline -1` to confirm.

## Clean up open PRs

After pushing, check for any open pull requests that should be dealt with. Use the GitHub MCP (`user-github`).

1. List open PRs via `list_pull_requests(owner: "ErikLydecker", repo: "sbn", state: "open")`.
2. If there are no open PRs, skip this section.
3. For each open PR, check the files changed via `pull_request_read(method: "get_files")` and assess:
   - **Mergeable with no conflicts against main?** Squash-merge it via `merge_pull_request(merge_method: "squash")`.
   - **Has conflicts or is stale/superseded?** Close it with a comment explaining why.
4. After merging any PRs, run `git pull origin main` to sync locally.
5. Report what was merged or closed.

## Monitor Render deploy

After push (and any PR merges), monitor the Render deploy to confirm it succeeds. Use the Render MCP tools (`user-render`, fall back to `plugin-render-render`). The SBN workspace owner ID is `tea-d7dk6ufavr4c73e4b49g` and the service ID is `srv-d7dkdcflk1mc73eqe7rg`.

1. Ensure the workspace is selected via `get_selected_workspace()` / `select_workspace()`.
2. Poll `list_deploys(serviceId, limit: 1)` until the latest deploy matches the most recent commit on main.
3. Watch for the deploy status to reach `live` or `build_failed`.
4. If `live` — report success with deploy time.
5. If `build_failed` — pull the build logs via `list_logs(resource, type: ["build"], limit: 50)` and report the failure with the error output.
6. If the deploy hasn't appeared after 60 seconds, check `list_logs(resource, type: ["build"], limit: 20)` for early build output.
