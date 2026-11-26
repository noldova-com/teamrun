/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CodexSandbox {
  public readonly mode: string;
  public readonly sandbox: string;
  public readonly approvalPolicy: string;

  public constructor(mode: string, sandbox: string, approvalPolicy: string) {
    this.mode = mode;
    this.sandbox = sandbox;
    this.approvalPolicy = approvalPolicy;
  }
}
