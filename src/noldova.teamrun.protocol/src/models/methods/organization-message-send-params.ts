/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { OrganizationTarget } from "../organization-target.js";

export class OrganizationMessageSendParams {
  public readonly target: OrganizationTarget;
  public readonly text: string;

  public constructor(
    target: OrganizationTarget,
    text: string) {
    ArgumentException.throwIfNullOrWhitespace(text, Resources.textField);

    this.target = target;
    this.text = text;
  }

  public static fromJson(value: unknown, path?: string): OrganizationMessageSendParams {
    const reader = JsonReader.fromValue(value, path);
    const target = reader.readObject(Resources.targetField);
    return new OrganizationMessageSendParams(
      OrganizationTarget.fromJson(target.toJson(), target.path),
      reader.readNonBlankString(Resources.textField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.targetField]: this.target.toJson(),
      [Resources.textField]: this.text
    };
  }
}
