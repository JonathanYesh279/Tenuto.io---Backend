# Tenuto.io Backend — Claude Code Instructions

Always read `.claude/AGENT_IMPLEMENTATION_GUIDE.md` at the start of each session for the current implementation roadmap.

## Commit Workflow (MANDATORY)

After completing each phase, sub-phase, or significant batch of changes (e.g. a bug fix round, a new feature, a refactor):

1. **Stop and commit.** Do NOT let uncommitted work accumulate across multiple phases.
2. Stage the relevant files with `git add` (specific files, not `-A`).
3. Write a concise commit message describing what was done.
4. **Tell the user: "Ready to push — run `git push origin main` from Windows."**
5. Wait for confirmation before continuing to the next task.

The user works on Windows and must push manually. Never run `git push` yourself.
