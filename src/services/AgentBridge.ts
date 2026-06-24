/**
 * AgentBridge — WebSocket bridge scaffold for live agent mode (S3-BROW-1)
 *
 * Connects an external MCP agent (e.g., Claude) to the browser's EngineProxy
 * via a localhost WebSocket. Agent commands arrive as JSON messages, are dispatched
 * to the EngineProxy (same instance the UI uses), and results flow back.
 *
 * Security: Localhost-only. No remote connections. Rate-limited.
 *
 * Phase 3 scope: Scaffold only. Full bidirectional collaboration is Phase 4.
 */

import type { BrowserEngine } from '../engine/BrowserEngine';

// -- Agent Command Protocol --

export type AgentCommand =
  | { type: 'agent.loadSAV'; fileName: string; buffer: string } // base64-encoded
  | { type: 'agent.query'; sql: string }
  | { type: 'agent.runCrosstab'; options: Record<string, unknown>; context: Record<string, unknown> }
  | { type: 'agent.getSchema' }
  | { type: 'agent.getUniqueValues'; column: string }
  | { type: 'agent.ping' };

export interface AgentResponse {
  type: 'agent.result' | 'agent.error';
  commandType: string;
  requestId: string;
  data?: unknown;
  error?: string;
}

export interface AgentBridgeOptions {
  /** Port for the WebSocket server (default: 9823) */
  port?: number;
  /** Max commands per second (default: 10) */
  rateLimit?: number;
  /** Callback when an agent command mutates store state */
  onStateChange?: (commandType: string) => void;
}

const DEFAULT_PORT = 9823;
const DEFAULT_RATE_LIMIT = 10;

export class AgentBridge {
  private browserEngine: BrowserEngine | null = null;
  private ws: WebSocket | null = null;
  private options: Required<AgentBridgeOptions>;
  private commandCount = 0;
  private rateLimitReset: ReturnType<typeof setInterval> | null = null;
  private _connected = false;

  constructor(options: AgentBridgeOptions = {}) {
    this.options = {
      port: options.port ?? DEFAULT_PORT,
      rateLimit: options.rateLimit ?? DEFAULT_RATE_LIMIT,
      onStateChange: options.onStateChange ?? (() => {}),
    };
  }

  get connected(): boolean {
    return this._connected;
  }

  /**
   * Bind the bridge to an EngineProxy instance.
   * Must be called before connect().
   */
  bind(browserEngine: BrowserEngine): void {
    this.browserEngine = browserEngine;
  }

  /**
   * Connect to the WebSocket server.
   * In the browser, this connects as a client to a local relay server.
   */
  connect(): void {
    if (this.ws) {
      console.warn('[AgentBridge] Already connected');
      return;
    }

    if (!this.browserEngine) {
      throw new Error('[AgentBridge] Must call bind(browserEngine) before connect()');
    }

    const url = `ws://localhost:${this.options.port}`;
    console.log(`[AgentBridge] Connecting to ${url}`);

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.warn('[AgentBridge] WebSocket connection failed (agent relay not running):', err);
      return;
    }

    this.ws.onopen = () => {
      this._connected = true;
      console.log('[AgentBridge] Connected to agent relay');
      this.send({ type: 'agent.result', commandType: 'handshake', requestId: 'init', data: { status: 'ready' } });
    };

    this.ws.onmessage = (event) => {
      try {
        const command = JSON.parse(event.data) as AgentCommand & { requestId?: string };
        this.handleCommand(command, command.requestId ?? crypto.randomUUID());
      } catch (err) {
        console.error('[AgentBridge] Failed to parse command:', err);
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      console.log('[AgentBridge] Disconnected from agent relay');
      this.ws = null;
    };

    this.ws.onerror = (err) => {
      console.warn('[AgentBridge] WebSocket error:', err);
    };

    // Rate limit reset
    this.rateLimitReset = setInterval(() => {
      this.commandCount = 0;
    }, 1000);
  }

  /**
   * Disconnect and clean up.
   */
  disconnect(): void {
    if (this.rateLimitReset) {
      clearInterval(this.rateLimitReset);
      this.rateLimitReset = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  private send(response: AgentResponse): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    }
  }

  private async handleCommand(command: AgentCommand & { requestId?: string }, requestId: string): Promise<void> {
    // Rate limit check
    this.commandCount++;
    if (this.commandCount > this.options.rateLimit) {
      this.send({
        type: 'agent.error',
        commandType: command.type,
        requestId,
        error: 'Rate limit exceeded. Max ' + this.options.rateLimit + ' commands/second.',
      });
      return;
    }

    if (!this.browserEngine) {
      this.send({
        type: 'agent.error',
        commandType: command.type,
        requestId,
        error: 'Engine not bound. Bridge not ready.',
      });
      return;
    }

    try {
      let result: unknown;

      switch (command.type) {
        case 'agent.ping':
          result = { status: 'ok', timestamp: Date.now() };
          break;

        case 'agent.query':
          result = await this.browserEngine.query(command.sql);
          break;

        case 'agent.loadSAV': {
          const buffer = Uint8Array.from(atob(command.buffer), c => c.charCodeAt(0)).buffer;
          result = await this.browserEngine.loadSAV(buffer);
          this.options.onStateChange(command.type);
          break;
        }

        case 'agent.runCrosstab':
          result = await this.browserEngine.runCrosstab(
            command.options as any,
            command.context as any,
          );
          this.options.onStateChange(command.type);
          break;

        case 'agent.getSchema':
          result = await this.browserEngine.getSchema();
          break;

        case 'agent.getUniqueValues':
          result = await this.browserEngine.getUniqueValues(command.column);
          break;

        default: {
          const unknown = command as { type: string };
          this.send({
            type: 'agent.error',
            commandType: unknown.type,
            requestId,
            error: `Unknown command type: ${unknown.type}`,
          });
          return;
        }
      }

      this.send({
        type: 'agent.result',
        commandType: command.type,
        requestId,
        data: result,
      });
    } catch (err: any) {
      this.send({
        type: 'agent.error',
        commandType: command.type,
        requestId,
        error: err.message || 'Unknown error',
      });
    }
  }
}
