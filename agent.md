# Fruit Rush Agent Instructions

Before doing any work in this repository, read this file first, then read [PRD.md](PRD.md) and any task-specific docs that apply.

## Project Rules

- The product name is Fruit Rush.
- The primary client stack is PixiJS + PWA, with TypeScript for browser code.
- Do not introduce Unity or C# into new work unless a task explicitly asks for it.
- Prefer browser-first flows for gameplay, shop, Boast sharing, and checkout.
- Keep payment and wallet flows compatible with **MiniPay** (primary), Celo, Magic.link, and the PWA return path.
- MiniPay Mini Apps must **auto-connect** on load (`window.ethereum.isMiniPay`) — never show a “Connect wallet” button inside MiniPay.
- Player-facing copy stays free of blockchain jargon (no “mint / gas / seed phrase / L2”). Prefer “save progress”, “link MiniPay”, “boast”.
- Use [Celopedia](https://celopedia.celo.org/) / `celo-org/celopedia-skills` for Celo + MiniPay patterns when available (`npx skills add celo-org/celopedia-skills`).

## Working Style

- Treat the PRD as the source of truth for product scope.
- Keep changes minimal and aligned with the existing docs.
- If you need to change the stack or naming again, update the docs here first so future agents inherit the same direction.