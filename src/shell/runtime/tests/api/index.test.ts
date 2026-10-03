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
      "AttachOptions",
      "BackupVerificationException",
      "BuildComparer",
      "BuildMismatchException",
      "BuildRelation",
      "CapabilityToken",
      "ChildProcessStarter",
      "ClientSettings",
      "CommandRegistry",
      "ConnectionException",
      "DataDirectory",
      "DataDirectoryInspection",
      "DataDirectoryInspector",
      "DataDirectoryLocator",
      "DataDirectoryOwnedException",
      "DataDirectoryState",
      "DatabaseBackup",
      "DeclarationsFormatException",
      "DiscoveryFormatException",
      "DiagnosticRedactor",
      "DiscoveryPublisher",
      "DiscoveryReader",
      "Endpoint",
      "EndpointKind",
      "EventChannel",
      "EventRegistry",
      "FolderProtectorFactory",
      "IdleMonitor",
      "LaunchException",
      "LaunchSettings",
      "MethodFailureException",
      "MethodRegistry",
      "Migration",
      "MigratedDatabase",
      "MigrationException",
      "ModuleContext",
      "ModuleDatabase",
      "ModuleDatabaseException",
      "ModuleDeclaration",
      "ModuleDeclarationReader",
      "ModuleHost",
      "ModuleLoadException",
      "NoRuntimeException",
      "NotificationCenter",
      "NotificationHandle",
      "NotificationPolicy",
      "OwnershipLock",
      "OwnershipReleasedException",
      "PackageRuntimePartLoader",
      "PosixFolderProtector",
      "PreShellDataException",
      "PreShellDataFoundException",
      "ProcessLaunchCommand",
      "Refusal",
      "Registration",
      "RegistrationException",
      "RequestContext",
      "RuntimeBuild",
      "RuntimeClient",
      "RuntimeCommand",
      "RuntimeDiscovery",
      "RuntimeEntry",
      "RuntimeHandoverException",
      "RuntimeHost",
      "RuntimeLauncher",
      "RuntimeLog",
      "RuntimeOptions",
      "RuntimeServer",
      "ServerSettings",
      "ServiceAccessException",
      "ServiceRegistry",
      "ShellDatabase",
      "SystemCommand",
      "SystemCommandException",
      "UnknownSchemaException",
      "WindowsFolderProtector",
      "WorkInProgressException",
      "WorkItem",
      "WorkTracker"
    ];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }
}
