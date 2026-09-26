import type { DemoApplication } from './types';

// Ledger abstraction for the Canton Resilience control layer.
//
// The UI never talks to a participant directly — it goes through this
// interface. `InMemoryLedger` reproduces the exact guards of the Daml
// choices in daml/Main.daml so the demo runs with no external dependency,
// and `HttpLedger` is a drop-in that proxies the same operations through the
// same-origin Next.js route (app/api/ledger/route.ts), which submits them to
// a real Canton participant over the Daml HTTP JSON API v1.
//
// Approvals are append-only, matching the ledger: `ActionRequest.Approve`
// creates a new contract state, it never "un-approves". `revoke` exists only
// for the local demo reset and is unsupported against a real ledger.

export interface RequestView {
  approvals: string[]; // party ids that have approved
  executed: boolean;
}

export interface ResilienceLedger {
  readonly kind: 'in-memory' | 'json-api';
  openRequest(app: DemoApplication): Promise<void>;
  approve(app: DemoApplication, partyId: string): Promise<void>;
  revoke(app: DemoApplication, partyId: string): Promise<void>;
  execute(app: DemoApplication, executor: string): Promise<void>;
  view(app: DemoApplication): Promise<RequestView>;
}

// --- In-memory implementation (default) -----------------------------------
// Mirrors daml/Main.daml: member checks, no double approval, threshold gate.

class InMemoryLedger implements ResilienceLedger {
  readonly kind = 'in-memory' as const;
  private state = new Map<string, RequestView>();

  private ensure(app: DemoApplication): RequestView {
    let v = this.state.get(app.id);
    if (!v) {
      v = { approvals: [], executed: false };
      this.state.set(app.id, v);
    }
    return v;
  }

  async openRequest(app: DemoApplication) {
    this.state.set(app.id, { approvals: [], executed: false });
  }

  async approve(app: DemoApplication, partyId: string) {
    const v = this.ensure(app);
    if (v.executed) throw new Error('Action already executed');
    if (!app.parties.some((p) => p.id === partyId))
      throw new Error('Approver is not a policy member');
    if (!v.approvals.includes(partyId)) v.approvals.push(partyId);
  }

  async revoke(app: DemoApplication, partyId: string) {
    const v = this.ensure(app);
    if (v.executed) return;
    v.approvals = v.approvals.filter((id) => id !== partyId);
  }

  async execute(app: DemoApplication, _executor: string) {
    const v = this.ensure(app);
    if (v.approvals.length < app.threshold)
      throw new Error('Approval threshold not met');
    v.executed = true;
  }

  async view(app: DemoApplication): Promise<RequestView> {
    const v = this.ensure(app);
    return { approvals: [...v.approvals], executed: v.executed };
  }
}

// --- HTTP proxy implementation (Daml JSON API v1, via /api/ledger) ---------
// Active when NEXT_PUBLIC_LEDGER_MODE=json-api. The browser only ever talks to
// the same-origin Next.js route app/api/ledger/route.ts, which owns the JWT
// minting and Canton participant connection. Approvals are append-only here,
// exactly as on the ledger — there is no `revoke`.

class HttpLedger implements ResilienceLedger {
  readonly kind = 'json-api' as const;

  private async call(op: string, app: DemoApplication, partyId?: string): Promise<any> {
    const res = await fetch('/api/ledger', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op, appId: app.id, partyId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? `Ledger request failed (${res.status})`);
    return data;
  }

  async openRequest(app: DemoApplication) {
    await this.call('openRequest', app);
  }

  async approve(app: DemoApplication, partyId: string) {
    await this.call('approve', app, partyId);
  }

  async revoke(): Promise<void> {
    throw new Error('Approvals are append-only on a real ledger');
  }

  async execute(app: DemoApplication, executor: string) {
    await this.call('execute', app, executor);
  }

  async view(app: DemoApplication): Promise<RequestView> {
    const data = await this.call('view', app);
    return { approvals: data.view?.approvals ?? [], executed: Boolean(data.view?.executed) };
  }
}

// --- Factory ---------------------------------------------------------------

let singleton: ResilienceLedger | null = null;

export function getLedger(): ResilienceLedger {
  if (singleton) return singleton;
  singleton =
    process.env.NEXT_PUBLIC_LEDGER_MODE === 'json-api' ? new HttpLedger() : new InMemoryLedger();
  return singleton;
}
