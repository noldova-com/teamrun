/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { ServiceException } from "@noldova/teamrun.services";
import { ErrorCode } from "@noldova/teamrun.protocol";

import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import type { IProviderTool } from "../../interfaces/i-provider-tool.js";
import { Resources } from "../../resources.js";

export class ProviderKindRegistry {
  private readonly adapters: Map<string, IProviderAdapter> = new Map();
  private readonly toolsByKind: Map<string, IProviderTool> = new Map();

  public register(adapter: IProviderAdapter, tool: IProviderTool | null = null): void {
    if (this.adapters.has(adapter.descriptor.id))
      throw new ArgumentException(Resources.formatKindAlreadyRegistered(adapter.descriptor.id), Resources.adapterParameterName);

    this.adapters.set(adapter.descriptor.id, adapter);
    if (!Object.isNull(tool))
      this.toolsByKind.set(adapter.descriptor.id, tool);
  }

  public unregister(kind: string): IProviderAdapter | null {
    const adapter = this.adapters.get(kind) ?? null;
    this.adapters.delete(kind);
    this.toolsByKind.delete(kind);
    return adapter;
  }

  public has(kind: string): boolean {
    return this.adapters.has(kind);
  }

  public get(kind: string): IProviderAdapter {
    const adapter = this.adapters.get(kind);
    if (Object.isUndefined(adapter))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatKindNotRegistered(kind), [kind]);

    return adapter;
  }

  public all(): readonly IProviderAdapter[] {
    return [...this.adapters.values()];
  }

  public tools(): readonly IProviderTool[] {
    return [...this.toolsByKind.values()];
  }
}
