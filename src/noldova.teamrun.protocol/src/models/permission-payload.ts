/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { PermissionRisk } from "../enums/permission-risk.js";
import { Resources } from "../resources.js";
import { PermissionDetail } from "./permission-detail.js";

export class PermissionPayload {
  public readonly module: string;
  public readonly subject: string | null;
  public readonly risk: PermissionRisk;
  public readonly details: readonly PermissionDetail[];
  public readonly served: { readonly tool: string; readonly input: JsonObject } | null;

  public constructor(module: string, subject: string | null, risk: PermissionRisk, details: readonly PermissionDetail[],
    served: { readonly tool: string; readonly input: JsonObject } | null = null) {
    ArgumentException.throwIfNullOrWhitespace(module, Resources.moduleField);
    if (!Object.isNull(served))
      ArgumentException.throwIfNullOrWhitespace(served.tool, Resources.servedToolField);

    this.module = module;
    this.subject = subject;
    this.risk = risk;
    this.details = [...details];
    this.served = Object.isNull(served) ? null : { tool: served.tool, input: served.input };
  }

  public static fromJson(value: unknown, path?: string): PermissionPayload {
    const reader = JsonReader.fromValue(value, path);
    return new PermissionPayload(
      reader.readNonBlankString(Resources.moduleField),
      reader.readNullableString(Resources.subjectField),
      reader.readOneOf(Resources.riskField, Object.values(PermissionRisk)),
      reader.readObjectArray(Resources.detailsField).map(t => PermissionDetail.fromJson(t.toJson(), t.path)),
      reader.hasField(Resources.servedToolField)
        ? { tool: reader.readNonBlankString(Resources.servedToolField), input: reader.readObject(Resources.servedInputField).toJson() } : null);
  }

  public isCallOf(tool: JsonValue | undefined, input: JsonValue | undefined): boolean {
    return !Object.isNull(this.served) && tool === this.served.tool && !Object.isUndefined(input)
      && PermissionPayload.canonical(input) === PermissionPayload.canonical(this.served.input);
  }

  public toJson(): JsonObject {
    return {
      [Resources.moduleField]: this.module,
      [Resources.subjectField]: this.subject,
      [Resources.riskField]: this.risk,
      [Resources.detailsField]: this.details.map(t => t.toJson()),
      ...Object.isNull(this.served) ? {} : { [Resources.servedToolField]: this.served.tool, [Resources.servedInputField]: this.served.input }
    };
  }

  private static canonical(value: JsonValue): string {
    return JSON.stringify(value, (_key, entry: unknown) => Object.isObject(entry) && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).toSorted(([a], [b]) => a.localeCompare(b))) : entry);
  }
}
