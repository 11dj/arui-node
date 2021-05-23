const got = require("got");
// const fs = require('fs')
const prompt = require('prompt-sync')();

async function api(budget) {
  const getTHBBuyPriceFromCard = async (symbol) => {
    const response = await got(
      "https://www.binance.com/bapi/fiat/v2/public/ocbs/fiat-channel-gateway/get-quotation?channelCode=card&fiatCode=THB&cryptoAsset=" + symbol,
      { responseType: "json" }
    );
    return Number(response.body.data.price)
  }
  const sellUSDTFromP2P = await got.post(
    "https://p2p.binance.com/bapi/c2c/v2/public/c2c/adv/quoted-price",
    {
      json: { fiatCurrency: "THB", assets: ["USDT"], tradeType: "SELL" },
      responseType: "json",
    }
  );

  const getTHBP2PPrice = async (symbol) => {
    const response = await got.post(
      "https://p2p.binance.com/bapi/c2c/v2/public/c2c/adv/quoted-price",
      {
        json: { fiatCurrency: "THB", assets: [symbol], tradeType: "SELL" },
        responseType: "json",
      }
    );
    return Number(response.body.data[0].referencePrice)
  }

  const getTHBPricefromBinance = async (symbol) => {
    const response = await got("https://api2.binance.com/api/v3/ticker/bookTicker?symbol=" + symbol);
    return Number(JSON.parse(response.body).askPrice)
  }

  const getPriceFromBitKub = async (symbol) => {
    const response = await got("https://api.bitkub.com/api/market/ticker?sym=" + symbol);
    return Object.values(JSON.parse(response.body))[0].highestBid
  }

  const usdt = await getTHBBuyPriceFromCard('USDT')
  const busd = await getTHBBuyPriceFromCard('BUSD')
  const sellUSDT = await getTHBP2PPrice('USDT')
  const [date, time] = new Date().toLocaleString().split(',')
  const [month, day, year] = date.split('/')
  const dateTrans = `${year}-${month.length == 1 ? '0' + month : month}-${day}`
  const filename = `${dateTrans}.txt`

  const calAB = (price1, price2, budget) => {
    const profit = (price2 / price1) - 1
    const percent = profit * 100
    const earning = budget * (profit + 1)
    const totalProfit = (budget * (profit + 1)) - budget
    return { percent, earning, totalProfit }
  }

  const timeMsg = `${dateTrans}${time}`

  const usdtx = calAB(usdt, sellUSDT, budget)
  const msgUSDT = `[USDT] BUY : ฿${usdt.toFixed(4)} |===> SELL in P2P ฿${sellUSDT.toFixed(2)} |===> profit ฿${usdtx.totalProfit.toFixed(2)} (${usdtx.percent.toFixed(2)}%)`
  console.log(timeMsg)
  console.log(msgUSDT);
  const bitkubIOST = await getPriceFromBitKub('THB_IOST')
  const binanceIOST = await getTHBPricefromBinance('IOSTBUSD')
  const binanceIOSTTHB = binanceIOST * busd
  const iostx = calAB(binanceIOSTTHB, bitkubIOST, budget)
  const msgIOST = `[IOST] BUY : ฿${binanceIOSTTHB.toFixed(2)} ($${binanceIOST.toFixed(5)}) |===> SELL IOST in bk ฿${bitkubIOST.toFixed(3)} |===> profit ฿${iostx.totalProfit.toFixed(2)} (${iostx.percent.toFixed(2)}%)`
  console.log(msgIOST)
  console.log(' ')
}
const budget = prompt('Enter your budget? ');
const timeInput = prompt('Set time interval in seconds (60s): ')
let timeInterval = timeInput.length > 0 ? timeInput : 60
console.log(`Your budget is ${budget} and Time interval ${timeInterval} seconds`)

setInterval(async function () {
  await api(budget)
}, timeInterval * 1000)