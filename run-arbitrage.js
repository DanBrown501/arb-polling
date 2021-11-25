require('dotenv').config()
//Web3 is the package used to get info from the Web3 network (run npm i Web3 in your terminal)
const Web3 = require('web3');
//@uniswap/sdk is the package used to buy,sell and poll UniSwap Prices (run npm i @uniswap/sdk in your terminal)
const { ChainId, Token, TokenAmount, Pair } = require('@uniswap/sdk');
//Call this to get access to abis including the kyber network
const abis = require('./abis');
// ./addresses holds mainnet tokens
const { mainnet: addresses } = require('./addresses');


// create a new Web3 object that is connected to the Infura node.

const web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.INFURA_URL)
);
// Creates a smart contract that allows you to convert one token to another.
// This will be used to convert ETH to Kyber.
const kyber = new web3.eth.Contract(
  abis.kyber.kyberNetworkProxy,
  addresses.kyber.kyberNetworkProxy
);

//How much ETH will be traded
const AMOUNT_ETH = 100;
//Price of ETH
const RECENT_ETH_PRICE = 230;
//Converts ETH to Wei
const AMOUNT_ETH_WEI = web3.utils.toWei(AMOUNT_ETH.toString());
//Converts DAI to wei
const AMOUNT_DAI_WEI = web3.utils.toWei((AMOUNT_ETH * RECENT_ETH_PRICE).toString());

const init = async () => {
  // Fetche the data for the tokens we want to trade.
// It returns a Promise that resolves to an array of two Token objects.
// The first element is the DAI token, and the second element is the WETH token.
  const [dai, weth] = await Promise.all(
    [addresses.tokens.dai, addresses.tokens.weth].map(tokenAddress => (
      Token.fetchData(
        ChainId.MAINNET,
        tokenAddress,
      )
  )));
  // fetches the data of a pair.
// It takes in two arguments, the first being the base token and the second being the quote token.
// It returns a Promise that resolves to an object containing the pair's price, price24h, and percentChange.
  const daiWeth = await Pair.fetchData(
    dai,
    weth,
  );
// subscribes to the newBlockHeaders event.
// and returns a subscription object.
  web3.eth.subscribe('newBlockHeaders')
    .on('data', async block => {
      console.log(`New block received. Block # ${block.number}`);
// returns the expected rate of the tokens that are being traded.
// The expected rate is the amount of tokens that you will receive for the amount of tokens that you are trading.
// For example, if you are trading 1 ETH for DAI, the expected rate is the amount of DAI
      const kyberResults = await Promise.all([
          kyber
            .methods
            .getExpectedRate(
              addresses.tokens.dai, 
              '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 
              AMOUNT_DAI_WEI
            ) 
            .call(),
          kyber
            .methods
            .getExpectedRate(
              '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 
              addresses.tokens.dai, 
              AMOUNT_ETH_WEI
            ) 
            .call()
      ]);
      // We take in a token and a token to convert to, and returns the amount of the token you can buy with 1 ETH.
// For example, if you wanted to buy 1 DAI with 1 ETH, you would use function 1 and pass in 1 ETH and DAI.
      const kyberRates = {
        buy: parseFloat(1 / (kyberResults[0].expectedRate / (10 ** 18))),
        sell: parseFloat(kyberResults[1].expectedRate / (10 ** 18))
      };
      console.log('Kyber ETH/DAI');
      console.log(kyberRates);
      // This takes in two tokens and returns the price of the first token in terms of the second token.
// In this case, it takes in DAI and WETH and returns the price of DAI in terms of WETH.
// It does this by taking the amount of DAI in the first token and dividing it by the amount of WETH in the second token.
// This is the same as taking the amount of WETH in the second token and dividing it by the amount of DAI in the first token.
// This is because the price of a token is the amount of the second token you need to buy one of the first token.
// So, if you want to buy DAI, you need to buy WETH.
// If you want to buy WETH, you need to buy DAI.
// This is the same as saying the price of DAI is the amount of WETH you need to buy one DAI.
// This is the same as saying the price of WETH is the amount of DAI you need to buy one WETH.
      const uniswapResults = await Promise.all([
        daiWeth.getOutputAmount(new TokenAmount(dai, AMOUNT_DAI_WEI)),
        daiWeth.getOutputAmount(new TokenAmount(weth, AMOUNT_ETH_WEI))
      ]);
      const uniswapRates = {
        buy: parseFloat( AMOUNT_DAI_WEI / (uniswapResults[0][0].toExact() * 10 ** 18)),
        sell: parseFloat(uniswapResults[1][0].toExact() / AMOUNT_ETH),
      };
      console.log('Uniswap ETH/DAI');
      console.log(uniswapRates);

      const gasPrice = await web3.eth.getGasPrice();
      //200000 is picked arbitrarily, have to be replaced by actual tx cost , with Web3 estimateGas()
      const txCost = 200000 * parseInt(gasPrice);
      const currentEthPrice = (uniswapRates.buy + uniswapRates.sell) / 2; 
      const profit1 = (parseInt(AMOUNT_ETH_WEI) / 10 ** 18) * (uniswapRates.sell - kyberRates.buy) - (txCost / 10 ** 18) * currentEthPrice;
      const profit2 = (parseInt(AMOUNT_ETH_WEI) / 10 ** 18) * (kyberRates.sell - uniswapRates.buy) - (txCost / 10 ** 18) * currentEthPrice;
      if(profit1 > 0) {
        console.log('Arb opportunity found!');
        console.log(`Buy ETH on Kyber at ${kyberRates.buy} dai`);
        console.log(`Sell ETH on Uniswap at ${uniswapRates.sell} dai`);
        console.log(`Expected profit: ${profit1} dai`);
        //Execute arb Kyber <=> Uniswap
      } else if(profit2 > 0) {
        console.log('Arb opportunity found!');
        console.log(`Buy ETH from Uniswap at ${uniswapRates.buy} dai`);
        console.log(`Sell ETH from Kyber at ${kyberRates.sell} dai`);
        console.log(`Expected profit: ${profit2} dai`);
        //Execute arb Uniswap <=> Kyber
      }
    })
    .on('error', error => {
      console.log(error);
    });
}
init();

