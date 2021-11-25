This arbitrage app is almost turn-key ready to go.

All you need is your own infura token...or a node api token of your choice.

create a .env file in the root folder and put your key in it. It should look something like this:

INFURA_URL=<YOUR API KEY HERE>

This app is only constructed to poll prices and alert you when an arb opportunity is available.

It doesn't actually make a smart contract and call the flashloan. BUT! it is the base of what we want to do.

