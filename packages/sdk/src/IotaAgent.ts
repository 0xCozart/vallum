import { requestSponsoredAction } from "./requestSponsoredAction.js";
import type { SponsoredActionRequest, SponsoredActionResult } from "./types.js";

export interface IotaAgentOptions {
  readonly gatewayBaseUrl: string;
  readonly apiKey: string;
  readonly fetchImpl?: typeof fetch;
}

export class IotaAgent {
  constructor(private readonly options: IotaAgentOptions) {}

  async requestSponsoredAction(request: SponsoredActionRequest): Promise<SponsoredActionResult> {
    return requestSponsoredAction({
      baseUrl: this.options.gatewayBaseUrl,
      apiKey: this.options.apiKey,
      fetchImpl: this.options.fetchImpl,
      manifest: request.manifest,
    });
  }
}
