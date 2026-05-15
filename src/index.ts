export type WalkerScope = "wallet:read" | "wallet:spend";

export type WalkerFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface WalkerClientOptions {
  baseUrl?: string;
  connectionToken?: string;
  fetch?: WalkerFetch;
}

export interface WalkerPlayerAuth {
  walkerBearerToken?: string;
  devPlayerEmail?: string;
  devPlayerName?: string;
}

export interface EnrollPartnerAppInput {
  name: string;
  allowedRedirectUrls?: string[];
}

export interface PartnerApp {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  allowedRedirectUrls: string[];
  createdAt: string;
}

export interface ConnectPartnerUserInput {
  clientId: string;
  externalUserId: string;
  scopes?: WalkerScope[];
  playerAuth: WalkerPlayerAuth;
}

export interface WalkerConnectUrlInput {
  clientId: string;
  externalUserId: string;
  partnerName?: string;
  redirectUri?: string;
  scopes?: WalkerScope[];
  scheme?: string;
}

export interface PartnerConnection {
  id: string;
  partnerAppId: string;
  playerId: string;
  externalUserId: string;
  connectionToken: string;
  scopes: WalkerScope[];
  createdAt: string;
}

export interface WalletBalance {
  connectionId: string;
  partnerAppId: string;
  externalUserId: string;
  playerId: string;
  creditBalance: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  totalSteps: number;
  totalActiveCalories: number;
}

export interface WalletTransaction {
  id: string;
  amount: number;
  transactionType: string;
  reason: string;
  externalReference: string | null;
  partnerAppId: string | null;
  partnerConnectionId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WalletTransactions {
  connectionId: string;
  creditBalance: number;
  transactions: WalletTransaction[];
}

export interface SpendCreditsInput {
  amount: number;
  reason: string;
  externalReference?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  connectionToken?: string;
}

export interface SpendCreditsResult {
  connectionId: string;
  transaction: WalletTransaction;
  creditBalance: number;
  idempotentReplay: boolean;
}

export interface ListTransactionsInput {
  limit?: number;
  connectionToken?: string;
}

export interface GetBalanceInput {
  connectionToken?: string;
}

export class WalkerApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "WalkerApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class WalkerClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: WalkerFetch;
  private connectionToken: string | undefined;

  constructor(options: WalkerClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "https://walker-xl5k.onrender.com");
    this.connectionToken = options.connectionToken;
    this.fetchImpl = options.fetch ?? getGlobalFetch();
  }

  setConnectionToken(connectionToken: string): void {
    this.connectionToken = connectionToken;
  }

  withConnectionToken(connectionToken: string): WalkerClient {
    return new WalkerClient({
      baseUrl: this.baseUrl,
      fetch: this.fetchImpl,
      connectionToken,
    });
  }

  async enrollPartnerApp(input: EnrollPartnerAppInput): Promise<PartnerApp> {
    const raw = await this.request<RawPartnerApp>("/v1/partner/apps", {
      method: "POST",
      body: {
        name: input.name,
        allowed_redirect_urls: input.allowedRedirectUrls ?? [],
      },
    });
    return mapPartnerApp(raw);
  }

  async connectPartnerUser(input: ConnectPartnerUserInput): Promise<PartnerConnection> {
    const raw = await this.request<RawPartnerConnection>("/v1/partner/connections", {
      method: "POST",
      headers: playerAuthHeaders(input.playerAuth),
      body: {
        client_id: input.clientId,
        external_user_id: input.externalUserId,
        scopes: input.scopes ?? ["wallet:read", "wallet:spend"],
      },
    });
    return mapPartnerConnection(raw);
  }

  createConnectUrl(input: WalkerConnectUrlInput): string {
    return createWalkerConnectUrl(input);
  }

  async getBalance(input: GetBalanceInput = {}): Promise<WalletBalance> {
    const raw = await this.request<RawWalletBalance>("/v1/partner/wallet/balance", {
      headers: this.connectionAuthHeaders(input.connectionToken),
    });
    return mapWalletBalance(raw);
  }

  async listTransactions(input: ListTransactionsInput = {}): Promise<WalletTransactions> {
    const search = new URLSearchParams();
    if (input.limit !== undefined) {
      search.set("limit", String(input.limit));
    }
    const query = search.toString();

    const raw = await this.request<RawWalletTransactions>(
      `/v1/partner/wallet/transactions${query ? `?${query}` : ""}`,
      {
        headers: this.connectionAuthHeaders(input.connectionToken),
      },
    );
    return {
      connectionId: raw.connection_id,
      creditBalance: raw.credit_balance,
      transactions: raw.transactions.map(mapWalletTransaction),
    };
  }

  async spendCredits(input: SpendCreditsInput): Promise<SpendCreditsResult> {
    const raw = await this.request<RawSpendResult>("/v1/partner/wallet/spend", {
      method: "POST",
      headers: this.connectionAuthHeaders(input.connectionToken),
      body: {
        amount: input.amount,
        reason: input.reason,
        external_reference: input.externalReference ?? null,
        idempotency_key: input.idempotencyKey,
        metadata: input.metadata ?? {},
      },
    });
    return {
      connectionId: raw.connection_id,
      transaction: mapWalletTransaction(raw.transaction),
      creditBalance: raw.credit_balance,
      idempotentReplay: raw.idempotent_replay,
    };
  }

  private connectionAuthHeaders(connectionToken?: string): Record<string, string> {
    const token = connectionToken ?? this.connectionToken;
    if (!token) {
      throw new Error("Missing Walker connection token.");
    }
    return { Authorization: `Bearer ${token}` };
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    let body: string | undefined;

    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
    };
    if (body !== undefined) {
      init.body = body;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, init);

    const payload = await parsePayload(response);
    if (!response.ok) {
      const detail = isRecord(payload) && "detail" in payload ? payload.detail : payload;
      throw new WalkerApiError(detailToMessage(detail, response.status), response.status, detail);
    }
    return payload as T;
  }
}

export const Walker = WalkerClient;

export function createWalkerConnectUrl(input: WalkerConnectUrlInput): string {
  const scheme = input.scheme ?? "walker";
  const url = new URL(`${scheme}://connect`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("external_user_id", input.externalUserId);
  if (input.partnerName) {
    url.searchParams.set("partner_name", input.partnerName);
  }
  if (input.redirectUri) {
    url.searchParams.set("redirect_uri", input.redirectUri);
  }
  url.searchParams.set("scopes", (input.scopes ?? ["wallet:read", "wallet:spend"]).join(","));
  return url.toString();
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH" | "PUT";
  headers?: HeadersInit;
  body?: unknown;
}

interface RawPartnerApp {
  id: string;
  name: string;
  client_id: string;
  client_secret: string;
  allowed_redirect_urls: string[];
  created_at: string;
}

interface RawPartnerConnection {
  id: string;
  partner_app_id: string;
  player_id: string;
  external_user_id: string;
  connection_token: string;
  scopes: WalkerScope[];
  created_at: string;
}

interface RawWalletBalance {
  connection_id: string;
  partner_app_id: string;
  external_user_id: string;
  player_id: string;
  credit_balance: number;
  total_credits_earned: number;
  total_credits_spent: number;
  total_steps: number;
  total_active_calories: number;
}

interface RawWalletTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  reason: string;
  external_reference: string | null;
  partner_app_id: string | null;
  partner_connection_id: string | null;
  idempotency_key: string | null;
  transaction_metadata: Record<string, unknown>;
  created_at: string;
}

interface RawWalletTransactions {
  connection_id: string;
  credit_balance: number;
  transactions: RawWalletTransaction[];
}

interface RawSpendResult {
  connection_id: string;
  transaction: RawWalletTransaction;
  credit_balance: number;
  idempotent_replay: boolean;
}

function mapPartnerApp(raw: RawPartnerApp): PartnerApp {
  return {
    id: raw.id,
    name: raw.name,
    clientId: raw.client_id,
    clientSecret: raw.client_secret,
    allowedRedirectUrls: raw.allowed_redirect_urls,
    createdAt: raw.created_at,
  };
}

function mapPartnerConnection(raw: RawPartnerConnection): PartnerConnection {
  return {
    id: raw.id,
    partnerAppId: raw.partner_app_id,
    playerId: raw.player_id,
    externalUserId: raw.external_user_id,
    connectionToken: raw.connection_token,
    scopes: raw.scopes,
    createdAt: raw.created_at,
  };
}

function mapWalletBalance(raw: RawWalletBalance): WalletBalance {
  return {
    connectionId: raw.connection_id,
    partnerAppId: raw.partner_app_id,
    externalUserId: raw.external_user_id,
    playerId: raw.player_id,
    creditBalance: raw.credit_balance,
    totalCreditsEarned: raw.total_credits_earned,
    totalCreditsSpent: raw.total_credits_spent,
    totalSteps: raw.total_steps,
    totalActiveCalories: raw.total_active_calories,
  };
}

function mapWalletTransaction(raw: RawWalletTransaction): WalletTransaction {
  return {
    id: raw.id,
    amount: raw.amount,
    transactionType: raw.transaction_type,
    reason: raw.reason,
    externalReference: raw.external_reference,
    partnerAppId: raw.partner_app_id,
    partnerConnectionId: raw.partner_connection_id,
    idempotencyKey: raw.idempotency_key,
    metadata: raw.transaction_metadata,
    createdAt: raw.created_at,
  };
}

function playerAuthHeaders(auth: WalkerPlayerAuth): Record<string, string> {
  if (auth.walkerBearerToken) {
    return { Authorization: `Bearer ${auth.walkerBearerToken}` };
  }
  if (auth.devPlayerEmail) {
    const headers: Record<string, string> = { "X-Player-Email": auth.devPlayerEmail };
    if (auth.devPlayerName) {
      headers["X-Player-Name"] = auth.devPlayerName;
    }
    return headers;
  }
  throw new Error("Missing Walker player auth. Provide walkerBearerToken or devPlayerEmail.");
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function getGlobalFetch(): WalkerFetch {
  if (typeof fetch !== "function") {
    throw new Error("No fetch implementation available. Pass fetch in WalkerClient options.");
  }
  return fetch.bind(globalThis);
}

async function parsePayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function detailToMessage(detail: unknown, status: number): string {
  if (typeof detail === "string") {
    return detail;
  }
  return `Walker API request failed with status ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
