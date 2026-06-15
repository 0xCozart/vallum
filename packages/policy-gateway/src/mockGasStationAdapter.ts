import { randomUUID } from "node:crypto";

import type { AgentTransactionManifest } from "@agentrail/manifest";
import type { AgentPolicyDecision } from "./policySchema.js";

export interface MockSponsorshipReservation {
  readonly sponsorshipId: string;
}

export interface MockGasStationAdapter {
  reserve: (request: MockSponsorshipRequest) => Promise<MockSponsorshipReservation> | MockSponsorshipReservation;
}

export interface MockSponsorshipRequest {
  readonly manifest: AgentTransactionManifest;
  readonly decision: Extract<AgentPolicyDecision, { allowed: true }>;
}

export function createMockGasStationAdapter(): MockGasStationAdapter {
  return {
    reserve: () => ({
      sponsorshipId: `mock_sponsorship_${randomUUID()}`,
    }),
  };
}
