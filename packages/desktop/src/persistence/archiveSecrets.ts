import { appDataDir, join } from "@tauri-apps/api/path";
import { type Client, Stronghold } from "@tauri-apps/plugin-stronghold";

const VAULT_FILE = "archive-secrets.hold";
const CLIENT_NAME = "archive-passwords";

let activeStronghold: Stronghold | null = null;
let activeClient: Client | null = null;

export class VaultPasswordRequiredError extends Error {
  constructor() {
    super("MasterPasswordRequired");
    this.name = "VaultPasswordRequiredError";
  }
}

async function getVaultPath(): Promise<string> {
  return join(await appDataDir(), VAULT_FILE);
}

async function loadStronghold(masterPassword?: string): Promise<Stronghold> {
  if (activeStronghold) return activeStronghold;
  if (!masterPassword) throw new VaultPasswordRequiredError();

  activeStronghold = await Stronghold.load(
    await getVaultPath(),
    masterPassword,
  );
  return activeStronghold;
}

async function loadClient(
  stronghold: Stronghold,
  createIfMissing: boolean,
): Promise<Client | null> {
  if (activeClient) return activeClient;
  try {
    activeClient = await stronghold.loadClient(CLIENT_NAME);
  } catch {
    if (!createIfMissing) return null;
    activeClient = await stronghold.createClient(CLIENT_NAME);
  }
  return activeClient;
}

export async function saveArchiveSecret(
  vaultKey: string,
  password: string,
  masterPassword?: string,
): Promise<void> {
  const stronghold = await loadStronghold(masterPassword);
  const client = await loadClient(stronghold, true);
  if (!client) throw new Error("Failed to initialize Stronghold client");

  await client
    .getStore()
    .insert(vaultKey, Array.from(new TextEncoder().encode(password)));
  await stronghold.save();
}

export async function loadArchiveSecret(
  vaultKey: string,
  masterPassword: string,
): Promise<string | null> {
  const stronghold = await loadStronghold(masterPassword);
  const client = await loadClient(stronghold, false);
  if (!client) return null;

  const value = await client.getStore().get(vaultKey);
  return value ? new TextDecoder().decode(value) : null;
}

export async function loadArchiveSecretFromActiveVault(
  vaultKey: string,
): Promise<string | null> {
  if (!activeStronghold) return null;
  const client = await loadClient(activeStronghold, false);
  if (!client) return null;

  const value = await client.getStore().get(vaultKey);
  return value ? new TextDecoder().decode(value) : null;
}
