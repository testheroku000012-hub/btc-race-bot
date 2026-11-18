import { runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

/* Dev-window analysis: CBBTC falls 2.8% overall but repeatedly rebounds after sharp
   15-minute selloffs.  A 15-bar drop of 0.3% followed by a higher close is a useful
   stabilisation signal; modest 30% entries capture those bounces while limiting impact.
   The 60-minute holding limit and explicit stop keep the bot out of the final drift down. */
const LOOKBACK = 15;
const DIP = 0.005;
const WEIGHT_BPS = 3000;
const HOLD_BARS = 480;
const TAKE_PROFIT_BPS = 60;
const STOP_BPS = 200;
const COOLDOWN = 5;
const MAX_SLIPPAGE_BPS = 100;

interface History { closes: number[]; cooldown: number }
const histories = new Map<string, History>();
const entrySeq = new Map<string, number>();

function history(symbol: string): History {
  let h = histories.get(symbol);
  if (!h) { h = { closes: [], cooldown: 0 }; histories.set(symbol, h); }
  return h;
}
function update(bar: Bar): History {
  const h = history(bar.symbol);
  h.closes.push(Number(bar.c) / 1e5);
  if (h.closes.length > LOOKBACK + 2) h.closes.shift();
  // Keep exactly one rolling close per received bar; the protocol batches are minute bars.
  if (h.cooldown > 0) h.cooldown--;
  return h;
}
function shouldEnter(h: History): boolean {
  if (h.cooldown > 0 || h.closes.length < LOOKBACK + 1) return false;
  const now = h.closes[h.closes.length - 1]!;
  const before = h.closes[h.closes.length - 1 - LOOKBACK]!;
  const prior = h.closes[h.closes.length - 2]!;
  return now < before * (1 - DIP) && now > prior;
}
function shouldExit(state: BarsState, symbol: string, h: History): boolean {
  const held = state.positions.get(symbol);
  const entered = entrySeq.get(symbol);
  if (!held || entered === undefined) return false;
  const value = state.value(symbol, held.qty);
  const cost = held.cost;
  const take = value * 10000n >= cost * BigInt(10000 + TAKE_PROFIT_BPS);
  const stop = value * 10000n <= cost * BigInt(10000 - STOP_BPS);
  return take || stop || state.seq - entered >= HOLD_BARS;
}

await runBars({
  onBatch(state, batch) {
    const fresh = new Set<string>();
    for (const bar of batch.bars) { update(bar); fresh.add(bar.symbol); }
    if (state.warmingUp) return [];
    const sells: SellInput[] = [];
    const buys: string[] = [];
    for (const { symbol } of state.hello.symbols) {
      if (!fresh.has(symbol)) continue;
      const h = history(symbol);
      const held = state.positions.get(symbol);
      if (held) {
        if (shouldExit(state, symbol, h)) {
          sells.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
          h.cooldown = COOLDOWN;
          entrySeq.delete(symbol);
        }
      } else if (shouldEnter(h)) buys.push(symbol);
    }
    const orders: (SellInput | BuyInput)[] = sells.slice(0, state.hello.caps.max_orders_per_bar);
    let cash = state.cash;
    for (const symbol of buys) {
      if (orders.length >= state.hello.caps.max_orders_per_bar) break;
      const amount = (state.equity * BigInt(WEIGHT_BPS)) / 10000n;
      const spend = amount < cash ? amount : cash;
      if (spend < BigInt(state.hello.fees.min_notional_quote_units)) continue;
      orders.push({ side: 'buy', symbol, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
      cash -= spend;
      entrySeq.set(symbol, state.seq);
    }
    return orders;
  },
});
