/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Resources as ProtocolResources, SharedMcpTransport } from "@noldova/teamrun.protocol";

import { SharedMcpRefusal } from "../../../src/app/models/shared-mcp-refusal";
import { Resources } from "../../../src/resources";

describe("SharedMcpRefusal", () => {
  it.each([
    { parameter: ProtocolResources.nameField, transport: SharedMcpTransport.Stdio, field: ProtocolResources.nameField, message: Resources.sharedMcpNameRefusal },
    { parameter: ProtocolResources.variablesField, transport: SharedMcpTransport.Stdio, field: ProtocolResources.variablesField,
      message: Resources.sharedMcpVariablesRefusal },
    { parameter: ProtocolResources.variablesField, transport: SharedMcpTransport.Http, field: ProtocolResources.bearerVariableField,
      message: Resources.sharedMcpBearerRefusal },
    { parameter: ProtocolResources.transportField, transport: SharedMcpTransport.Http, field: ProtocolResources.urlField, message: Resources.sharedMcpAddressRefusal },
    { parameter: ProtocolResources.urlField, transport: SharedMcpTransport.Http, field: ProtocolResources.urlField, message: Resources.sharedMcpAddressSecretRefusal },
    { parameter: ProtocolResources.headersField, transport: SharedMcpTransport.Http, field: ProtocolResources.headersField,
      message: Resources.sharedMcpHeaderNamesRefusal }
  ])("puts the definition's refusal of $parameter for a $transport server under $field", ({ parameter, transport, field, message }) => {
    const refusal = SharedMcpRefusal.ofDefinition(new ArgumentException("Refused.", parameter), transport, "docs");

    expect([refusal.field, refusal.message]).toEqual([field, message]);
  });

  it("says only of the name teamrun that it is TeamRun's own", () => {
    const refusals = ["teamrun", "Teamrun"].map(t => SharedMcpRefusal.ofDefinition(new ArgumentException("Refused.", ProtocolResources.nameField),
      SharedMcpTransport.Stdio, t));

    expect(refusals.map(t => [t.field, t.message])).toEqual([[ProtocolResources.nameField, Resources.sharedMcpOwnNameRefusal],
      [ProtocolResources.nameField, Resources.sharedMcpNameRefusal]]);
  });

  it("puts a header's refusal under the headers", () => {
    const refusal = SharedMcpRefusal.ofHeader(new ArgumentException("Refused.", "variable"));

    expect([refusal.field, refusal.message]).toEqual([ProtocolResources.headersField, Resources.sharedMcpHeaderLineRefusal]);
  });

  it.each([
    { kind: "a failure that isn't an argument's", error: new RangeError("Broken.") },
    { kind: "an argument it doesn't know", error: new ArgumentException("Refused.", "command") },
    { kind: "an argument without a name", error: new ArgumentException("Refused.") }
  ])("throws $kind on rather than naming a field", ({ error }) => {
    expect(() => SharedMcpRefusal.ofDefinition(error, SharedMcpTransport.Stdio, "docs")).toThrow(error);
  });

  it("throws a header's failure that isn't an argument's on", () => {
    const error = new RangeError("Broken.");

    expect(() => SharedMcpRefusal.ofHeader(error)).toThrow(error);
  });
});
