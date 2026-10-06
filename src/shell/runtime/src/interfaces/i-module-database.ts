/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { SQLInputValue, SQLOutputValue, StatementResultingChanges } from "node:sqlite";

export interface IModuleDatabase {
  read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;

  readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[];

  run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges;

  transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T;
}
