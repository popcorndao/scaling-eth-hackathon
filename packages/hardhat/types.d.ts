declare namespace Chai {
  interface Assertion extends LanguageChains, NumericComparison, TypeComparison {
    reverted: AsyncAssertion;
    revertedWith(reason: string): AsyncAssertion;
    emit(contract: any, eventName: string): EmitAssertion;
    properHex(length: number): void;
    properPrivateKey: void;
    properAddress: void;
    changeBalance(wallet: any, balance: any): AsyncAssertion;
    changeBalances(wallets: any[], balances: any[]): AsyncAssertion;
    changeTokenBalance(token: any, wallet: any, balance: any): AsyncAssertion;
    changeTokenBalances(token: any, wallets: any[], balances: any[]): AsyncAssertion;
  }

  interface NumberComparer {
    (value: any, message?: string): Assertion;
  }

  interface AsyncAssertion extends Assertion, Promise<void> {
  }

  interface EmitAssertion extends AsyncAssertion {
    withArgs(...args: any[]): AsyncAssertion;
  }
}