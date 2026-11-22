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

export class NodeTypeUpdateParams {
  public readonly organizationId: string;
  public readonly typeId: string;
  public readonly name: string | undefined;
  public readonly icon: string | null | undefined;
  public readonly color: string | null | undefined;

  public constructor(
    organizationId: string,
    typeId: string,
    name: string | undefined,
    icon: string | null | undefined,
    color: string | null | undefined) {
    ArgumentException.throwIfNullOrWhitespace(organizationId, Resources.organizationIdField);
    ArgumentException.throwIfNullOrWhitespace(typeId, Resources.typeIdField);
    if (Object.isUndefined(name) && Object.isUndefined(icon) && Object.isUndefined(color))
      throw new ArgumentException(Resources.emptyNodeTypeUpdate, Resources.typeIdField);
    if (!Object.isUndefined(name))
      NodeType.validateName(name);
    if (!Object.isUndefined(icon))
      NodeType.validateIcon(icon);
    if (!Object.isUndefined(color))
      NodeType.validateColor(color);

    this.organizationId = organizationId;
    this.typeId = typeId;
    this.name = name;
    this.icon = icon;
    this.color = color;
  }

  public static fromJson(value: unknown, path?: string): NodeTypeUpdateParams {
    const reader = JsonReader.fromValue(value, path);
    return new NodeTypeUpdateParams(
      reader.readNonBlankString(Resources.organizationIdField),
      reader.readNonBlankString(Resources.typeIdField),
      reader.hasField(Resources.nameField) ? NodeType.readName(reader) : undefined,
      reader.hasField(Resources.iconField) ? NodeType.readIcon(reader) : undefined,
      reader.hasField(Resources.colorField) ? NodeType.readColor(reader) : undefined);
  }

  public applyTo(type: NodeType, updatedAt: string): NodeType {
    return new NodeType(type.id, this.name ?? type.name, Object.isUndefined(this.icon) ? type.icon : this.icon,
      Object.isUndefined(this.color) ? type.color : this.color, type.createdAt, updatedAt);
  }

  public toJson(): JsonObject {
    return {
      [Resources.organizationIdField]: this.organizationId,
      [Resources.typeIdField]: this.typeId,
      ...Object.isUndefined(this.name) ? {} : { [Resources.nameField]: this.name },
      ...Object.isUndefined(this.icon) ? {} : { [Resources.iconField]: this.icon },
      ...Object.isUndefined(this.color) ? {} : { [Resources.colorField]: this.color }
    };
  }
}
