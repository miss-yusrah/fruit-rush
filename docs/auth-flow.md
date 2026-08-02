# Auth flow — Magic email + wallet

Fruit Rush supports two linked-account paths that both yield a Celo `0x` address
in `WalletState`. Guests remain a third, session-only path.

## Assumptions

- SDK pin: `magic-sdk@^33` + `@magic-ext/oauth2` (social popup).
- Env: `VITE_MAGIC_PUBLISHABLE_KEY`, optional `VITE_CELO_RPC_URL` /
  `VITE_CELO_TESTNET_RPC_URL`.
- Dev uses Alfajores; production uses Celo mainnet (`import.meta.env.PROD`).
- Magic does **not** pay gas in cUSD out of the box — see `sendCUSD` TODO for a paymaster.
- Privy / Dynamic remain worth evaluating if we need native gas sponsorship.

## Login → wallet → in-game

```mermaid
sequenceDiagram
  actor Player
  participant Connect as ConnectScreen
  participant Wallet as WalletState
  participant Magic as magicAuth / Magic SDK
  participant Celo as Celo (embedded wallet)

  Player->>Connect: Open /connect
  alt Email OTP
    Player->>Connect: Enter email + Send
    Connect->>Wallet: loginWithEmail(email)
    Wallet->>Magic: loginWithEmailOTP
    Magic-->>Player: OTP modal
    Player->>Magic: Enter OTP
    Magic->>Celo: Provision / unlock wallet
    Magic-->>Wallet: { address, DID token, provider }
    Wallet-->>Connect: status = connected (loginMethod = magic)
  else External wallet
    Player->>Connect: Pick MiniPay / injected / WC
    Connect->>Wallet: connect(option)
    Wallet-->>Connect: status = connected (loginMethod = minipay / metamask / …)
  else Guest
    Player->>Connect: Continue as guest
    Note over Wallet: address stays null; App sets guest flag
  end

  Connect->>Connect: onDone → home / modes
  Note over Player,Celo: Shop / tournaments / boast call requireConnect()
```

## Session restore

On bridge mount, `restoreSession()` checks `magic.user.isLoggedIn()` and hydrates
`address` / `email` without another OTP. Disconnect / Sign out calls `magic.user.logout()`
(email) or wagmi `disconnect()` (wallet).
