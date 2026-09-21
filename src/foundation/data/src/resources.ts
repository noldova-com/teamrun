/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly connectionClosed: string = "The connection is closed.";
  public static readonly containerParameterName: string = "container";
  public static readonly createdAtParameterName: string = "createdAt";
  public static readonly defaultChangeBatch: number = 100;
  public static readonly entityIdParameterName: string = "entityId";
  public static readonly entityParameterName: string = "entity";
  public static readonly fieldsParameterName: string = "fields";
  public static readonly idParameterName: string = "id";
  public static readonly indexWithoutFields: string = "An index names at least one field.";
  public static readonly limitParameterName: string = "limit";
  public static readonly locationParameterName: string = "location";
  public static readonly migrationIdInvalid: string = "A migration id is fourteen digits, an underscore, and a PascalCase name.";
  public static readonly migrationIdPattern: RegExp = /^\d{14}_[A-Z][A-Za-z0-9]*$/;
  public static readonly migrationsUnordered: string = "Migrations are listed once each, in ascending id order.";
  public static readonly nameParameterName: string = "name";
  public static readonly nestedTransactionFailed: string = "An inner transaction failed, so the outer transaction was rolled back.";
  public static readonly sequenceParameterName: string = "sequence";
  public static readonly transactionCompleted: string = "The transaction has already been committed or rolled back.";
  public static readonly transactionRollbackFailed: string = "The transaction failed and rollback also failed.";

  public static formatFieldMissing(field: string): string {
    return `The record has no field "${field}".`;
  }

  public static formatFieldNotInteger(field: string): string {
    return `The field "${field}" does not hold an integer.`;
  }

  public static formatFieldNotText(field: string): string {
    return `The field "${field}" does not hold text.`;
  }
}
