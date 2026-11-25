/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CodexSandbox {
  public readonly sandbox: string;
  public readonly approvalPolicy: string;

  public constructor(sandbox: string, approvalPolicy: string) {
    this.sandbox = sandbox;
    this.approvalPolicy = approvalPolicy;
  }
}
