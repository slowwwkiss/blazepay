# BlazePay — Send BCH with a link

**BCH Blaze 2026 · Mainnet Track.** A one-page web app: create a BCH payment
link (amount + message), share it, get paid on-chain. No account, no backend,
no custody.

- **Live demo:** https://slowwwkiss.github.io/blazepay/
- **Presentation:** https://slowwwkiss.github.io/blazepay/slides/
- **Hackathon:** https://dorahacks.io/hackathon/bchblaze2026/detail

## How it works (2 minutes, for judges)

1. **Mainnet (real BCH):** flip the toggle to **Mainnet**, scan the
   WizardConnect QR with **Paytaca / Selene / Cashonize**, sign in your
   wallet. Same code path, real BCH, your own wallet and money. BlazePay
   scans your first 20 receive + 20 change addresses, so funds spread
   across the wallet are all found.
2. **Try free on Testnet first:** open the demo, press **Get free testnet
   BCH** — the app creates a throwaway testnet wallet in your browser and
   funds it from the faucet. Nothing real moves.
3. **Create a link:** amount `0.001` BCH + a message → **Generate payment
   link** → copy the link or scan the QR.
4. **Pay it:** open the link, press **Pay now** — a real transaction
   with a txid and explorer link. The message rides on-chain as OP_RETURN.

The **Latest payments** feed reads incoming payments to the recipient
straight from Electrum, so every payment is verifiable on-chain.

## Tech

- [mainnet-js v3](https://mainnet.cash) — BCH wallet, transaction building,
  Electrum reads (UTXOs, balances, history). One code path for testnet and
  mainnet; only the network flips.
- [WizardConnect](https://docs.riftenlabs.com/wizardconnect/) — QR handshake
  over an encrypted Nostr relay. The wallet shares its xpubs, BlazePay
  derives the first 20 receive + 20 change addresses and scans them all for
  funds, then asks the wallet to sign (`sign_transaction_request`). Keys
  never leave the wallet.
- **OP_RETURN memo** — every payment can carry a message on-chain.
- **CashTokens** — the banner address is the token-aware address of this
  project; EMBER2026 donations fund Community Choice voting:
  `bitcoincash:zppall5d96fdw0ecrpjstqlqv4j6gprlfg5apphgup`
  (BCH cashaddr: `bitcoincash:qppall5d96fdw0ecrpjstqlqv4j6gprlfgnhjlewrj`).

## Run it locally

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in docs/ (GitHub Pages serves /docs)
```

No environment variables, no secrets, no backend to start. The build is a
static site — `docs/index.html` plus `docs/assets/*`.

## Project layout

```
index.html            Vite entry (the app shell)
src/main.js           All app logic (create link, pay, feed)
src/style.css         Styling
public/slides/        Presentation deck (hosted with the demo)
docs/                 Built output (committed so GitHub Pages can serve it)
```

## Payment link format

```
#/pay?to=<cashaddr>&amt=<bch>&memo=<message>&net=testnet|mainnet
```

## Mainnet payment flow (WizardConnect)

1. Dapp opens a relay session (`initiateDappRelay`) and shows the `wiz://` URI
   as a QR code.
2. Wallet scans it, replies `wallet_ready` with its xpubs.
3. BlazePay derives the first 20 receive + 20 change addresses
   (`getAddrsByXpubKey`, paths `0/0`..`0/19` on each xpub), builds
   watch-only wallets for all of them, and aggregates UTXOs + balance.
4. `watch.send(..., { buildUnsigned: true })` builds the unsigned tx;
   `DappConnectionManager.signTransaction` sends it to the wallet with
   `inputPaths` `[inputIndex, "receive"|"change", addressIndex]` — one entry
   per input, at the derivation path of the address its UTXO came from.
5. BlazePay broadcasts the signed tx via the mainnet Electrum provider and
   shows the txid + explorer link.

## Status

Built during BCH Blaze 2026 (Nov 2026). Testnet end-to-end verified
(faucet funding, tx build + sign + broadcast, on-chain OP_RETURN memo);
mainnet uses the identical code path with the network flag flipped — a live
mainnet signing round-trip has not been run from this machine yet.
