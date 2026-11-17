/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SharedMcpValues {
  public static readonly none: SharedMcpValues = new SharedMcpValues(new Map());

  private readonly lookup: (server: string, variable: string) => string | undefined;

  public constructor(values: ReadonlyMap<string, ReadonlyMap<string, string>>) {
    const kept = new Map([...values].map(([server, named]) => [server, new Map(named)] as const));
    this.lookup = (server, variable) => kept.get(server)?.get(variable);
  }

  public valueOf(server: string, variable: string): string | undefined {
    return this.lookup(server, variable);
  }
}
