# L1/L2 ERC20 Deposit + Withdrawal Example

## Introduction

In this example repository we will walk through how to add L1 <> L2 message passing in your application.

Message passing is automatically done for all Optimistic Ethereum transactions, but retrieving these messages is something that you must implement yourself in your application.
_Message passing_ is used to pass data from L1 to L2 or from L2 to L1.

## Prerequisite Software

- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Node.js](https://nodejs.org/en/download/)
- [Yarn](https://classic.yarnpkg.com/en/docs/install#mac-stable)
- [Docker](https://docs.docker.com/engine/install/)

## L1 <> L2 Communication: Brief Summary

For example, you would pass data from L1 to L2 when initiating a process on L1, and finalizing it on L2, such as an L1 deposit and L2 withdrawal.
The [`L1CrossDomainMessenger`](https://github.com/ethereum-optimism/optimism/blob/master/packages/contracts/contracts/optimistic-ethereum/OVM/bridge/messaging/OVM_L1CrossDomainMessenger.sol) will pass the L1 data to L2 by calling [`sendMessage`](https://github.com/ethereum-optimism/optimism/blob/master/packages/contracts/contracts/optimistic-ethereum/OVM/bridge/messaging/Abs_BaseCrossDomainMessenger.sol#L51-L61).
Then, the [`L2CrossDomainMessenger`](https://github.com/ethereum-optimism/optimism/blob/master/packages/contracts/contracts/optimistic-ethereum/OVM/bridge/messaging/OVM_L2CrossDomainMessenger.sol) calls [`relayMessage`](https://github.com/ethereum-optimism/optimism/blob/master/packages/contracts/contracts/optimistic-ethereum/OVM/bridge/messaging/OVM_L1CrossDomainMessenger.sol#L79-L89) to relay the L1 data back to the receiving user.

Similarly, for an L2 to L1 deposit-withdrawal, message passing would start at the `L2CrossDomainMessenger` calling `sendMessage` and end with the message being relayed by the `L1CrossDomainMessenger` to L1.

For further information, you can review our [documentation on L1 <> L2 Communication on our community hub](https://community.optimism.io/docs/developers/integration.html#%E2%98%8E%EF%B8%8F-l1-l2-communication).

## Message Passing in this Example

In this repository, on [line 97](https://github.com/ethereum-optimism/l1-l2-deposit-withdrawal/blob/main/example.js#L97), we wait for the message to relayed by the `L2CrossDomainMessenger` and use the [`@eth-optimism/watcher`](https://www.npmjs.com/package/@eth-optimism/watcher) to retrieve the hash of message of the previous transaction, a deposit of an ERC20 on L1.

Likewise, on [line 115](https://github.com/ethereum-optimism/l1-l2-deposit-withdrawal/blob/main/example.js#L115), we wait for a second message to be relayed, but this time by the `L1CrossDomainMessenger` so that we can retrieve the message of `tx3`, a withdraw of an ERC20 on L2.

## Running the Example

Run the following commands to get started:

```sh
yarn install
yarn compile
```

Make sure you have the local L1/L2 system running (open a second terminal for this):

```sh
git clone git@github.com:ethereum-optimism/optimism.git
cd optimism
yarn
yarn build
cd ops
docker-compose build
docker-compose up
```

Now run the deploy script:

```sh
node ./deploy.js
```

If everything goes well, you should see something like the following:

```text
Deploying L1 mockDAI...
L1_mockDAI address:  0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf
Deploying L1_CurveDepositZap ...
L1_CurveDepositZap address:  0x0E801D84Fa97b50751Dbf25036d067dCf18858bF
Deploying L1_MockYearnVault ...
L1_YearnVault address:  0x8f86403A4DE0BB5791fa46B8e795C547942fE4Cf
Deploying L2 ERC20...
L2_oDAI address:  0x5FbDB2315678afecb367f032d93F642f64180aa3
Deploying L1 ERC20 Gateway...
L1_ERC20Gateway address:  0x9d4454B023096f34B160D6B654540c56A1F81688
Deploying L1_Pool ...
L1_Pool address:  0x5eb3Bc0a489C5A8288765d2336659EbCA68FCd00
Deploying L2_Pool ...
L2_Pool address:  0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
Setting L2_Pool address on L1_Pool ...
L2 Pool address on L1 Pool set to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
Initializing L2 ERC20...
```

Now run the following to start the frontend and you are ready.

```sh
yarn lerna start --parallel
```