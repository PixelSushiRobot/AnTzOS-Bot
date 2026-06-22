import type { IChainVerifier } from "./IChainVerifier.js";

type EtherscanResponse<T> = {
  status?: string;
  message?: string;
  result?: T;
};

type EtherscanSignatureRecord = {
  message?: unknown;
};

type EtherscanTokenBalanceRecord = {
  balance?: unknown;
  TokenQuantity?: unknown;
  tokenQuantity?: unknown;
};

const EVM_CHAIN_IDS = ["1", "8453", "42161"] as const;

export class EthVerifier implements IChainVerifier {
  public readonly chainName = "ethereum";

  private readonly apiKey: string;

  public constructor(apiKey = process.env.ETHERSCAN_API_KEY ?? "") {
    this.apiKey = apiKey;
  }

  public async verifyOwnership(
    walletAddress: string,
    expectedCode: string,
  ): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const params = new URLSearchParams({
        chainid: "1",
        module: "account",
        action: "getverifiedsignatures",
        address: walletAddress,
        apikey: this.apiKey,
      });
      const url = `https://api.etherscan.io/v2/api?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json()) as EtherscanResponse<
        EtherscanSignatureRecord[]
      >;

      if (!Array.isArray(payload.result)) {
        return false;
      }

      return payload.result.some((signature) => {
        return (
          typeof signature.message === "string" &&
          signature.message.includes(expectedCode)
        );
      });
    } catch {
      return false;
    }
  }

  public async verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    for (const chainId of EVM_CHAIN_IDS) {
      try {
        const params = new URLSearchParams({
          chainid: chainId,
          module: "account",
          action: "addresstokenbalance",
          address: walletAddress,
          contractaddress: contractAddress,
          apikey: this.apiKey,
        });
        const url = `https://api.etherscan.io/v2/api?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
          continue;
        }

        const payload = (await response.json()) as EtherscanResponse<
          EtherscanTokenBalanceRecord[] | EtherscanTokenBalanceRecord | string
        >;

        if (this.hasPositiveBalance(payload.result)) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  private hasPositiveBalance(
    result: EtherscanTokenBalanceRecord[] | EtherscanTokenBalanceRecord | string | undefined,
  ): boolean {
    if (Array.isArray(result)) {
      return result.some((tokenBalance) => this.getBalanceValue(tokenBalance) > 0);
    }

    if (typeof result === "string") {
      return Number(result) > 0;
    }

    if (result && typeof result === "object") {
      return this.getBalanceValue(result) > 0;
    }

    return false;
  }

  private getBalanceValue(tokenBalance: EtherscanTokenBalanceRecord): number {
    const value =
      tokenBalance.balance ??
      tokenBalance.TokenQuantity ??
      tokenBalance.tokenQuantity;

    return Number(value);
  }
}
