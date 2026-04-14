---
name: ship
description: Stage, commit, and push all changes to origin with a descriptive commit message.
---

# Ship changes

1. Run `git status` and `git diff --stat` to see what changed.
2. Analyze the changes and write a clear, concise commit message in imperative mood (e.g., "Add autonomous agent workflow rules"). If the changes span multiple concerns, summarize the overall intent.
3. Stage all changes with `git add -A`.
4. Commit with the message.
5. Push to origin with `git push -u origin HEAD`.
6. Show the final `git log --oneline -1` to confirm.
