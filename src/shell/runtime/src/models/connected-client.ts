/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConnectedClient {
  public readonly connection: number;
  public readonly client: string;

  public constructor(connection: number, client: string) {
    this.connection = connection;
    this.client = client;
  }
}
