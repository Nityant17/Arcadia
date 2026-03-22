export class StorageClient {
  constructor(
    _bucketName: string,
    _gatewayUrl: string,
    _backendCanisterId: string,
    _projectId: string,
    _agent: unknown,
  ) {}

  async putFile(_bytes: Uint8Array, _onProgress?: (percentage: number) => void) {
    throw new Error("Storage client is disabled in FastAPI mode.");
  }

  async getDirectURL(_hash: string) {
    throw new Error("Storage client is disabled in FastAPI mode.");
  }
}
