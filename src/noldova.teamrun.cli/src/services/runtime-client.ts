/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { CliCommandException, type ICliPartContext } from "@noldova/desktop.cli";
import { MethodName, Provider, ProviderListModelsParams, ProviderModelList } from "@noldova/teamrun.protocol";

import { CliPartException } from "../exceptions/cli-part.exception.js";
import { Resources } from "../resources.js";

export class RuntimeClient {
  private readonly context: ICliPartContext;

  public constructor(context: ICliPartContext) {
    this.context = context;
  }

  public static isConflict(error: unknown): boolean {
    const failure = error instanceof Error && error.name === Resources.methodFailureName ? Reflect.get(error, Resources.failureField) as { code?: unknown } | undefined : undefined;
    return failure?.code === Resources.conflictCode;
  }

  public requestAsync(method: MethodName, parameters: JsonValue, signal: AbortSignal): Promise<JsonValue> {
    return this.context.requestAsync(Resources.formatQualifiedName(method), parameters, signal);
  }

  public async listAsync<T>(method: MethodName, parameters: JsonValue, signal: AbortSignal, read: (item: unknown) => T): Promise<readonly T[]> {
    const answer = await this.requestAsync(method, parameters, signal);
    if (!Array.isArray(answer))
      throw new CliPartException(Resources.formatQualifiedName(method));

    return answer.map(t => read(t));
  }

  public async findProviderAsync(id: string, signal: AbortSignal): Promise<Provider> {
    const providers = await this.listAsync(MethodName.ProviderList, null, signal, t => Provider.fromJson(t));
    const found = providers.find(t => t.id === id);
    if (Object.isUndefined(found))
      throw new CliCommandException(Resources.notFoundCode, Resources.formatProviderNotFound(id));

    return found;
  }

  public async readModelsAsync(kind: string, providerId: string | null, signal: AbortSignal): Promise<ProviderModelList> {
    return ProviderModelList.fromJson(await this.requestAsync(MethodName.ProviderModelCatalog, new ProviderListModelsParams(kind, providerId).toJson(), signal));
  }
}
