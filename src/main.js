// BlazePay — BCH payment links. Static SPA, no backend.
// mainnet-js v3 for wallets/tx/Electrum; WizardConnect for mainnet wallet signing.
import './style.css';
import {
  createWallet,
  walletFromId,
  OpReturnData,
  getHistory,
  getNetworkProvider,
  WatchWallet,
  getAddrsByXpubKey,
} from 'mainnet-js';
import { initiateDappRelay } from '@wizardconnect/core';
import { DappConnectionManager } from '@wizardconnect/dapp';
import QRCode from 'qrcode';

// ---------------------------------------------------------------- config
const PROJECT_CASHADDR = 'bitcoincash:qppall5d96fdw0ecrpjstqlqv4j6gprlfgnhjlewrj';
const PROJECT_TOKENADDR = 'bitcoincash:zppall5d96fdw0ecrpjstqlqv4j6gprlfg5apphgup';
const REPO_URL = 'https://github.com/slowwwkiss/blazepay';
const SATS_PER_BCH = 100_000_000n;
const TESTNET_WALLET_KEY = 'blazepay-testnet-walletid';
const FAUCET_URL = 'https://rest-unstable.mainnet.cash/faucet/get_testnet_bch';
const DUST_SATS = 1000n; // minimum payment size we accept

const $ = (id) => document.getElementById(id);
const els = {
  netTestnet: $('net-testnet'), netMainnet: $('net-mainnet'), netNote: $('net-note'),
  inAmount: $('in-amount'), inMemo: $('in-memo'), inRecipient: $('in-recipient'),
  createForm: $('create-form'), linkResult: $('link-result'), outLink: $('out-link'),
  btnCopyLink: $('btn-copy-link'), btnOpenLink: $('btn-open-link'), qrImg: $('qr-img'),
  payCard: $('pay-card'), payAmount: $('pay-amount'), payMemo: $('pay-memo'),
  payRecipient: $('pay-recipient'), payNetwork: $('pay-network'),
  panelTestnet: $('panel-testnet'), panelMainnet: $('panel-mainnet'),
  twAddr: $('tw-addr'), twBalance: $('tw-balance'),
  btnFaucet: $('btn-faucet'), btnPayTestnet: $('btn-pay-testnet'),
  btnWcConnect: $('btn-wc-connect'), wcQr: $('wc-qr'), wcQrImg: $('wc-qr-img'),
  wcUri: $('wc-uri'), wcConnected: $('wc-connected'), wcStart: $('wc-start'),
  wcWalletName: $('wc-wallet-name'), wcAddr: $('wc-addr'), wcBalance: $('wc-balance'),
  btnPayMainnet: $('btn-pay-mainnet'), btnWcDisconnect: $('btn-wc-disconnect'),
  payStatus: $('pay-status'), receipt: $('receipt'), rcTxid: $('rc-txid'),
  rcExplorer: $('rc-explorer'), btnReceiptCopy: $('btn-receipt-copy'),
  feedAddr: $('feed-addr'), feedNet: $('feed-net'), feedList: $('feed-list'),
  feedEmpty: $('feed-empty'), feedError: $('feed-error'),
  btnRefreshFeed: $('btn-refresh-feed'),
  btnDonate: $('btn-donate'), btnCopyDonate: $('btn-copy-donate'),
};

const state = {
  network: 'testnet', // 'testnet' | 'mainnet'
  pay: null,          // { to, amtBch, memo, net }
  testnetWallet: null,
  testnetWalletId: localStorage.getItem(TESTNET_WALLET_KEY) || null,
  wcManager: null,
  wcRelay: null,
  wcAddress: null,
  wcWatch: null,
};

function explorerTxUrl(network, txid) {
  return network === 'mainnet'
    ? `https://blockchair.com/bitcoin-cash/transaction/${txid}`
    : `https://blockchair.com/bitcoin-cash/testnet/transaction/${txid}`;
}
function explorerAddrUrl(network, addr) {
  return network === 'mainnet'
    ? `https://blockchair.com/bitcoin-cash/address/${addr}`
    : `https://blockchair.com/bitcoin-cash/testnet/address/${addr}`;
}
function fmtBch(satsBig) {
  const negative = satsBig < 0n;
  const v = negative ? -satsBig : satsBig;
  const whole = v / SATS_PER_BCH;
  const frac = (v % SATS_PER_BCH).toString().padStart(8, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}
function bchToSats(bchStr) {
  const n = Number(bchStr);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Enter an amount greater than 0.');
  const sats = BigInt(Math.round(n * 100_000_000));
  if (sats < DUST_SATS) throw new Error('Amount is below the dust limit (0.00001 BCH).');
  return sats;
}
function showStatus(msg, kind = 'info') {
  els.payStatus.classList.remove('hidden');
  els.payStatus.textContent = msg;
  els.payStatus.dataset.kind = kind;
}
function clearStatus() { els.payStatus.classList.add('hidden'); els.payStatus.textContent = ''; }
function hideReceipt() { els.receipt.classList.add('hidden'); }
function showReceipt(txid) {
  els.rcTxid.textContent = txid;
  els.rcExplorer.href = explorerTxUrl(state.network, txid);
  els.receipt.classList.remove('hidden');
}
async function copyText(text, btn, doneLabel = 'Copied!') {
  try { await navigator.clipboard.writeText(text); }
  catch { // clipboard API unavailable (non-secure context) — fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  if (btn) {
    const old = btn.textContent; btn.textContent = doneLabel;
    setTimeout(() => { btn.textContent = old; }, 1500);
  }
}

// ---------------------------------------------------------------- pay link
function parsePayHash() {
  const h = location.hash;
  if (!h.startsWith('#/pay?')) return null;
  const q = new URLSearchParams(h.slice(6));
  const to = q.get('to') || '';
  const amt = q.get('amt') || '';
  const memo = q.get('memo') || '';
  const net = q.get('net') === 'mainnet' ? 'mainnet' : 'testnet';
  if (!to || !amt) return null;
  return { to, amtBch: amt, memo, net };
}
function buildPayLink({ to, amtBch, memo, net }) {
  const q = new URLSearchParams({
    to,
    amt: String(amtBch),
    memo: memo || '',
    net,
  });
  return `${location.origin}${location.pathname}#/pay?${q.toString()}`;
}
function renderPayCard() {
  const p = state.pay;
  if (!p) { els.payCard.classList.add('hidden'); return; }
  els.payCard.classList.remove('hidden');
  let satsText;
  try { satsText = `${bchToSats(p.amtBch).toString()} sat`; }
  catch { satsText = 'invalid amount in link'; }
  els.payAmount.textContent = `${p.amtBch} BCH (${satsText})`;
  els.payMemo.textContent = p.memo || '(no message)';
  els.payRecipient.textContent = p.to;
  els.payNetwork.textContent = p.net === 'mainnet' ? 'Mainnet (real BCH)' : 'Testnet (play money)';
  els.panelTestnet.classList.toggle('hidden', p.net !== 'testnet');
  els.panelMainnet.classList.toggle('hidden', p.net !== 'mainnet');
  hideReceipt(); clearStatus();
  if (p.net === 'testnet') ensureTestnetWallet().catch((e) => showStatus(`Test wallet error: ${e.message}`, 'error'));
  else refreshWcPanel();
}
function setNetwork(net) {
  state.network = net;
  els.netTestnet.classList.toggle('active', net === 'testnet');
  els.netMainnet.classList.toggle('active', net === 'mainnet');
  els.netNote.textContent = net === 'testnet'
    ? 'Testnet: the app creates a throwaway test wallet in your browser and funds it free from the faucet. Nothing real moves.'
    : 'Mainnet: real BCH, your own wallet, your own money. Connect with WizardConnect (Paytaca / Selene / Cashonize) and sign in your wallet.';
  // Keep the create form on the chosen network; if a pay link is open, it keeps its own network.
  refreshFeed();
}

// ---------------------------------------------------------------- testnet wallet
async function ensureTestnetWallet() {
  if (state.testnetWallet) return state.testnetWallet;
  els.twAddr.textContent = 'creating…';
  els.twBalance.textContent = '…';
  try {
    let w;
    if (state.testnetWalletId) {
      try { w = await walletFromId(state.testnetWalletId); }
      catch { state.testnetWalletId = null; }
    }
    if (!w) {
      w = await createWallet({ network: 'testnet', type: 'seed' });
      const info = await w.getInfo();
      state.testnetWalletId = info.walletId;
      localStorage.setItem(TESTNET_WALLET_KEY, info.walletId);
    }
    state.testnetWallet = w;
    els.twAddr.textContent = w.getDepositAddress();
    try { await refreshTestnetBalance(); }
    catch { /* balance shows its own error; address stays visible */ }
    return w;
  } catch (e) {
    els.twAddr.textContent = `error: ${e.message}`;
    throw e;
  }
}
async function refreshTestnetBalance() {
  try {
    const bal = await state.testnetWallet.getBalance();
    els.twBalance.textContent = `${fmtBch(bal)} tBCH (${bal.toString()} sat)`;
    return bal;
  } catch (e) {
    els.twBalance.textContent = `error: ${e.message}`;
    throw e;
  }
}
async function fundTestnet() {
  const w = await ensureTestnetWallet();
  const addr = w.getDepositAddress();
  els.btnFaucet.disabled = true;
  els.btnFaucet.textContent = 'Requesting…';
  try {
    const res = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashaddr: addr }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`faucet answered ${res.status}: ${body.slice(0, 120)}`);
    showStatus('Faucet request sent — waiting for the coins to arrive (usually under a minute)…');
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const bal = await refreshTestnetBalance();
      if (bal > DUST_SATS) { showStatus(`Funded! Balance is now ${fmtBch(bal)} tBCH.`, 'ok'); return; }
    }
    showStatus('Faucet accepted the request but no coins arrived yet — wait a bit and press Refresh, or use the fallback faucet link below.', 'error');
  } catch (e) {
    showStatus(`Faucet failed: ${e.message}. Use the fallback faucet link below and send tBCH to the address above.`, 'error');
  } finally {
    els.btnFaucet.disabled = false;
    els.btnFaucet.textContent = 'Get free testnet BCH';
  }
}
async function payWithTestnet() {
  const p = state.pay;
  if (!p) return;
  clearStatus(); hideReceipt();
  els.btnPayTestnet.disabled = true;
  try {
    const w = await ensureTestnetWallet();
    const sats = bchToSats(p.amtBch);
    const bal = await w.getBalance();
    if (bal < sats + 1000n) {
      showStatus(`Not enough tBCH: balance ${fmtBch(bal)}, need ${p.amtBch} + fee. Press "Get free testnet BCH" first.`, 'error');
      return;
    }
    showStatus('Building and sending the testnet transaction…');
    const reqs = [{ cashaddr: p.to, value: sats }];
    if (p.memo) reqs.push(OpReturnData.from(p.memo.slice(0, 180)));
    const resp = await w.send(reqs);
    showStatus(`Paid! Transaction ${resp.txId} — confirming on-chain…`, 'ok');
    showReceipt(resp.txId);
    await refreshTestnetBalance();
    setTimeout(refreshFeed, 4000);
  } catch (e) {
    showStatus(`Payment failed: ${e.message}`, 'error');
  } finally {
    els.btnPayTestnet.disabled = false;
  }
}

// ---------------------------------------------------------------- WizardConnect (mainnet)
function wcReset(keepQr = false) {
  if (state.wcRelay) { try { state.wcRelay.cleanup(); } catch { /* ignore */ } }
  state.wcRelay = null; state.wcManager = null;
  state.wcAddress = null; state.wcWatch = null;
  els.wcQr.classList.add('hidden');
  els.wcConnected.classList.add('hidden');
  els.wcStart.classList.remove('hidden');
  if (!keepQr) els.wcUri.textContent = '';
}
async function wcConnect() {
  clearStatus();
  els.btnWcConnect.disabled = true;
  els.btnWcConnect.textContent = 'Starting relay…';
  try {
    const mgr = new DappConnectionManager('BlazePay');
    const relay = initiateDappRelay((payload) => {
      mgr.updateConnection(payload.client, payload.status);
    });
    mgr.attachRelay(relay);
    state.wcManager = mgr; state.wcRelay = relay;
    els.wcStart.classList.add('hidden');
    els.wcQr.classList.remove('hidden');
    els.wcUri.textContent = relay.uri;
    els.wcQrImg.src = await QRCode.toDataURL(relay.uri, { width: 280, margin: 1 });
    mgr.on('walletready', async (msg) => {
      try {
        els.wcWalletName.textContent = msg.wallet_name || 'BCH wallet';
        const paths = mgr.getSessionPaths();
        const receive = paths.find((x) => x.name === 'receive');
        if (!receive) throw new Error('Wallet did not share a receive xpub.');
        const [addr] = getAddrsByXpubKey(receive.xpub, '0/0', 1);
        state.wcAddress = addr;
        els.wcAddr.textContent = addr;
        els.wcQr.classList.add('hidden');
        els.wcConnected.classList.remove('hidden');
        await refreshWcBalance();
        showStatus('Wallet connected. Review the amount, then press Pay — your wallet will ask you to sign.', 'ok');
      } catch (e) {
        showStatus(`Connected, but address derivation failed: ${e.message}`, 'error');
      }
    });
    mgr.on('disconnect', () => { wcReset(); showStatus('Wallet disconnected.'); });
  } catch (e) {
    showStatus(`Could not start WizardConnect: ${e.message}`, 'error');
    wcReset();
  } finally {
    els.btnWcConnect.disabled = false;
    els.btnWcConnect.textContent = 'Connect wallet (show QR)';
  }
}
async function refreshWcPanel() {
  if (state.wcAddress) {
    els.wcStart.classList.add('hidden');
    els.wcQr.classList.add('hidden');
    els.wcConnected.classList.remove('hidden');
    els.wcAddr.textContent = state.wcAddress;
    await refreshWcBalance().catch(() => {});
  }
}
async function refreshWcBalance() {
  if (!state.wcAddress) return 0n;
  const watch = await WatchWallet.watchOnly(state.wcAddress);
  state.wcWatch = watch;
  const bal = await watch.getBalance();
  els.wcBalance.textContent = `${fmtBch(bal)} BCH (${bal.toString()} sat)`;
  return bal;
}
async function payWithMainnet() {
  const p = state.pay;
  if (!p || !state.wcManager || !state.wcAddress) return;
  clearStatus(); hideReceipt();
  els.btnPayMainnet.disabled = true;
  try {
    const sats = bchToSats(p.amtBch);
    const watch = state.wcWatch || await WatchWallet.watchOnly(state.wcAddress);
    const utxos = await watch.getUtxos();
    const bal = await watch.getBalance();
    if (utxos.length === 0 || bal < sats + 1000n) {
      showStatus(`Not enough BCH at the connected address (balance ${fmtBch(bal)}). The payment uses the wallet's first receive address — fund it first, or use an address that holds funds.`, 'error');
      return;
    }
    showStatus('Building the unsigned transaction…');
    const reqs = [{ cashaddr: p.to, value: sats }];
    if (p.memo) reqs.push(OpReturnData.from(p.memo.slice(0, 180)));
    // All inputs come from the wallet's first receive address (index 0), so
    // every input path is ["receive", 0] for the sign request.
    const built = await watch.send(reqs, {
      buildUnsigned: true,
      utxoIds: utxos,
      changeAddress: state.wcAddress,
    });
    const inputPaths = utxos.map((_, i) => [i, 'receive', 0]);
    showStatus('Waiting for your signature in the wallet…');
    const signed = await state.wcManager.signTransaction({
      transaction: {
        transaction: built.unsignedTransaction,
        sourceOutputs: built.sourceOutputs,
        userPrompt: `Pay ${p.amtBch} BCH via BlazePay${p.memo ? ` — ${p.memo}` : ''}`,
        broadcast: false,
      },
      inputPaths,
    });
    if (signed.error) throw new Error(signed.error);
    showStatus('Signed! Broadcasting…');
    const provider = getNetworkProvider('mainnet');
    const txid = await provider.sendRawTransaction(signed.signedTransaction);
    showStatus('Paid! Transaction confirmed by the network — receipt below.', 'ok');
    showReceipt(txid);
    await refreshWcBalance();
    setTimeout(refreshFeed, 4000);
  } catch (e) {
    showStatus(`Payment failed: ${e.message}`, 'error');
  } finally {
    els.btnPayMainnet.disabled = false;
  }
}

// ---------------------------------------------------------------- feed
async function refreshFeed() {
  const feedAddr = state.pay ? state.pay.to : PROJECT_CASHADDR;
  const net = state.pay ? state.pay.net : state.network;
  els.feedAddr.textContent = feedAddr;
  els.feedNet.textContent = net;
  els.feedError.classList.add('hidden');
  try {
    const provider = getNetworkProvider(net);
    const items = await getHistory({ addresses: [feedAddr], provider, count: 10 });
    const incoming = (items || []).filter((it) => it.valueChange > 0);
    els.feedList.innerHTML = '';
    els.feedEmpty.classList.toggle('hidden', incoming.length > 0);
    for (const it of incoming) {
      const from = (it.inputs || []).map((i) => i.address).filter(Boolean).slice(0, 2).join(', ') || 'unknown';
      const when = it.timestamp ? new Date(it.timestamp * 1000).toLocaleString() : 'unconfirmed';
      const li = document.createElement('li');
      li.innerHTML = `<b>${fmtBch(BigInt(Math.round(it.valueChange * 100_000_000)))} BCH</b>
        <span class="muted">from ${from} · ${when}</span><br/>
        <a href="${explorerTxUrl(net, it.hash)}" target="_blank" rel="noopener">${it.hash.slice(0, 16)}…${it.hash.slice(-8)}</a>`;
      els.feedList.appendChild(li);
    }
  } catch (e) {
    els.feedError.textContent = `Could not load the feed: ${e.message}`;
    els.feedError.classList.remove('hidden');
  }
}

// ---------------------------------------------------------------- events
els.createForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  try {
    const amtBch = els.inAmount.value.trim();
    const sats = bchToSats(amtBch); // validates
    void sats;
    const link = buildPayLink({
      to: els.inRecipient.value.trim(),
      amtBch,
      memo: els.inMemo.value.trim(),
      net: state.network,
    });
    els.outLink.value = link;
    els.btnOpenLink.href = link;
    els.qrImg.src = await QRCode.toDataURL(link, { width: 220, margin: 1 });
    els.linkResult.classList.remove('hidden');
    els.linkResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    alert(e.message);
  }
});
els.btnCopyLink.addEventListener('click', () => copyText(els.outLink.value, els.btnCopyLink));
els.btnCopyDonate.addEventListener('click', () => copyText(PROJECT_TOKENADDR, els.btnCopyDonate));
els.btnDonate.addEventListener('click', () => copyText(PROJECT_TOKENADDR, els.btnDonate));
els.btnReceiptCopy.addEventListener('click', () => copyText(els.rcTxid.textContent, els.btnReceiptCopy));
els.netTestnet.addEventListener('click', () => setNetwork('testnet'));
els.netMainnet.addEventListener('click', () => setNetwork('mainnet'));
els.btnFaucet.addEventListener('click', fundTestnet);
els.btnPayTestnet.addEventListener('click', payWithTestnet);
els.btnWcConnect.addEventListener('click', wcConnect);
els.btnPayMainnet.addEventListener('click', payWithMainnet);
els.btnWcDisconnect.addEventListener('click', async () => {
  try { state.wcManager?.clearStoredSession(); await state.wcManager?.sendDisconnect('user closed the tab'); } catch { /* ignore */ }
  wcReset(); showStatus('Wallet disconnected.');
});
els.btnRefreshFeed.addEventListener('click', refreshFeed);
window.addEventListener('hashchange', () => {
  state.pay = parsePayHash();
  if (state.pay) setNetwork(state.pay.net);
  renderPayCard();
  refreshFeed();
});

// ---------------------------------------------------------------- init
(function init() {
  // Banner links are absolute where they must survive any host path.
  $('link-repo').href = REPO_URL;
  state.pay = parsePayHash();
  if (state.pay) state.network = state.pay.net;
  setNetwork(state.network);
  renderPayCard();
  if (!state.pay) ensureTestnetWallet().catch(() => { /* shown in panel */ });
  setInterval(() => { if (!document.hidden) refreshFeed(); }, 30000);
})();
