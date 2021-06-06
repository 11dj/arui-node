const got = require("got");
const prompt = require('prompt-sync')();
const getBinanceTHBRate = async (symbol) => {
  const card = await got(
    "https://www.binance.com/bapi/fiat/v2/public/ocbs/fiat-channel-gateway/get-quotation?channelCode=card&fiatCode=THB&cryptoAsset=" + symbol,
    { responseType: "json" }
  );
  const p2p = await got.post(
    "https://p2p.binance.com/bapi/c2c/v2/public/c2c/adv/quoted-price",
    {
      json: { fiatCurrency: "THB", assets: [symbol], tradeType: "SELL" },
      responseType: "json",
    }
  );
  return {
    card: Number(card.body.data.price),
    p2p: Number(p2p.body.data[0].referencePrice)
  }

}

const getBinanceSymbols = async (fiat) => {
  const response = await got("https://api.binance.com/api/v3/ticker/bookTicker", { responseType: "json" });
  return response.body.filter(fe => fe.symbol.includes(fiat))
}

const getBitKubSymbols = async () => {
  const response = await got("https://api.bitkub.com/api/market/ticker", { responseType: "json" });
  const x = ((o) => { var ks = []; for (var k in o) ks.push({ ...o[k], symbol: k }); return ks })(response.body);
  return x
}

bnbkSymbols = async () => {
  const bn = await getBinanceSymbols('USDT')
  const bk = await getBitKubSymbols()
  const bnSymbols = bn.map((ea) => ea.symbol)
  const bkSymbols = bk.map((ea) => ea.symbol)
  const bn2bkSymbols = bnSymbols.filter(el => bkSymbols.map(ea => ea.replace(/^THB_+/i, '')).includes(el.replace("USDT", "")));
  const bk2bnSymbols = bkSymbols.filter(el => bnSymbols.map(ea => ea.replace("USDT", "")).includes(el.replace(/^THB_+/i, "")));
  const symbols = bn2bkSymbols.map(ea => ea.replace("USDT", ""))
  const resp = symbols.map(ea => {
    return {
      symbol: ea,
      binance: bn.filter(bn => bn.symbol.includes(ea))[0],
      bitkub: bk.filter(bk => bk.symbol.includes(ea))[0]
    }
  })
  return resp
}

const calArb = (price1, price2) => {
  let gap = (price2 / price1)
  let diff = gap - 1
  const percent = diff * 100
  return { price1, price2, gap, percent }
}

const display1 = (item, budget) => {
  const { symbol, price1, price2, originPrice, gap } = item
  percent = (gap - 1) * 100
  profit = budget * gap
  let message;
  if (item.type == 'bn2bk') {
    message = `[${symbol}] Binance ฿${price1.toFixed(3)}($${originPrice.toFixed(5)}) ==> Bitkub ฿${price2.toFixed(2)} || profit ฿${profit.toFixed(2)} (${percent.toFixed(2)}%)`
    return message
  } else if (item.type == 'bk2bn') {
    message = `[${symbol}] Bitkub ฿${price1.toFixed(2)} ==> Binance ฿${price2.toFixed(2)}($${originPrice.toFixed(5)}) || profit ฿${profit.toFixed(2)} (${percent.toFixed(2)}%)`
    return message
  }
}


run = async () => {
  let message
  const [date, time] = new Date().toLocaleString().split(',')
  const [month, day, year] = date.split('/')
  const dateTrans = `${year}-${month.length == 1 ? '0' + month : month}-${day}`
  const timeMsg = `${dateTrans}${time}`
  const usdt = await getBinanceTHBRate('USDT')
  const buyUSDT = (usdt.p2p > usdt.card) ? usdt.card : usdt.p2p
  const symbols = await bnbkSymbols()
  const calArbs = symbols.map(el => {
    return {
      symbol: el.symbol,
      bn2bk: { ...calArb(el.binance.askPrice * buyUSDT, el.bitkub.highestBid), originPrice: Number(el.binance.askPrice) },
      bk2bn: { ...calArb(el.bitkub.lowestAsk, el.binance.bidPrice * usdt.p2p), originPrice: Number(el.binance.bidPrice) }
    }
  })
  const alloArb = calArbs.reduce((total, each) => {
    if (isFinite(each.bn2bk.gap) && each.bn2bk.gap > 1) {
      const { price1, price2, gap, originPrice } = each.bn2bk
      total.push({
        symbol: each.symbol,
        type: 'bn2bk',
        gap, originPrice, price1, price2,
      })
    }
    if (isFinite(each.bk2bn.gap) && each.bk2bn.gap > 1) {
      const { price1, price2, gap, originPrice } = each.bk2bn
      total.push({
        symbol: each.symbol,
        type: 'bk2bn',
        gap, originPrice, price1, price2,
      })
    }
    return total
  }, []).sort((a, b) => (a.gap < b.gap) ? 1 : ((b.gap < a.gap) ? -1 : 0))
  const budget = 80000
  // console.log(timeMsg)
  let fiatMsg = `[USDT] card: ${usdt.card}, p2p: ${usdt.p2p} || gap ${(((usdt.p2p / usdt.card) - 1) * 100).toFixed(2)}% `
  // console.log(fiatMsg)
  let title10bnbk = '10 Top higest arbitrage between Binance and Bitkub'
  // console.log(title10bnbk)
  const alloArbMsg = alloArb.slice(0, 10).map((ea, inx) => `${(inx + 1) + '.' + display1(ea, budget)}`)
  message = `\n${timeMsg}\n${fiatMsg}\n${title10bnbk}\n${alloArbMsg.join('\n')} \n`
  return message
}





function print(input) {
  const numberOfLines = (input.match(/\n/g) || []).length;
  process.stdout.clearScreenDown();
  process.stdout.write(input);
  process.stdout.cursorTo(0);
  process.stdout.moveCursor(0, -numberOfLines);
}

setInterval(async function () {
  const message = await run()
  print(message)
}, 3000)