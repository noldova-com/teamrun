/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { type ILog, type ITimer, Resources as CoreResources, TimeoutException } from "@noldova/teamrun.core";
import { type Provider, type ProviderIdentity, ProviderModelList } from "@noldova/teamrun.protocol";

import { MessageFraming } from "../../enums/message-framing.js";
import { AcpRequestException } from "../../exceptions/acp-request.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import { ProcessOrigin } from "../../models/process-origin.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { AcpClient } from "../acp/acp-client.js";
import { CopilotAccountReader } from "./copilot-account.reader.js";
import type { CopilotAgent } from "./copilot-agent.js";
import { CopilotModelReader } from "./copilot-model.reader.js";

export class CopilotModelLister {
  private readonly agent: CopilotAgent;
  private readonly starter: IProcessStarter;
  private readonly timings: ProviderTimings;
  private readonly timer: ITimer;
  private readonly log: ILog | null;
  private readonly clients: Set<AcpClient> = new Set();
  private stops: number = 0;

  public constructor(agent: CopilotAgent, starter: IProcessStarter, timings: ProviderTimings, timer: ITimer, log: ILog | null) {
    this.agent = agent;
    this.starter = starter;
    this.timings = timings;
    this.timer = timer;
    this.log = log;
  }

  public get shutdowns(): number {
    return this.stops;
  }

  public list(provider: Provider | null, refresh: boolean = false): Promise<ProviderModelList> {
    return this.inSession(provider, new ProviderModelList([], false), (client, sessionId) => this.listInSession(client, sessionId, refresh));
  }

  public readQuota(provider: Provider | null, refresh: boolean = false): Promise<JsonValue | null> {
    return this.inSession(provider, null, async (client, sessionId) => {
      const session = { [Resources.sessionIdField]: sessionId };
      if (refresh)
        await client.request(Resources.copilotQuotaRefreshMethod, session, this.timings.requestTimeout).catch(() => null);
      return await client.request(Resources.copilotQuotaMethod, session, this.timings.requestTimeout);
    });
  }

  public async readAccount(provider: Provider | null): Promise<ProviderIdentity | null> {
    const ended = new AbortController();
    const read = this.connected(provider, async client => CopilotAccountReader.read(await this.readStatus(client)), ended.signal);
    const expired = this.timer.delayAsync(this.timings.accountTimeout, ended.signal).then(() => null, () => null);
    try {
      return await Promise.race([read, expired]);
    }
    finally {
      ended.abort();
    }
  }

  public async shutdown(): Promise<void> {
    this.stops += 1;
    await Promise.all([...this.clients].map(t => this.close(t)));
  }

  private inSession<T>(provider: Provider | null, signedOut: T, work: (client: AcpClient, sessionId: string) => Promise<T>): Promise<T> {
    return this.connected(provider, async client => {
      if (!JsonReader.fromValue(await this.readStatus(client)).readBoolean(Resources.copilotAuthenticatedField))
        return signedOut;
      const created = JsonReader.fromValue(await client.request(Resources.copilotSessionCreateMethod, {}, this.timings.initializeTimeout));
      const sessionId = created.readNonBlankString(Resources.sessionIdField);
      try {
        return await work(client, sessionId);
      }
      finally {
        await this.deleteSession(client, sessionId);
      }
    });
  }

  private async connected<T>(provider: Provider | null, work: (client: AcpClient) => Promise<T>, signal: AbortSignal | null = null): Promise<T> {
    const launch = this.agent.headlessLaunch(provider, await this.starter.readEnvironmentAsync(this.agent.baseEnvironment));
    const command = launch.command.withOrigin(new ProcessOrigin(Resources.copilotKindId, provider?.id ?? null));
    const client = new AcpClient(command, launch.environment, launch.directory, this.starter, this.timings, this.timer, MessageFraming.ContentLength);
    const stop = (): void => {
      void this.close(client);
    };
    this.clients.add(client);
    signal?.addEventListener(Resources.abortEvent, stop, { once: true });
    try {
      client.start();
      await this.connect(client);
      return await work(client);
    }
    finally {
      signal?.removeEventListener(Resources.abortEvent, stop);
      await this.close(client);
    }
  }

  private readStatus(client: AcpClient): Promise<JsonValue> {
    return client.request(Resources.copilotAuthStatusMethod, {}, this.timings.initializeTimeout);
  }

  private async listInSession(client: AcpClient, sessionId: string, refresh: boolean): Promise<ProviderModelList> {
    const answer = JsonReader.fromValue(await client.request(Resources.copilotSessionModelListMethod,
      { [Resources.sessionIdField]: sessionId, [Resources.copilotSkipCacheField]: refresh }, this.timings.requestTimeout));
    const models = CopilotModelReader.read(answer);
    if (models.length > 0)
      return new ProviderModelList(models, true);
    const quota = JsonReader.fromValue(await client.request(Resources.copilotQuotaMethod, { [Resources.sessionIdField]: sessionId }, this.timings.requestTimeout));
    return quota.readBoolean(Resources.copilotFreeUserField) ? new ProviderModelList([], true, false, Resources.copilotFreePlanName) : new ProviderModelList([], true);
  }

  private async deleteSession(client: AcpClient, sessionId: string): Promise<void> {
    if (!client.isConnected)
      return;
    const graceEnded = new AbortController();
    const grace = this.timer.delayAsync(this.timings.stopGrace, graceEnded.signal)
      .then(() => Promise.reject(new TimeoutException(Resources.formatAcpTimeout(Resources.copilotSessionDeleteMethod))));
    try {
      await Promise.race([client.request(Resources.copilotSessionDeleteMethod, { [Resources.sessionIdField]: sessionId }, null), grace]);
    }
    catch (error) {
      this.log?.write(Resources.formatCopilotListingSessionDeleteFailed(CoreResources.formatFailureKind(error)));
    }
    finally {
      graceEnded.abort();
    }
  }

  private async connect(client: AcpClient): Promise<void> {
    try {
      await client.request(Resources.copilotConnectMethod, {}, this.timings.initializeTimeout);
    }
    catch (error) {
      if (!(error instanceof AcpRequestException) || error.code !== Resources.acpUnsupportedCode)
        throw error;
    }
  }

  private async close(client: AcpClient): Promise<void> {
    try {
      await client.stop();
    }
    catch (error) {
      this.log?.write(Resources.formatCopilotListingStopFailed(CoreResources.formatFailureKind(error)));
    }
    this.clients.delete(client);
  }

}
