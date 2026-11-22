# BlazePay — NOTES

## What was built
**BlazePay** — "Send BCH with a link". One-page static web app (no backend, no
custody) for **BCH Blaze 2026, Mainnet Track**. Source: `~/workspace/makefun/bch-blaze/`
(see `README.md` for the full layout).

1. **Create a payment link** — amount (BCH) + message + recipient (defaults
   to the project address) → shareable URL (`#/pay?to=…&amt=…&memo=…&net=…`)
   + QR code.
2. **Pay the link** — shows amount / memo / recipient / network. Two wallet
   paths:
   - **Testnet (free):** the app creates a throwaway testnet wallet in the
     browser and funds it from the faucet (one click). Pay → real testnet tx
     with txid + explorer link; memo rides on-chain as OP_RETURN.
   - **Mainnet (real BCH):** WizardConnect — QR handshake (`wiz://` URI) with
     Paytaca / Selene / Cashonize. The wallet shares its xpub, BlazePay
     derives the first receive address, builds the tx with
     `watch.send(..., { buildUnsigned: true })`, asks the wallet to sign via
     `sign_transaction_request` (`inputPaths: [i, "receive", 0]`), then
     broadcasts via the mainnet Electrum provider. Keys never leave the wallet.
3. **Latest payments feed** — incoming payments to the recipient, read live
   from Electrum (`getHistory`), with txid + explorer links.
4. **Required banner** on top of the homepage: (a) presentation link, (b)
   GitHub repo link, (c) CashTokens donation address for EMBER2026 (Community
   Choice voting) with copy button.
5. **Presentation deck** (7 slides, Widget Factory structure: problem,
   solution, demo, technology, why BCH, business) in `public/slides/`,
   hosted alongside the demo.

## Why this concept
- A judge can understand it in 2 minutes and try it for free in the same
  session (testnet faucet is one click, no wallet install needed).
- It exercises real mainnet BCH end-to-end: wallet connect (WizardConnect),
  transaction building + signing + broadcast (mainnet-js), on-chain
  verification (Electrum history feed), OP_RETURN, CashTokens.
- Payment links are a real, simple use case that only makes sense on BCH
  (sub-cent fees, fast confirmation, native OP_RETURN/CashTokens).
- No backend, no custody, no cost — nothing to break, nothing to fund.

## Track
Mainnet Track (prize pool: 1st $3,500 PUSD + BLISS 2027 ticket, 2nd $1,500,
3rd $750). Winners announced 28 Nov 2026. Submit deadline 22 Nov 21:00 WIB.
**Roll call already closed → we are in the LOW PRIORITY QUEUE** (judges
review if time permits), so the app is built to be instantly understandable.

## Links (targets — see blocker below)
- Demo (GitHub Pages): https://slowwwkiss.github.io/blazepay/
- Demo (jsDelivr fallback, works as soon as the repo exists):
  https://cdn.jsdelivr.net/gh/slowwwkiss/blazepay@main/docs/index.html
- Repo: https://github.com/slowwwkiss/blazepay
- Presentation: https://slowwwkiss.github.io/blazepay/slides/
- Hackathon: https://dorahacks.io/hackathon/bchblaze2026/detail

## CashTokens address (project)
- BCH cashaddr (recipient default): `bitcoincash:qppall5d96fdw0ecrpjstqlqv4j6gprlfgnhjlewrj`
- CashTokens tokenaddr (donations, shown in banner):
  `bitcoincash:zppall5d96fdw0ecrpjstqlqv4j6gprlfg5apphgup`
- Generated fresh for this project with mainnet-js (seed wallet, mainnet).
- Private key/seed: `~/workspace/makefun/bch-blaze/.bch-address-private.json`
  (mode 600, gitignored, NEVER committed, never in any report or chat).
- This is a NEW address — not the agent wallet, not the payout wallet.

## Verification results (15 Nov 2026, all in this VM)
- **Build:** `vite build` OK (docs/ output, 859 KB JS). One warning only:
  Node `crypto` externalized from mainnet-js `randomBytes.js` — harmless
  (browser takes the `window.crypto.getRandomValues` branch; proven by the
  headless test creating a wallet).
- **Headless Chromium (Playwright, local server):** page loads with **zero JS
  errors**; banner shows all 3 required links; test wallet is created in the
  browser (`bchtest:…`); create-link generates a correct `#/pay?to=…&amt=…
  &memo=…&net=testnet` link + QR (data URL); opening the link renders the pay
  card with correct amount/memo/recipient/network; WizardConnect QR renders
  with a valid `wiz://?p=…` URI (77 chars); slides page loads (7 slides).
- **Testnet end-to-end (real chain, via HTTPS REST — see sandbox note):**
  faucet funded alice `bchtest:qzvezsefgtqkmr8efch49zasfrcfyktp5u438xvrm5`
  with 10,000 sat (faucet tx `dca4868fd8323bd23096c54cddec2f323f45a46b1db53bae8fe9f651dc3b8a03`).
  Unsigned tx built locally with mainnet-js `buildEncodedTransaction` — the
  exact function the app's `watch.send({buildUnsigned:true})` calls (165
  bytes; sourceOutputs in the exact shape WizardConnect expects).
  Signed locally with mainnet-js, broadcast via REST, txid
  `37aee8bbce740796a654a288e4997783b66afdc316a8e33a527a45f94b51abe3`.
  On-chain verification: vout 0 = 0.00005 BCH to bob, vout 1 = OP_RETURN
  `426c617a6550617920746573743a2068656c6c6f2042434820426c617a652032303236`
  ("BlazePay test: hello BCH Blaze 2026"), vout 2 = 0.000045 BCH change;
  bob's balance reads 5,000 sat. Also verified the faucet funds the exact
  wallet the app creates in a browser (balance 10,000 sat via REST).
- **Faucet:** `POST https://rest-unstable.mainnet.cash/faucet/get_testnet_bch`
  works (HTTP 200, txid returned, tx confirmed on-chain).
- **Testnet chain note:** mainnet-js v3's "testnet" = chipnet (its default
  Electrum server is `wss://chipnet.imaginary.cash:50004`). The faucet, the
  REST backend, and mainnet-js defaults all share that same definition, so
  the in-app faucet funds the in-app wallet on the same chain (verified:
  REST reports 10,000 sat for the app-created wallet). The UI just says
  "Testnet" — accurate for a judge.

## What could NOT be verified in this VM (sandbox limits, not app bugs)
- **Electrum over WebSocket (WSS) is blocked in this VM** — every outbound
  WSS fails (`ERR_TUNNEL_CONNECTION_FAILED` / timeout), even to
  `wss://echo.websocket.org`, and raw TCP is disabled by policy
  (`other_tcp` denied). So the live balance/feed reads and the in-browser
  `wallet.send` could not be exercised here; they use the standard
  mainnet-js Electrum provider and will work on a normal network (a judge's
  browser). The underlying build/sign/broadcast logic was verified via the
  REST path above with the same mainnet-js code.
- **No real wallet was available** to complete a live WizardConnect
  sign round-trip (needs Paytaca/Selene/Cashonize on a phone). Verified
  instead: relay URI + QR generation, and the unsigned-tx + sourceOutputs
  shape the app hands to `signTransaction` (matches the documented
  WizardConnect flow and the Cauldron/Moria pattern).
- **No mainnet BCH was spent** (by design — we have none and must spend
  none). The mainnet code path is identical to the verified testnet path
  except the network flag.

## BLOCKER — needs one human step (repo + hosting)
`create_repository` via the GitHub connector fails:
`403 Resource not accessible by integration` — the GitHub App cannot create
repos in the user account (it can only read/write repos selected for the
installation). The app CAN read existing repos (verified: `yoloo`, `lonk`),
so push will work once the repo exists and is selected.
**Exact steps for the parent/user (browser, ~2 minutes):**
1. On github.com, create a **public** repo named **`blazepay`** under
   `slowwwkiss` (no README — the push includes everything).
2. Open the GitHub App installation (Connectors → GitHub → "Select
   repositories") and select `blazepay` (or "All repositories").
3. Tell this agent — it will push all files (source + built `docs/`) in one
   commit and verify.
4. **Enable GitHub Pages** (browser): repo Settings → Pages → Deploy from
   branch → `main` / `/docs` → Save. Demo goes live at
   https://slowwwkiss.github.io/blazepay/ (also verify the jsDelivr fallback
   URL works immediately after push — no Pages needed for that one).
**DO NOT** push BlazePay into an existing repo (`yoloo`, `lonk`, …) — those
are the user's own sites; the hackathon needs its own repo.

## Costs
$0. No BCH spent, no paid hosting, no paid services. Faucet tBCH only.

## Files
- `index.html`, `src/main.js`, `src/style.css`, `vite.config.js`,
  `package.json`, `public/slides/index.html`, `README.md`, `.gitignore`
- `docs/` — built output (committed for GitHub Pages `/docs` source)
- `tools/` — local-only verification scripts (NOT pushed): address
  generation, testnet E2E (3 phases), headless browser check, fund-app-wallet
- `.bch-address-private.json` — project keys, mode 600, NEVER pushed
- `NOTES.md` (this file), `SUBMISSION-DRAFT.md`
