/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type MigrationBuilder, SqlMigration } from "@noldova/context.data.sql";
import type { Provider } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class ProviderNamesMigration extends SqlMigration {
  public constructor() {
    super(Resources.providerNamesMigrationId);
  }

  public override apply(builder: MigrationBuilder): void {
    builder.executeSql(Resources.renameProvidersTable);
    builder.executeSql(Resources.renameKindColumn);
    builder.executeSql(Resources.dropLegacyKindIndex);
    builder.createIndex<Provider>(Resources.providersTable, t => t.kind);
    builder.executeSql(Resources.createChangesTable);
    builder.executeSql(Resources.renameProviderEntity);
    for (const field of Resources.renamedProviderFields) {
      const named = Object.isNull(field.name) ? {} : { [Resources.nameColumn]: field.name };
      const entityNamed = Object.isNull(field.name) ? {} : { [Resources.entityIdColumn]: field.name };
      builder.executeSql(Resources.formatRenameJsonField(field.table, Resources.jsonColumn, field.from, field.to, named));
      builder.executeSql(Resources.formatRenameJsonField(Resources.changesTable, Resources.payloadColumn, field.from, field.to,
        { [Resources.entityColumn]: field.entity, ...entityNamed }));
    }
  }
}
