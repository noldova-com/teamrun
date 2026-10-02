/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
    const separatorIndex = text.indexOf(Resources.nameSeparator);
    if (separatorIndex < 0)
      throw new ArgumentException(Resources.nameInvalid, parameterName);

    return new QualifiedName(text.slice(0, separatorIndex), text.slice(separatorIndex + 1), parameterName);
  }

  public equals(other: QualifiedName): boolean {
    return other.text === this.text;
  }

  public toString(): string {
    return this.text;
  }
}
