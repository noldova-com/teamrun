/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { Failure, FailureCode, ShellClients } from "@noldova/desktop.protocol";
import { type IMethodHandler, MethodFailureException, type RequestContext } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { IProvidersService } from "@noldova/teamrun.core";
import { ProviderUpdateParams } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { DispatchedMethod } from "./dispatched-method.js";

export class ProviderUpdateMethod implements IMethodHandler {
  private readonly method: IMethodHandler;
  private readonly providers: Pick<IProvidersService, "findAsync">;

  public constructor(method: IMethodHandler, providers: Pick<IProvidersService, "findAsync">) {
    this.method = method;
    this.providers = providers;
  }

  public async handleAsync(request: RequestContext): Promise<JsonValue> {
    if (request.client !== ShellClients.mainProcess && await this.changesWhatRunsAsync(request.payload))
      throw new MethodFailureException(new Failure(FailureCode.Unauthorized, Resources.mainProcessOnly,
        { [Resources.errorField]: FailureCode.Unauthorized, [Resources.argumentsField]: [] }));

    return await this.method.handleAsync(request);
  }

  private async changesWhatRunsAsync(payload: JsonValue): Promise<boolean> {
    let params: ProviderUpdateParams;
    try {
      params = ProviderUpdateParams.fromJson(payload);
    }
    catch {
      return false;
    }
    const stored = await this.providers.findAsync(params.providerId).catch((error: unknown) => {
      throw DispatchedMethod.failureOf(error);
    });
    return !Object.isNull(stored) && (resolve(params.profileDir) !== stored.profileDir
      || (!Object.isNull(params.ownMcpServers) && params.ownMcpServers !== stored.ownMcpServers));
  }
}
