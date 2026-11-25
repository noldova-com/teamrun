/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import * as api from "@noldova/teamrun.providers";

@TestClass
export class ProvidersApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const expected = [
      "AbortTimer", "AgentSdkQueryFactory", "AppServerClient", "AppServerClientInfo", "AppServerException", "AppServerInitialization",
      "AppServerUnavailableException", "BoundedOutput", "ClaudeAdapter", "ClaudeChat", "ClaudeCompactionReader", "ClaudeSessionFile", "ClaudeEnvironment", "ClaudeInput", "ClaudePlan", "ClaudePrompt", "ClaudeRun", "ClaudeSignInReader", "ClaudeSubAgents",
      "ClaudeTasks", "ClaudeTurn", "ClaudeUsageReader", "CodexAccount", "CodexAdapter", "CodexAppServerDownload", "CodexAppServerProgram", "CodexServerChoice", "CodexServerReading", "CodexCompactionReader", "CodexSessionFile", "JsonlTail", "SessionFileCarry", "CodexEnvironment", "CodexItemReader", "CodexLogin", "CodexRateLimits", "CodexRequestRouter", "CodexSubAgents", "CodexTasks", "CodexTurn",
      "CodexUsage", "CodexActivity", "CodexSharedServerStatuses", "CommandLineTool", "CommandResult", "CommandRunner", "CommandSource", "Deadline", "DeltaStream",
      "ExecutableLocator", "ExecutableNotFoundException", "ExecutableSource", "ExecutableVersionReader", "FailureDescriber", "HandlerSubscription",
      "ClaudeInstructions", "InstructionFile", "PersonInstructions", "HomeInstructions", "AntigravityInstructions", "AcpAdapter", "AcpUsageReader", "AcpBackgroundReplies", "AcpActivity", "AcpChannel", "AcpClient", "AcpCommands", "AcpConfigOption", "AcpModelChoices", "AcpModelMember", "AcpSpeedOption", "AcpPermissionSwitch", "AcpGatedTool", "AcpMcpTool", "AcpEnvironment", "AcpKeptSession", "AcpField", "AcpLaunch", "AcpAgentCatalog", "AcpAgentInstaller", "AcpCommandLine", "AcpInstallTools", "AcpRegistryIcons", "DownloadAddress", "GeneralAcpAdapter", "AcpRegistry", "AcpRegistryAgent", "AcpRegistryBinary", "AcpRegistryListing", "AcpRegistryPackage", "AcpRegistrySource", "AcpSession", "AcpSessionOpener", "AcpSubAgents", "AcpTasks", "AcpTerminals", "AcpTurn", "ManagedProfile", "GeneralAcpAgent", "GeminiFolderTrust", "LocalAcpCommand", "GrokAdapter", "GrokAgent", "GrokEnvironment", "GrokHome", "GrokShortHome", "GrokSignOutReader", "GrokSteering", "GrokToolGate",
      "AntigravityAdapter", "AntigravityAgent", "AntigravityQuestionReader", "AntigravityEnvironment", "AntigravityInstaller", "AntigravityInstallation", "AntigravityModelStore", "AntigravityProfile", "AntigravityRelease", "AntigravityServer",
      "OpencodeAdapter", "OpencodeAgent", "OpencodeEnvironment", "OpencodeMcpServers", "OpencodeDataFolder", "OpencodeLevelReader",
      "FxAdapter", "FxAgent", "FxEnvironment", "FxSteering", "FxUsageReader",
      "MuseAdapter", "MuseAgent", "PiAdapter", "PiRpcClient", "PiRpcException", "PiTurn",
      "AcpRequestException", "CopilotAccountReader", "CopilotAdapter", "CopilotAgent", "CopilotHooks", "CopilotModelLister", "CopilotModelReader", "CopilotQuotaReader", "CopilotToDoReader", "CursorAboutReader", "CursorAdapter", "CursorAgent", "CursorEnvironment", "CursorInstaller", "CursorPermissions", "CursorProfile", "CursorRelease", "CursorQuestionReader", "CursorPlanReader", "CursorImageReader", "CursorToDoListReader", "GrokAccountReader", "GrokMcpServersReader", "GrokModelReader", "GrokUsageReader", "MessageFraming",
      "GrokImageReader", "GrokMcpBlockReader", "GrokModelListReader", "GrokQuestionReader", "GrokPlanReader", "ImageDataReader", "SavedImageFile", "SavedImage", "CommandOutputDecoder", "ShellCommandReader", "TaskOutputFollower", "TaskOutputReader", "CommandTitleReader",
      "ShellDialect", "CommandKind", "CommandFlags", "CmdletParameters", "ShellToken", "ShellTokenKind", "ShellTokenReader", "WriteKind", "WriteTargetReader", "WriteTargets",
      "InstallHeldException", "InvalidOperationException", "ModelUnavailableException", "JsonRpcError", "LocatedExecutable", "NodeProcessStarter", "PendingRequest", "ProcessCommand",
      "PowershellSession", "ProcessExit", "ProcessOrigin", "ProcessTerminator", "ProcessTree", "ProviderAbilityTable", "ProviderTimings", "ReadOnlyMcpTools", "Resources", "ServedToolNames", "SharedMcpLaunch", "SharedMcpLauncher", "SharedMcpCommand", "StartedProcess", "TailBuffer", "ThreadStartResult", "TokenTotals", "UsageValues", "PlanDetails",
      "TerminalSignIn", "TerminalToolCall", "TerminalToolReader", "TerminalToolResult", "UnsupportedServerRequestException", "UsualFolder", "ZipDirectory",
      "AcpConnectionException", "AcpRegistryException", "AgentLaunchException", "ConfigurationUnreadableException", "ForkUnavailableException", "InstallCancelledException",
      "InstallFailedException", "ModelListException", "ProfileFolderException", "ProviderRefusedException", "ProviderStoppedException", "ProvidersException", "ReleaseSourceException", "SignInException", "SignOutException",
      "SettingUnavailableException", "TaskException", "ToolsUnavailableException", "UnsupportedVersionException",
      "ArchiveUnpacker", "ClaudeInstaller", "CodexInstaller", "CopilotInstaller", "GrokInstaller", "GrokRelease", "InstallRename", "InstallStaging", "ReleaseDownload", "ReleaseFile"
    ];

    Assert.areEqual([...expected].sort().join(","), Object.keys(api).sort().join(","));
  }
}
