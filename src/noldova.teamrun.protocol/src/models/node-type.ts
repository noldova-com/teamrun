/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class NodeType {
  public readonly id: string;
  public readonly name: string;
  public readonly icon: string | null;
  public readonly color: string | null;
  public readonly createdAt: string;
  public readonly updatedAt: string;

  public constructor(id: string, name: string, icon: string | null, color: string | null, createdAt: string, updatedAt: string) {
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    NodeType.validateName(name);
    NodeType.validateIcon(icon);
    NodeType.validateColor(color);
    ArgumentException.throwIfNullOrWhitespace(createdAt, Resources.createdAtField);
    ArgumentException.throwIfNullOrWhitespace(updatedAt, Resources.updatedAtField);
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.color = color;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public static validateName(name: string): void {
    if (!NodeType.allowsName(name))
      throw new ArgumentException(Resources.invalidNodeTypeName, Resources.nameField);
  }

  public static validateIcon(icon: string | null): void {
    if (!Object.isNull(icon) && !Resources.nodeTypeIconPattern.test(icon))
      throw new ArgumentException(Resources.invalidNodeTypeIcon, Resources.iconField);
  }

  public static validateColor(color: string | null): void {
    if (!Object.isNull(color) && !Resources.nodeTypeColorPattern.test(color))
      throw new ArgumentException(Resources.invalidNodeTypeColor, Resources.colorField);
  }

  public static readName(reader: JsonReader): string {
    const name = reader.readString(Resources.nameField);
    if (!NodeType.allowsName(name))
      throw new JsonException(Resources.invalidNodeTypeName, `${reader.path}.${Resources.nameField}`);
    return name;
  }

  public static readIcon(reader: JsonReader): string | null {
    const icon = reader.readNullableString(Resources.iconField);
    if (!Object.isNull(icon) && !Resources.nodeTypeIconPattern.test(icon))
      throw new JsonException(Resources.invalidNodeTypeIcon, `${reader.path}.${Resources.iconField}`);
    return icon;
  }

  public static readColor(reader: JsonReader): string | null {
    const color = reader.readNullableString(Resources.colorField);
    if (!Object.isNull(color) && !Resources.nodeTypeColorPattern.test(color))
      throw new JsonException(Resources.invalidNodeTypeColor, `${reader.path}.${Resources.colorField}`);
    return color;
  }

  public static fromJson(value: unknown, path?: string): NodeType {
    const reader = JsonReader.fromValue(value, path);
    return new NodeType(
      reader.readNonBlankString(Resources.idField),
      NodeType.readName(reader),
      NodeType.readIcon(reader),
      NodeType.readColor(reader),
      reader.readNonBlankString(Resources.createdAtField),
      reader.readNonBlankString(Resources.updatedAtField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.nameField]: this.name,
      [Resources.iconField]: this.icon,
      [Resources.colorField]: this.color,
      [Resources.createdAtField]: this.createdAt,
      [Resources.updatedAtField]: this.updatedAt
    };
  }

  private static allowsName(name: string): boolean {
    return Resources.departmentNamePattern.test(name) && name.trim().length > 0;
  }
}
