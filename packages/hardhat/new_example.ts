import { ethers } from 'hardhat';
const { Watcher } = require('@eth-optimism/watcher')
const { predeploys, getContractInterface } = require('@eth-optimism/contracts')
// Set up some contract factories. You can ignore this stuff.
const factory = (name, ovm = false, mocks = false) => {
    const artifact = require(`./artifacts${ovm ? '-ovm' : ''}/contracts/${mocks ? '/mocks/' : ''}${name}.sol/${name}.json`)
    return new ethers.ContractFactory(artifact.abi, artifact.bytecode)
}

// Set up some contract factories. You can ignore this stuff.
const erc20L1Artifact = require(`./artifacts/contracts/ERC20.sol/ERC20.json`)
const factory__L1_ERC20 = new ethers.ContractFactory(erc20L1Artifact.abi, erc20L1Artifact.bytecode)
//const factory__L1_ERC20 = factory('ERC20')
const erc20L2Artifact = require('../../node_modules/@eth-optimism/contracts/artifacts-ovm/contracts/optimistic-ethereum/libraries/standards/L2StandardERC20.sol/L2StandardERC20.json')
const factory__L2_ERC20 = new ethers.ContractFactory(erc20L2Artifact.abi, erc20L2Artifact.bytecode)

const l1StandardBridgeArtifact = require(`../../node_modules/@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L1StandardBridge.sol/OVM_L1StandardBridge.json`)
const factory__L1StandardBridge = new ethers.ContractFactory(l1StandardBridgeArtifact.abi, l1StandardBridgeArtifact.bytecode)

const l2StandardBridgeArtifact = require(`../../node_modules/@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol/OVM_L2StandardBridge.json`)
const factory__L2StandardBridge = new ethers.ContractFactory(l2StandardBridgeArtifact.abi, l2StandardBridgeArtifact.bytecode)

const factory__L1_Pool = factory('L1_Pool');
const factory__L2_Pool = factory('L2_Pool', true);
const factory__L1_MockYearnVault = factory('MockYearnV2Vault', false, true);
const factory__L1_MockCurveDepositZap = factory('MockCurveDepositZap', false, true);


async function main() {
    // Set up our RPC provider connections.
    const l1RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:9545')
    const l2RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:8545')
    const [owner, rewardsManager, poolTokenEscrow] = await ethers.getSigners();
    // Set up our wallets (using a default private key with 10k ETH allocated to it).
    // Need two wallets objects, one for interacting with L1 and one for interacting with L2.
    // Both will use the same private key.
    const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    const l1Wallet = new ethers.Wallet(key, l1RpcProvider)
    const l2Wallet = new ethers.Wallet(key, l2RpcProvider)

    const l2AddressManager = new ethers.Contract(
        predeploys.Lib_AddressManager,
        getContractInterface('Lib_AddressManager'),
        l2RpcProvider
    )

    const l1Messenger = new ethers.Contract(
        await l2AddressManager.getAddress('OVM_L1CrossDomainMessenger'),
        getContractInterface('OVM_L1CrossDomainMessenger'),
        l1RpcProvider
    )

    const l1MessengerAddress = l1Messenger.address
    // L2 messenger address is always the same.
    const l2MessengerAddress = '0x4200000000000000000000000000000000000007'

    // Tool that helps watches and waits for messages to be relayed between L1 and L2.
    const watcher = new Watcher({
        l1: {
            provider: l1RpcProvider,
            messengerAddress: l1MessengerAddress
        },
        l2: {
            provider: l2RpcProvider,
            messengerAddress: l2MessengerAddress
        }
    })

    // Deploy an ERC20 token on L1.
    console.log('Deploying L1 ERC20...')

    const L1_ERC20 = await factory__L1_ERC20.connect(l1Wallet).deploy(
        10000, //initialSupply
        'L1 ERC20', //name
    )
    await L1_ERC20.deployTransaction.wait()

    // Deploy the paired ERC20 token to L2.
    console.log('Deploying L2 ERC20...')
    const L2_ERC20 = await factory__L2_ERC20.connect(l2Wallet).deploy(
        '0x4200000000000000000000000000000000000010',
        L1_ERC20.address,
        'L2 ERC20', //name
        'L2T', // symbol
    )
    await L2_ERC20.deployTransaction.wait()

    const L2StandardBridge = factory__L2StandardBridge
        .connect(l2Wallet)
        .attach('0x4200000000000000000000000000000000000010')

    console.log('Instantiate L1 Standard Bridge...')
    const L1StandardBridgeAddress = await L2StandardBridge.l1TokenBridge();
    const L1StandardBridge = factory__L1StandardBridge.connect(l1Wallet).attach(L1StandardBridgeAddress)

    // Initial balances.
    console.log(`Balance on L1: ${await L1_ERC20.balanceOf(l1Wallet.address)}`) // 10000
    console.log(`Balance on L2: ${await L2_ERC20.balanceOf(l1Wallet.address)}`) // 0

    // Allow the gateway to lock up some of our tokens.
    console.log('Approving tokens for Standard Bridge...')
    const tx1 = await L1_ERC20.approve(L1StandardBridge.address, 5000)
    await tx1.wait()

    // Lock the tokens up inside the gateway and ask the L2 contract to mint new ones.
    console.log('Depositing tokens into L2 ...')
    const tx2 = await L1StandardBridge.depositERC20(
        L1_ERC20.address,
        L2_ERC20.address,
        5000,
        2000000,
        '0x')
    await tx2.wait()

    // Wait for the message to be relayed to L2.
    console.log('Waiting for deposit to be relayed to L2...')
    const [msgHash1] = await watcher.getMessageHashesFromL1Tx(tx2.hash)

    const receipt = await watcher.getL2TransactionReceipt(msgHash1, true)
    //console.log("receipt", receipt)

    // Log some balances to see that it worked!
    console.log(`Balance on L1: ${await L1_ERC20.balanceOf(l1Wallet.address)}`) // 5000
    console.log(`Balance on L2: ${await L2_ERC20.balanceOf(l1Wallet.address)}`) // 5000

    // Burn the tokens on L2 and ask the L1 contract to unlock on our behalf.
    console.log(`Withdrawing tokens back to L1 ...`)
    const tx3 = await L2StandardBridge.withdraw(
        L2_ERC20.address,
        100,
        2000000,
        '0x'
    )
    await tx3.wait()

    // Wait for the message to be relayed to L1.
    console.log(`Waiting for withdrawal to be relayed to L1...`)
    const [msgHash2] = await watcher.getMessageHashesFromL2Tx(tx3.hash)
    await watcher.getL1TransactionReceipt(msgHash2)

    // Log balances again!
    console.log(`Balance on L1: ${await L1_ERC20.balanceOf(l1Wallet.address)}`) // 5100
    console.log(`Balance on L2: ${await L2_ERC20.balanceOf(l1Wallet.address)}`) // 4900

    console.log("Deploying L1_CurveDepositZap ...");
    const L1_CurveDepositZap = await factory__L1_MockCurveDepositZap.connect(l1Wallet).deploy(
        L1_ERC20.address
    )
    await L1_CurveDepositZap.deployTransaction.wait();

    console.log("L1_CurveDepositZap address: ", L1_CurveDepositZap.address)

    console.log("Deploying L1_MockYearnVault ...");
    const L1_YearnVault = await factory__L1_MockYearnVault.connect(l1Wallet).deploy(
        L1_CurveDepositZap.address
    );
    await L1_YearnVault.deployTransaction.wait();

    console.log("L1_YearnVault address: ", L1_YearnVault.address)

    console.log("Deploying L1_Pool ...")
    const L1_Pool = await factory__L1_Pool.connect(l1Wallet).deploy(
        L1_ERC20.address,
        L2_ERC20.address,
        L1_YearnVault.address,
        L1_CurveDepositZap.address,
        l1MessengerAddress,
        L1StandardBridge.address,
        rewardsManager.address,
        poolTokenEscrow.address
    )
    await L1_Pool.deployTransaction.wait();

    console.log("L1_Pool address: ", L1_Pool.address)


    console.log("Deploying L2_Pool ...")
    const L2_Pool = await factory__L2_Pool.connect(l2Wallet).deploy(
        L2_ERC20.address,
        L2StandardBridge.address,
        L1_Pool.address,
        l2MessengerAddress,
        0,
        { gasPrice: 0, gasLimit: 8900000 }
    )
    //const revertReason1 = await getOptimismRevertReason({tx: L2_Pool.deployTransaction, provider: l2RpcProvider });
    //if(revertReason1){
    //  console.log(revertReason1)
    //}

    await L2_Pool.deployTransaction.wait();

    console.log("L2_Pool address: ", L2_Pool.address)

    console.log('Setting L2_Pool address on L1_Pool ...');
    const setL2PoolTx = await L1_Pool.connect(l1Wallet).setL2Pool(L2_Pool.address);
    await setL2PoolTx.wait();

    console.log("L2 Pool address on L1 Pool set to:", await L1_Pool.L2_Pool());

    // allow L2_Pool to use our tokens
    console.log("Approving L2_Pool to spend oDAI ... ");
    const approveTx = await L2_ERC20.connect(l2Wallet).approve(L2_Pool.address, 4000, { gasLimit: 8900000, gasPrice: 0 })
    await approveTx.wait();


    // deposit oDAI into L1_Pool
    console.log("Depositing oDAI into L1_Pool ... ");
    const depositTx = await L2_Pool.connect(l2Wallet).deposit(2500, { gasLimit: 8900000, gasPrice: 0 });
    //const revertReason2 = await getOptimismRevertReason({tx: depositTx, provider: l2RpcProvider });

    //if (revertReason2) {
    //  console.log(revertReason2);
    //}

    await depositTx.wait();


    console.log(" waiting for Pool deposit to be relayed to L1 ...")
    const [depositHash] = await watcher.getMessageHashesFromL2Tx(depositTx.hash);
    await watcher.getL1TransactionReceipt(depositHash);

    console.log(`poolTokenEscrow balance : ${(await L1_Pool.balanceOf(poolTokenEscrow.address)).toString()}`)
    console.log("Balance of DAI in L1_Pool: ", `${await L1_ERC20.balanceOf(L1_Pool.address)}`);
    console.log("Balance of L2_Pool tokens: ", `${await L2_Pool.balanceOf(l2Wallet.address)}`);
    console.log("Total assets in yearn vault:", (await L1_YearnVault.totalAssets()).toString());

    // withdrawing DAI from L1_Pool
    console.log("Pool Withdrawal (L2->L1->L2) ...");
    const withdrawTx = await L2_Pool.connect(l2Wallet).requestWithdrawal(2500, { gasLimit: 8900000, gasPrice: 0 });
    //const revertReason3 = await getOptimismRevertReason({tx: withdrawTx, provider: l2RpcProvider });

    //if (revertReason3) {
    //  console.log(revertReason3);
    //}

    await withdrawTx.wait();

    console.log("waiting for Pool Withdrawal to be relayed to Layer 2 ...")
    const [withdrawHash] = await watcher.getMessageHashesFromL2Tx(withdrawTx.hash);
    console.log("withdrawHash:", withdrawHash);
    await watcher.getL1TransactionReceipt(withdrawHash)

    await new Promise((resolve) => {
        setTimeout(() => {
            resolve(true)
        }, 5000);
    });

    console.log(`oDAI in L2 wallet ${await L2_ERC20.balanceOf(l2Wallet.address)}`);
    console.log("Balance of DAI in L2_Pool: ", `${await L2_ERC20.balanceOf(L2_Pool.address)}`);
    console.log("Total assets in yearn vault:", (await L1_YearnVault.totalAssets()).toString());

    // const pool = BatchWithdrawablePoolAdapter.fromContract(L2_Pool as BatchWithdrawablePool);

    // console.log("withdrawal summaries", (await pool.getWithdrawalSummaries(l2Wallet.address)));


    // // deposit oDAI into L1_Pool
    // console.log("Depositing oDAI into L1_Pool ... ");
    // const depositTx2 = await L2_Pool.connect(l2Wallet).deposit(200, { gasLimit: 8900000, gasPrice: 0 });
    // // const revertReason2 = await getOptimismRevertReason({ tx: depositTx2, provider: l2RpcProvider });

    // // if (revertReason2) {
    // //     console.log(revertReason2);
    // // }

    // await depositTx2.wait();


    // console.log(" waiting for Pool deposit to be relayed to L1 ...")
    // const [depositHash2] = await watcher.getMessageHashesFromL2Tx(depositTx2.hash);
    // await watcher.getL1TransactionReceipt(depositHash2);

    // console.log(`poolTokenEscrow balance ... ${(await L1_Pool.balanceOf(poolTokenEscrow.address)).toString()}`)
    // console.log("Balance of DAI in L1_Pool: ", `${await L1_ERC20.balanceOf(L1_Pool.address)}`);
    // console.log("Balance of L2_Pool tokens: ", `${await L2_Pool.balanceOf(l2Wallet.address)}`);
    // console.log("Total assets in yearn vault:", (await L1_YearnVault.totalAssets()).toString());

    // // withdrawing DAI from L1_Pool
    // console.log("Pool Withdrawal (L2->L1->L2) ...");
    // const withdrawTx2 = await L2_Pool.connect(l2Wallet).requestWithdrawal(200, { gasLimit: 8900000, gasPrice: 0 });
    // // const revertReason3 = await getOptimismRevertReason({ tx: withdrawTx2, provider: l2RpcProvider });

    // // if (revertReason3) {
    // //     console.log(revertReason3);
    // // }

    // await withdrawTx2.wait();

    // console.log("waiting for Pool Withdrawal to be relayed to Layer 2 ...")
    // const [withdrawHash2] = await watcher.getMessageHashesFromL2Tx(withdrawTx2.hash);
    // console.log("withdrawHash:", withdrawHash2);
    // await watcher.getL1TransactionReceipt(withdrawHash2)

    // await new Promise((resolve) => {
    //     setTimeout(() => {
    //         resolve(true)
    //     }, 5000);
    // });

    // console.log(`oDAI in L2 wallet ${await L2_ERC20.balanceOf(l2Wallet.address)}`);
    // console.log("Balance of DAI in L2_Pool: ", `${await L2_ERC20.balanceOf(L2_Pool.address)}`);
    // console.log("Total assets in yearn vault:", (await L1_YearnVault.totalAssets()).toString());

    // console.log("withdrawal summaries", (await pool.getWithdrawalSummaries(l2Wallet.address)));




    console.log(`
    PASTE THE FOLLOWING LINES IN .env:
    
    REACT_APP_L1_DAI_ADDRESS=${L1_ERC20.address}
    REACT_APP_L2_DAI_ADDRESS=${L2_ERC20.address}
    REACT_APP_L1_POOL_ADDRESS=${L1_Pool.address}
    REACT_APP_L2_POOL_ADDRESS=${L2_Pool.address}
    REACT_APP_L1_TOKEN_GATEWAY_ADDRESS=${L1StandardBridge.address}
    REACT_APP_L2_TOKEN_GATEWAY_ADDRESS=${L2StandardBridge.address}
    `)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    })


export { }