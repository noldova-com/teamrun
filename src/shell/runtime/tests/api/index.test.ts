/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/teamrun-shell-runtime";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class RuntimeApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const exportNames = [
      "BackupVerificationException",
      "DataDirectory",
      "DataDirectoryInspection",
      "DataDirectoryInspector",
      "DataDirectoryOwnedException",
      "DataDirectoryState",
      "DiscoveryFormatException",
      "DiscoveryReader",
      "DatabaseBackup",
      "DiscoveryPublisher",
      "FolderProtectorFactory",
      "Migration",
      "MigrationException",
      "OwnershipLock",
      "OwnershipReleasedException",
      "PosixFolderProtector",
      "PreShellDataException",
      "RuntimeDiscovery",
      "ShellDatabase",
      "SystemCommand",
      "SystemCommandException",
      "UnknownSchemaException",
      "WindowsFolderProtector"
    ];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }
}
