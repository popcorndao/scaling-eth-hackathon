const ethers = require('ethers')
const { Watcher } = require('@eth-optimism/watcher')
const { getContractFactory } = require('@eth-optimism/contracts')
const { getOptimismRevertReason } = require('./utils/revertOptimism');
// Set up some contract factories. You can ignore this stuff.
const factory = (name, ovm = false, mocks= false) => {
  const artifact = require(`./artifacts${ovm ? '-ovm' : ''}/contracts/${mocks ? '/mocks/' : ''}${name}.sol/${name}.json`)
  return new ethers.ContractFactory(artifact.abi, artifact.bytecode)
}
const factory__L1_ERC20 = factory('ERC20')
const factory__L2_ERC20 = factory('L2DepositedERC20', true)
const factory__L1_ERC20Gateway = getContractFactory('OVM_L1ERC20Gateway')
const factory__L1_Pool = factory('L1_Pool');
const factory__L2_Pool = factory('L2_Pool', true);
const factory__L1_MockYearnVault = factory('MockYearnV2Vault', false, true);
const factory__L1_MockCurveDepositZap = factory('MockCurveDepositZap', false, true);

async function main() {
  // Set up our RPC provider connections.
  const l1RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:9545')
  const l2RpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:8545')

  // Set up our wallets (using a default private key with 10k ETH allocated to it).
  // Need two wallets objects, one for interacting with L1 and one for interacting with L2.
  // Both will use the same private key.
  const key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  const l1Wallet = new ethers.Wallet(key, l1RpcProvider)
  const l2Wallet = new ethers.Wallet(key, l2RpcProvider)

  // L1 messenger address depends on the deployment, this is default for our local deployment.
  const l1MessengerAddress = '0x59b670e9fA9D0A427751Af201D676719a970857b'
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
  console.log('Deploying L1 mockDAI...')
  const L1_mockDAI = await factory__L1_ERC20.connect(l1Wallet).deploy(
    1234, //initialSupply
    'mockDAI', //name
  )
  await L1_mockDAI.deployTransaction.wait()
  console.log("L1_mockDAI address: ",L1_mockDAI.address)


  console.log("Deploying L1_CurveDepositZap ...");
  const L1_CurveDepositZap = await factory__L1_MockCurveDepositZap.connect(l1Wallet).deploy(
    L1_mockDAI.address
  )
  await L1_CurveDepositZap.deployTransaction.wait();

  console.log("L1_CurveDepositZap address: ",L1_CurveDepositZap.address)

  console.log("Deploying L1_MockYearnVault ...");
  const L1_YearnVault = await factory__L1_MockYearnVault.connect(l1Wallet).deploy(
    L1_CurveDepositZap.address
  );
  await L1_YearnVault.deployTransaction.wait();

  console.log("L1_YearnVault address: ",L1_YearnVault.address)


  // Deploy the paired ERC20 token to L2.
  console.log('Deploying L2 ERC20...')
  const L2_oDAI = await factory__L2_ERC20.connect(l2Wallet).deploy(
    l2MessengerAddress,
    'oDAI', //name
    {
      gasPrice: 0,
      gasLimit: 8900000
    }
  )
  await L2_oDAI.deployTransaction.wait()

  console.log("L2_oDAI address: ",L2_oDAI.address)


  // Create a gateway that connects the two contracts.
  console.log('Deploying L1 ERC20 Gateway...')
  const L1_ERC20Gateway = await factory__L1_ERC20Gateway.connect(l1Wallet).deploy(
    L1_mockDAI.address,
    L2_oDAI.address,
    l1MessengerAddress
  )
  await L1_ERC20Gateway.deployTransaction.wait()

  console.log("L1_ERC20Gateway address: ",L1_ERC20Gateway.address)

  console.log("Deploying L1_Pool ...")
  const L1_Pool = await factory__L1_Pool.connect(l1Wallet).deploy(
    L1_mockDAI.address,
    L1_YearnVault.address,
    L1_CurveDepositZap.address,
    l1MessengerAddress,
    L1_ERC20Gateway.address
  )
  await L1_Pool.deployTransaction.wait();

  console.log("L1_Pool address: ",L1_Pool.address)


  console.log("Deploying L2_Pool ...")
  const L2_Pool = await factory__L2_Pool.connect(l2Wallet).deploy(
    L2_oDAI.address,
    L1_Pool.address,
    l2MessengerAddress,
    { gasPrice: 0, gasLimit: 8900000 }
  )
  //const revertReason1 = await getOptimismRevertReason({tx: L2_Pool.deployTransaction, provider: l2RpcProvider });
  //if(revertReason1){
  //  console.log(revertReason1)
  //}

  await L2_Pool.deployTransaction.wait();

  console.log("L2_Pool address: ",L2_Pool.address)

  console.log('Setting L2_Pool address on L1_Pool ...');
  const setL2PoolTx = await L1_Pool.connect(l1Wallet).setL2Pool(L2_Pool.address);
  await setL2PoolTx.wait();

  console.log("L2 Pool address on L1 Pool set to:",  await L1_Pool.L2_Pool());

  // Make the L2 ERC20 aware of the gateway contract.
  console.log('Initializing L2 ERC20...')
  const tx0 = await L2_oDAI.init(
    L1_ERC20Gateway.address,
    {
      gasPrice: 0
    }
  )
  await tx0.wait()

  // Initial balances.
  console.log(`Balance on L1: ${await L1_mockDAI.balanceOf(l1Wallet.address)}`) // 1234
  console.log(`Balance on L2: ${await L2_oDAI.balanceOf(l1Wallet.address)}`) // 0

  // Allow the gateway to lock up some of our tokens.
  console.log('Approving tokens for ERC20 gateway...')
  const tx1 = await L1_mockDAI.approve(L1_ERC20Gateway.address, 1234)
  await tx1.wait()

  // Lock the tokens up inside the gateway and ask the L2 contract to mint new ones.
  console.log('Depositing tokens into L2 ERC20...')
  const tx2 = await L1_ERC20Gateway.deposit(1234)
  await tx2.wait()

  // Wait for the message to be relayed to L2.
  console.log('Waiting for deposit to be relayed to L2...')
  const [ msgHash1 ] = await watcher.getMessageHashesFromL1Tx(tx2.hash)
  await watcher.getL2TransactionReceipt(msgHash1)

  // Log some balances to see that it worked!
  console.log(`Balance on L1: ${await L1_mockDAI.balanceOf(l1Wallet.address)}`) // 0
  console.log(`Balance on L2: ${await L2_oDAI.balanceOf(l1Wallet.address)}`) // 1234


  // allow L2_Pool to use our tokens
  console.log("Approving L2_Pool to spend oDAI ... ");
  const approveTx = await L2_oDAI.connect(l2Wallet).approve(L2_Pool.address, 1234, { gasLimit: 8900000, gasPrice: 0})
  await approveTx.wait();


  // deposit oDAI into L1_Pool
  console.log("Depositing oDAI into L1_Pool ... ");
  const depositTx = await L2_Pool.connect(l2Wallet).deposit(1234, { gasLimit: 8900000, gasPrice: 0});
  //const revertReason2 = await getOptimismRevertReason({tx: depositTx, provider: l2RpcProvider });
  
  //if (revertReason2) {
  //  console.log(revertReason2);
  //}

  await depositTx.wait();

  console.log(" waiting for Pool deposit to be relayed to L1 ...")
  const [depositHash] = await watcher.getMessageHashesFromL2Tx(depositTx.hash);
  await watcher.getL1TransactionReceipt(depositHash);

  console.log("Balance of DAI in L1_Pool: ", `${await L1_mockDAI.balanceOf(L1_Pool.address)}`);
  console.log("Total assets in yearn vault:" , (await L1_YearnVault.totalAssets()).toString());


  // withdrawing DAI from L1_Pool
  console.log("Pool Withdrawal (L2->L1->L2) ...");
  const withdrawTx = await L2_Pool.connect(l2Wallet).withdraw(1234, { gasLimit: 8900000, gasPrice: 0});
  //const revertReason3 = await getOptimismRevertReason({tx: withdrawTx, provider: l2RpcProvider });
  
  //if (revertReason3) {
  //  console.log(revertReason3);
  //}

  await withdrawTx.wait();

  console.log("waiting for Pool Withdrawal to be relayed to Layer 2 ...")
  const [withdrawHash] = await watcher.getMessageHashesFromL2Tx(withdrawTx.hash);
  console.log("withdrawHash:" ,withdrawHash);
  await watcher.getL1TransactionReceipt(withdrawHash)

  console.log(`oDAI in L2 wallet ${await L2_oDAI.balanceOf(l2Wallet.address)}`);
  console.log("Total assets in yearn vault:" , (await L1_YearnVault.totalAssets()).toString());
  



  /** 

  // Burn the tokens on L2 and ask the L1 contract to unlock on our behalf.
  console.log(`Withdrawing tokens back to L1 ERC20...`)
  const tx3 = await L2_oDAI.withdraw(
    1234,
    {
      gasPrice: 0
    }
  )
  await tx3.wait()

  // Wait for the message to be relayed to L1.
  console.log(`Waiting for withdrawal to be relayed to L1...`)
  const [ msgHash2 ] = await watcher.getMessageHashesFromL2Tx(tx3.hash)
  await watcher.getL1TransactionReceipt(msgHash2)

  // Log balances again!
  console.log(`Balance on L1: ${await L1_mockDAI.balanceOf(l1Wallet.address)}`) // 1234
  console.log(`Balance on L2: ${await L2_oDAI.balanceOf(l1Wallet.address)}`) // 0
  **/
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
