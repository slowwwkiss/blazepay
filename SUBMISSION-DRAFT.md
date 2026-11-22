# DoraHacks submission draft — BCH Blaze 2026, Mainnet Track
<!-- DRAFT ONLY — do NOT submit from here. Submit via the DoraHacks page
     (browser/human step) before 22 Nov 2026 21:00 WIB. -->
<!-- Status 15 Nov 2026: code + verification DONE; repo + live demo pending
     the one human step in NOTES.md (create public repo `blazepay` under
     slowwwkiss, select it in the GitHub App installation, then this agent
     pushes + verifies). Fill the URLs below once the push is verified. -->

## Track
Mainnet Track

## Project title
BlazePay — Send BCH with a link

## Short description (for the listing)
BlazePay turns a BCH payment into a link. Create a payment link (amount +
message), share it anywhere, get paid on-chain — no account, no backend, no
custody. Flip to testnet to try it free with one click, or connect your BCH
wallet via WizardConnect and pay real BCH on mainnet. The memo rides on-chain
as OP_RETURN and a live feed shows every payment as it lands.

## Demo / website URL
https://slowwwkiss.github.io/blazepay/
(Fallback, also live after push: https://cdn.jsdelivr.net/gh/slowwwkiss/blazepay@main/docs/index.html)

## Source code (GitHub)
https://github.com/slowwwkiss/blazepay

## Presentation
https://slowwwkiss.github.io/blazepay/slides/

## CashTokens donation address (Community Choice voting, EMBER2026)
bitcoincash:zppall5d96fdw0ecrpjstqlqv4j6gprlfg5apphgup
(also shown in the banner on top of the demo homepage)

## How to demo it (for the judges, 2 minutes)
1. Open the demo — it starts on **Testnet**. Press **"Get free testnet BCH"**:
   the app creates a throwaway test wallet in your browser and funds it free
   from the faucet. Nothing real moves.
2. In **"Create a payment link"**, keep the defaults (0.001 tBCH + message)
   and press **Generate payment link** — copy the link or scan the QR.
3. Open the link and press **Pay now**: a real testnet transaction is sent
   (txid + explorer link on the receipt; the message is visible on-chain as
   OP_RETURN) and the payment appears in **"Latest payments"** below.
4. Flip to **Mainnet**, scan the WizardConnect QR with Paytaca / Selene /
   Cashonize, and sign the same payment with your own wallet and your own BCH.

## What it does (long description, if the form asks)
Getting paid in crypto is still too hard: receiving BCH means explaining
wallets and pasting a 42-character address, and payment apps solve it by
becoming custodians. BlazePay removes all of that. A payment is just a URL:
`#/pay?to=…&amt=…&memo=…&net=…`. The receiver creates the link, the payer
opens it, connects a wallet, and the money moves on-chain — the app never
holds funds, runs no backend, and stores nothing.

Built with mainnet-js v3 (wallets, transaction building, Electrum reads) and
WizardConnect (QR handshake over an encrypted Nostr relay; the wallet shares
its xpub, the dapp derives the address and requests a signature — keys never
leave the wallet). Every payment can carry an OP_RETURN memo, and a live
feed reads incoming payments straight from the chain. The project address is
CashTokens-aware, so EMBER2026 donations fund Community Choice voting.

Tested end-to-end on testnet: faucet funding, unsigned-tx building with the
exact code path the app uses, local signing, broadcast, and on-chain
verification (5000 sat to the recipient + OP_RETURN memo + change, confirmed
via the block explorer data).

## Checklist against the Mainnet Track rules
- [x] At least one feature sending a real BCH MAINNET transaction — the
      WizardConnect pay flow (payer = judge, their own wallet and funds).
- [x] Live demo openable from one link — GitHub Pages (static, free).
- [x] Banner on top of the homepage with presentation link + GitHub repo
      link + CashTokens donation address for EMBER2026.
- [x] WizardConnect integration (Paytaca / Selene / Cashonize).
- [x] Original project, built during the hackathon (15–21 Nov 2026).
