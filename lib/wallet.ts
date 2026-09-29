// Wallet / signing seam for Canton Resilience.
//
// In production the privileged action is signed by the acting party's wallet
// (the hackathon target is **Grofty**). That signing happens client-side and
// the signature travels with the ledger command. This project keeps the ledger
// integration real (see app/api/ledger/route.ts) and treats the wallet as a
// well-defined seam so a real adapter can drop in without touching the console.
//
// A real adapter would wrap Grofty (no public SDK yet) or the published
// `@canton-network/wallet-sdk` (v1.5.x on npm): `connect()` opens the wallet and
// returns the party's on-ledger id; `sign()` produces a signature over the
// command payload that the participant verifies. Until that infrastructure is
// wired, `DemoWallet` stands in — it is explicitly a local stand-in and performs
// no cryptographic signing.

export interface SignRequest {
  application: string;
  verb: string;
  reference: string;
}

export interface WalletAdapter {
  readonly id: string;
  readonly label: string; // shown in the UI, e.g. "Grofty"
  readonly real: boolean; // true only when backed by a real signing SDK
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sign(req: SignRequest): Promise<{ signature: string }>;
}

// Local stand-in used for the LocalNet demo. No real signature is produced; the
// participant accepts the command because the server route acts as the party
// (dev tokens). Clearly not production signing — that's the whole point of the seam.
class DemoWallet implements WalletAdapter {
  readonly id = 'demo';
  readonly label = 'Grofty';
  readonly real = false;
  private connected = false;

  async connect() {
    this.connected = true;
  }
  async disconnect() {
    this.connected = false;
  }
  async sign(req: SignRequest) {
    if (!this.connected) throw new Error('Connect a wallet before signing');
    // Deterministic, non-cryptographic placeholder reference.
    return { signature: `demo:${req.application}:${req.verb}:${req.reference}` };
  }
}

let singleton: WalletAdapter | null = null;

export function getWallet(): WalletAdapter {
  if (!singleton) singleton = new DemoWallet();
  return singleton;
}
