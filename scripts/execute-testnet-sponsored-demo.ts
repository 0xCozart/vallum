import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import { toBase64 } from "@iota/bcs";

import { loadEnvFile } from "../apps/policy-gateway-service/src/readiness.js";
import { createGasKitClient } from "../packages/sdk/src/index.js";

const DEMO_PACKAGE_ID = "0x9b936476bb6a4b88d7c1dd84643f4bdced3cc6cad351e288fc95d1033f05d8f0";
const DEMO_MODULE = "demo_badge";
const DEMO_FUNCTION = "mint_badge";
const GAS_BUDGET = 50_000_000;

interface CliOptions {
  envFile: string;
  help: boolean;
}

const usage = `usage: npm exec tsx -- scripts/execute-testnet-sponsored-demo.ts [--env-file <path>]

Runs one real IOTA testnet sponsored execute against the configured local policy gateway and Gas Station.
Requires a live policy gateway, live Gas Station, and a local .env with IOTA_RPC_URL and GASKIT_DEMO_APP_KEY.
The script generates an ephemeral user key for the sender and never prints private keys or bearer tokens.`;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { envFile: ".env", help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      const value = argv[index + 1];
      if (!value) throw new Error("--env-file requires a path.");
      options.envFile = value;
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function requireEnv(env: Record<string, string>, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`Missing required env value ${key}.`);
  return value;
}

function gatewayBaseUrl(env: Record<string, string>): string {
  const host = env.GASKIT_GATEWAY_HOST || "127.0.0.1";
  const port = env.GASKIT_GATEWAY_PORT || "8787";
  return `http://${host}:${port}`;
}

async function main(): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid arguments.");
    return 2;
  }

  if (options.help) {
    console.log(usage);
    return 0;
  }

  try {
    const env = await loadEnvFile(options.envFile);
    const rpcUrl = requireEnv(env, "IOTA_RPC_URL");
    const appKey = requireEnv(env, "GASKIT_DEMO_APP_KEY");
    const baseUrl = gatewayBaseUrl(env);
    const iota = new IotaClient({ url: rpcUrl });
    const user = Ed25519Keypair.generate();
    const userAddress = user.toIotaAddress();
    const gasKit = createGasKitClient({ baseUrl, apiKey: appKey });

    console.log(`gatewayBaseUrl=${baseUrl}`);
    console.log(`iotaRpcUrl=${rpcUrl}`);
    console.log(`demoTarget=${DEMO_PACKAGE_ID}::${DEMO_MODULE}::${DEMO_FUNCTION}`);
    console.log(`ephemeralUserAddress=${userAddress}`);

    const reservation = await gasKit.reserveGas({
      gasBudget: GAS_BUDGET,
      reserveDurationSecs: 120,
      walletAddress: userAddress,
      packageId: DEMO_PACKAGE_ID,
      functionName: DEMO_FUNCTION,
    });
    const gasCoin = reservation.gasCoins?.[0] as { objectId?: string; version?: string | number; digest?: string } | undefined;
    if (!reservation.sponsorAddress) throw new Error("Gas Station reserve response did not include result.sponsor_address.");
    if (!gasCoin?.objectId || gasCoin.version === undefined || !gasCoin.digest) {
      throw new Error("Gas Station reserve response did not include a usable gas coin reference.");
    }

    console.log(`reservedGas=true`);
    console.log(`reservationId=${reservation.reservationId}`);
    console.log(`gasKitTransactionId=${reservation.gasKitTransactionId}`);
    console.log(`sponsorAddress=${reservation.sponsorAddress}`);

    const tx = new Transaction();
    tx.setSender(userAddress);
    tx.setGasOwner(reservation.sponsorAddress);
    tx.setGasBudget(GAS_BUDGET);
    tx.setGasPayment([{ objectId: gasCoin.objectId, version: gasCoin.version, digest: gasCoin.digest }]);
    tx.moveCall({ target: `${DEMO_PACKAGE_ID}::${DEMO_MODULE}::${DEMO_FUNCTION}` });

    const transactionBytes = await tx.build({ client: iota });
    const { signature } = await user.signTransaction(transactionBytes);
    const executed = await gasKit.executeSponsoredTransaction({
      reservationId: reservation.reservationId,
      gasKitTransactionId: reservation.gasKitTransactionId,
      transactionBytes: toBase64(transactionBytes),
      userSignature: signature,
    });

    if (!executed.digest) throw new Error("Execute response did not include effects.transactionDigest or digest.");
    console.log(`executed=true`);
    console.log(`transactionDigest=${executed.digest}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Sponsored testnet execute failed unexpectedly.");
    return 1;
  }
}

process.exitCode = await main();
