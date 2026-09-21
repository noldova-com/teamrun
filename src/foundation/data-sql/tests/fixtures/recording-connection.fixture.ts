/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { DataRecord, DataSource } from "@noldova/teamrun-foundation-data";
import { SqlConnection, type SqlDialect, type SqlQuery } from "@noldova/teamrun-foundation-data-sql";

import { TestDialect } from "./test-dialect.fixture.js";

export class RecordingConnection extends SqlConnection {
  private open: boolean = true;
  private nextRowId: number = 1;
  private readonly testDialect: SqlDialect = new TestDialect();

  public readonly statements: string[] = [];
  public readonly appliedIds: string[] = [];
  public readonly queryResults: DataRecord[] = [];
  public failingStatement?: string;

  public constructor(dataSource: DataSource = new DataSource("recording", ":memory:")) {
    super(dataSource);
  }

  public override get dialect(): SqlDialect {
    return this.testDialect;
  }

  public override get isOpen(): boolean {
    return this.open;
  }

  public override close(): void {
    this.open = false;
  }

  public override execute(query: SqlQuery): number {
    this.throwIfClosed();
    if (!Object.isUndefined(this.failingStatement) && query.text.includes(this.failingStatement))
      throw new Error(query.text);

    this.statements.push(query.text);
    if (query.text.startsWith("INSERT INTO __migrations") && Object.isString(query.parameters[0]))
      this.appliedIds.push(query.parameters[0]);
    return 1;
  }

  public override insert(query: SqlQuery): number {
    this.execute(query);
    this.nextRowId += 1;
    return this.nextRowId - 1;
  }

  public override query(query: SqlQuery): readonly DataRecord[] {
    this.throwIfClosed();
    this.statements.push(query.text);
    if (query.text.startsWith("SELECT id FROM __migrations"))
      return [...this.appliedIds].sort().map(t => new DataRecord(new Map([["id", t]])));

    return [...this.queryResults];
  }
}
