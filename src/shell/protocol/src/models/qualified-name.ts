/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";

export class QualifiedName {
  public readonly owner: string;
  public readonly member: string;
  public readonly text: string;

  public constructor(owner: string, member: string, parameterName: string = Resources.nameField) {
    if (!Resources.ownerPattern.test(owner) || !Resources.memberPattern.test(member))
      throw new ArgumentException(Resources.nameInvalid, parameterName);

    this.owner = owner;
    this.member = member;
    this.text = `${owner}${Resources.nameSeparator}${member}`;
  }

  public get isShell(): boolean {
    return this.owner === Resources.shellOwner;
  }

  public static parse(text: string, parameterName: string = Resources.textParameterName): QualifiedName {
    const name = QualifiedName.find(text);
    if (Object.isNull(name))
      throw new ArgumentException(Resources.nameInvalid, parameterName);
    return name;
  }

  public static find(text: string): QualifiedName | null {
    const separatorIndex = text.indexOf(Resources.nameSeparator);
    const owner = text.slice(0, separatorIndex);
    const member = text.slice(separatorIndex + 1);
    return separatorIndex >= 0 && Resources.ownerPattern.test(owner) && Resources.memberPattern.test(member) ? new QualifiedName(owner, member) : null;
  }

  public equals(other: QualifiedName): boolean {
    return other.text === this.text;
  }

  public toString(): string {
    return this.text;
  }
}
