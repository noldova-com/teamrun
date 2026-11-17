/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProfileNode {
  private static readonly ANONYMOUS: string = "(anonymous)";

  public readonly id: number;
  public readonly functionName: string;
  public readonly url: string;
  public readonly lineNumber: number;
  public readonly columnNumber: number;
  public readonly children: readonly number[];

  public constructor(id: number, functionName: string, url: string, lineNumber: number, columnNumber: number, children: readonly number[]) {
    this.id = id;
    this.functionName = functionName;
    this.url = url;
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber;
    this.children = children;
  }

  public get fileName(): string {
    return this.url.split("/").pop()?.split("?")[0] ?? "";
  }

  public get label(): string {
    return `${this.functionName.length > 0 ? this.functionName : ProfileNode.ANONYMOUS}@${this.fileName}:${this.lineNumber + 1}:${this.columnNumber}`;
  }
}
