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
import { NodeType } from "../node-type.js";

export class NodeTypeCreateParams {
  public readonly organizationId: string;
  public readonly name: string;
  public readonly icon: string | null;
  public readonly color: string | null;

  public constructor(
    organizationId: string,
    name: string,
    icon: string | null = null,
    color: string | null = null) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    NodeType.validateName(name);
    NodeType.validateIcon(icon);
    NodeType.validateColor(color);

    this.organizationId = organizationId;
    this.name = name;
    this.icon = icon;
    this.color = color;
  }

  public static fromJson(value: unknown, path?: string): NodeTypeCreateParams {
    const reader = JsonReader.fromValue(value, path);
    return new NodeTypeCreateParams(
      reader.readNonBlankString(Resources.organizationIdField),
      NodeType.readName(reader),
      reader.hasField(Resources.iconField) ? NodeType.readIcon(reader) : null,
      reader.hasField(Resources.colorField) ? NodeType.readColor(reader) : null);
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.nameField]: this.name,
      [Resources.iconField]: this.icon,
      [Resources.colorField]: this.color
    };
  }
}
