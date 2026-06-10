export type ContractTemplateRiskCategory = "low" | "medium" | "high";

export interface ContractTemplateMetadata {
  readonly templateId: string;
  readonly version: string;
  readonly packageId: string;
  readonly module: string;
  readonly entryFunctions: readonly string[];
  readonly allowedActions: readonly string[];
  readonly riskCategory: ContractTemplateRiskCategory;
  readonly receiptEvents: readonly string[];
  readonly requiredManifestFields: readonly string[];
  readonly refundDisputeBehavior: string;
}

export interface ContractTemplateAction {
  readonly templateId?: string;
  readonly templateVersion?: string;
  readonly packageId: string;
  readonly module?: string;
  readonly functionName: string;
}

export type ContractTemplateDecision =
  | {
      readonly allowed: true;
      readonly template: ContractTemplateMetadata;
    }
  | {
      readonly allowed: false;
      readonly reasonCode:
        | "CONTRACT_TEMPLATE_NOT_REGISTERED"
        | "CONTRACT_TEMPLATE_VERSION_MISMATCH"
        | "CONTRACT_PACKAGE_NOT_REGISTERED"
        | "CONTRACT_MODULE_NOT_REGISTERED"
        | "CONTRACT_FUNCTION_NOT_REGISTERED";
      readonly message: string;
    };

export interface ContractTemplateRegistry {
  readonly templates: readonly ContractTemplateMetadata[];
  readonly findTemplate: (templateId: string, version: string) => ContractTemplateMetadata | undefined;
  readonly findTemplateVersions: (templateId: string) => readonly ContractTemplateMetadata[];
}

export const escrowContractTemplateV1: ContractTemplateMetadata = {
  templateId: "escrow_v1",
  version: "1.0.0",
  packageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
  module: "escrow",
  entryFunctions: ["open_escrow", "release_escrow", "refund_escrow"],
  allowedActions: ["open_escrow", "release_escrow", "refund_escrow"],
  riskCategory: "medium",
  receiptEvents: ["escrow_opened", "escrow_released", "escrow_refunded"],
  requiredManifestFields: ["agent", "owner", "spend", "action", "counterparty", "receipt"],
  refundDisputeBehavior: "Verifier release or expiry/refund state transition.",
};

export const receiptContractTemplateV1: ContractTemplateMetadata = {
  templateId: "receipt_v1",
  version: "1.0.0",
  packageId: "0x4444444444444444444444444444444444444444444444444444444444444444",
  module: "receipt",
  entryFunctions: ["create_receipt", "mark_released", "mark_refunded"],
  allowedActions: ["create_receipt", "mark_released", "mark_refunded"],
  riskCategory: "low",
  receiptEvents: ["receipt_created", "receipt_released", "receipt_refunded"],
  requiredManifestFields: ["agent", "owner", "action", "receipt"],
  refundDisputeBehavior: "Records external escrow outcome without independently settling funds.",
};

export const payPerCallContractTemplateV1: ContractTemplateMetadata = {
  templateId: "pay_per_call_v1",
  version: "1.0.0",
  packageId: "0x5555555555555555555555555555555555555555555555555555555555555555",
  module: "pay_per_call",
  entryFunctions: ["request_call", "deliver", "refund"],
  allowedActions: ["request_call", "deliver", "refund"],
  riskCategory: "medium",
  receiptEvents: ["pay_per_call_created", "submitted", "completed", "failed"],
  requiredManifestFields: ["agent", "owner", "spend", "action", "counterparty", "receipt"],
  refundDisputeBehavior: "Provider delivery after payment confirmation or refund/fail before result delivery.",
};

export const dataLicenseContractTemplateV1: ContractTemplateMetadata = {
  templateId: "data_license_v1",
  version: "1.0.0",
  packageId: "0x6666666666666666666666666666666666666666666666666666666666666666",
  module: "data_license",
  entryFunctions: ["request_license", "grant_access", "revoke_access"],
  allowedActions: ["request_license", "grant_access", "revoke_access"],
  riskCategory: "medium",
  receiptEvents: ["data_license_created", "access_granted", "access_revoked", "failed"],
  requiredManifestFields: ["agent", "owner", "spend", "action", "counterparty", "receipt"],
  refundDisputeBehavior: "Provider grants scoped access after policy approval or revokes access with receipt evidence.",
};

export const defaultContractTemplates = [
  escrowContractTemplateV1,
  receiptContractTemplateV1,
  payPerCallContractTemplateV1,
  dataLicenseContractTemplateV1,
] as const;

export const defaultContractTemplateRegistry = createContractTemplateRegistry(defaultContractTemplates);

export function createContractTemplateRegistry(
  templates: readonly ContractTemplateMetadata[],
): ContractTemplateRegistry {
  const byTemplateVersion = new Map<string, ContractTemplateMetadata>();
  const byTemplate = new Map<string, ContractTemplateMetadata[]>();

  for (const template of templates) {
    byTemplateVersion.set(templateKey(template.templateId, template.version), template);
    const versions = byTemplate.get(template.templateId) ?? [];
    versions.push(template);
    byTemplate.set(template.templateId, versions);
  }

  return {
    templates: Object.freeze([...templates]),
    findTemplate(templateId: string, version: string): ContractTemplateMetadata | undefined {
      return byTemplateVersion.get(templateKey(templateId, version));
    },
    findTemplateVersions(templateId: string): readonly ContractTemplateMetadata[] {
      return Object.freeze([...(byTemplate.get(templateId) ?? [])]);
    },
  };
}

export function evaluateContractTemplateAction(
  registry: ContractTemplateRegistry,
  action: ContractTemplateAction,
): ContractTemplateDecision {
  if (!action.templateId || !action.templateVersion) {
    return reject(
      "CONTRACT_TEMPLATE_NOT_REGISTERED",
      "Contract action is missing template id or version metadata.",
    );
  }

  const template = registry.findTemplate(action.templateId, action.templateVersion);
  if (!template) {
    const knownVersions = registry.findTemplateVersions(action.templateId);
    return reject(
      knownVersions.length > 0 ? "CONTRACT_TEMPLATE_VERSION_MISMATCH" : "CONTRACT_TEMPLATE_NOT_REGISTERED",
      "Contract template id and version are not registered.",
    );
  }

  if (template.packageId !== action.packageId) {
    return reject("CONTRACT_PACKAGE_NOT_REGISTERED", "Contract package does not match approved template metadata.");
  }
  if (template.module !== action.module) {
    return reject("CONTRACT_MODULE_NOT_REGISTERED", "Contract module does not match approved template metadata.");
  }
  if (!template.entryFunctions.includes(action.functionName)) {
    return reject("CONTRACT_FUNCTION_NOT_REGISTERED", "Contract function does not match approved template metadata.");
  }

  return { allowed: true, template };
}

function templateKey(templateId: string, version: string): string {
  return `${templateId}@${version}`;
}

function reject(
  reasonCode: Exclude<ContractTemplateDecision, { allowed: true }>["reasonCode"],
  message: string,
): ContractTemplateDecision {
  return { allowed: false, reasonCode, message };
}
