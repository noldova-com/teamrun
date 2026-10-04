/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class GitHubException extends Error {
  public readonly status: number | null;

  public constructor(message: string, options?: ErrorOptions, status: number | null = null) {
    super(message, options);

    this.name = GitHubException.name;
    this.status = status;
  }
}
