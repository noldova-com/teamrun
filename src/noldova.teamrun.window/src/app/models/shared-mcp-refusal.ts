/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Resources as ProtocolResources, SharedMcpTransport } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class SharedMcpRefusal {
  private static readonly byParameter: ReadonlyMap<string, SharedMcpRefusal> = new Map([
    [ProtocolResources.nameField, new SharedMcpRefusal(ProtocolResources.nameField, Resources.sharedMcpNameRefusal)],
    [ProtocolResources.transportField, new SharedMcpRefusal(ProtocolResources.urlField, Resources.sharedMcpAddressRefusal)],
    [ProtocolResources.urlField, new SharedMcpRefusal(ProtocolResources.urlField, Resources.sharedMcpAddressSecretRefusal)],
    [ProtocolResources.headersField, new SharedMcpRefusal(ProtocolResources.headersField, Resources.sharedMcpHeaderNamesRefusal)],
    [ProtocolResources.signsInField, new SharedMcpRefusal(ProtocolResources.signsInField, Resources.sharedMcpSignsInRefusal)],
    [ProtocolResources.accountField, new SharedMcpRefusal(ProtocolResources.headersField, Resources.sharedMcpAccountRefusal)]
  ]);

  public readonly field: string;
  public readonly message: string;

  public constructor(field: string, message: string) {
    this.field = field;
    this.message = message;
  }

  public static ofDefinition(error: unknown, transport: SharedMcpTransport, name: string): SharedMcpRefusal {
    if (!(error instanceof ArgumentException))
      throw error;
    if (error.parameterName === ProtocolResources.nameField && name === ProtocolResources.mcpServerName)
      return new SharedMcpRefusal(ProtocolResources.nameField, Resources.sharedMcpOwnNameRefusal);
    if (error.parameterName === ProtocolResources.variablesField)
      return transport === SharedMcpTransport.Stdio
        ? new SharedMcpRefusal(ProtocolResources.variablesField, Resources.sharedMcpVariablesRefusal)
        : new SharedMcpRefusal(ProtocolResources.bearerVariableField, Resources.sharedMcpBearerRefusal);
    const refusal = SharedMcpRefusal.byParameter.get(error.parameterName ?? String.empty);
    if (Object.isUndefined(refusal))
      throw error;
    return refusal;
  }

  public static ofHeader(error: unknown): SharedMcpRefusal {
    if (!(error instanceof ArgumentException))
      throw error;
    return new SharedMcpRefusal(ProtocolResources.headersField, Resources.sharedMcpHeaderLineRefusal);
  }
}
