# Tenuto.io Backend — Claude Code Instructions

Always read `.claude/AGENT_IMPLEMENTATION_GUIDE.md` at the start of each session for the current implementation roadmap.

## Related Repositories

- **Frontend:** `/mnt/c/Users/yona2/Documents/Tenuto.io/Tenuto.io-Frontend` (React 18 + TypeScript + Vite + Tailwind)
- **Frontend Guide:** `.claude/FRONTEND_IMPLEMENTATION_GUIDE.md` — comprehensive guide for frontend agent work
- When working on frontend tasks, explore the frontend repo first to understand current structure before making changes.

## Commit Workflow (MANDATORY)

After completing each phase, sub-phase, or significant batch of changes (e.g. a bug fix round, a new feature, a refactor):

1. **Stop and commit.** Do NOT let uncommitted work accumulate across multiple phases.
2. Stage the relevant files with `git add` (specific files, not `-A`).
3. Write a concise commit message describing what was done.
4. **Tell the user: "Ready to push — run `git push origin main` from Windows."**
5. Wait for confirmation before continuing to the next task.

The user works on Windows and must push manually. Never run `git push` yourself.
