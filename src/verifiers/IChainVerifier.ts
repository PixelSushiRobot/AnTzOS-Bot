export interface IChainVerifier {
  chainName: string;

  verifyOwnership(
    walletAddress: string,
    expectedCode: string,
    inputPayload?: string,
  ): Promise<boolean>;

  verifyAssetOwnership(
    walletAddress: string,
    contractAddress: string,
  ): Promise<boolean>;
}
