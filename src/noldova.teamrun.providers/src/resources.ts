/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Resources as CoreResources } from "@noldova/teamrun.core";
import { BackgroundTaskStatus, PlanStepStatus, Resources as ProtocolResources, SubAgentStatus } from "@noldova/teamrun.protocol";

import { CommandKind } from "./enums/command-kind.js";
import { ShellDialect } from "./enums/shell-dialect.js";
import { WriteKind } from "./enums/write-kind.js";
import { CmdletParameters } from "./models/cmdlet-parameters.js";
import { CommandFlags } from "./models/command-flags.js";

export class Resources {
  public static readonly acpBase64Encoding: BufferEncoding = "base64";
  public static readonly grokExecutableName: string = "grok";
  public static readonly grokWindowsExecutableName: string = "grok.exe";
  public static readonly grokDirectoryName: string = ".grok";
  public static readonly sessionIdField: string = "sessionId";
  public static readonly nameField: string = "name";
  public static readonly titleField: string = "title";
  public static readonly optionsField: string = "options";
  public static readonly contentField: string = "content";
  public static readonly signInNotSupported: string = "This provider can't start its sign-in from TeamRun.";
  public static readonly signOutNotSupported: string = "This provider can't sign out from TeamRun.";
  public static readonly toolLogoutCommand: string = "/logout";
  public static readonly grokSignInUnavailable: string = "Grok CLI offers no sign-in TeamRun can start. Run grok login with the profile's GROK_HOME.";
  public static readonly xaiLogoutMethods: readonly string[] = ["_x.ai/auth/logout", "x.ai/auth/logout"];
  public static readonly xaiOkField: string = "ok";
  public static readonly xaiApiKeyStillSetField: string = "api_key_still_set";
  public static readonly grokSignOutRefused: string = "Grok answered that it didn't sign out.";
  public static readonly grokApiKeyStillSet: string =
    "Grok signed out of its account but still has an xAI API key, from XAI_API_KEY or saved in the profile folder, and keeps using it.";
  public static readonly grokNotFound: string = "Grok CLI was not found. Install it from https://x.ai/cli.";
  public static readonly grokAgentArguments: readonly string[] = ["--no-auto-update"];
  public static readonly grokPermissionModeArgument: string = "--permission-mode";
  public static readonly grokDefaultPermissionMode: string = "default";
  public static readonly grokAgentCommandArguments: readonly string[] = ["agent", "--no-leader"];
  public static readonly grokStdioCommand: string = "stdio";
  public static readonly grokModelArgument: string = "--model";
  public static readonly grokSubAgentsVariable: string = "GROK_SUBAGENTS";
  public static readonly grokEffortArgument: string = "--reasoning-effort";
  public static readonly copilotKindId: string = "copilot";
  public static readonly copilotDisplayName: string = "GitHub Copilot";
  public static readonly copilotToolTitle: string = "Copilot tool";
  public static readonly copilotExecutableName: string = "copilot";
  public static readonly copilotWindowsExecutableName: string = "copilot.exe";
  public static readonly copilotWindowsShimName: string = "copilot.cmd";
  public static readonly githubScopeName: string = "@github";
  public static readonly copilotPackageName: string = "copilot";
  public static readonly copilotPlatformPackagePrefix: string = "copilot-";
  public static readonly copilotAuthMethod: string = "copilot-login";
  public static readonly copilotDefaultModelName: string = "Auto";
  public static readonly copilotArguments: readonly string[] = ["--acp", "--stdio", "--no-auto-update"];
  public static readonly copilotTitleSessionArguments: readonly string[] = ["--available-tools=none", "--no-ask-user", "--no-custom-instructions"];
  public static readonly copilotNotice: RegExp = /^Info: /u;
  public static readonly copilotEffortArgument: string = "--reasoning-effort";
  public static readonly copilotModelArgument: string = "--model";
  public static readonly maximumEchoedModelName: number = 40;
  public static readonly copilotHeadlessArguments: readonly string[] = ["--headless", "--no-auto-update", "--stdio"];
  public static readonly copilotConnectMethod: string = "connect";
  public static readonly copilotAuthStatusMethod: string = "auth.getStatus";
  public static readonly copilotSessionCreateMethod: string = "session.create";
  public static readonly copilotSessionDeleteMethod: string = "session.delete";
  public static readonly copilotQuotaMethod: string = "session.quota.get";
  public static readonly copilotQuotaRefreshMethod: string = "session.quota.refresh";
  public static readonly copilotQuotaRefusal: RegExp =
    /\b(?:exceeded|exhausted|reached|used up)\s+(?:your|the)\s+(?:\w+\s+){0,2}quota\b|\bquota\s+(?:(?:has|have)\s+been\s+|is\s+|was\s+)?(?:exceeded|exhausted|reached|used up)\b|(?<![a-z])quota_?(?:exceeded|exhausted)(?![a-z])/i;
  public static readonly copilotRefusalDataFields: readonly string[] = ["message", "code", "type", "details"];
  public static readonly copilotRefusalReply: RegExp = /^Error: ([^\n()]{1,200}?)(?:\s*\(Request ID: [^\n()]{1,100}\))?$/;
  public static readonly copilotSessionModelListMethod: string = "session.model.list";
  public static readonly copilotSkipCacheField: string = "skipCache";
  public static readonly copilotFreeUserField: string = "isFreeUser";
  public static readonly copilotPlanTierField: string = "planTier";
  public static readonly copilotFreePlanName: string = "Copilot Free";
  public static readonly copilotListingTimedOut: string = "it timed out";
  public static readonly copilotListingEmpty: string = "its list came back empty";
  public static readonly copilotAuthenticatedField: string = "isAuthenticated";
  public static readonly copilotLoginField: string = "login";
  public static readonly copilotAuthTypeField: string = "authType";
  public static readonly copilotModelListField: string = "list";
  public static readonly copilotCapabilitiesField: string = "capabilities";
  public static readonly copilotSupportsField: string = "supports";
  public static readonly copilotVisionField: string = "vision";
  public static readonly copilotReasoningEffortField: string = "reasoningEffort";
  public static readonly copilotReasoningEffortsField: string = "supportedReasoningEfforts";
  public static readonly copilotListedReasoningEffortField: string = "reasoning_effort";
  public static readonly copilotDefaultReasoningEffortField: string = "defaultReasoningEffort";
  public static readonly copilotPolicyField: string = "policy";
  public static readonly copilotPolicyStateField: string = "state";
  public static readonly copilotDisabledPolicy: string = "disabled";
  public static readonly copilotAutoModelId: string = "auto";
  public static readonly copilotHomeVariable: string = "COPILOT_HOME";
  public static readonly copilotHomeFolderName: string = ".copilot";
  public static readonly copilotProfileEntries: readonly string[] = ["config.json", "session-state", "history-session-state", "logs"];
  public static readonly copilotMcpConfigFile: string = "mcp-config.json";
  public static readonly copilotMcpServersField: string = "mcpServers";
  public static readonly copilotProjectMcpFile: string = ".mcp.json";
  public static readonly copilotGitHubFolder: string = ".github";
  public static readonly copilotMcpFile: string = "mcp.json";
  public static readonly copilotGitFolder: string = ".git";
  public static readonly copilotPluginsFolder: string = "installed-plugins";
  public static readonly copilotSettingsFile: string = "settings.json";
  public static readonly copilotHooksFolder: string = "hooks";
  public static readonly copilotHooksField: string = "hooks";
  public static readonly copilotHookFileExtension: string = ".json";
  public static readonly copilotPluginHookFiles: readonly (readonly string[])[] = [["hooks.json"], ["hooks", "hooks.json"]];
  public static readonly copilotPolicyFolder: string = "/etc/github-copilot/policy.d";
  public static readonly copilotWindowsPolicySegments: readonly string[] = ["GitHub", "Copilot", "policy.d"];
  public static readonly programDataVariable: string = "ProgramData";
  public static readonly windowsProgramData: string = "C:\\ProgramData";
  public static readonly copilotEnabledPluginsField: string = "enabledPlugins";
  public static readonly copilotCommentLine: RegExp = /^[ \t]*\/\/.*$/gm;
  public static readonly missingFileCode: string = "ENOENT";
  public static readonly copilotDisableBuiltinMcpsArgument: string = "--disable-builtin-mcps";
  public static readonly copilotDisableMcpServerArgument: string = "--disable-mcp-server";
  public static readonly copilotSharedStdioRefused: string = "GitHub Copilot refuses a stdio MCP server TeamRun passes it, and takes only HTTP ones.";
  public static readonly copilotSharedStdioRefusedShort: string = "takes HTTP servers only";
  public static readonly copilotSharedServerNamedLikeOwnShort: string = "has its own server by this name";
  public static readonly copilotSharedServerNamedLikeOwn: string = "GitHub Copilot has an MCP server of its own by this name. TeamRun turns "
    + "Copilot's own servers off by name, which would turn this one off too, and while they're on, both load under one name and which one Copilot uses is unknown.";
  public static readonly copilotAllowToolArgument: string = "--allow-tool";
  public static readonly copilotUserMcpSource: string = "user";
  public static readonly copilotProjectMcpSource: string = "project";
  public static readonly copilotPluginMcpSource: string = "plugin";
  public static readonly museKindId: string = "muse";
  public static readonly museDisplayName: string = "Muse Code";
  public static readonly museSignInCommand: string = "muse login";
  public static readonly museSignOutCommand: string = "muse logout";
  public static readonly musePosixInstallCommand: string = "curl -fsSL https://dev.meta.ai/install.sh | sh";
  public static readonly museWindowsInstallCommand: string = "irm https://dev.meta.ai/install.ps1 | iex";
  public static readonly museSubscribeUrl: string = "https://dev.meta.ai";
  public static readonly museExecutableName: string = "muse";
  public static readonly museWindowsShimName: string = "muse.cmd";
  public static readonly museVersionFile: string = ".muse-version";
  public static readonly museBinaryPrefix: string = "muse-bin-";
  public static readonly museWindowsBinarySuffix: string = ".exe";
  public static readonly museInstallDirectoryVariable: string = "MUSE_INSTALL_DIR";
  public static readonly museWindowsInstallSegments: readonly string[] = ["Programs", "muse"];
  public static readonly museUnixInstallSegments: readonly string[] = [".local", "bin"];
  public static readonly museConfigFolderName: string = ".config";
  public static readonly museSettingsFolder: string = "muse";
  public static readonly museSettingsFile: string = "settings.json";
  public static readonly museSchemaVersionField: string = "schema_version";
  public static readonly museSchemaVersion: number = 1;
  public static readonly museAcpArgument: string = "acp";
  public static readonly museNoSessionLogArgument: string = "--no-session-log";
  public static readonly museAcpGateVariable: string = "MUSE_EXPERIMENTAL_ACP";
  public static readonly museAcpGateOn: string = "on";
  public static readonly museExcludedEnvironment: RegExp = /^MUSE_EXPERIMENTAL_SDK_ENABLED$/iu;
  public static readonly museMacPlatform: string = "darwin";
  public static readonly museOneAccountPerMac: string =
    "Muse Code keeps its sign-in in this Mac's keychain, which every Muse Code profile shares, so TeamRun takes one Muse Code provider per Mac.";
  public static readonly museSignedOutRefusal: string = "log in to muse before opening a session";
  public static readonly museSignIn: string = "Muse Code isn't signed in. Choose Sign in in the provider's menu, or run muse login in a terminal.";
  public static readonly codexOwnMcpServersNote: string = "This switch also covers the apps connected to your Codex account, such as mail and files.";
  public static readonly claudeOwnMcpServersNote: string = "This switch also covers the connectors on your Claude account, such as mail and files.";
  public static readonly codexOwnMcpServersShortNote: string = "the apps on your Codex account";
  public static readonly claudeOwnMcpServersShortNote: string = "your Claude account's connectors";
  public static readonly piKindId: string = "pi";
  public static readonly piDisplayName: string = "Pi";
  public static readonly piSignInCommand: string = "pi";
  public static readonly piPosixInstallCommand: string = "curl -fsSL https://pi.dev/install.sh | sh";
  public static readonly piWindowsInstallCommand: string = "npm i -g @earendil-works/pi-coding-agent";
  public static readonly piLauncherSegments: readonly string[] = [".pi", "agent", "bin", "pi"];
  public static readonly piExecutableName: string = "pi";
  public static readonly piWindowsShimName: string = "pi.cmd";
  public static readonly piWindowsNodeName: string = "node.exe";
  public static readonly piScriptSegments: readonly string[] = ["@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"];
  public static readonly piAgentDirectoryVariable: string = "PI_CODING_AGENT_DIR";
  public static readonly piAgentDirectoryName: string = ".pi/agent";
  public static readonly piModeVariable: string = "TEAMRUN_PI_MODE";
  public static readonly piToolsUrlVariable: string = "TEAMRUN_PI_TOOLS_URL";
  public static readonly piToolsTokenVariable: string = "TEAMRUN_PI_TOOLS_TOKEN";
  public static readonly piDirectExposure: string = "direct";
  public static readonly piSharedServersVariable: string = "TEAMRUN_PI_SHARED_SERVERS";
  public static readonly piOwnVariablePrefix: string = "TEAMRUN_PI_";
  public static readonly piAuthFile: string = "auth.json";
  public static readonly piSettingsFile: string = "settings.json";
  public static readonly piExtensionFile: string = "teamrun-approvals.js";
  public static readonly piMinimumVersion: readonly number[] = [1, 1, 0];
  public static readonly piVersionPattern: RegExp = /^(\d+)\.(\d+)\.(\d+)/u;
  public static readonly piModeArgument: string = "--mode";
  public static readonly piRpcMode: string = "rpc";
  public static readonly piExtensionArgument: string = "--extension";
  public static readonly piSessionArgument: string = "--session";
  public static readonly piNoSessionArgument: string = "--no-session";
  public static readonly piNoToolsArgument: string = "--no-tools";
  public static readonly piNoExtensionsArgument: string = "--no-extensions";
  public static readonly piBuiltInProviderExtensions: readonly string[] = ["builtin:llama.cpp"];
  public static readonly piSetupOffArguments: readonly string[] = ["--no-mcp", "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-themes"];
  public static readonly piUnknownProvider: string = "unknown";
  public static readonly piAuthCheckArguments: readonly string[] = ["auth", "check", "--provider"];
  public static readonly piJsonArgument: string = "--json";
  public static readonly piAskMode: string = "ask";
  public static readonly piAskModeName: string = "Ask first";
  public static readonly piAskModeDescription: string = "Asks before Pi runs a command, changes a file or uses an MCP tool.";
  public static readonly piReadOnlyMode: string = "read-only";
  public static readonly piReadOnlyModeName: string = "Read only";
  public static readonly piReadOnlyModeDescription: string = "Pi reads and searches files, and runs no command, changes no file and uses no MCP tool.";
  public static readonly piAllowAllMode: string = "allow-all";
  public static readonly piAllowAllModeName: string = "Allow all";
  public static readonly piAllowAllModeDescription: string = "Pi runs commands, changes files and uses MCP tools without asking.";
  public static readonly piApprovalTitle: string = "teamrun-approval";
  public static readonly piReadOnlyTools: readonly string[] = ["read", "grep", "find", "ls"];
  public static readonly piApprovalsExtension: string = [
    `const readOnlyTools = ${JSON.stringify(Resources.piReadOnlyTools)};`,
    "export default function (pi) {",
    "  pi.on(\"tool_call\", async (event, ctx) => {",
    `    const mode = process.env[${JSON.stringify(Resources.piModeVariable)}];`,
    `    if (mode === ${JSON.stringify(Resources.piAllowAllMode)} || readOnlyTools.includes(event.toolName))`,
    "      return undefined;",
    `    if (mode === ${JSON.stringify(Resources.piReadOnlyMode)})`,
    "      return { block: true, reason: \"TeamRun runs this Pi chat read-only.\" };",
    `    const allowed = await ctx.ui.confirm(${JSON.stringify(Resources.piApprovalTitle)}, JSON.stringify({ toolName: event.toolName, input: event.input }));`,
    "    return allowed ? undefined : { block: true, reason: \"The person refused this tool in TeamRun.\" };",
    "  });",
    "  const register = (name, config) => {",
    "    try {",
    "      pi.registerMcpServer(name, config);",
    "    }",
    "    catch {",
    "    }",
    "  };",
    `  const toolsUrl = process.env[${JSON.stringify(Resources.piToolsUrlVariable)}];`,
    "  if (toolsUrl)",
    `    register(${JSON.stringify(ProtocolResources.mcpServerName)}, { url: toolsUrl, exposure: ${JSON.stringify(Resources.piDirectExposure)},`,
    `      headers: { ${JSON.stringify(ProtocolResources.authorizationHeaderName)}: "Bearer " + process.env[${JSON.stringify(Resources.piToolsTokenVariable)}] } });`,
    `  const shared = process.env[${JSON.stringify(Resources.piSharedServersVariable)}];`,
    "  if (shared)",
    "    for (const [name, config] of Object.entries(JSON.parse(shared)))",
    "      register(name, config);",
    "}",
    ""].join("\n");
  public static readonly piCommandTools: readonly string[] = ["bash", "powershell"];
  public static readonly piFileTools: readonly string[] = ["edit", "write"];
  public static readonly piThinkingLevels: readonly string[] = ["off", "minimal", "low", "medium", "high"];
  public static readonly piExtendedThinkingLevels: readonly string[] = ["xhigh", "max"];
  public static readonly piThinkingLevelMapField: string = "thinkingLevelMap";
  public static readonly piCompactionReasonField: string = "reason";
  public static readonly piManualCompaction: string = "manual";
  public static readonly piModelSeparator: string = "/";
  public static readonly piRequestIdPrefix: string = "teamrun-";
  public static readonly piItemPrefix: string = "pi";
  public static readonly piResponseType: string = "response";
  public static readonly piExtensionRequestType: string = "extension_ui_request";
  public static readonly piExtensionResponseType: string = "extension_ui_response";
  public static readonly piNotifyMethod: string = "notify";
  public static readonly piConfirmMethod: string = "confirm";
  public static readonly piDialogMethods: readonly string[] = ["select", "confirm", "input", "editor"];
  public static readonly piSelectMethod: string = "select";
  public static readonly piTimeoutField: string = "timeout";
  public static readonly piDialogTimeoutMargin: number = 1_000;
  public static readonly piPromptCommand: string = "prompt";
  public static readonly piAbortCommand: string = "abort";
  public static readonly piSteerCommand: string = "steer";
  public static readonly piGetStateCommand: string = "get_state";
  public static readonly piGetModelsCommand: string = "get_available_models";
  public static readonly piSetModelCommand: string = "set_model";
  public static readonly piSetThinkingCommand: string = "set_thinking_level";
  public static readonly piCompactCommand: string = "compact";
  public static readonly piGetStatsCommand: string = "get_session_stats";
  public static readonly piGetForkMessagesCommand: string = "get_fork_messages";
  public static readonly piGetCommandsCommand: string = "get_commands";
  public static readonly piForkCommand: string = "fork";
  public static readonly piCloneCommand: string = "clone";
  public static readonly piMessageStartEvent: string = "message_start";
  public static readonly piMessageUpdateEvent: string = "message_update";
  public static readonly piMessageEndEvent: string = "message_end";
  public static readonly piToolStartEvent: string = "tool_execution_start";
  public static readonly piToolEndEvent: string = "tool_execution_end";
  public static readonly piCompactionEndEvent: string = "compaction_end";
  public static readonly piRetryStartEvent: string = "auto_retry_start";
  public static readonly piExtensionErrorEvent: string = "extension_error";
  public static readonly piSettledEvent: string = "agent_settled";
  public static readonly piTextDelta: string = "text_delta";
  public static readonly piThinkingDelta: string = "thinking_delta";
  public static readonly piAssistantRole: string = "assistant";
  public static readonly piErrorStopReason: string = "error";
  public static readonly piHandledDisposition: string = "handled";
  public static readonly piImageType: string = "image";
  public static readonly piBase64Encoding: BufferEncoding = "base64";
  public static readonly piAllowDecision: string = "allow";
  public static readonly piDenyDecision: string = "deny";
  public static readonly piAssistantMessageEventField: string = "assistantMessageEvent";
  public static readonly piContentIndexField: string = "contentIndex";
  public static readonly piStopReasonField: string = "stopReason";
  public static readonly piErrorMessageField: string = "errorMessage";
  public static readonly piCacheReadField: string = "cacheRead";
  public static readonly piCacheWriteField: string = "cacheWrite";
  public static readonly piToolNameField: string = "toolName";
  public static readonly piToolCallIdField: string = "toolCallId";
  public static readonly piArgsField: string = "args";
  public static readonly piIsErrorField: string = "isError";
  public static readonly piAbortedField: string = "aborted";
  public static readonly piDispositionField: string = "disposition";
  public static readonly piSessionFileField: string = "sessionFile";
  public static readonly piSessionIdField: string = "sessionId";
  public static readonly piThinkingLevelField: string = "thinkingLevel";
  public static readonly piModelsField: string = "models";
  public static readonly piCommandsField: string = "commands";
  public static readonly piMessagesField: string = "messages";
  public static readonly piEntryIdField: string = "entryId";
  public static readonly piCancelledField: string = "cancelled";
  public static readonly piContextUsageField: string = "contextUsage";
  public static readonly piTokensField: string = "tokens";
  public static readonly piContextWindowField: string = "contextWindow";
  public static readonly piDefaultProviderField: string = "defaultProvider";
  public static readonly piReasoningField: string = "reasoning";
  public static readonly piImagesField: string = "images";
  public static readonly piCommandField: string = "command";
  public static readonly costField: string = "cost";
  public static readonly inputField: string = "input";
  public static readonly roleField: string = "role";
  public static readonly providerField: string = "provider";
  public static readonly lineFeedByte: number = 0x0a;
  public static readonly maximumToolOutputLength: number = 4000;
  public static readonly piCompactTimeout: number = 600_000;
  public static readonly piNotFound: string = "TeamRun can't find Pi's pi command. Install Pi with curl -fsSL https://pi.dev/install.sh | sh, or on Windows with npm i -g @earendil-works/pi-coding-agent, then check again.";
  public static readonly piChooseModel: string = "Pi has no default model yet: choose a model in Pi, then check again.";
  public static readonly piSignInUnavailable: string = "Pi signs in in a terminal: choose Sign in, which opens pi, and type /login there.";
  public static readonly piNoResult: string = "Pi ended the turn without a result.";
  public static readonly piCompacted: string = "Pi compacted its context.";
  public static readonly piForkCancelled: string = "A Pi extension cancelled the fork.";
  public static readonly piAlreadyStarted: string = "Pi has already started.";
  public static readonly copilotSignInCommand: string = "copilot login";
  public static readonly copilotToolCommand: string = "copilot";
  public static readonly copilotExcludedEnvironment: RegExp = /^(?:GROK|XAI|CODEX|CLAUDE|ANTHROPIC|OPENAI|GEMINI|GOOGLE|AWS|AZURE)(?:_|$)|^COPILOT_(?:ALLOW_ALL|HOME)$/i;
  public static readonly copilotProfileExcludedEnvironment: RegExp = /^(?:COPILOT_GITHUB_TOKEN|GH_TOKEN|GITHUB_TOKEN)$/i;
  public static readonly copilotSessionStateFolderName: string = "session-state";
  public static readonly copilotSessionDatabaseName: string = "session.db";
  public static readonly copilotToDoWritePattern: RegExp =
    /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM|REPLACE\s+INTO)\s+(?:["'`[]?main["'`\]]?\s*\.\s*)?["'`[]?todos\b/i;
  public static readonly copilotToDoQuery: string = "SELECT substr(title, 1, ?) AS title, status FROM todos ORDER BY created_at, rowid LIMIT ?";
  public static readonly copilotToDoBusyTimeout: number = 250;
  public static readonly copilotDetailedContentField: string = "detailedContent";
  public static readonly copilotSqlOutputPrefix: string = "SQL: ";
  public static readonly maximumCopilotToDos: number = 100;
  public static readonly copilotToDoStatuses: Readonly<Record<string, PlanStepStatus>> = {
    pending: PlanStepStatus.Pending,
    in_progress: PlanStepStatus.InProgress,
    done: PlanStepStatus.Completed
  };
  public static readonly copilotNotFound: string = "GitHub Copilot CLI was not found. Install it from Add provider on the Providers tab.";
  public static readonly copilotSignInUnavailable: string = "GitHub Copilot CLI signs in in a terminal: run copilot login, then refresh.";
  public static readonly acpInitialize: string = "initialize";
  public static readonly acpAuthenticate: string = "authenticate";
  public static readonly acpSessionNew: string = "session/new";
  public static readonly acpLogout: string = "logout";
  public static readonly acpAuthField: string = "auth";
  public static readonly acpLogoutField: string = "logout";
  public static readonly acpSessionLoad: string = "session/load";
  public static readonly acpSessionPrompt: string = "session/prompt";
  public static readonly acpSessionCancel: string = "session/cancel";
  public static readonly acpSessionSetModel: string = "session/set_model";
  public static readonly acpSessionResume: string = "session/resume";
  public static readonly acpSessionOpenMethods: readonly string[] = [Resources.acpSessionNew, Resources.acpSessionLoad, Resources.acpSessionResume];
  public static readonly acpMcpServersField: string = "mcpServers";
  public static readonly acpSessionSetConfigOption: string = "session/set_config_option";
  public static readonly acpSessionClose: string = "session/close";
  public static readonly acpConfigOptionsField: string = "configOptions";
  public static readonly acpSelectType: string = "select";
  public static readonly acpCategoryField: string = "category";
  public static readonly acpCurrentValueField: string = "currentValue";
  public static readonly acpValueField: string = "value";
  public static readonly acpGroupField: string = "group";
  public static readonly acpGroupNameField: string = "groupName";
  public static readonly familyIdParameterName: string = "familyId";
  public static readonly familyNameParameterName: string = "familyName";
  public static readonly levelNameParameterName: string = "levelName";
  public static readonly choicesParameterName: string = "choices";
  public static readonly speedValuesMismatch: string = "A speed option has at least one speed, each set by a choice of its own.";
  public static readonly optionIdParameterName: string = "optionId";
  public static readonly modeParameterName: string = "mode";
  public static readonly onValueParameterName: string = "onValue";
  public static readonly offValueParameterName: string = "offValue";
  public static readonly serverParameterName: string = "server";
  public static readonly toolParameterName: string = "tool";
  public static readonly toolUseIdParameterName: string = "toolUseId";
  public static readonly antigravityLevelIdPattern: RegExp = /^(.+)-(high|medium|low)$/;
  public static readonly antigravityLevelNamePattern: RegExp = /^(.+) \((High|Medium|Low)\)$/;
  public static readonly acpDefaultLevelName: string = "Standard";
  public static readonly acpLevelNamePattern: RegExp = /^(minimal|low|medium|high|xhigh|max)$/i;
  public static readonly acpAgentInfoField: string = "agentInfo";
  public static readonly acpVersionField: string = "version";
  public static readonly acpModelCategory: string = "model";
  public static readonly acpThoughtLevelCategory: string = "thought_level";
  public static readonly acpResourceLinkType: string = "resource_link";
  public static readonly acpSessionCapabilitiesField: string = "sessionCapabilities";
  public static readonly acpResumeCapabilityField: string = "resume";
  public static readonly acpCloseCapabilityField: string = "close";
  public static readonly profileMarker: string = ".teamrun-managed-profile";
  public static readonly profileDirectoryParameter: string = "profileDirectory";
  public static readonly acpModelsField: string = "models";
  public static readonly acpStopReasonField: string = "stopReason";
  public static readonly acpEndTurn: string = "end_turn";
  public static readonly acpRefusal: string = "refusal";
  public static readonly grokKindId: string = "grok";
  public static readonly grokDisplayName: string = "Grok";
  public static readonly acpMetaField: string = "_meta";
  public static readonly fxMetaField: string = "fx";
  public static readonly fxSteerField: string = "steer";
  public static readonly fxSteeringField: string = "steering";
  public static readonly fxAbsorbedSteering: string = "absorbed";
  public static readonly grokModelStateField: string = "modelState";
  public static readonly acpCurrentModelField: string = "currentModelId";
  public static readonly acpModelIdField: string = "modelId";
  public static readonly acpAvailableModelsField: string = "availableModels";
  public static readonly acpCapabilitiesField: string = "agentCapabilities";
  public static readonly acpPromptCapabilitiesField: string = "promptCapabilities";
  public static readonly acpImageCapabilityField: string = "image";
  public static readonly acpMcpCapabilitiesField: string = "mcpCapabilities";
  public static readonly acpHttpCapabilityField: string = "http";
  public static readonly acpHttpServerType: string = "http";
  public static readonly grokReasoningEffortsField: string = "reasoningEfforts";
  public static readonly grokValueField: string = "value";
  public static readonly grokLabelField: string = "label";
  public static readonly grokDefaultField: string = "default";
  public static readonly grokReasoningEffortField: string = "reasoningEffort";
  public static readonly grokSupportsReasoningEffortField: string = "supportsReasoningEffort";
  public static readonly grokFallbackModels: readonly string[] = ["grok-4.6", "grok-4.5"];
  public static readonly codexDefaultReasoningEffortField: string = "defaultReasoningEffort";
  public static readonly codexEffortNames: Readonly<Record<string, string>> = { xhigh: "Extra high" };
  public static readonly codexServiceTiersField: string = "serviceTiers";
  public static readonly codexSpeedTiersField: string = "additionalSpeedTiers";
  public static readonly codexDefaultServiceTierField: string = "defaultServiceTier";
  public static readonly codexServiceTierField: string = "serviceTier";
  public static readonly codexStandardTier: string = "standard";
  public static readonly codexStandardTierName: string = "Standard";
  public static readonly codexTierNotServedReason: string = "tier_not_served";
  public static readonly codexModelContextWindowSetting: string = "model_context_window";
  public static readonly codexContextWindowMinimum: number = 64_000;
  public static readonly codexUnreportedContextWindow: number = 128_000;
  public static readonly codexContextWindowPresets: readonly number[] = [128_000, 256_000, 500_000];
  public static readonly codexUsableWindowShare: number = 0.95;
  public static readonly codexWindowRounding: number = 1_000;
  public static readonly codexToolsAwaitTasks: string = "TeamRun's tools are unavailable in this turn until the chat's background tasks end.";
  public static readonly codexSenderRefused: string = "The teamrun command from Codex's shell doesn't act as this reply: another reply still "
    + "takes the token Codex's thread holds.";
  public static readonly codexWakeTaken: string = "Codex's next turn on this chat took the sub-agent's result, so no turn ran for it here.";
  public static readonly grokAgentVersionField: string = "agentVersion";
  public static readonly acpAuthMethodsField: string = "authMethods";
  public static readonly acpAgentAuthType: string = "agent";
  public static readonly grokCachedAuthMethod: string = "cached_token";
  public static readonly grokRoutedMcpTool: string = "use_tool";
  public static readonly acpSessionUpdate: string = "session/update";
  public static readonly acpUpdateField: string = "update";
  public static readonly acpSessionUpdateField: string = "sessionUpdate";
  public static readonly acpCompactionUpdate: string = "compaction_update";
  public static readonly acpAvailableCommandsUpdate: string = "available_commands_update";
  public static readonly acpAvailableCommandsField: string = "availableCommands";
  public static readonly acpCommandPrefix: string = "/";
  public static readonly acpCommandPrefixPattern: RegExp = /^\//u;
  public static readonly acpCommandNameEndPattern: RegExp = /\s/u;
  public static readonly acpCompactionCompleted: string = "completed";
  public static readonly acpCompactionIdField: string = "compactionId";
  public static readonly xaiSessionNotificationMethods: readonly string[] = ["_x.ai/session_notification", "x.ai/session_notification"];
  public static readonly xaiAutoCompactCompleted: string = "auto_compact_completed";
  public static readonly xaiRetryState: string = "retry_state";
  public static readonly xaiRetryFailed: string = "failed";
  public static readonly xaiErrorTypeField: string = "errorType";
  public static readonly xaiContextLengthError: string = "context_length";
  public static readonly xaiAskUserQuestionMethods: readonly string[] = ["_x.ai/ask_user_question", "x.ai/ask_user_question"];
  public static readonly xaiAskUserQuestionTool: string = "ask_user_question";
  public static readonly xaiOutcomeField: string = "outcome";
  public static readonly xaiExitPlanModeMethods: readonly string[] = ["_x.ai/exit_plan_mode", "x.ai/exit_plan_mode"];
  public static readonly xaiExitPlanModeTool: string = "exit_plan_mode";
  public static readonly xaiPlanContentField: string = "planContent";
  public static readonly xaiHooksRunMethods: readonly string[] = ["_x.ai/hooks/run", "x.ai/hooks/run"];
  public static readonly xaiHooksField: string = "x.ai/hooks";
  public static readonly xaiHookDecisionsField: string = "decisions";
  public static readonly xaiHookDecisionField: string = "decision";
  public static readonly xaiHookDeny: string = "deny";
  public static readonly xaiHookReasonField: string = "reason";
  public static readonly xaiHookCallbackIdsField: string = "hookCallbackIds";
  public static readonly xaiHookEventField: string = "hookEventName";
  public static readonly xaiPreToolUseEvent: string = "PreToolUse";
  public static readonly xaiPreToolUseWireEvent: string = "pre_tool_use";
  public static readonly xaiToolUseIdField: string = "toolUseId";
  public static readonly xaiToolNameField: string = "toolName";
  public static readonly xaiReadOnlyField: string = "read_only";
  public static readonly xaiMcpToolSeparator: string = "__";
  public static readonly grokReadOnlyHookId: string = "teamrun-read-only-chat";
  public static readonly xaiApprovedOutcome: string = "approved";
  public static readonly xaiAcceptedOutcome: string = "accepted";
  public static readonly xaiOtherAnswer: string = "Other";
  public static readonly xaiAnnotationsField: string = "annotations";
  public static readonly xaiNotesField: string = "notes";
  public static readonly xaiSubAgentSpawned: string = "subagent_spawned";
  public static readonly xaiSubAgentProgress: string = "subagent_progress";
  public static readonly xaiSubAgentFinished: string = "subagent_finished";
  public static readonly xaiSubAgentUpdates: readonly string[] = [Resources.xaiSubAgentSpawned, Resources.xaiSubAgentProgress, Resources.xaiSubAgentFinished];
  public static readonly xaiChildSessionField: string = "child_session_id";
  public static readonly xaiSubAgentIdField: string = "subagent_id";
  public static readonly xaiSubAgentIdParam: string = "subagentId";
  public static readonly xaiSubAgentCancelMethods: readonly string[] = ["_x.ai/subagent/cancel", "x.ai/subagent/cancel"];
  public static readonly xaiCancelledField: string = "cancelled";
  public static readonly xaiSubAgentTypeField: string = "subagent_type";
  public static readonly xaiToolCallCountField: string = "tool_call_count";
  public static readonly xaiToolCallsField: string = "tool_calls";
  public static readonly xaiTokensUsedField: string = "tokens_used";
  public static readonly xaiDurationField: string = "duration_ms";
  public static readonly xaiBackgroundField: string = "background";
  public static readonly xaiRunInBackgroundField: string = "run_in_background";
  public static readonly xaiToolMetaField: string = "x.ai/tool";
  public static readonly xaiRequestingSessionField: string = "x.ai/requestingSessionId";
  public static readonly xaiSpawnSubAgentTool: string = "spawn_subagent";
  public static readonly xaiSubAgentStatuses: ReadonlyMap<string, SubAgentStatus> = new Map([["completed", SubAgentStatus.Completed], ["failed", SubAgentStatus.Failed],
    ["cancelled", SubAgentStatus.Stopped]]);
  public static readonly copilotMetaField: string = "github.com/copilot";
  public static readonly copilotAgentIdField: string = "agentId";
  public static readonly copilotAgentTypeField: string = "agent_type";
  public static readonly copilotModeField: string = "mode";
  public static readonly copilotBackgroundMode: string = "background";
  public static readonly copilotSessionEventMethods: readonly string[] = ["_github.com/copilot/sessionEvent", "github.com/copilot/sessionEvent"];
  public static readonly copilotEventsField: string = "events";
  public static readonly copilotSubAgentStarted: string = "subagent.started";
  public static readonly copilotSubAgentCompleted: string = "subagent.completed";
  public static readonly antigravitySubagentsField: string = "Subagents";
  public static readonly antigravityTypeNameField: string = "TypeName";
  public static readonly antigravityRoleField: string = "Role";
  public static readonly antigravityStartSubAgentTitle: string = "Running start_subagent";
  public static readonly copilotTotalToolCallsField: string = "totalToolCalls";
  public static readonly copilotCancelledField: string = "cancelled";
  public static readonly copilotReadKind: string = "read";
  public static readonly copilotReadAgentIdField: string = "agent_id";
  public static readonly copilotTurnPattern: RegExp = /\n\n\[Turn \d+\]\n/;
  public static readonly copilotAgentStatusPattern: RegExp = /(?:^|, )status: ([a-z_]+)(?:,|$)/m;
  public static readonly copilotFinishedStatuses: readonly string[] = ["idle", "completed"];
  public static readonly copilotRepliesSeparator: string = "\n\n";
  public static readonly acpUnnamedSubAgent: string = "A sub-agent";
  public static readonly acpSubAgentDescription: string = "Sub-agent";
  public static readonly acpFailedStatus: string = "failed";
  public static readonly xaiTaskBackgroundedMethods: readonly string[] = ["_x.ai/task_backgrounded", "x.ai/task_backgrounded"];
  public static readonly xaiTaskCompletedMethods: readonly string[] = ["_x.ai/task_completed", "x.ai/task_completed"];
  public static readonly xaiTaskIdField: string = "task_id";
  public static readonly xaiToolCallIdField: string = "tool_call_id";
  public static readonly xaiTaskSnapshotField: string = "task_snapshot";
  public static readonly xaiBackgroundTasks: string = "background_tasks";
  public static readonly xaiTasksField: string = "tasks";
  public static readonly xaiRunningStatus: string = "running";
  public static readonly xaiBackgroundTaskStarted: string = "BackgroundTaskStarted";
  public static readonly xaiProcessIdField: string = "pid";
  public static readonly xaiExitCodeField: string = "exit_code";
  public static readonly xaiExplicitlyKilledField: string = "explicitly_killed";
  public static readonly xaiWillWakeField: string = "will_wake";
  public static readonly xaiTurnCompleted: string = "turn_completed";
  public static readonly xaiStopReasonField: string = "stop_reason";
  public static readonly xaiPromptIdField: string = "promptId";
  public static readonly xaiPromptIdSnakeField: string = "prompt_id";
  public static readonly xaiWakePromptPrefix: string = "task-completed-";
  public static readonly xaiSubAgentWakePromptPrefix: string = "subagent-completed-";
  public static readonly outputField: string = "output";
  public static readonly acpMessageChunk: string = "agent_message_chunk";
  public static readonly acpThoughtChunk: string = "agent_thought_chunk";
  public static readonly acpUserChunk: string = "user_message_chunk";
  public static readonly xaiPromptIndexField: string = "promptIndex";
  public static readonly promptIndexPattern: RegExp = /^\d+$/;
  public static readonly acpToolCall: string = "tool_call";
  public static readonly acpToolUpdate: string = "tool_call_update";
  public static readonly acpPlanUpdate: string = "plan";
  public static readonly acpCurrentModeUpdate: string = "current_mode_update";
  public static readonly acpEntriesField: string = "entries";
  public static readonly acpPlanStatuses: Readonly<Record<string, PlanStepStatus>> = {
    pending: PlanStepStatus.Pending,
    in_progress: PlanStepStatus.InProgress,
    completed: PlanStepStatus.Completed
  };
  public static readonly planDetailId: string = "teamrun-plan";
  public static readonly planTextDetailId: string = "teamrun-plan-text";
  public static readonly acpUsageUpdate: string = "usage_update";
  public static readonly acpSessionInfoUpdate: string = "session_info_update";
  public static readonly acpTitleSpaces: RegExp = /\s+/gu;
  public static readonly acpTitleCutEnd: RegExp = /(?:\u2026|\.\.\.)$/u;
  public static readonly compactionPayload: JsonObject = { [CoreResources.compactionField]: true };
  public static formatClaudeCompactSummaryNotText(file: string): string {
    return `The compact summary in ${file} isn't text.`;
  }

  public static readonly codexOwnComputerToolsOff: JsonObject = { browser_use: false, computer_use: false };
  public static readonly codexNoToolsConfig: JsonObject = {
    plugins: {},
    notify: [],
    features: { plugins: false, hooks: false, shell_tool: false, unified_exec: false, multi_agent: false, multi_agent_v2: false, apps: false, goals: false,
      image_generation: false, view_image: false, sleep_tool: false, skill_search: false, tool_suggest: false, browser_use: false, computer_use: false, in_app_browser: false,
      memories: false, skill_mcp_dependency_install: false, workspace_dependencies: false, code_mode_host: false },
    tools: { update_plan: { enabled: false }, view_image: false },
    web_search: "disabled"
  };
  public static readonly acpRequestPermission: string = "session/request_permission";
  public static readonly acpElicitationCreate: string = "elicitation/create";
  public static readonly acpTerminalCreate: string = "terminal/create";
  public static readonly acpTerminalOutput: string = "terminal/output";
  public static readonly acpTerminalWaitForExit: string = "terminal/wait_for_exit";
  public static readonly acpTerminalKill: string = "terminal/kill";
  public static readonly acpTerminalRelease: string = "terminal/release";
  public static readonly acpTerminalMethods: readonly string[] = [Resources.acpTerminalCreate, Resources.acpTerminalOutput, Resources.acpTerminalWaitForExit,
    Resources.acpTerminalKill, Resources.acpTerminalRelease];
  public static readonly acpTerminalIdField: string = "terminalId";
  public static readonly acpTerminalType: string = "terminal";
  public static readonly acpArgsField: string = "args";
  public static readonly acpEnvField: string = "env";
  public static readonly acpOutputByteLimitField: string = "outputByteLimit";
  public static readonly acpTruncatedField: string = "truncated";
  public static readonly acpExitStatusField: string = "exitStatus";
  public static readonly acpSignalField: string = "signal";
  public static readonly acpTerminalIdPrefix: string = "teamrun-terminal-";
  public static readonly acpTerminalCommandSeparator: string = " ";
  public static readonly acpTerminalOutputLimit: number = 1024 * 1024;
  public static readonly acpEndedToolStatuses: readonly string[] = ["completed", "failed"];
  public static readonly acpTerminalOtherSession: string = "This terminal request names a session other than the turn's.";
  public static readonly utf8ContinuationMask: number = 0xc0;
  public static readonly utf8ContinuationBits: number = 0x80;
  public static readonly acpModeField: string = "mode";
  public static readonly acpFormMode: string = "form";
  public static readonly acpRequestedSchemaField: string = "requestedSchema";
  public static readonly acpPropertiesField: string = "properties";
  public static readonly acpItemsField: string = "items";
  public static readonly acpEnumField: string = "enum";
  public static readonly acpOneOfField: string = "oneOf";
  public static readonly acpAnyOfField: string = "anyOf";
  public static readonly acpConstField: string = "const";
  public static readonly acpArrayType: string = "array";
  public static readonly acpBooleanType: string = "boolean";
  public static readonly acpNumberType: string = "number";
  public static readonly acpIntegerType: string = "integer";
  public static readonly acpActionField: string = "action";
  public static readonly acpAcceptAction: string = "accept";
  public static readonly acpDeclineAction: string = "decline";
  public static readonly acpCancelAction: string = "cancel";
  public static readonly acpCancelRequest: string = "$/cancel_request";
  public static readonly acpRequestIdField: string = "requestId";
  public static readonly yesLabel: string = "Yes";
  public static readonly noLabel: string = "No";
  public static readonly acpToolCallField: string = "toolCall";
  public static readonly acpToolCallIdField: string = "toolCallId";
  public static readonly acpOptionIdField: string = "optionId";
  public static readonly acpLocationsField: string = "locations";
  public static readonly grokToolTitle: string = "Grok tool";
  public static readonly acpOtherKind: string = "other";
  public static readonly acpExecuteKind: string = "execute";
  public static readonly acpEditKind: string = "edit";
  public static readonly acpPendingStatus: string = "pending";
  public static readonly acpCompletedStatus: string = "completed";
  public static readonly acpDiffType: string = "diff";
  public static readonly acpOldTextField: string = "oldText";
  public static readonly acpNewTextField: string = "newText";
  public static readonly addChangeKind: string = "add";
  public static readonly updateChangeKind: string = "update";
  public static readonly deleteChangeKind: string = "delete";
  public static readonly moveChangeKind: string = "move";
  public static readonly movePathField: string = "move_path";
  public static readonly changeVerbs: ReadonlyMap<string, string> = new Map([
    ["add", "Added"], ["delete", "Deleted"], ["update", "Edited"], ["move", "Moved"]
  ]);
  public static readonly otherChangeVerb: string = "Changed";
  public static readonly noFileChangesTitle: string = "Changed files";
  public static readonly changeGroupSeparator: string = "; ";
  public static readonly diffRemovedPrefix: string = "-";
  public static readonly diffAddedPrefix: string = "+";
  public static readonly acpAllowOnce: string = "allow_once";
  public static readonly antigravityQuestionIdPrefix: string = "interaction_";
  public static readonly acpRejectOnce: string = "reject_once";
  public static readonly acpSelected: string = "selected";
  public static readonly acpCancelled: string = "cancelled";
  public static readonly acpApprovePlanOption: string = "approve-plan";
  public static readonly acpKeepPlanningOption: string = "keep-planning";
  public static readonly approvePlanLabel: string = "Approve plan";
  public static readonly keepPlanningLabel: string = "Keep planning";
  public static readonly acpJsonRpcVersion: string = "2.0";
  public static readonly acpMaximumPending: number = 128;
  public static readonly acpMaximumBufferedCharacters: number = 16 * 1024 * 1024;
  public static readonly acpKillWait: number = 5000;
  public static readonly acpAlreadyStarted: string = "The ACP client is already started.";
  public static readonly acpDisconnected: string = "The ACP agent connection is closed.";
  public static readonly acpTooManyRequests: string = "The ACP request limit was reached.";
  public static readonly acpGatedRequestRefused: string = "TeamRun refused this tool call, as it couldn't answer the agent's check before it.";
  public static readonly acpDidNotStop: string = "The ACP agent did not stop within the shutdown timeout.";
  public static readonly acpFrameTooLarge: string = "The ACP agent exceeded the message size limit.";
  public static readonly acpInvalidFrame: string = "The ACP agent returned an invalid message.";
  public static readonly acpUnsupportedRequest: string = "This ACP request is not supported by TeamRun.";
  public static readonly acpUnsupportedCode: number = -32601;
  public static readonly acpInvalidParamsCode: number = -32602;
  public static readonly acpAuthRequiredCode: number = -32000;
  public static readonly spawnEvent: string = "spawn";
  public static readonly grokLogsDirectory: string = "logs";
  public static readonly grokUnifiedLogFile: string = "unified.jsonl";
  public static readonly grokLogTailBytes: number = 1_048_576;
  public static readonly grokLogTimeField: string = "ts";
  public static readonly grokLogMessageField: string = "msg";
  public static readonly grokLogContextField: string = "ctx";
  public static readonly grokLogServerField: string = "server";
  public static readonly grokLogReasonField: string = "reason";
  public static readonly grokMcpBlockedMessage: string = "MCP server blocked by managed settings policy";
  public static readonly grokExcludedEnvironment: RegExp = /^(?:CODEX|CLAUDE|ANTHROPIC|OPENAI|GEMINI|GOOGLE|AWS|AZURE|COPILOT|GIT_CONFIG|GIT_ASKPASS|SSH_ASKPASS)(?:_|$)|^GROK_HOME$/i;
  public static readonly grokProfileExcludedEnvironment: RegExp = /^(?:GROK|XAI)_\w*(?:KEY|TOKEN|SECRET|AUTH)/i;
  public static readonly grokHomeVariable: string = "GROK_HOME";
  public static readonly grokBackgroundOffVariables: readonly string[] = ["GROK_MEMORY", "GROK_MANAGED_MCPS_ENABLED", "GROK_CLAUDE_MCPS_ENABLED",
    "GROK_CURSOR_MCPS_ENABLED", "GROK_CODEX_MCPS_ENABLED", "GROK_CLAUDE_HOOKS_ENABLED", "GROK_CURSOR_HOOKS_ENABLED", "GROK_CODEX_HOOKS_ENABLED"];
  public static readonly grokTitleOffVariables: readonly string[] = [...Resources.grokBackgroundOffVariables, "GROK_CLAUDE_RULES_ENABLED", "GROK_CURSOR_RULES_ENABLED",
    "GROK_CODEX_RULES_ENABLED", "GROK_CLAUDE_SKILLS_ENABLED", "GROK_CURSOR_SKILLS_ENABLED", "GROK_CODEX_SKILLS_ENABLED", "GROK_CLAUDE_AGENTS_ENABLED",
    "GROK_CURSOR_AGENTS_ENABLED", "GROK_CODEX_AGENTS_ENABLED"];
  public static readonly grokTitleDroppedVariables: readonly string[] = ["GROK_CONFIG", "GROK_CONFIG_PATH"];
  public static readonly grokAuthPathVariable: string = "GROK_AUTH_PATH";
  public static readonly grokAuthFile: string = "auth.json";
  public static readonly grokProfileEntries: readonly string[] = [Resources.grokAuthFile, "config.toml", Resources.profileMarker];
  public static readonly grokTitleHomeFolder: string = "title-home";
  public static readonly homeVariable: string = "HOME";
  public static readonly userProfileVariable: string = "USERPROFILE";
  public static readonly appDataVariable: string = "APPDATA";
  public static readonly localAppDataVariable: string = "LOCALAPPDATA";
  public static readonly systemRootVariable: string = "SystemRoot";
  public static readonly xdgConfigVariable: string = "XDG_CONFIG_HOME";
  public static readonly xdgDataVariable: string = "XDG_DATA_HOME";
  public static readonly xauthorityVariable: string = "XAUTHORITY";
  public static readonly browserVariable: string = "BROWSER";
  public static readonly signInVariables: readonly string[] = [Resources.homeVariable, Resources.userProfileVariable, Resources.appDataVariable,
    Resources.localAppDataVariable, Resources.xdgConfigVariable, Resources.xdgDataVariable, Resources.xauthorityVariable, Resources.browserVariable];
  public static readonly localAppDataDirectory: string = "AppData/Local";
  public static readonly grokDisabledValue: string = "0";
  public static readonly grokFolderTrustVariable: string = "GROK_FOLDER_TRUST";
  public static readonly opencodeKindId: string = "opencode";
  public static readonly opencodeSubAgentTypeField: string = "subagent_type";
  public static readonly opencodeDisplayName: string = "OpenCode";
  public static readonly opencodeExecutableName: string = "opencode";
  public static readonly opencodeWindowsExecutableName: string = "opencode.exe";
  public static readonly opencodeWindowsShimName: string = "opencode.cmd";
  public static readonly opencodeDirectoryName: string = ".opencode";
  public static readonly opencodePackageName: string = "opencode-ai";
  public static readonly opencodeWindowsPackagePrefix: string = "opencode-windows-";
  public static readonly opencodeBaselineSuffix: string = "-baseline";
  public static readonly opencodeArguments: readonly string[] = ["acp"];
  public static readonly opencodeLevelArguments: readonly string[] = ["models", "--verbose"];
  public static readonly opencodeModelLinePattern: RegExp = /^[^\s{}"]+\/[^\s{}"]+\r?$/gm;
  public static readonly opencodeVariantsField: string = "variants";
  public static readonly opencodeDefaultVariant: string = "default";
  public static readonly opencodeAuthMethod: string = "opencode-login";
  public static readonly opencodeSignInCommand: string = "opencode auth login";
  public static readonly opencodeSignOutCommand: string = "opencode auth logout";
  public static readonly opencodeToolTitle: string = "OpenCode tool";
  public static readonly opencodeSignInHint: string = "OpenCode isn't signed in. Choose Sign in in the provider's menu to run opencode auth login, or sign in with your own OpenCode.";
  public static readonly opencodeUsualDataFolder: string = ".local/share";
  public static readonly opencodeProfileEntries: readonly string[] = ["opencode/auth.json"];
  public static readonly opencodeChatAgents: readonly string[] = ["build", "plan"];
  public static readonly opencodeSubAgents: readonly string[] = ["general", "explore"];
  public static readonly opencodeChatAgentState: Readonly<Record<string, boolean | string>> = { disable: false, mode: "primary", hidden: false };
  public static readonly opencodeTaskTool: string = "task";
  public static readonly opencodeModeField: string = "mode";
  public static readonly opencodeOwnMcpServersNote: string = "While this switch is off, OpenCode still starts the MCP servers its own settings turn on, and TeamRun refuses their tools.";
  public static readonly opencodeOwnMcpServersShortNote: string = "uses its own while on";
  public static readonly opencodeReadTool: string = "read";
  public static readonly opencodeReadOnlyTools: readonly string[] = ["glob", "grep", "list", "skill", "lsp"];
  public static readonly opencodeTodoTool: string = "todowrite";
  public static readonly opencodeEnvFilePatterns: readonly string[] = ["*.env", "*.env.*"];
  public static readonly opencodeEnvExamplePattern: string = "*.env.example";
  public static readonly opencodeAgentField: string = "agent";
  public static readonly opencodePermissionField: string = "permission";
  public static readonly opencodeNotFound: string = "OpenCode was not found. Install OpenCode 1.x with curl -fsSL https://opencode.ai/install | bash, or on Windows with npm i -g opencode-ai@1, then refresh.";
  public static readonly opencodeSignInUnavailable: string = "OpenCode signs in in a terminal: choose Sign in in the provider's menu, which runs opencode auth login.";
  public static readonly opencodeExcludedEnvironment: RegExp = /^(?:GIT_CONFIG|GIT_ASKPASS|SSH_ASKPASS)(?:_|$)/i;
  public static readonly opencodeAddedExcludedEnvironment: RegExp = /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)|^(?:ANTHROPIC|OPENAI|OPENROUTER|GROQ|DEEPSEEK|MISTRAL|XAI|GROK|GEMINI|GOOGLE|VERTEX|AWS|AZURE|CODEX|CLAUDE|COPILOT|GITHUB|HF|HUGGINGFACE|TOGETHER|FIREWORKS|CEREBRAS|ZHIPU|MOONSHOT|CLOUDFLARE|VERCEL|GIT_CONFIG|GIT_ASKPASS|SSH_ASKPASS)(?:_|$)/i;
  public static readonly opencodeConfigContentVariable: string = "OPENCODE_CONFIG_CONTENT";
  public static readonly opencodePermissionVariable: string = "OPENCODE_PERMISSION";
  public static readonly opencodePureVariable: string = "OPENCODE_PURE";
  public static readonly opencodePureValue: string = "1";
  public static readonly opencodeConfigVariable: string = "OPENCODE_CONFIG";
  public static readonly opencodeConfigDirVariable: string = "OPENCODE_CONFIG_DIR";
  public static readonly opencodeDisableProjectConfigVariable: string = "OPENCODE_DISABLE_PROJECT_CONFIG";
  public static readonly opencodeTrueValues: readonly string[] = ["1", "true"];
  public static readonly opencodeUsualConfigFolder: string = ".config";
  public static readonly opencodeConfigFolder: string = "opencode";
  public static readonly opencodeGlobalConfigFiles: readonly string[] = ["config.json", "opencode.json", "opencode.jsonc"];
  public static readonly opencodeConfigFiles: readonly string[] = ["opencode.json", "opencode.jsonc"];
  public static readonly opencodeDotFolder: string = ".opencode";
  public static readonly opencodeManagedConfigDirVariable: string = "OPENCODE_TEST_MANAGED_CONFIG_DIR";
  public static readonly opencodeMacManagedFolder: string = "/Library/Application Support/opencode";
  public static readonly opencodeLinuxManagedFolder: string = "/etc/opencode";
  public static readonly opencodeMcpField: string = "mcp";
  public static readonly opencodeEnabledField: string = "enabled";
  public static readonly opencodeLineComment: string = "//";
  public static readonly opencodeLineEnd: string = "\n";
  public static readonly opencodeBlockCommentStart: string = "/*";
  public static readonly opencodeBlockCommentEnd: string = "*/";
  public static readonly opencodeQuote: string = "\"";
  public static readonly opencodeEscape: string = "\\";
  public static readonly opencodeTrailingComma: RegExp = /^,\s*[}\]]/;
  public static readonly gitDirectoryName: string = ".git";
  public static readonly opencodeAskedTools: readonly string[] = ["edit", "bash", "webfetch", "websearch", "codesearch", "external_directory", "doom_loop"];
  public static readonly opencodeVersionPattern: RegExp = /^(\d+)\.(\d+)\.(\d+)/;
  public static readonly opencodeMinimumVersion: readonly number[] = [1, 18, 31];
  public static readonly opencodeUnsupportedMajor: number = 2;
  public static readonly antigravityKindId: string = "antigravity";
  public static readonly antigravityDisplayName: string = "Antigravity";
  public static readonly antigravityToolTitle: string = "Antigravity tool";
  public static readonly antigravityVersion: string = "1.3.0";
  public static readonly antigravityAcceptedVersionPattern: RegExp = /^1\.3\.\d+$/u;
  public static readonly antigravityAuthMethod: string = "oauth-personal";
  public static readonly antigravityExecutableName: string = "agy_acp_server.par";
  public static readonly antigravityWindowsExecutableName: string = "agy_acp_server.exe";
  public static readonly antigravityHarnessName: string = "localharness_external";
  public static readonly antigravityWindowsHarnessName: string = "localharness_external.exe";
  public static readonly antigravityLinuxArguments: readonly string[] = ["--uid="];
  public static readonly antigravityNotFound: string = "Antigravity's ACP server is not installed, and none is on PATH. Install it from TeamRun's providers.";
  public static readonly antigravitySignInUnavailable: string = "Antigravity offers no Google sign-in TeamRun can start.";
  public static readonly antigravityProfileAbsolute: string = "The dedicated Antigravity profile must use an absolute path.";
  public static readonly antigravityProfileNotManaged: string = "Antigravity requires a dedicated TeamRun profile. Select an empty directory; an existing Antigravity setup will not be changed.";
  public static readonly antigravityProfileMarkerValue: string = "TeamRun Antigravity profile v1\n";
  public static readonly antigravityMcpField: string = "mcp";
  public static readonly antigravityMcpServerField: string = "server";
  public static readonly antigravityMcpToolField: string = "tool";
  public static readonly antigravityTokenSegments: readonly string[] = ["antigravity-acp", "acp_token.json"];
  public static readonly antigravityModelsFile: string = ".teamrun-models.json";
  public static readonly antigravityModelsField: string = "models";
  public static readonly antigravityTempKeyLength: number = 12;
  public static readonly antigravityHomeVariable: string = "GEMINI_HOME";
  public static readonly antigravityDirectoryName: string = ".gemini";
  public static readonly antigravityInstructionFiles: readonly string[] = ["AGENTS.md", "GEMINI.md"];
  public static readonly antigravityConfigFolder: string = "config";
  public static readonly antigravityRulesFolder: string = "rules";
  public static readonly antigravityProjectRulesFolders: readonly (readonly string[])[] = [[".agent", "rules"], [".agents", "rules"]];
  public static readonly antigravityManualRule: RegExp = /^\uFEFF?---[ \t]*\r?\n(?:(?!---[ \t]*\r?\n)[^\n]*\n)*?trigger:[ \t]*(["']?)manual\1[ \t]*\r?\n/u;
  public static readonly antigravityPersonFolders: readonly (readonly string[])[] = [["config", "skills"], ["antigravity-cli", "skills"]];
  public static readonly antigravityHiddenHomeFolder: string = ".teamrun-hidden-home";
  public static readonly antigravitySignInFolder: string = "antigravity-acp";
  public static readonly antigravityNotALink: string = "Something other than a link is already there, and TeamRun leaves it alone.";
  public static readonly antigravityFileStorageVariable: string = "AGY_ACP_FORCE_FILE_STORAGE";
  public static readonly antigravityHarnessVariable: string = "ANTIGRAVITY_HARNESS_PATH";
  public static readonly antigravitySharedServersKept: string =
    "Antigravity keeps a session's MCP servers, with their values, in its conversation files, so TeamRun passes it no shared MCP servers.";
  public static readonly antigravitySharedServersKeptShort: string = "would keep it in its files";
  public static readonly savedSecretsStdioOnlyShort: string = "saved secrets reach its stdio servers only";
  public static readonly savedSecretsFromEnvironmentOnlyShort: string = "reads values only from its environment";
  public static readonly sharedMcpUnconfirmedShort: string = "not confirmed yet";
  public static readonly antigravityExcludedEnvironment: RegExp = /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)|^(?:GEMINI|GOOGLE|GCLOUD|CLOUDSDK|AGY|ANTIGRAVITY)_|^(?:BROWSER|PYTHONUNBUFFERED|ELECTRON_RUN_AS_NODE|TEMP|TMP|TMPDIR)$/i;
  public static readonly antigravityReleases: readonly { readonly target: string; readonly file: string; readonly sha256: string; readonly archiveBytes: number;
    readonly executableBytes: number; readonly harnessBytes: number }[] = [
    { target: "darwin-arm64", file: "macos/agy-acp-server-1.3.0-darwin-arm64.zip", sha256: "7cd97045f7b4fe81175a107cdf16f9c51484e3c78a5162cae415338bb6aa5b88", archiveBytes: 111_456_962, executableBytes: 278_535_456, harnessBytes: 118_611_392 },
    { target: "darwin-x64", file: "macos/agy-acp-server-1.3.0-darwin-x86_64.zip", sha256: "bb23956b89984bf5d354af2c3725e6c57f0cc1b7228e77a0e91c9c2bc1d47646", archiveBytes: 117_245_544, executableBytes: 282_840_688, harnessBytes: 124_175_392 },
    { target: "linux-x64", file: "linux/agy-acp-server-1.3.0-linux-x86_64.zip", sha256: "9fb60956af0a9d76220a4db91ca9ac88e2a2372ad68f985ab5fceace6b825b96", archiveBytes: 333_727_150, executableBytes: 926_533_965, harnessBytes: 130_388_040 },
    { target: "linux-arm64", file: "linux/agy-acp-server-1.3.0-linux-arm64.zip", sha256: "500b0bc0fb858e88f4df404d4cedf80bf9298c178291e39e383d6c50b111cbdf", archiveBytes: 321_690_363, executableBytes: 930_848_992, harnessBytes: 123_224_968 },
    { target: "win32-x64", file: "windows/agy-acp-server-1.3.0-windows-x86_64.zip", sha256: "65215e0688681fa3116e048a9eab27ef53af1bbd6f3da3f1c52bd4911d8b17f9", archiveBytes: 124_509_787, executableBytes: 81_437_336, harnessBytes: 145_548_952 },
    { target: "win32-arm64", file: "windows/agy-acp-server-1.3.0-windows-arm64.zip", sha256: "4a0f469720e9beb9438a979f543fdbfad5022ebe0992c052c590bd78b3144ca3", archiveBytes: 124_654_803, executableBytes: 85_893_472, harnessBytes: 135_640_216 }
  ];
  public static readonly antigravityDownloadBase: string = "https://dl.google.com/agy-extensions/releases/";
  public static readonly antigravityNoRelease: string = "Antigravity's ACP server has no build for this computer.";
  public static readonly antigravityNoUnzip: string = "Installing Antigravity needs unzip, which this computer does not have.";
  public static readonly stagingPrefix: string = ".teamrun-staging-";
  public static readonly antigravityArchiveName: string = "download.zip";
  public static readonly antigravityMemberMismatch: string = "The Antigravity download is missing its server or harness, or one has the wrong size. Nothing was installed.";
  public static readonly macPlatform: string = "darwin";
  public static readonly x64Architecture: string = "x64";
  public static readonly codesignArguments: readonly string[] = ["--force", "--sign", "-", "--options", "runtime", "--entitlements"];
  public static readonly antigravityEntitlementsName: string = "entitlements.plist";
  public static readonly antigravityEntitlements: string = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
    + "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n"
    + "<plist version=\"1.0\">\n<dict>\n  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>\n  <true/>\n</dict>\n</plist>\n";
  public static readonly acceptEncodingHeader: string = "accept-encoding";
  public static readonly identityEncoding: string = "identity";
  public static readonly executableMode: number = 0o755;
  public static readonly removeRetries: number = 5;
  public static readonly releaseDownloadLimit: number = 1024 * 1024 * 1024;
  public static readonly unwritableErrorCodes: readonly string[] = ["EACCES", "EPERM", "EROFS"];
  public static readonly renameRetryCodes: readonly string[] = ["EPERM", "EACCES", "EBUSY"];
  public static readonly renameRetryFirstDelay: number = 50;
  public static readonly renameRetryLongestDelay: number = 1000;
  public static readonly renameRetryLimit: number = 10_000;
  public static readonly installReadyName: string = "ready";
  public static readonly installReadySuffix: string = ".ready";
  public static readonly readFlag: string = "r";
  public static readonly parentSegment: string = "..";
  public static readonly zipRootedName: RegExp = /^(?:[\\/]|[a-z]:)/i;
  public static readonly zipNameSeparators: RegExp = /[\\/]/;
  public static readonly zipEndSignature: number = 0x06054b50;
  public static readonly zipCentralSignature: number = 0x02014b50;
  public static readonly zip64LocatorSignature: number = 0x07064b50;
  public static readonly zip64EndSignature: number = 0x06064b50;
  public static readonly zipEndRecordBytes: number = 22;
  public static readonly zipMaxCommentBytes: number = 0xffff;
  public static readonly zipCentralHeaderBytes: number = 46;
  public static readonly zip64LocatorBytes: number = 20;
  public static readonly zip64EndRecordBytes: number = 56;
  public static readonly zipUint16Max: number = 0xffff;
  public static readonly zipUint32Max: number = 0xffffffff;
  public static readonly zipUnixHost: number = 3;
  public static readonly fileTypeMask: number = 0o170000;
  public static readonly symbolicLinkType: number = 0o120000;
  public static readonly antigravityArchiveUnsafe: string = "The Antigravity download has an entry TeamRun can't read, a link, or a path outside its folder. Nothing was installed.";
  public static readonly unzipExecutableName: string = "unzip";
  public static readonly unzipWindowsExecutableName: string = "unzip.exe";
  public static readonly tarWindowsExecutableName: string = "tar.exe";
  public static readonly tarCommandName: string = "tar";
  public static readonly tarMacPath: string = "/usr/bin/tar";
  public static readonly tarExtractArguments: readonly string[] = ["-xf"];
  public static readonly tarDirectoryArgument: string = "-C";
  public static readonly unzipArguments: readonly string[] = ["-q", "-o"];
  public static readonly unzipDirectoryArgument: string = "-d";
  public static readonly modelDisplayNameField: string = "displayName";
  public static readonly modelDescriptionField: string = "description";
  public static readonly modelIsDefaultField: string = "isDefault";
  public static readonly supportedReasoningEffortsField: string = "supportedReasoningEfforts";
  public static readonly inputModalitiesField: string = "inputModalities";
  public static readonly nextCursorField: string = "nextCursor";
  public static readonly cursorField: string = "cursor";
  public static readonly maximumModelPages: number = 20;
  public static readonly modelCatalogTooLarge: string = "The provider model catalog exceeded its pagination limit.";
  public static readonly modelDiscoveryTimedOut: string = "The provider did not return its model catalog in time.";
  public static readonly claudeDefaultModel: string = "default";
  public static readonly claudeModelVersion: RegExp = /(?<![\w.])\d+(?:\.\d+)*(?![\w.])/u;
  public static readonly claudeModelNoteStart: string = " (";
  public static readonly claudeModelVersionStart: RegExp = /^(\d+(?:\.\d+)*)(?![\w.])/u;
  public static readonly claudeModelId: RegExp = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[\w+\])?$/u;
  public static readonly localImageInputType: string = "localImage";
  public static readonly imageInputType = "image";
  public static readonly base64SourceType = "base64";
  public static readonly pngMediaType = "image/png";
  public static readonly jpegMediaType = "image/jpeg";
  public static readonly gifMediaType = "image/gif";
  public static readonly webpMediaType = "image/webp";
  public static readonly codexKindId: string = "codex";
  public static readonly codexDisplayName: string = "Codex";
  public static readonly claudeKindId: string = "claude";
  public static readonly claudeFastSpeed: string = "fast";
  public static readonly claudeFastSpeedName: string = "Fast";
  public static readonly claudeStandardSpeed: string = "standard";
  public static readonly claudeStandardSpeedName: string = "Standard";
  public static readonly claudeFastModeOn: string = "on";
  public static readonly claudeFastModeCooldown: string = "cooldown";
  public static readonly claudeDisplayName: string = "Claude Code";

  public static readonly windowsPlatform: string = "win32";
  public static readonly linuxPlatform: string = "linux";
  public static readonly windowsTempVariables: readonly string[] = ["TEMP", "TMP"];
  public static readonly posixTempVariables: readonly string[] = ["TMPDIR"];
  public static readonly sha256Algorithm: string = "sha256";
  public static readonly hexEncoding: "hex" = "hex";
  public static readonly pythonUnbufferedVariable: string = "PYTHONUNBUFFERED";
  public static readonly codexExecutableName: string = "codex";
  public static readonly codexWindowsExecutableName: string = "codex.exe";
  public static readonly codexWindowsShimName: string = "codex.cmd";
  public static readonly claudeExecutableName: string = "claude";
  public static readonly claudeWindowsExecutableName: string = "claude.exe";
  public static readonly claudeWindowsShimName: string = "claude.cmd";
  public static readonly localDirectoryName: string = ".local";
  public static readonly binDirectoryName: string = "bin";
  public static readonly localAppDataSegments: readonly string[] = ["AppData", "Local"];
  public static readonly windowsSystemRoot: string = "C:\\Windows";
  public static readonly windowsSystemFolderName: string = "System32";
  public static readonly codexWindowsInstallSegments: readonly string[] = ["Programs", "OpenAI", "Codex", "bin"];
  public static readonly wingetLinksSegments: readonly string[] = ["Microsoft", "WinGet", "Links"];
  public static readonly libDirectoryName: string = "lib";
  public static readonly nodeModulesDirectoryName: string = "node_modules";
  public static readonly openAiScopeName: string = "@openai";
  public static readonly codexPackageName: string = "codex";
  public static readonly codexPlatformPackagePrefix: string = "codex-";
  public static readonly vendorDirectoryName: string = "vendor";
  public static readonly platformArchitectureSeparator: string = "-";
  public static readonly codexTargetTriples: ReadonlyMap<string, string> = new Map([
    ["win32-x64", "x86_64-pc-windows-msvc"],
    ["win32-arm64", "aarch64-pc-windows-msvc"],
    ["darwin-x64", "x86_64-apple-darwin"],
    ["darwin-arm64", "aarch64-apple-darwin"],
    ["linux-x64", "x86_64-unknown-linux-musl"],
    ["linux-arm64", "aarch64-unknown-linux-musl"]
  ]);

  public static readonly versionArgument: string = "--version";
  public static readonly claudePosixInstallCommand: string = "curl -fsSL https://claude.ai/install.sh | bash";
  public static readonly claudeWindowsInstallCommand: string = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"irm https://claude.ai/install.ps1 | iex\"";
  public static readonly claudeReleaseChannel: string = "https://downloads.claude.ai/claude-code-releases";
  public static readonly claudeLatestName: string = "latest";
  public static readonly claudeManifestName: string = "manifest.json";
  public static readonly claudeProgramName: string = "claude";
  public static readonly claudeWindowsProgramName: string = "claude.exe";
  public static readonly claudeSetupArgument: string = "install";
  public static readonly claudeForceArgument: string = "--force";
  public static readonly claudeTargets: readonly string[] = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-arm64", "win32-x64"];
  public static readonly claudeMuslSuffix: string = "-musl";
  public static readonly muslLoaderPaths: readonly string[] = ["/lib/libc.musl-x86_64.so.1", "/lib/libc.musl-aarch64.so.1"];
  public static readonly claudeNoBuild: string = "Claude Code has no build for this computer.";
  public static readonly claudeNotFoundAfterSetup: string = "Claude Code was set up, but TeamRun can't find it where Claude Code installs itself. Restart TeamRun, then install it again.";
  public static readonly releaseVersionPattern: RegExp = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
  public static readonly sha256Pattern: RegExp = /^[0-9a-f]{64}$/;
  public static readonly claudeSubscribeUrl: string = "https://claude.com/pricing";
  public static readonly codexReleaseChannels: readonly string[] = ["https://releases.openai.com/codex/channels/latest",
    "https://api.github.com/repos/openai/codex/releases/latest"];
  public static readonly codexNoBuild: string = "Codex has no build for this computer.";
  public static readonly codexNoTar: string = "Installing Codex needs tar, which this computer does not have.";
  public static readonly codexTagPrefix: string = "rust-v";
  public static readonly codexPackagePrefix: string = "codex-package-";
  public static readonly codexPackageSuffix: string = ".tar.gz";
  public static readonly sha256DigestPrefix: string = "sha256:";
  public static readonly releaseTagField: string = "tag_name";
  public static readonly releaseAssetsField: string = "assets";
  public static readonly releaseAssetNameField: string = "name";
  public static readonly releaseAssetDigestField: string = "digest";
  public static readonly releaseAssetSizeField: string = "size";
  public static readonly releaseAssetUrlField: string = "browser_download_url";
  public static readonly claudePlatformsField: string = "platforms";
  public static readonly claudeChecksumField: string = "checksum";
  public static readonly claudeSizeField: string = "size";
  public static readonly acceptHeader: string = "accept";
  public static readonly jsonContentType: string = "application/json";
  public static readonly acpRegistryUrl: string = "https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json";
  public static readonly acpRegistryMaxAge: number = 3_600_000;
  public static readonly acpRegistryMaxBytes: number = 1_048_576;
  public static readonly acpRegistryUnreadable: string = "The ACP registry's list of agents can't be read.";
  public static readonly acpRegistryUnreachable: string = "TeamRun couldn't reach the ACP registry. Check the network connection and try again.";
  public static readonly acpRegistryAgentsField: string = "agents";
  public static readonly acpRegistryVersionField: string = "version";
  public static readonly acpRegistryIconField: string = "icon";
  public static readonly acpRegistryDistributionField: string = "distribution";
  public static readonly acpRegistryBinaryField: string = "binary";
  public static readonly acpRegistryNpxField: string = "npx";
  public static readonly acpRegistryUvxField: string = "uvx";
  public static readonly acpRegistryArchiveField: string = "archive";
  public static readonly acpRegistryCommandField: string = "cmd";
  public static readonly acpRegistryArgumentsField: string = "args";
  public static readonly acpRegistryEnvironmentField: string = "env";
  public static readonly acpRegistrySha256Field: string = "sha256";
  public static readonly acpRegistryPackageField: string = "package";
  public static readonly acpRegistryIdPattern: RegExp = /^[a-z][a-z0-9-]*$/u;
  public static readonly acpRegistryArchivePattern: RegExp = /^https:\/\/[^\s]+$/u;
  public static readonly acpRegistryPathSeparators: RegExp = /[\\/]/u;
  public static readonly acpRegistryRootedPattern: RegExp = /^(?:[\\/]|[A-Za-z]:)/u;
  public static readonly acpRegistryIdMaxLength: number = 64;
  public static readonly acpRegistryDeviceNames: RegExp = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/u;
  public static readonly acpRegistryOwnProviderIds: readonly string[] = ["antigravity", "antigravity-acp", "claude", "claude-acp", "codex", "codex-acp", "copilot",
    "cursor", "fx", "github-copilot-cli", "grok", "grok-build", "muse", "opencode", "opencode-v2", "pi", "pi-acp"];
  public static readonly acpRegistryLoopbackHosts: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];
  public static readonly acpRegistryHttpsProtocol: string = "https:";
  public static readonly acpRegistryHttpProtocol: string = "http:";
  public static readonly acpRegistryUrlParameter: string = "url";
  public static readonly acpRegistryUrlRefused: string = "TeamRun reads the ACP registry only over https.";
  public static readonly acpRegistryRedirect: NonNullable<RequestInit["redirect"]> = "manual";
  public static readonly acpRegistryLengthHeader: string = "content-length";
  public static readonly generalAcpExcludedEnvironment: RegExp =
    /(?:KEY|TOKEN|SECRET|PASS|_PWD|CREDENTIAL|AUTH|COOKIE|JWT|BEARER)|^(?:ANTHROPIC|OPENAI|OPENROUTER|GROQ|DEEPSEEK|MISTRAL|XAI|GROK|GEMINI|GOOGLE|GCLOUD|CLOUDSDK|VERTEX|AWS|AZURE|CODEX|CLAUDE|COPILOT|GITHUB|GH|CURSOR|OPENCODE|ANTIGRAVITY|AGY|HF|HUGGINGFACE|TOGETHER|FIREWORKS|CEREBRAS|ZHIPU|MOONSHOT|CLOUDFLARE|VERCEL|AI_GATEWAY|FX|GIT_CONFIG|GIT_ASKPASS|SSH_ASKPASS)(?:_|$)/i;
  public static readonly acpRegistryVariablePattern: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/u;
  public static readonly localAcpKindPrefix: string = "local-";
  public static readonly geminiCliMetaField: string = "gemini-cli";
  public static readonly geminiCliAgentName: string = "gemini-cli";
  public static readonly geminiCliMcpField: string = "mcp";
  public static readonly geminiCliServerNameField: string = "server_name";
  public static readonly geminiCliToolNameField: string = "tool_name";
  public static readonly geminiCliTrustWorkspaceVariable: string = "GEMINI_CLI_TRUST_WORKSPACE";
  public static readonly geminiRestrictedModeVariable: string = "GEMINI_RESTRICTED_MODE";
  public static readonly geminiCliHomeVariable: string = "GEMINI_CLI_HOME";
  public static readonly geminiSystemSettingsVariable: string = "GEMINI_CLI_SYSTEM_SETTINGS_PATH";
  public static readonly geminiSystemDefaultsVariable: string = "GEMINI_CLI_SYSTEM_DEFAULTS_PATH";
  public static readonly geminiTrustedFoldersVariable: string = "GEMINI_CLI_TRUSTED_FOLDERS_PATH";
  public static readonly geminiTrueValue: string = "true";
  public static readonly geminiFalseValue: string = "false";
  public static readonly geminiCliSkipTrustArgument: string = "--skip-trust";
  public static readonly geminiCliListsToolsBeforeSession: readonly [number, number] = [0, 67];
  public static readonly versionSeparator: string = ".";
  public static readonly geminiMacSystemSettings: string = "/Library/Application Support/GeminiCli/settings.json";
  public static readonly geminiWindowsSystemSettings: string = "C:\\ProgramData\\gemini-cli\\settings.json";
  public static readonly geminiLinuxSystemSettings: string = "/etc/gemini-cli/settings.json";
  public static readonly geminiSystemDefaultsFile: string = "system-defaults.json";
  public static readonly geminiDirectoryName: string = ".gemini";
  public static readonly geminiSettingsFile: string = "settings.json";
  public static readonly geminiTrustedFoldersFile: string = "trustedFolders.json";
  public static readonly geminiSeatbeltSandbox: string = "sandbox-exec";
  public static readonly sandboxVariable: string = "SANDBOX";
  public static readonly cacheDirectoryName: string = ".cache";
  public static readonly geminiFolderTrustPath: readonly string[] = ["security", "folderTrust", "enabled"];
  public static readonly geminiIdeEnabledPath: readonly string[] = ["ide", "enabled"];
  public static readonly geminiTrustFolderLevel: string = "TRUST_FOLDER";
  public static readonly geminiTrustParentLevel: string = "TRUST_PARENT";
  public static readonly geminiDoNotTrustLevel: string = "DO_NOT_TRUST";
  public static readonly geminiTrustLevels: readonly string[] = [Resources.geminiTrustFolderLevel, Resources.geminiTrustParentLevel, Resources.geminiDoNotTrustLevel];
  public static readonly mcpAnnotationsField: string = "annotations";
  public static readonly mcpReadOnlyHintField: string = "readOnlyHint";
  public static readonly acpRegistryWebsiteField: string = "website";
  public static readonly acpRegistryRepositoryField: string = "repository";
  public static readonly acpLocalSecretsField: string = "secrets";
  public static readonly acpLocalSlugPattern: RegExp = /[^a-z0-9]+/gu;
  public static readonly acpLocalSlugEdges: RegExp = /^-+|-+$/gu;
  public static readonly acpLocalSlugSeparator: string = "-";
  public static readonly acpLocalSlugMaxLength: number = 60;
  public static readonly acpLocalDefaultId: string = "agent";
  public static readonly acpLineBreakPattern: RegExp = /[\r\n]/u;
  public static readonly acpNpmPackagePattern: RegExp = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
  public static readonly acpNpmPackageMaxLength: number = 256;
  public static readonly acpNpmVersionSeparator: string = "@";
  public static readonly acpNpmScopeSeparator: string = "/";
  public static readonly acpNpmInstallArguments: readonly string[] = ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", "--loglevel=error"];
  public static readonly acpNpmPrefixArgument: string = "--prefix";
  public static readonly acpNpmModulesFolder: string = "node_modules";
  public static readonly acpNpmManifestName: string = "package.json";
  public static readonly acpNpmBinField: string = "bin";
  public static readonly acpNpmBinSegments: readonly string[] = ["node_modules", ".bin"];
  public static readonly acpNpmWindowsShimExtension: string = ".cmd";
  public static readonly acpNpmBinPattern: RegExp = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
  public static readonly npmExecutableName: string = "npm";
  public static readonly npmWindowsExecutableName: string = "npm.cmd";
  public static readonly acpAgentUnpackedName: string = "unpacked";
  public static readonly acpAgentDownloadName: string = "download";
  public static readonly acpAgentUnpackTimeout: number = 300_000;
  public static readonly acpAgentNpmTimeout: number = 600_000;
  public static readonly acpArchiveZipExtension: string = ".zip";
  public static readonly acpArchiveTarExtensions: readonly string[] = [".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz"];
  public static readonly acpIconFileExtension: string = ".icon";
  public static readonly acpIconTypeHeader: string = "content-type";
  public static readonly acpIconTypeSeparator: string = ";";
  public static readonly acpIconTypes: readonly string[] = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
  public static readonly acpIconMaxBytes: number = 262_144;
  public static readonly acpIconDataPrefix: string = "data:";
  public static readonly acpIconDataBase64: string = ";base64,";
  public static readonly acpIconEncoding: BufferEncoding = "base64";
  public static readonly acpTerminalAuthType: string = "terminal";
  public static readonly acpTerminalWordPattern: RegExp = /^[A-Za-z0-9_.:=/@-]+$/u;
  public static readonly acpTerminalWordSeparator: string = " ";
  public static readonly acpPathVariable: string = "PATH";
  public static readonly terminalLauncherExtensions: readonly string[] = ["", ".exe", ".cmd", ".ps1", ".bat"];
  public static readonly acpRegistryCurrentFolder: string = ".";
  public static readonly acpRegistryParentFolder: string = "..";
  public static readonly acpRegistryTargets: readonly string[] = ["darwin-aarch64", "darwin-x86_64", "linux-aarch64", "linux-x86_64", "windows-aarch64",
    "windows-x86_64"];
  public static readonly acpRegistrySystems: Readonly<Partial<Record<NodeJS.Platform, string>>> = { darwin: "darwin", linux: "linux", win32: "windows" };
  public static readonly acpRegistryMachines: Readonly<Partial<Record<string, string>>> = { arm64: "aarch64", x64: "x86_64" };
  public static readonly codexStandaloneSegments: readonly string[] = ["packages", "standalone"];
  public static readonly codexReleasesDirectoryName: string = "releases";
  public static readonly codexArchiveName: string = "codex-package.tar.gz";
  public static readonly codexAppServerReleaseAddress: string = "https://api.github.com/repos/openai/codex/releases/tags/";
  public static readonly codexAppServerPackagePrefix: string = "codex-app-server-package-";
  public static readonly codexAppServerDisplayName: string = "Codex app server";
  public static readonly codexAppServerProgram: string = "bin/codex-app-server";
  public static readonly codexAppServerUnpackedName: string = "package";
  public static readonly codexAppServerExecutableMembers: readonly string[] = ["bin/codex-app-server", "bin/codex-code-mode-host", "bin/codex-exec-server",
    "codex-path/rg", "codex-resources/bwrap"];
  public static readonly codexSessionSourceArgument: string = "--session-source";
  public static readonly codexHiddenSessionSource: string = "app-server";
  public static readonly codexThreadsListedNotice: string = "TeamRun's Codex chats show in the Codex app's recent chats until TeamRun downloads "
    + "Codex's app server for this version from GitHub, which it does when Noldova Desktop's Check for updates setting allows it, when you choose "
    + "Check for updates, and when you install or update Codex here.";
  public static readonly helpArgument: string = "--help";
  public static readonly windowsExecutableExtension: string = ".exe";
  public static readonly codexPreviousReleaseName: string = "previous";
  public static readonly codexPackageProgram: string = "bin/codex";
  public static readonly codexWindowsPackageProgram: string = "bin/codex.exe";
  public static readonly codexCodeModeHostName: string = "codex-code-mode-host";
  public static readonly codexCodeModeHostProgram: string = "bin/codex-code-mode-host";
  public static readonly codexExecutableMembers: readonly string[] = ["bin/codex", "bin/codex-code-mode-host", "codex-path/rg", "codex-resources/bwrap"];
  public static readonly codexPosixMembers: readonly string[] = ["codex-package.json", "bin/codex", "bin/codex-code-mode-host", "codex-path/rg", "codex"];
  public static readonly codexLinuxMembers: readonly string[] = ["codex-resources/bwrap"];
  public static readonly codexWindowsMembers: readonly string[] = ["codex-package.json", "bin/codex.exe", "bin/codex-code-mode-host.exe", "codex-path/rg.exe",
    "codex-resources/codex-command-runner.exe", "codex-resources/codex-windows-sandbox-setup.exe"];
  public static readonly codexCurrentName: string = "current";
  public static readonly codexCurrentTemporaryPrefix: string = ".current.";
  public static readonly codexVisibleTemporaryPrefix: string = ".codex.";
  public static readonly codexAutoUpdateName: string = "auto-update-version";
  public static readonly codexTemporaryInfix: string = ".tmp.";
  public static readonly junctionLinkType: "junction" = "junction";
  public static readonly codexPosixInstallCommand: string = "curl -fsSL https://chatgpt.com/codex/install.sh | sh";
  public static readonly codexWindowsInstallCommand: string = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"irm https://chatgpt.com/codex/install.ps1 | iex\"";
  public static readonly codexSubscribeUrl: string = "https://chatgpt.com/pricing";
  public static readonly copilotPosixInstallCommand: string = "curl -fsSL https://gh.io/copilot-install | bash";
  public static readonly copilotWindowsInstallCommand: string = "winget install GitHub.Copilot";
  public static readonly copilotSubscribeUrl: string = "https://github.com/features/copilot/plans";
  public static readonly copilotReleaseChannel: string = "https://api.github.com/repos/github/copilot-cli/releases/latest";
  public static readonly copilotTagPrefix: string = "v";
  public static readonly copilotArchivePrefix: string = "copilot-";
  public static readonly copilotPosixArchiveSuffix: string = ".tar.gz";
  public static readonly copilotWindowsArchiveSuffix: string = ".zip";
  public static readonly copilotTargets: readonly string[] = ["darwin-arm64", "darwin-x64", "linux-arm64", "linux-x64", "win32-arm64", "win32-x64"];
  public static readonly copilotMuslPlatform: string = "linuxmusl";
  public static readonly copilotUnpackedName: string = "unpacked";
  public static readonly copilotPreviousName: string = "previous";
  public static readonly copilotNoBuild: string = "GitHub Copilot has no build for this computer.";
  public static readonly copilotNoExtractor: string = "Installing GitHub Copilot needs tar, which this computer does not have.";
  public static readonly grokPosixInstallCommand: string = "curl -fsSL https://x.ai/cli/install.sh | bash";
  public static readonly grokWindowsInstallCommand: string = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"irm https://x.ai/cli/install.ps1 | iex\"";
  public static readonly grokSubscribeUrl: string = "https://x.ai/grok";
  public static readonly opencodePosixInstallCommand: string = "curl -fsSL https://opencode.ai/install | bash";
  public static readonly opencodeWindowsInstallCommand: string = "npm i -g opencode-ai@1";
  public static readonly opencodeSubscribeUrl: string = "https://opencode.ai";
  public static readonly grokVersion: string = "1.0.70";
  public static readonly grokDownloadBase: string = "https://x.ai/cli/";
  public static readonly grokReleases: readonly { readonly target: string; readonly file: string; readonly sha256: string; readonly archiveBytes: number;
    readonly program: string; readonly programBytes: number }[] = [
    { target: "darwin-arm64", file: "grok-1.0.70-macos-aarch64.gz", sha256: "9c83a2b8b28064574b65e1fa50e8342dd5d797d81c5c724c1d60bb0ad35e3199", archiveBytes: 72_479_908, program: "grok-macos-aarch64", programBytes: 179_063_008 },
    { target: "darwin-x64", file: "grok-1.0.70-macos-x86_64.gz", sha256: "0d2a0916d64a553cd889ad0753257c8d5aeb76085f0661be1630f8cbcf0bf171", archiveBytes: 78_096_674, program: "grok-macos-x86_64", programBytes: 193_578_304 },
    { target: "linux-x64", file: "grok-1.0.70-linux-x86_64.gz", sha256: "11d27a30adfb75c4b9b180072ab27412a1916f054ff5497ab70fb9a77d304bcc", archiveBytes: 76_760_282, program: "grok-linux-x86_64", programBytes: 195_700_192 },
    { target: "linux-arm64", file: "grok-1.0.70-linux-aarch64.gz", sha256: "0d9e47fc2cb14db2f52f99e9289c41b3723b64de05c284a9f18c2e8df52550cf", archiveBytes: 71_629_408, program: "grok-linux-aarch64", programBytes: 166_639_048 },
    { target: "win32-x64", file: "grok-1.0.70-windows-x86_64.exe.gz", sha256: "211f1cc44ecebfb8032dd2ee1b00ebe285175c3d319da59d14b47d11577c4391", archiveBytes: 69_748_695, program: "grok-windows-x86_64.exe", programBytes: 176_011_920 },
    { target: "win32-arm64", file: "grok-1.0.70-windows-aarch64.exe.gz", sha256: "6081ab4f7c8a0044283c2242a8b8d3d62d3ab66613ff981520b474629e49532d", archiveBytes: 65_758_265, program: "grok-windows-aarch64.exe", programBytes: 149_485_200 }
  ];
  public static readonly grokDownloadsDirectoryName: string = "downloads";
  public static readonly grokArchiveName: string = "grok.gz";
  public static readonly grokProgramNames: readonly string[] = ["grok", "agent"];
  public static readonly grokWindowsProgramNames: readonly string[] = ["grok.exe", "agent.exe"];
  public static readonly grokAsideSuffix: string = ".old";
  public static readonly grokAsideSeparator: string = "-";
  public static readonly grokNoBuild: string = "Grok has no build for this computer.";
  public static readonly appServerArgument: string = "app-server";
  public static readonly codexLoginStatusArguments: readonly string[] = ["login", "status"];
  public static readonly codexConfigArgument: string = "-c";
  public static readonly codexAppsOffArgument: string = "features.apps=false";
  public static readonly authArgument: string = "auth";
  public static readonly statusArgument: string = "status";
  public static readonly logoutArgument: string = "logout";
  public static readonly jsonArgument: string = "--json";
  public static readonly taskkillExecutable: string = "taskkill";
  public static readonly taskkillProcessIdArgument: string = "/pid";
  public static readonly taskkillTreeArgument: string = "/T";
  public static readonly taskkillForceArgument: string = "/F";
  public static readonly terminateSignal: NodeJS.Signals = "SIGTERM";
  public static readonly stopSignal: NodeJS.Signals = "SIGSTOP";
  public static readonly continueSignal: NodeJS.Signals = "SIGCONT";
  public static readonly killSignal: NodeJS.Signals = "SIGKILL";
  public static readonly processTreeFreezeRounds: number = 10;
  public static readonly processExitWait: number = 2_000;
  public static readonly processListTimeout: number = 30_000;
  public static readonly powershellSessionAnswerLimit: number = 5_000;
  public static readonly psExecutable: string = "ps";
  public static readonly psProcessListArguments: readonly string[] = ["-A", "-o", "pid=,ppid=,lstart="];
  public static readonly psProcessGroupArguments: readonly string[] = ["-A", "-o", "pid=,pgid=,lstart="];
  public static readonly psStartTolerance: number = 2000;
  public static readonly powershellExecutable: string = "powershell.exe";
  public static readonly powershellCommandArguments: readonly string[] = ["-NoProfile", "-NonInteractive", "-Command"];
  public static readonly powershellProcessListScript: string = "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, " +
    "$_.ParentProcessId, $(if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 'unknown' }) }";
  public static readonly powershellProcessListArguments: readonly string[] = [...Resources.powershellCommandArguments, Resources.powershellProcessListScript];
  public static readonly powershellSessionArguments: readonly string[] = [...Resources.powershellCommandArguments, "-"];
  public static readonly powershellSessionIdle: number = 30_000;
  public static readonly powershellSessionMarker: string = "TEAMRUN-ANSWERED-";
  public static readonly powershellSessionEnded: string = "The PowerShell session ended before it answered.";
  public static readonly processTreeGracePoll: number = 100;
  public static readonly processEnvironmentSeparator: string = "\0";
  public static readonly codexThreadEntryPrefix: string = "CODEX_THREAD_ID=";
  public static readonly processListEnvironment: Readonly<Record<string, string>> = { LC_ALL: "C" };
  public static readonly processParentPattern: RegExp = /^[ \t]*(\d+)[ \t]+(\d+)[ \t]+(\S[^\r\n]*?)[ \t]*\r?$/gm;
  public static readonly versionPattern: RegExp = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;
  public static readonly stampSeparator: string = "|";
  public static readonly userAgentVersionPattern: RegExp = /\/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/;

  public static readonly openAiApiKeyVariable: string = "OPENAI_API_KEY";
  public static readonly codexApiKeyVariable: string = "CODEX_API_KEY";
  public static readonly codexHomeVariable: string = "CODEX_HOME";
  public static readonly claudeConfigDirVariable: string = "CLAUDE_CONFIG_DIR";
  public static readonly codexHomeFolderName: string = ".codex";
  public static readonly claudeHomeFolderName: string = ".claude";
  public static readonly claudeConfigFile: string = ".claude.json";
  public static readonly maximumConfigurationMegabytes: number = 32;
  public static readonly maximumConfigurationBytes: number = Resources.maximumConfigurationMegabytes * 1024 * 1024;
  public static readonly claudeMcpServersField: string = "mcpServers";
  public static readonly ownMcpServersField: string = "mcpServers";
  public static readonly ownMcpFile: string = "mcp.json";
  public static readonly claudeProjectsField: string = "projects";
  public static readonly claudeProjectsFolder: string = "projects";
  public static readonly claudeSessionFileExtension: string = ".jsonl";
  public static readonly claudeCompactSummaryMarker: string = "\"isCompactSummary\":true";
  public static readonly jsonlTailChunkBytes: number = 1_048_576;
  public static readonly sessionCopyExtension: string = ".teamrun-copy";
  public static readonly codexSessionsFolder: string = "sessions";
  public static readonly codexRolloutExtension: string = ".jsonl";
  public static readonly codexCompactedMarker: string = "\"type\":\"compacted\"";
  public static readonly codexPayloadField: string = "payload";
  public static readonly claudeProjectMcpFile: string = ".mcp.json";
  public static readonly claudeDisabledMcpJsonField: string = "disabledMcpjsonServers";
  public static readonly claudeCommandField: string = "command";
  public static readonly claudeEnvironmentField: string = "env";
  public static readonly claudeExpandedServerFields: readonly string[] = ["command", "args", "env", "url", "headers"];
  public static readonly claudeVariableReference: RegExp = /\$\{([^}]+)\}/g;
  public static readonly claudeVariableFallback: string = ":-";
  public static readonly claudeProjectKeySeparator: string = "/";
  public static readonly windowsFolderSeparator: string = "\\";
  public static readonly gitDirectoryLine: RegExp = /^gitdir:\s*(.+?)\s*$/m;
  public static readonly gitCommonDirectoryFile: string = "commondir";
  public static readonly codexProfileEntries: readonly string[] = ["config.toml", "sessions", "history.jsonl", "version.json", "log"];
  public static readonly claudeProfileEntries: readonly string[] = [".claude.json", "settings.json", "projects", "history.jsonl", "statsig", "todos"];
  public static readonly claudeSignInCommand: string = "claude auth login";
  public static readonly claudeClientAppVariable: string = "CLAUDE_AGENT_SDK_CLIENT_APP";
  public static readonly disableAutoupdaterVariable: string = "DISABLE_AUTOUPDATER";
  public static readonly claudeNonessentialTrafficVariable: string = "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC";
  public static readonly claudeTodoToolsVariable: string = "CLAUDE_CODE_ENABLE_TODO_TOOLS";
  public static readonly enabledValue: string = "1";
  public static readonly claudeSessionStateEventsVariable: string = "CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS";
  public static readonly claudeAutoMemoryOffVariable: string = "CLAUDE_CODE_DISABLE_AUTO_MEMORY";
  public static readonly claudeCredentialVariablePattern: RegExp = /^(CLAUDE_|CLAUDEPID$|CLAUDECODE$|ANTHROPIC_)/i;
  public static readonly claudeSettingVariables: ReadonlySet<string> = new Set([
    "CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS", "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE",
    "CLAUDE_AUTO_BACKGROUND_TASKS", "CLAUDE_AX_PREPARK_MS", "CLAUDE_AX_SCREEN_READER", "CLAUDE_AX_STARTUP_QUIET_MS",
    "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR", "CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS", "CLAUDE_CLIENT_PRESENCE_FILE", "CLAUDE_CODE_ACCESSIBILITY",
    "CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD", "CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT", "CLAUDE_CODE_ALWAYS_ENABLE_EFFORT",
    "CLAUDE_CODE_ARTIFACT_AUTO_OPEN", "CLAUDE_CODE_ARTIFACT_COMMENTS", "CLAUDE_CODE_ARTIFACT_COMMENTS_AUTOREACT", "CLAUDE_CODE_ARTIFACT_PUBLISH_EDITS",
    "CLAUDE_CODE_ATTRIBUTION_HEADER", "CLAUDE_CODE_AUTO_BACKGROUND_WORKER_CHECKIN_SECONDS", "CLAUDE_CODE_AUTO_COMPACT_WINDOW",
    "CLAUDE_CODE_AUTO_CONNECT_IDE", "CLAUDE_CODE_AUTO_MODE_MODEL", "CLAUDE_CODE_AUTO_MODE_SERVER", "CLAUDE_CODE_AWS_CHAIN_RESOLVE_TIMEOUT_MS",
    "CLAUDE_CODE_BASH_EDIT_DIFF", "CLAUDE_CODE_BG_TASKS_REPORT_RUNNING", "CLAUDE_CODE_BS_AS_CTRL_BACKSPACE", "CLAUDE_CODE_CONNECT_TIMEOUT_MS",
    "CLAUDE_CODE_DEBUG_LOGS_DIR", "CLAUDE_CODE_DEBUG_LOG_LEVEL", "CLAUDE_CODE_DISABLE_1M_CONTEXT", "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING",
    "CLAUDE_CODE_DISABLE_ADVISOR_TOOL", "CLAUDE_CODE_DISABLE_AGENT_VIEW", "CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN", "CLAUDE_CODE_DISABLE_ARTIFACT",
    "CLAUDE_CODE_DISABLE_ATTACHMENTS", "CLAUDE_CODE_DISABLE_AUTO_MEMORY", "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS",
    "CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_DEFAULT", "CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_GUARD", "CLAUDE_CODE_DISABLE_BG_EXIT_HANDOFF",
    "CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP", "CLAUDE_CODE_DISABLE_BG_STABLE_PATH", "CLAUDE_CODE_DISABLE_BUNDLED_SKILLS",
    "CLAUDE_CODE_DISABLE_CFC_PROMPT", "CLAUDE_CODE_DISABLE_CLAUDE_MDS", "CLAUDE_CODE_DISABLE_CRON", "CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS", "CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS", "CLAUDE_CODE_DISABLE_FAST_MODE",
    "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY", "CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING", "CLAUDE_CODE_DISABLE_FILE_MENTIONS",
    "CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS", "CLAUDE_CODE_DISABLE_INLINE_SHELL_RM_PROMPT", "CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP",
    "CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND", "CLAUDE_CODE_DISABLE_MODEL_ACCESS_FALLBACK", "CLAUDE_CODE_DISABLE_MOUNTED_DRIVE_RM_PROMPT",
    "CLAUDE_CODE_DISABLE_MOUSE", "CLAUDE_CODE_DISABLE_MOUSE_CLICKS", "CLAUDE_CODE_DISABLE_MTLS_RELOAD_ON_STALE_CONNECTION",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK", "CLAUDE_CODE_DISABLE_NOTIFICATION_PRESENCE_CHECK",
    "CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL", "CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS", "CLAUDE_CODE_DISABLE_POLICY_SKILLS",
    "CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY", "CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK", "CLAUDE_CODE_DISABLE_STRUCTURED_OUTPUTS",
    "CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT", "CLAUDE_CODE_DISABLE_TERMINAL_TITLE", "CLAUDE_CODE_DISABLE_THINKING",
    "CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK", "CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT", "CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL",
    "CLAUDE_CODE_DISABLE_WEB_FETCH", "CLAUDE_CODE_DISABLE_WINDOWS_SHELL_LAUNCHER", "CLAUDE_CODE_DISABLE_WORKFLOWS", "CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS",
    "CLAUDE_CODE_ENABLE_AUTO_MODE", "CLAUDE_CODE_ENABLE_AWAY_SUMMARY", "CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH", "CLAUDE_CODE_ENABLE_CFC",
    "CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL", "CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING", "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
    "CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE", "CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION", "CLAUDE_CODE_ENABLE_SHARE_BUNDLE", "CLAUDE_CODE_ENABLE_TASKS",
    "CLAUDE_CODE_ENABLE_TELEMETRY", "CLAUDE_CODE_ENABLE_TODO_TOOLS",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "CLAUDE_CODE_EXTRA_BODY", "CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS",
    "CLAUDE_CODE_FORCE_SESSION_PERSISTENCE", "CLAUDE_CODE_FORCE_STRIKETHROUGH", "CLAUDE_CODE_FORCE_SYNC_OUTPUT", "CLAUDE_CODE_FORCE_TERMINAL_IMAGES",
    "CLAUDE_CODE_FORK_SUBAGENT", "CLAUDE_CODE_FORWARD_SUBAGENT_TEXT", "CLAUDE_CODE_GATEWAY_HINT_HEADERS", "CLAUDE_CODE_GATEWAY_MODEL_DISCOVERY_TIMEOUT_MS",
    "CLAUDE_CODE_GIT_BASH_PATH", "CLAUDE_CODE_GLOB_HIDDEN", "CLAUDE_CODE_GLOB_NO_IGNORE", "CLAUDE_CODE_GLOB_TIMEOUT_SECONDS",
    "CLAUDE_CODE_GOAL_CHECKIN_MINUTES", "CLAUDE_CODE_GZIP_REQUEST_BODIES", "CLAUDE_CODE_HIDE_CWD", "CLAUDE_CODE_IDE_HOST_OVERRIDE",
    "CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL", "CLAUDE_CODE_IDE_SKIP_VALID_CHECK", "CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS", "CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS",
    "CLAUDE_CODE_MAX_CONTEXT_TOKENS", "CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH", "CLAUDE_CODE_MAX_OUTPUT_TOKENS", "CLAUDE_CODE_MAX_RETRIES",
    "CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION", "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH", "CLAUDE_CODE_MAX_TURNS", "CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION",
    "CLAUDE_CODE_MCP_ALLOWLIST_ENV", "CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS", "CLAUDE_CODE_MCP_STARTUP_WAIT_MS", "CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT",
    "CLAUDE_CODE_NATIVE_CURSOR", "CLAUDE_CODE_NEW_INIT", "CLAUDE_CODE_NONBLOCKING_STDOUT", "CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES",
    "CLAUDE_CODE_NO_FLICKER", "CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE", "CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH", "CLAUDE_CODE_OTEL_DIAG_STDERR",
    "CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS", "CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS", "CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS",
    "CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS", "CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS", "CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE",
    "CLAUDE_CODE_PERFORCE_MODE", "CLAUDE_CODE_PLUGIN_CACHE_DIR", "CLAUDE_CODE_PLUGIN_DIRS", "CLAUDE_CODE_PLUGIN_DIR_WATCH",
    "CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS", "CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE", "CLAUDE_CODE_PLUGIN_PREFER_HTTPS", "CLAUDE_CODE_PLUGIN_SEED_DIR",
    "CLAUDE_CODE_POWERSHELL_RESPECT_EXECUTION_POLICY", "CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS", "CLAUDE_CODE_PROCESS_WRAPPER", "CLAUDE_CODE_PROJECT_DIR_NAME",
    "CLAUDE_CODE_PROMPT_CACHE_TTL", "CLAUDE_CODE_PROPAGATE_TRACEPARENT", "CLAUDE_CODE_PROXY_RESOLVES_HOSTS",
    "CLAUDE_CODE_RESTRICTED", "CLAUDE_CODE_RESUME_PROMPT",
    "CLAUDE_CODE_RESUME_SHOWS_CUT_OFF_CALLS", "CLAUDE_CODE_RETRY_WATCHDOG", "CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS",
    "CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS", "CLAUDE_CODE_SAFE_MODE", "CLAUDE_CODE_SCRIPT_CAPS", "CLAUDE_CODE_SCROLL_SPEED",
    "CLAUDE_CODE_SEND_FEEDBACK", "CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS", "CLAUDE_CODE_SHELL", "CLAUDE_CODE_SHELL_PREFIX", "CLAUDE_CODE_SIMPLE",
    "CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT", "CLAUDE_CODE_SKIP_AWS_CRED_CACHE", "CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS",
    "CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK", "CLAUDE_CODE_SKIP_MODEL_ACCESS_MEMORY", "CLAUDE_CODE_SKIP_PROMPT_HISTORY",
    "CLAUDE_CODE_STOP_HOOK_BLOCK_CAP", "CLAUDE_CODE_SUBAGENT_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL_FORCE", "CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL",
    "CLAUDE_CODE_SUBPROCESS_ENV_SCRUB", "CLAUDE_CODE_SYNC_PLUGIN_INSTALL", "CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS", "CLAUDE_CODE_SYNC_SKILLS",
    "CLAUDE_CODE_SYNC_SKILLS_INSTALL_TIMEOUT_MS", "CLAUDE_CODE_SYNC_SKILLS_WAIT_TIMEOUT_MS", "CLAUDE_CODE_SYNTAX_HIGHLIGHT", "CLAUDE_CODE_TASK_LIST_ID",
    "CLAUDE_CODE_TMPDIR", "CLAUDE_CODE_TMUX_TRUECOLOR", "CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE", "CLAUDE_CODE_TOOL_MEMORY_LIMIT",
    "CLAUDE_CODE_TRANSCRIPT_LOCAL_GC", "CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS",
    "CLAUDE_CODE_USE_POWERSHELL_TOOL", "CLAUDE_CODE_WARN_DISK_FREE_GIB", "CLAUDE_CODE_WARN_MEMORY_FREE_GIB", "CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS",
    "CLAUDE_CODE_WEBFETCH_DEADLINE_MS", "CLAUDE_CODE_WEB_SEARCH_REFILLS_PER_HOUR", "CLAUDE_CODE_WORKER_CHECKIN_SCHEDULE",
    "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS", "CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS", "CLAUDE_CODE_YOU_SHOULD_KNOW_DEBUG",
    "CLAUDE_ENABLE_BYTE_WATCHDOG", "CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK", "CLAUDE_ENABLE_STREAM_WATCHDOG", "CLAUDE_ENV_FILE",
    "CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX", "CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS", "CLAUDE_STREAM_IDLE_TIMEOUT_MS", "CLAUDE_SUBAGENT_BG_SHELL_MAX_MS"
  ]);
  public static readonly claudeRoutingVariables: ReadonlySet<string> = new Set([
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
    "CLAUDE_CODE_SKIP_VERTEX_AUTH",
    "CLAUDE_CODE_SKIP_FOUNDRY_AUTH",
    "ANTHROPIC_BEDROCK_BASE_URL",
    "ANTHROPIC_VERTEX_BASE_URL",
    "ANTHROPIC_FOUNDRY_BASE_URL"
  ]);
  public static readonly clientAppPrefix: string = "teamrun/";

  public static readonly lineSeparator: string = "\n";
  public static readonly contentLengthName: string = "Content-Length";
  public static readonly frameHeaderSeparator: string = "\r\n\r\n";
  public static readonly frameHeaderLineSeparator: string = "\r\n";
  public static readonly contentLengthHeader: RegExp = /^content-length: *(\d{1,9})$/i;
  public static readonly listSeparator: string = ", ";
  public static readonly requestIdSeparator: string = ":";
  public static readonly ellipsis: string = "…";
  public static readonly jsonObjectStart: string = "{";
  public static readonly maximumOutputLength: number = 512 * 1024;
  public static readonly levelListOutputLength: number = 16 * 1024 * 1024;
  public static readonly maximumStderrChunks: number = 50;
  public static readonly maximumSummaryLength: number = 500;
  public static readonly maximumReasoningLength: number = 4000;
  public static readonly maximumCommandOutputLength: number = 4000;
  public static readonly maximumToolResultLength: number = 6000;
  public static readonly maximumInputKeys: number = 4;
  public static readonly claudeMaximumTurns: number = 400;
  public static readonly claudeThinkingDisplayArgument: string = "thinking-display";
  public static readonly claudeSummarizedThinkingDisplay: string = "summarized";
  public static readonly projectInstructionsFileName: string = "CLAUDE.md";
  public static readonly claudeProjectInstructionFiles: readonly string[] = ["CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md"];
  public static readonly claudeRulesFolder: string = "rules";
  public static readonly agentsInstructionsFile: string = "AGENTS.md";
  public static readonly markdownExtension: string = ".md";
  public static readonly frontMatterFence: string = "---";
  public static readonly rulePathsKey: string = "paths:";
  public static readonly claudeLocalInstructionsFile: string = "CLAUDE.local.md";
  public static readonly claudeMacManagedInstructionsFile: string = "/Library/Application Support/ClaudeCode/CLAUDE.md";
  public static readonly claudeLinuxManagedInstructionsFile: string = "/etc/claude-code/CLAUDE.md";
  public static readonly claudeWindowsManagedInstructionsFile: string = "C:\\Program Files\\ClaudeCode\\CLAUDE.md";
  public static readonly claudeImportPattern: RegExp = /(?:^|\s)@((?:\\ |\S)+)/g;
  public static readonly codeFencePattern: RegExp = /^(?:```|~~~)/;
  public static readonly codeSpanPattern: RegExp = /(`+)[\s\S]*?\1/g;
  public static readonly commentOpening: string = "<!--";
  public static readonly commentClosing: string = "-->";
  public static readonly escapedSpace: string = "\\ ";
  public static readonly homePrefix: string = "~/";
  public static readonly quotes: string = "\"'";
  public static readonly maximumImportDepth: number = 4;
  public static readonly maximumInstructionsLength: number = 65_536;
  public static readonly maximumInstructionsTotalLength: number = 131_072;
  public static readonly space: string = " ";

  public static readonly versionTimeout: number = 20_000;
  public static readonly signInCheckTimeout: number = 30_000;
  public static readonly initializeTimeout: number = 60_000;
  public static readonly requestTimeout: number = 120_000;
  public static readonly interruptTimeout: number = 20_000;
  public static readonly interruptGrace: number = 30_000;
  public static readonly stopGrace: number = 3_000;
  public static readonly claudeAbortGrace: number = 8_000;
  public static readonly modelCheckWait: number = 3_000;
  public static readonly acpCommandsWait: number = 3_000;
  public static readonly teamRunToolsWait: number = 5_000;
  public static readonly streamInterval: number = 100;
  public static readonly resumeRetryDelay: number = 1000;
  public static readonly wakeGrace: number = 60000;
  public static readonly accountTimeout: number = 10_000;
  public static readonly modelListTimeout: number = 15_000;
  public static readonly silenceLimit: number = 14_400_000;
  public static readonly idleLimit: number = 1_800_000;
  public static readonly stopReportWait: number = 60_000;
  public static readonly idleCompactionDelay: number = 3_240_000;
  public static readonly idleCompactionTokens: number = 150_000;

  public static readonly idField: string = "id";
  public static readonly methodField: string = "method";
  public static readonly paramsField: string = "params";
  public static readonly resultField: string = "result";
  public static readonly errorField: string = "error";
  public static readonly codeField: string = "code";
  public static readonly messageField: string = "message";
  public static readonly dataField: string = "data";
  public static readonly userAgentField: string = "userAgent";
  public static readonly accountField: string = "account";
  public static readonly requiresOpenaiAuthField: string = "requiresOpenaiAuth";
  public static readonly typeField: string = "type";
  public static readonly emailField: string = "email";
  public static readonly planTypeField: string = "planType";
  public static readonly modelField: string = "model";
  public static readonly effortField: string = "effort";
  public static readonly hiddenField: string = "hidden";
  public static readonly threadField: string = "thread";
  public static readonly threadIdField: string = "threadId";
  public static readonly requestIdField: string = "requestId";
  public static readonly turnField: string = "turn";
  public static readonly reasoningEffortField: string = "reasoningEffort";
  public static readonly cwdField: string = "cwd";
  public static readonly textField: string = "text";
  public static readonly itemField: string = "item";
  public static readonly itemIdField: string = "itemId";
  public static readonly statusField: string = "status";
  public static readonly summaryField: string = "summary";
  public static readonly commandField: string = "command";
  public static readonly exitCodeField: string = "exitCode";
  public static readonly aggregatedOutputField: string = "aggregatedOutput";
  public static readonly commandActionsField: string = "commandActions";
  public static readonly readOnlyField: string = "readOnly";
  public static readonly deniedField: string = "denied";
  public static readonly readingCommandActions: readonly string[] = ["read", "listFiles", "search"];
  public static readonly readCommandAction: string = "read";
  public static readonly listFilesCommandAction: string = "listFiles";
  public static readonly searchCommandAction: string = "search";
  public static readonly writingCommandWords: readonly string[] = ["tee", "tee-object", "xargs", "-exec", "-execdir", "-ok", "-okdir", "-delete", "-fls"];
  public static readonly findPrintOptionPrefix: string = "-fprint";
  public static readonly commandWordBreakPattern: RegExp = /[\s|;&()<>'"`]+/;
  public static readonly commandPathPrefixPattern: RegExp = /^.*[\\/]/;
  public static readonly utf16RunPattern: RegExp = /(\uFFFD\uFFFD|\uFEFF|)((?:[^\0]\0)+|(?:\0[^\0])+)/g;
  public static readonly utf16PairPattern: RegExp = /([^\0])\0|\0([^\0])/g;
  public static readonly minimumUtf16Run: number = 4;
  public static readonly changesField: string = "changes";
  public static readonly pathField: string = "path";
  public static readonly kindField: string = "kind";
  public static readonly diffField: string = "diff";
  public static readonly maximumItemJsonLength: number = 4000;
  public static readonly savedPathField: string = "savedPath";
  public static readonly revisedPromptField: string = "revisedPrompt";
  public static readonly failureField: string = "failure";
  public static readonly imageDataField: string = "imageData";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly maximumImageDataLength: number = 12_000_000;
  public static readonly base64Pattern: RegExp = /^[A-Za-z0-9+/]+=*$/;
  public static readonly imageSignatures: Readonly<Record<string, string>> = {
    iVBORw0KGgo: "image/png", "/9j/": "image/jpeg", R0lGOD: "image/gif", UklGR: "image/webp"
  };
  public static readonly maximumImageBytes: number = Resources.maximumImageDataLength / 4 * 3;
  public static readonly acpRawOutputField: string = "rawOutput";
  public static readonly acpContentBlockType: string = "content";
  public static readonly grokImageOutputTypes: readonly string[] = ["ImageGen", "ImageEdit"];
  public static readonly grokImageVariantField: string = "variant";
  public static readonly grokSessionsDirectory: string = "sessions";
  public static readonly grokImagesDirectory: string = "images";
  public static readonly grokSessionIdPlaceholder: string = "0".repeat(36);
  public static readonly grokImagesFolderLimit: number = 248;
  public static readonly grokShortHomeFolder: string = "nol";
  public static readonly grokShortHomeNameLength: number = 8;
  public static readonly grokShortHomeHash: string = "sha256";
  public static readonly grokShortHomeEncoding: "hex" = "hex";
  public static readonly grokImageNamePattern: RegExp = /^\d{1,6}\.(?:jpe?g|png|webp)$/i;
  public static readonly pathSeparatorPattern: RegExp = /[\\/]/;
  public static readonly executableSuffixPattern: RegExp = /\.exe$/;
  public static readonly absoluteCommandPattern: RegExp = /^(?:[\\/]|[A-Za-z]:[\\/])/u;
  public static readonly shellSpacePattern: RegExp = /[ \t\n]/;
  public static readonly singleQuote: string = "'";
  public static readonly doubleQuote: string = "\"";
  public static readonly backslash: string = "\\";
  public static readonly doubleQuotedEscapes: string = "$`\"\\\n";
  public static readonly posixShellNames: readonly string[] = ["bash", "zsh", "sh"];
  public static readonly posixShellScriptFlags: readonly string[] = ["-lc", "-c"];
  public static readonly powerShellNames: readonly string[] = ["pwsh", "powershell"];
  public static readonly powerShellFlags: readonly string[] = ["-nologo", "-noprofile"];
  public static readonly powerShellScriptFlags: readonly string[] = ["-command", "-c"];
  public static readonly powerShellEncodingLinePattern: RegExp =
    /^[ \t]*(?:try[ \t]*\{[ \t]*)?\[(?:System\.)?Console\]::OutputEncoding[ \t]*=[ \t]*[^;\n{}]+?[ \t]*;?[ \t]*(?:\}[ \t]*catch[ \t]*\{[ \t]*\}[ \t]*)?(?:\r?\n|$)/i;
  public static readonly cmdShellName: string = "cmd";
  public static readonly cmdFlags: readonly string[] = ["/d", "/s", "/q"];
  public static readonly cmdScriptFlags: readonly string[] = ["/c", "/k"];
  public static readonly shellLineBreakPattern: RegExp = /[\r\n]/u;
  public static readonly shellOperators: Readonly<Record<ShellDialect, string>> = {
    [ShellDialect.Posix]: "|&;<>()`${}",
    [ShellDialect.PowerShell]: "|&;<>(){}$@,`",
    [ShellDialect.Cmd]: "|&<>^()%"
  };
  public static readonly shellQuotedRefused: Readonly<Record<ShellDialect, string>> = {
    [ShellDialect.Posix]: "$`",
    [ShellDialect.PowerShell]: "$`",
    [ShellDialect.Cmd]: "%"
  };
  public static readonly commentMark: string = "#";
  public static readonly flagPrefix: string = "-";
  public static readonly longFlagPrefix: string = "--";
  public static readonly flagValueSeparator: string = "=";
  public static readonly switchPrefix: string = "/";
  public static readonly commandKinds: Readonly<Record<ShellDialect, ReadonlyMap<string, CommandKind>>> = {
    [ShellDialect.Posix]: new Map([
      ["rg", CommandKind.Search], ["grep", CommandKind.Search], ["cat", CommandKind.Read], ["head", CommandKind.ReadStart], ["tail", CommandKind.ReadEnd],
      ["ls", CommandKind.List], ["dir", CommandKind.List], ["cd", CommandKind.ChangeFolder], ["pushd", CommandKind.ChangeFolder], ["git", CommandKind.Git]
    ]),
    [ShellDialect.PowerShell]: new Map([
      ["rg", CommandKind.Search], ["findstr", CommandKind.Search], ["select-string", CommandKind.Search], ["sls", CommandKind.Search],
      ["get-content", CommandKind.Read], ["gc", CommandKind.Read], ["cat", CommandKind.Read], ["type", CommandKind.Read],
      ["get-childitem", CommandKind.List], ["gci", CommandKind.List], ["ls", CommandKind.List], ["dir", CommandKind.List],
      ["set-location", CommandKind.ChangeFolder], ["sl", CommandKind.ChangeFolder], ["cd", CommandKind.ChangeFolder], ["chdir", CommandKind.ChangeFolder],
      ["push-location", CommandKind.ChangeFolder], ["pushd", CommandKind.ChangeFolder], ["git", CommandKind.Git]
    ]),
    [ShellDialect.Cmd]: new Map([
      ["rg", CommandKind.Search], ["findstr", CommandKind.Search], ["type", CommandKind.Read], ["dir", CommandKind.List],
      ["cd", CommandKind.ChangeFolder], ["chdir", CommandKind.ChangeFolder], ["pushd", CommandKind.ChangeFolder], ["git", CommandKind.Git]
    ])
  };
  public static readonly searchFlags: ReadonlyMap<string, CommandFlags> = new Map([
    ["rg", new CommandFlags("ilnNsSwxcHhIuUo", "gtTABCmMj", "e", [
      "--hidden", "--no-ignore", "--ignore-case", "--smart-case", "--case-sensitive", "--line-number", "--no-line-number", "--heading", "--no-heading",
      "--fixed-strings", "--word-regexp", "--line-regexp", "--files-with-matches", "--count", "--with-filename", "--no-filename", "--only-matching",
      "--multiline", "--follow", "--no-messages", "--vimgrep"
    ], [
      "--glob", "--iglob", "--type", "--type-not", "--max-count", "--context", "--after-context", "--before-context", "--max-depth", "--color", "--sort"
    ], "--regexp")],
    ["grep", new CommandFlags("rRniEFGPwxlchHosqI", "ABCm", "e", [
      "--recursive", "--dereference-recursive", "--line-number", "--ignore-case", "--extended-regexp", "--fixed-strings", "--perl-regexp",
      "--word-regexp", "--line-regexp", "--files-with-matches", "--count", "--with-filename", "--no-filename", "--only-matching", "--no-messages",
      "--quiet", "--silent"
    ], [
      "--include", "--exclude", "--exclude-dir", "--context", "--after-context", "--before-context", "--max-count", "--color", "--colour"
    ], "--regexp")]
  ]);
  public static readonly findstrName: string = "findstr";
  public static readonly findstrLiteralPrefix: string = "/c:";
  public static readonly findstrSwitches: readonly string[] = ["/s", "/i", "/n", "/r", "/l", "/b", "/e", "/m", "/o", "/p", "/x", "/offline"];
  public static readonly patternParameter: string = "-pattern";
  public static readonly pathParameters: readonly string[] = ["-path", "-literalpath"];
  public static readonly selectStringParameters: CmdletParameters = new CmdletParameters(
    ["-simplematch", "-casesensitive", "-list", "-allmatches", "-quiet", "-raw"], ["-pattern", "-path", "-literalpath", "-encoding", "-include", "-exclude"]);
  public static readonly getContentParameters: CmdletParameters = new CmdletParameters(
    ["-raw", "-force"], ["-path", "-literalpath", "-totalcount", "-head", "-first", "-tail", "-last", "-encoding", "-delimiter", "-readcount"]);
  public static readonly startParameters: readonly string[] = ["-totalcount", "-head", "-first"];
  public static readonly endParameters: readonly string[] = ["-tail", "-last"];
  public static readonly partValueFlags: readonly string[] = ["-n", "-c"];
  public static readonly partFlagPattern: RegExp = /^(?:-[0-9]+|-[nc][0-9]+|--(?:lines|bytes)=[0-9]+)$/u;
  public static readonly listLetters: string = "laAhtrS1FGp";
  public static readonly recurseLetter: string = "R";
  public static readonly listNames: readonly string[] = ["--all", "--almost-all", "--human-readable", "--classify", "--color"];
  public static readonly dirRecurseSwitch: string = "/s";
  public static readonly dirSwitches: readonly string[] = ["/b", "/w", "/p", "/q", "/x", "/l", "/n", "/d"];
  public static readonly dirValueSwitches: readonly string[] = ["/a", "/o", "/t"];
  public static readonly getChildItemParameters: CmdletParameters = new CmdletParameters(
    ["-force", "-file", "-directory", "-name", "-hidden", "-recurse"], ["-path", "-literalpath", "-filter", "-include", "-exclude", "-depth"]);
  public static readonly recurseParameter: string = "-recurse";
  public static readonly depthParameter: string = "-depth";
  public static readonly setLocationParameters: CmdletParameters = new CmdletParameters([], ["-path", "-literalpath"]);
  public static readonly driveSwitch: string = "/d";
  public static readonly gitNoPagerFlag: string = "--no-pager";
  public static readonly gitOutputFlag: string = "--output";
  public static readonly gitTitles: ReadonlyMap<string, string> = new Map([
    ["status", "Checked the git status"], ["diff", "Viewed the git diff"], ["log", "Viewed the git log"]
  ]);
  public static readonly listedFolderTitle: string = "Listed the folder";
  public static readonly listedTreeTitle: string = "Listed the folder and its subfolders";
  public static readonly dotSegments: readonly string[] = [".", ".."];
  public static readonly shellBlankPattern: RegExp = /[ \t\r]/u;
  public static readonly shellSeparators: Readonly<Record<ShellDialect, readonly string[]>> = {
    [ShellDialect.Posix]: ["&&", "||", ";;", "|&", ";", "|", "&"],
    [ShellDialect.PowerShell]: ["&&", "||", ";", "|"],
    [ShellDialect.Cmd]: ["&&", "||", "&", "|"]
  };
  public static readonly shellRedirects: Readonly<Record<ShellDialect, readonly string[]>> = {
    [ShellDialect.Posix]: ["&>>", "<<<", "<<-", "&>", "<<", "<>", "<&", ">>", ">|", ">&", ">", "<"],
    [ShellDialect.PowerShell]: [">>", ">&", ">"],
    [ShellDialect.Cmd]: [">>", ">&", "<&", ">", "<"]
  };
  public static readonly shellGroupCharacters: Readonly<Record<ShellDialect, string>> = {
    [ShellDialect.Posix]: "()",
    [ShellDialect.PowerShell]: String.empty,
    [ShellDialect.Cmd]: "()"
  };
  public static readonly shellGlobCharacters: Readonly<Record<ShellDialect, string>> = {
    [ShellDialect.Posix]: "*?[",
    [ShellDialect.PowerShell]: "*?[",
    [ShellDialect.Cmd]: "*?"
  };
  public static readonly descriptorPatterns: Readonly<Record<ShellDialect, RegExp>> = {
    [ShellDialect.Posix]: /^\d+$/u,
    [ShellDialect.PowerShell]: /^(?:\d+|\*)$/u,
    [ShellDialect.Cmd]: /^\d+$/u
  };
  public static readonly writingRedirects: readonly string[] = ["&>>", "&>", "<>", ">>", ">|", ">&", ">"];
  public static readonly hereDocumentRedirects: readonly string[] = ["<<", "<<-"];
  public static readonly tabStrippingRedirect: string = "<<-";
  public static readonly duplicateRedirect: string = ">&";
  public static readonly duplicateTargetPattern: RegExp = /^(?:\d+|-)$/u;
  public static readonly leadingTabsPattern: RegExp = /^\t+/u;
  public static readonly trailingCarriageReturnPattern: RegExp = /\r$/u;
  public static readonly inputRedirect: string = "<";
  public static readonly dollarSign: string = "$";
  public static readonly subexpressionStart: string = "$(";
  public static readonly backtick: string = "`";
  public static readonly caret: string = "^";
  public static readonly percentSign: string = "%";
  public static readonly atSign: string = "@";
  public static readonly comma: string = ",";
  public static readonly openParenthesis: string = "(";
  public static readonly closeParenthesis: string = ")";
  public static readonly openBrace: string = "{";
  public static readonly closeBrace: string = "}";
  public static readonly powerShellBlockCommentStart: string = "<#";
  public static readonly powerShellBlockCommentEnd: string = "#>";
  public static readonly powerShellStopParsing: string = "--%";
  public static readonly processSubstitutionMarks: string = "<>";
  public static readonly nullDevices: readonly string[] = ["/dev/null", "/dev/stdout", "/dev/stderr", "nul", "$null"];
  public static readonly absoluteTargetPattern: RegExp = /^(?:[\\/]|[A-Za-z]:|~(?:[\\/]|$))/u;
  public static readonly assignmentPattern: RegExp = /^[A-Za-z_][A-Za-z0-9_]*=/u;
  public static readonly trailingSeparatorsPattern: RegExp = /[\\/]+$/u;
  public static readonly shellLeadingKeywords: readonly string[] = ["if", "then", "else", "elif", "do", "while", "until", "!", "{", "time"];
  public static readonly testBrackets: readonly string[] = ["[", "[["];
  public static readonly homeFolder: string = "~";
  public static readonly previousFolder: string = "-";
  public static readonly standardStream: string = "-";
  public static readonly currentFolder: string = ".";
  public static readonly folderSeparator: string = "/";
  public static readonly writeKinds: Readonly<Record<ShellDialect, ReadonlyMap<string, WriteKind>>> = {
    [ShellDialect.Posix]: new Map<string, WriteKind>([
      ...["echo", "printf", "cat", "ls", "dir", "grep", "egrep", "fgrep", "rg", "head", "tail", "wc", "pwd", "true", "false", "test", "[", "[[", "]]",
        "which", "type", "date", "sleep", "stat", "file", "diff", "cmp", "cut", "tr", "basename", "dirname", "realpath", "readlink", "du", "df", "jq",
        "nl", "od", "column", "fold", "seq", "sha256sum", "sha1sum", "md5sum", "cksum", "mkdir", "chmod", "chown", "export", "set", "unset", "local",
        "declare", "shopt", ":", "exit", "return", "wait", "uname", "whoami", "hostname", "fi", "done", "}", "for", "select", "in"
      ].map(t => [t, WriteKind.Quiet] as const),
      ["cd", WriteKind.ChangeFolder], ["pushd", WriteKind.PushFolder], ["popd", WriteKind.PopFolder], ["git", WriteKind.Git],
      ["touch", WriteKind.Files], ["tee", WriteKind.Files], ["truncate", WriteKind.Files], ["cp", WriteKind.Copy], ["install", WriteKind.Copy],
      ["ln", WriteKind.Copy], ["mv", WriteKind.Move], ["rm", WriteKind.Remove], ["unlink", WriteKind.Remove], ["sed", WriteKind.StreamEdit],
      ["dd", WriteKind.DiskDump], ["sort", WriteKind.Sort], ["curl", WriteKind.Download], ["wget", WriteKind.Fetch], ["find", WriteKind.Find]
    ]),
    [ShellDialect.PowerShell]: new Map<string, WriteKind>([
      ...["get-content", "gc", "cat", "type", "get-childitem", "gci", "ls", "dir", "select-string", "sls", "write-output", "echo", "write", "write-host",
        "get-location", "gl", "pwd", "test-path", "get-item", "gi", "get-itemproperty", "gp", "measure-object", "measure", "select-object", "select",
        "sort-object", "sort", "format-table", "ft", "format-list", "fl", "out-string", "out-null", "out-host", "oh", "get-date", "start-sleep", "sleep",
        "resolve-path", "rvpa", "split-path", "join-path", "get-command", "gcm", "get-process", "gps", "ps", "get-filehash", "convertto-json",
        "convertfrom-json", "rg", "findstr", "mkdir", "md", "exit", "return"
      ].map(t => [t, WriteKind.Quiet] as const),
      ...["set-location", "sl", "cd", "chdir"].map(t => [t, WriteKind.ChangeFolder] as const),
      ...["push-location", "pushd"].map(t => [t, WriteKind.PushFolder] as const),
      ...["pop-location", "popd"].map(t => [t, WriteKind.PopFolder] as const),
      ...["out-file", "set-content", "sc", "add-content", "ac", "clear-content", "clc", "tee-object", "tee"].map(t => [t, WriteKind.Files] as const),
      ...["new-item", "ni"].map(t => [t, WriteKind.NewItem] as const),
      ...["copy-item", "cp", "copy", "cpi"].map(t => [t, WriteKind.Copy] as const),
      ...["move-item", "mv", "move", "mi"].map(t => [t, WriteKind.Move] as const),
      ...["remove-item", "rm", "del", "erase", "ri", "rd", "rmdir"].map(t => [t, WriteKind.Remove] as const),
      ...["rename-item", "ren", "rni"].map(t => [t, WriteKind.Rename] as const),
      ["git", WriteKind.Git]
    ]),
    [ShellDialect.Cmd]: new Map<string, WriteKind>([
      ...["echo", "type", "dir", "findstr", "rg", "mkdir", "md", "rem", "::", "cls", "ver", "exit"].map(t => [t, WriteKind.Quiet] as const),
      ["cd", WriteKind.ChangeFolder], ["chdir", WriteKind.ChangeFolder], ["pushd", WriteKind.PushFolder], ["popd", WriteKind.PopFolder],
      ["git", WriteKind.Git], ["copy", WriteKind.Copy], ["move", WriteKind.Move], ["del", WriteKind.Remove], ["erase", WriteKind.Remove],
      ["ren", WriteKind.Rename], ["rename", WriteKind.Rename]
    ])
  };
  public static readonly writeFlags: ReadonlyMap<string, CommandFlags> = new Map([
    ["touch", new CommandFlags(String.empty, "dtr", null, [], ["--date", "--reference"], null)],
    ["truncate", new CommandFlags(String.empty, "sr", null, [], ["--size", "--reference"], null)],
    ["cp", new CommandFlags(String.empty, "St", null, [], ["--suffix", "--target-directory"], null)],
    ["install", new CommandFlags(String.empty, "Stmog", null, [], ["--suffix", "--target-directory", "--mode", "--owner", "--group"], null)],
    ["ln", new CommandFlags(String.empty, "St", null, [], ["--suffix", "--target-directory"], null)],
    ["mv", new CommandFlags(String.empty, "St", null, [], ["--suffix", "--target-directory"], null)],
    ["sed", new CommandFlags(String.empty, "ef", null, [], ["--expression", "--file"], null)],
    ["sort", new CommandFlags(String.empty, "otSkT", null, [], ["--output", "--key", "--field-separator", "--buffer-size", "--temporary-directory"], null)],
    ["curl", new CommandFlags(String.empty, "oHdXuAeFTrmwbcKxyCE", null, [], ["--output", "--output-dir", "--header", "--data", "--request", "--user"],
      null)],
    ["wget", new CommandFlags(String.empty, "OoPaUt", null, [], ["--output-document", "--output-file", "--directory-prefix"], null)]
  ]);
  public static readonly noFlags: CommandFlags = new CommandFlags(String.empty, String.empty, null, [], [], null);
  public static readonly gitValueFlags: readonly string[] = ["-C", "-c", "--git-dir", "--work-tree", "--namespace"];
  public static readonly gitFolderFlag: string = "-C";
  public static readonly readingGitCommands: readonly string[] = ["status", "log", "diff", "show", "rev-parse", "ls-files", "ls-tree", "blame", "grep",
    "describe", "shortlog", "cat-file", "merge-base", "help", "version"];
  public static readonly recursiveFlags: readonly string[] = ["-r", "-R", "--recursive", "-a", "--archive"];
  public static readonly targetFolderFlags: readonly string[] = ["-t", "--target-directory"];
  public static readonly inPlaceFlags: readonly string[] = ["-i", "--in-place"];
  public static readonly scriptFlags: readonly string[] = ["-e", "--expression", "-f", "--file"];
  public static readonly outputFlags: readonly string[] = ["-o", "--output"];
  public static readonly outputFolderFlags: readonly string[] = ["--output-dir"];
  public static readonly substitutionPattern: RegExp = /\$\(|`/u;
  public static readonly remoteNameFlags: readonly string[] = ["-O", "--remote-name", "--remote-name-all", "-J", "--remote-header-name"];
  public static readonly outputDocumentFlags: readonly string[] = ["-O", "--output-document"];
  public static readonly diskDumpOutputPrefix: string = "of=";
  public static readonly findWritingActions: readonly string[] = ["-delete", "-exec", "-execdir", "-ok", "-okdir", "-fprint", "-fprint0", "-fprintf", "-fls"];
  public static readonly cmdletWriteParameters: ReadonlyMap<string, CmdletParameters> = new Map(([
    [["set-location", "sl", "cd", "chdir", "push-location", "pushd"], Resources.setLocationParameters],
    [["pop-location", "popd"], new CmdletParameters([], [])],
    [["out-file"], new CmdletParameters(["-append", "-force", "-noclobber", "-nonewline"], ["-filepath", "-path", "-literalpath", "-encoding", "-width",
      "-inputobject"])],
    [["set-content", "sc", "add-content", "ac"], new CmdletParameters(["-force", "-nonewline", "-passthru", "-asbytestream"], ["-path", "-literalpath",
      "-value", "-encoding", "-filter", "-include", "-exclude", "-stream"])],
    [["clear-content", "clc"], new CmdletParameters(["-force"], ["-path", "-literalpath", "-filter", "-include", "-exclude", "-stream"])],
    [["tee-object", "tee"], new CmdletParameters(["-append"], ["-filepath", "-literalpath", "-variable", "-inputobject", "-encoding"])],
    [["new-item", "ni"], new CmdletParameters(["-force"], ["-path", "-name", "-itemtype", "-type", "-value"])],
    [["copy-item", "cp", "copy", "cpi"], new CmdletParameters(["-force", "-recurse", "-passthru", "-container"], ["-path", "-literalpath", "-destination",
      "-filter", "-include", "-exclude"])],
    [["move-item", "mv", "move", "mi"], new CmdletParameters(["-force", "-passthru"], ["-path", "-literalpath", "-destination", "-filter", "-include",
      "-exclude"])],
    [["remove-item", "rm", "del", "erase", "ri", "rd", "rmdir"], new CmdletParameters(["-force", "-recurse"], ["-path", "-literalpath", "-filter",
      "-include", "-exclude"])],
    [["rename-item", "ren", "rni"], new CmdletParameters(["-force", "-passthru"], ["-path", "-literalpath", "-newname"])]
  ] as [readonly string[], CmdletParameters][]).flatMap(([names, parameters]) => names.map(t => [t, parameters] as const)));
  public static readonly fileParameters: readonly string[] = ["-filepath", "-path", "-literalpath"];
  public static readonly destinationParameter: string = "-destination";
  public static readonly nameParameter: string = "-name";
  public static readonly newNameParameter: string = "-newname";
  public static readonly itemTypeParameters: readonly string[] = ["-itemtype", "-type"];
  public static readonly folderItemType: string = "directory";
  public static readonly variableParameter: string = "-variable";
  public static readonly wildcardParameters: readonly string[] = ["-filter", "-include", "-exclude"];
  public static readonly parameterValueSeparator: string = ":";
  public static readonly cmdSwitchPattern: RegExp = /^\/[A-Za-z?-]+$/u;
  public static readonly acpRawInputField: string = "rawInput";
  public static readonly useToolNameField: string = "tool_name";
  public static readonly useToolInputField: string = "tool_input";
  public static readonly useToolFileField: string = "tool_input_file";
  public static readonly useToolFields: readonly string[] = ["tool_name", "tool_input", "tool_input_file", "variant"];
  public static readonly useToolFileFormField: string = "file";
  public static readonly routedTeamRunToolPrefix: string = "teamrun__";
  public static readonly acpTeamRunToolPattern: RegExp = /^teamrun(?:__|-)([A-Za-z0-9]+(?:_[A-Za-z0-9]+)*)$/u;
  public static readonly teamRunToolNamePattern: RegExp = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/u;
  public static readonly approvedToolNamePattern: RegExp = /^[A-Za-z0-9_-]+$/;
  public static readonly controlCharacters: RegExp = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
  public static readonly pathFolders: RegExp =
    /(?<=[("'])(?:[A-Za-z]:[\\/]|\\\\|~?\/)(?:[^()"'\r\n]*[\\/])?|(?<=^|[\s=])(?:[A-Za-z]:[\\/]|\\\\|~?\/)(?:[^\s()"'\\/]+[\\/])*/g;
  public static readonly acpAudioType: string = "audio";
  public static readonly acpResourceType: string = "resource";
  public static readonly acpResourceField: string = "resource";
  public static readonly acpBlobField: string = "blob";
  public static readonly sizeField: string = "size";
  public static readonly base64PaddingPattern: RegExp = /=+$/;
  public static readonly imageNotSaved: string = "not saved";
  public static readonly serverField: string = "server";
  public static readonly toolField: string = "tool";
  public static readonly questionsField: string = "questions";
  public static readonly questionField: string = "question";
  public static readonly headerField: string = "header";
  public static readonly labelField: string = "label";
  public static readonly descriptionField: string = "description";
  public static readonly multiSelectField: string = "multiSelect";
  public static readonly isOtherField: string = "isOther";
  public static readonly isSecretField: string = "isSecret";
  public static readonly answersField: string = "answers";
  public static readonly queryField: string = "query";
  public static readonly fromModelField: string = "fromModel";
  public static readonly toModelField: string = "toModel";
  public static readonly reasonField: string = "reason";
  public static readonly willRetryField: string = "willRetry";
  public static readonly grantRootField: string = "grantRoot";
  public static readonly loggedInField: string = "loggedIn";
  public static readonly subscriptionTypeField: string = "subscriptionType";
  public static readonly organizationNameField: string = "orgName";
  public static readonly authMethodField: string = "authMethod";

  public static readonly initializeMethod: string = "initialize";
  public static readonly initializedMethod: string = "initialized";
  public static readonly accountReadMethod: string = "account/read";
  public static readonly loginStartMethod: string = "account/login/start";
  public static readonly loginCancelMethod: string = "account/login/cancel";
  public static readonly logoutMethod: string = "account/logout";
  public static readonly loginCompletedMethod: string = "account/login/completed";
  public static readonly chatGptLoginType: string = "chatgpt";
  public static readonly loginIdField: string = "loginId";
  public static readonly authUrlField: string = "authUrl";
  public static readonly codexSignInHost: string = "auth.openai.com";
  public static readonly httpsProtocol: string = "https:";
  public static readonly successField: string = "success";
  public static readonly modelListMethod: string = "model/list";
  public static readonly configReadMethod: string = "config/read";
  public static readonly threadStartMethod: string = "thread/start";
  public static readonly threadResumeMethod: string = "thread/resume";
  public static readonly threadArchiveMethod: string = "thread/archive";
  public static readonly threadUnarchiveMethod: string = "thread/unarchive";
  public static readonly threadUnsubscribeMethod: string = "thread/unsubscribe";
  public static readonly threadForkMethod: string = "thread/fork";
  public static readonly lastTurnIdField: string = "lastTurnId";
  public static readonly threadNameSetMethod: string = "thread/name/set";
  public static readonly threadNotFoundMarker: string = "thread not found";
  public static readonly reviewStartMethod: string = "review/start";
  public static readonly reviewTargetField: string = "target";
  public static readonly reviewInstructionsField: string = "instructions";
  public static readonly reviewUncommittedTarget: string = "uncommittedChanges";
  public static readonly reviewCustomTarget: string = "custom";
  public static readonly archivedMarker: string = "is archived";
  public static readonly activeWriterMarker: string = "active writer";
  public static readonly resumeRetryCount: number = 3;
  public static readonly turnStartMethod: string = "turn/start";
  public static readonly threadCompactStartMethod: string = "thread/compact/start";
  public static readonly turnInterruptMethod: string = "turn/interrupt";
  public static readonly turnSteerMethod: string = "turn/steer";
  public static readonly itemStartedNotification: string = "item/started";
  public static readonly itemCompletedNotification: string = "item/completed";
  public static readonly agentMessageDeltaNotification: string = "item/agentMessage/delta";
  public static readonly deltaField: string = "delta";
  public static readonly turnCompletedNotification: string = "turn/completed";
  public static readonly turnStartedNotification: string = "turn/started";
  public static readonly turnPlanUpdatedNotification: string = "turn/plan/updated";
  public static readonly planField: string = "plan";
  public static readonly stepField: string = "step";
  public static readonly explanationField: string = "explanation";
  public static readonly codexPlanStatuses: Readonly<Record<string, PlanStepStatus>> = {
    pending: PlanStepStatus.Pending,
    inProgress: PlanStepStatus.InProgress,
    completed: PlanStepStatus.Completed
  };
  public static readonly modelReroutedNotification: string = "model/rerouted";
  public static readonly errorNotification: string = "error";
  public static readonly commandApprovalRequest: string = "item/commandExecution/requestApproval";
  public static readonly fileChangeApprovalRequest: string = "item/fileChange/requestApproval";
  public static readonly codexCommandKind: string = "commandExecution";
  public static readonly codexFileChangeKind: string = "fileChange";
  public static readonly codexElicitationKind: string = "elicitation";
  public static readonly userInputRequest: string = "item/tool/requestUserInput";
  public static readonly codexAsyncInputTool: string = "request_user_input_async";
  public static readonly deliveryField: string = "delivery";
  public static readonly codexAsyncDelivery: string = "async";
  public static readonly codexQuestionReplyOpen: string = "<send_user_message_question_reply>";
  public static readonly codexQuestionReplyClose: string = "</send_user_message_question_reply>";
  public static readonly questionItemIdField: string = "questionItemId";
  public static readonly answerField: string = "answer";
  public static readonly mcpElicitationRequest: string = "mcpServer/elicitation/request";
  public static readonly mcpServerStartupStatusNotification: string = "mcpServer/startupStatus/updated";
  public static readonly mcpServerStartupFailedState: string = "failed";
  public static readonly mcpServerReauthenticationRequired: string = "reauthenticationRequired";
  public static readonly failureReasonField: string = "failureReason";
  public static readonly serverNameField: string = "serverName";
  public static readonly codexApprovalKindField: string = "codex_approval_kind";
  public static readonly codexToolCallApprovalKind: string = "mcp_tool_call";
  public static readonly codexPersistField: string = "persist";
  public static readonly codexPersistSession: string = "session";
  public static readonly codexToolTitleField: string = "tool_title";
  public static readonly codexToolParamsField: string = "tool_params";
  public static readonly codexNotePrefix: string = "user_note: ";
  public static readonly codexOtherLabel: string = "None of the above";
  public static readonly serverRequestResolvedNotification: string = "serverRequest/resolved";
  public static readonly commandOutputDeltaNotification: string = "item/commandExecution/outputDelta";
  public static readonly terminalInteractionNotification: string = "item/commandExecution/terminalInteraction";
  public static readonly backgroundTerminalsListMethod: string = "thread/backgroundTerminals/list";
  public static readonly backgroundTerminalsTerminateMethod: string = "thread/backgroundTerminals/terminate";
  public static readonly backgroundTerminalsCleanMethod: string = "thread/backgroundTerminals/clean";
  public static readonly processIdField: string = "processId";
  public static readonly terminatedField: string = "terminated";
  public static readonly inProgressItemStatus: string = "inProgress";
  public static readonly completedItemStatus: string = "completed";
  public static readonly interruptedItemStatus: string = "interrupted";
  public static readonly maximumTerminalPages: number = 20;
  public static readonly codexTerminalNotTerminated: string = "Codex did not stop the command.";

  public static readonly chatGptAccountType: string = "chatgpt";
  public static readonly codexUnknownPlan: string = "unknown";
  public static readonly workspaceWriteSandbox: string = "workspace-write";
  public static readonly readOnlySandbox: string = "read-only";
  public static readonly dangerFullAccessSandbox: string = "danger-full-access";
  public static readonly onRequestApprovalPolicy: string = "on-request";
  public static readonly neverApprovalPolicy: string = "never";
  public static readonly dangerFullAccessPolicy: string = "dangerFullAccess";
  public static readonly readOnlyPolicy: string = "readOnly";
  public static readonly workspaceWritePolicy: string = "workspaceWrite";
  public static readonly approvalPolicyField: string = "approvalPolicy";
  public static readonly sandboxPolicyField: string = "sandboxPolicy";
  public static readonly codexReadOnlyMode: string = "read-only";
  public static readonly codexReadOnlyModeName: string = "Read Only";
  public static readonly codexReadOnlyModeDescription: string = "Reads files in the workspace, and asks before edits and internet access.";
  public static readonly codexWakePrompt: string = "A sub-agent you started in the background has ended, and its result is in this turn. "
    + "Go on with the work it was for, or end your turn if nothing is left.";
  public static readonly acpBackgroundSubAgentsNote: string = "A sub-agent of your own that you start in the background ends when your turn ends, "
    + "and nothing it finds reaches you after that, so wait for each one's result before you end your turn.";
  public static readonly copilotBackgroundSubAgentsNote: string = "A sub-agent of your own that you start in the background keeps your turn open until it ends, "
    + "and its result reaches you in that turn, so no one can send you a message until then, and stopping your turn ends it.";
  public static readonly codexExplorerUnavailable: string = "Codex runs the commands your Codex rules allow outside its read-only sandbox, and TeamRun can't turn those rules off for one chat, so an explorer there could change files.";
  public static readonly codexDefaultMode: string = "auto";
  public static readonly codexDefaultModeName: string = "Default";
  public static readonly codexDefaultModeDescription: string = "Reads, edits and runs commands in the workspace, and asks before internet access or edits elsewhere.";
  public static readonly codexPlanMode: string = "plan";
  public static readonly codexPlanModeName: string = "Plan";
  public static readonly codexPlanModeDescription: string = "Reads and plans in Codex's plan mode, and changes nothing; commands and the web still ask first.";
  public static readonly codexCollaborationModeField: string = "collaborationMode";
  public static readonly codexModeField: string = "mode";
  public static readonly codexDefaultCollaboration: string = "default";
  public static readonly codexCollaborationSettingsField: string = "settings";
  public static readonly codexReasoningEffortSetting: string = "reasoning_effort";
  public static readonly codexDeveloperInstructionsSetting: string = "developer_instructions";
  public static readonly codexFullAccessMode: string = "full-access";
  public static readonly codexFullAccessModeName: string = "Full Access";
  public static readonly codexFullAccessModeDescription: string = "Edits files outside the workspace and uses the internet without asking.";
  public static readonly acpModeCategory: string = "mode";
  public static readonly acpSessionSetMode: string = "session/set_mode";
  public static readonly acpModesField: string = "modes";
  public static readonly acpCurrentModeField: string = "currentModeId";
  public static readonly acpAvailableModesField: string = "availableModes";
  public static readonly copilotAgentMode: string = "https://agentclientprotocol.com/protocol/session-modes#agent";
  public static readonly copilotAgentModeName: string = "Agent";
  public static readonly copilotAgentModeDescription: string = "Works on the task, and asks before tools, paths and URLs not yet allowed.";
  public static readonly copilotPlanMode: string = "https://agentclientprotocol.com/protocol/session-modes#plan";
  public static readonly copilotPlanModeName: string = "Plan";
  public static readonly copilotPlanModeDescription: string = "Plans the work for your review, and changes nothing until then.";
  public static readonly copilotAutopilotMode: string = "https://agentclientprotocol.com/protocol/session-modes#autopilot";
  public static readonly copilotAutopilotModeName: string = "Autopilot";
  public static readonly copilotAutopilotModeDescription: string = "Turns Allow All on and works until the task is done without asking (experimental).";
  public static readonly copilotAllowAllMode: string = "allow_all";
  public static readonly copilotAllowAllModeName: string = "Allow All";
  public static readonly copilotAllowAllModeDescription: string = "Uses every tool, path and URL without asking.";
  public static readonly copilotAllowAllOption: string = "allow_all";
  public static readonly copilotAllowAllOn: string = "on";
  public static readonly copilotAllowAllOff: string = "off";
  public static readonly antigravityDefaultMode: string = "default";
  public static readonly antigravityDefaultModeName: string = "Default";
  public static readonly antigravityDefaultModeDescription: string = "Asks before file edits and commands.";
  public static readonly antigravityAutoEditMode: string = "auto_edit";
  public static readonly antigravityAutoEditModeName: string = "Auto Edit";
  public static readonly antigravityAutoEditModeDescription: string = "Makes file edits in the workspace without asking, and asks before commands.";
  public static readonly antigravityYoloMode: string = "yolo";
  public static readonly antigravityYoloModeName: string = "YOLO";
  public static readonly antigravityYoloModeDescription: string = "Runs every tool without asking.";
  public static readonly grokDefaultMode: string = "default";
  public static readonly grokDefaultModeName: string = "Default";
  public static readonly grokDefaultModeDescription: string = "Works on the task, and asks as its permission settings say.";
  public static readonly grokPlanMode: string = "plan";
  public static readonly grokPlanModeName: string = "Plan";
  public static readonly grokPlanModeDescription: string = "Reads and plans for your approval, and changes nothing until then.";
  public static readonly grokAskMode: string = "ask";
  public static readonly grokAskModeName: string = "Ask";
  public static readonly grokAskModeDescription: string = "Reads and answers, and changes nothing.";
  public static readonly grokAlwaysApproveMode: string = "bypassPermissions";
  public static readonly grokAlwaysApproveModeName: string = "Always-approve";
  public static readonly grokAlwaysApproveModeDescription: string = "Approves tool calls without asking; deny rules, hooks and some shell ask rules still apply.";
  public static readonly opencodeBuildMode: string = "build";
  public static readonly opencodeBuildModeName: string = "Build";
  public static readonly opencodeBuildModeDescription: string = "Works on the task, and asks before it edits files, runs commands or reaches the web.";
  public static readonly opencodePlanMode: string = "plan";
  public static readonly opencodePlanModeName: string = "Plan";
  public static readonly opencodePlanModeDescription: string = "Reads and plans, and edits no file; commands and the web still ask first.";
  public static readonly opencodeAllowAllMode: string = "allowAll";
  public static readonly opencodeAllowAllModeName: string = "Allow All";
  public static readonly opencodeAllowAllModeDescription: string =
    "Allows everything without asking: edits, commands, the web, TeamRun's tools and files outside the folder, over any rule set elsewhere, even an organization's.";
  public static readonly cursorKindId: string = "cursor";
  public static readonly cursorDisplayName: string = "Cursor";
  public static readonly cursorExecutableName: string = "cursor-agent";
  public static readonly cursorWindowsLauncherName: string = "cursor-agent.cmd";
  public static readonly cursorWindowsScriptExtension: string = ".cmd";
  public static readonly cursorWindowsNodeName: string = "node.exe";
  public static readonly cursorScriptName: string = "index.js";
  public static readonly cursorVersionsDirectoryName: string = "versions";
  public static readonly cursorVersionPattern: RegExp = /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:-(\d{2})-(\d{2})-(\d{2}))?-[a-f0-9]+$/;
  public static readonly cursorVersion: string = "2026.10.22-27dcf5f";
  public static readonly cursorDownloadBase: string = "https://downloads.cursor.com/lab/2026.10.22-27dcf5f/";
  public static readonly cursorArchiveName: string = "agent-cli-package.tar.gz";
  public static readonly cursorWindowsArchiveName: string = "agent-cli-package.zip";
  public static readonly cursorPackageDirectoryName: string = "dist-package";
  public static readonly cursorNodeName: string = "node";
  public static readonly cursorReleases: readonly { readonly target: string; readonly path: string; readonly sha256: string; readonly archiveBytes: number;
    readonly nodeBytes: number; readonly scriptBytes: number }[] = [
    { target: "darwin-arm64", path: "darwin/arm64/", sha256: "2f5b0a3dd5fb951cecffac813867d8a08d810e59837d59fd5f12d69b922398d7", archiveBytes: 180_412_627, nodeBytes: 147_346_352, scriptBytes: 8_087_090 },
    { target: "darwin-x64", path: "darwin/x64/", sha256: "7a3cfbf0fcfb979b6213feb5f9fd10fbc7cd4e51ab28c3b572bb935e0b114961", archiveBytes: 188_039_979, nodeBytes: 150_084_144, scriptBytes: 8_080_090 },
    { target: "linux-x64", path: "linux/x64/", sha256: "85296944e4600a83c4b764f578d1502bf9c416db200d33a593e8f3ecabfdc294", archiveBytes: 184_859_176, nodeBytes: 126_879_696, scriptBytes: 7_520_482 },
    { target: "linux-arm64", path: "linux/arm64/", sha256: "22a36df9720830668ccd4d707e5190204ab9c8a0efb2f068cc914895f804d3ec", archiveBytes: 182_799_294, nodeBytes: 123_377_224, scriptBytes: 7_520_490 },
    { target: "win32-x64", path: "windows/x64/", sha256: "864a8f6a22f8c5ebedef8e0ceba529eae9a59b3d7f6fccb75e43e0f5efc3c147", archiveBytes: 80_207_693, nodeBytes: 93_915_464, scriptBytes: 7_695_101 },
    { target: "win32-arm64", path: "windows/arm64/", sha256: "91028414a667646437dafb5e0c579db39b71f1a42d0ed057688cb530570db014", archiveBytes: 77_626_713, nodeBytes: 82_150_728, scriptBytes: 7_702_096 }
  ];
  public static readonly cursorUnpackedName: string = "unpacked";
  public static readonly cursorPreviousName: string = "previous";
  public static readonly cursorNoBuild: string = "Cursor has no build for this computer.";
  public static readonly cursorNoExtractor: string = "Installing Cursor needs tar, which this computer does not have.";
  public static readonly cursorArchiveUnsafe: string = "The Cursor download has an entry TeamRun can't read, a link, or a path outside its folder. Nothing was installed.";
  public static readonly cursorWindowsInstallDirectoryName: string = "cursor-agent";
  public static readonly cursorArguments: readonly string[] = ["--disable-project-configs", "acp"];
  public static readonly cursorModelArgument: string = "--model";
  public static readonly cursorAuthMethod: string = "cursor_login";
  public static readonly cursorSignInCommand: string = "cursor-agent login";
  public static readonly cursorToolTitle: string = "Cursor tool";
  public static readonly cursorRefusalLead: string = "\n\n";
  public static readonly cursorSignInRefusal: string = "Please sign in to continue";
  public static readonly cursorRefusals: readonly string[] = [Resources.cursorSignInRefusal, "Upgrade your plan to continue", "Add a payment method to continue",
    "Check your settings to continue"];
  public static readonly cursorNotFound: string = "Cursor's CLI was not found. Install it with Cursor's own install command, then refresh.";
  public static readonly cursorSignInUnavailable: string = "Cursor signs in in a terminal: choose Sign in in the provider's menu, which runs cursor-agent login for its profile.";
  public static readonly cursorProfileAbsolute: string = "The dedicated Cursor profile must use an absolute path.";
  public static readonly cursorProfileNotManaged: string = "Cursor requires a dedicated TeamRun profile. Select an empty directory; an existing Cursor setup will not be changed.";
  public static readonly cursorProfileMarkerValue: string = "TeamRun Cursor profile v1\n";
  public static readonly cursorConfigVariable: string = "CURSOR_CONFIG_DIR";
  public static readonly cursorNoBrowserVariable: string = "NO_OPEN_BROWSER";
  public static readonly cursorNoColorVariable: string = "NO_COLOR";
  public static readonly cursorConfigFileName: string = "cli-config.json";
  public static readonly cursorDataVariables: Readonly<Record<string, string>> = { CURSOR_DATA_DIR: "data" };
  public static readonly cursorXdgVariables: Readonly<Record<string, string>> = { XDG_CONFIG_HOME: "home/.config" };
  public static readonly cursorWindowsVariables: Readonly<Record<string, string>> = { APPDATA: "home/AppData/Roaming" };
  public static readonly cursorFolderSeparator: string = "/";
  public static readonly cursorExcludedEnvironment: RegExp = /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)|^(?:CURSOR|ANTHROPIC|OPENAI|OPENROUTER|XAI|GROK|GEMINI|GOOGLE|VERTEX|AWS|AZURE|CODEX|CLAUDE|COPILOT|GITHUB|GH|HF|HUGGINGFACE|OPENCODE|GIT_CONFIG|GIT_ASKPASS|SSH_ASKPASS)(?:_|$)/i;
  public static readonly cursorStaticChannel: string = "static";
  public static readonly cursorAllowlistApproval: string = "allowlist";
  public static readonly cursorPersonFolderName: string = ".cursor";
  public static readonly cursorTitleHomeFolder: string = "title-home";
  public static readonly cursorPermissionsField: string = "permissions";
  public static readonly cursorAllowField: string = "allow";
  public static readonly cursorDenyField: string = "deny";
  public static readonly cursorMcpRuleServer: RegExp = /^\s*Mcp\(\s*([^:)]*)/i;
  public static readonly cursorRuleWildcard: string = "*";
  public static readonly cursorPosixInstallCommand: string = "curl https://cursor.com/install -fsS | bash";
  public static readonly cursorWindowsInstallCommand: string = "irm 'https://cursor.com/install?win32=true' | iex";
  public static readonly cursorSubscribeUrl: string = "https://cursor.com/pricing";
  public static readonly cursorAgentMode: string = "agent";
  public static readonly cursorAgentModeName: string = "Agent";
  public static readonly cursorAgentModeDescription: string = "Works on the task, and asks before it runs a command or uses a tool its allow list doesn't name.";
  public static readonly cursorAskMode: string = "ask";
  public static readonly cursorAskModeName: string = "Ask";
  public static readonly cursorAskModeDescription: string = "Reads and answers, and changes no file.";
  public static readonly cursorPlanMode: string = "plan";
  public static readonly cursorPlanModeName: string = "Plan";
  public static readonly cursorPlanModeDescription: string = "Reads and plans for your approval, and changes no file until then.";
  public static readonly cursorAllowAllMode: string = "allow-all";
  public static readonly cursorAllowAllModeName: string = "Allow all";
  public static readonly cursorAllowAllModeDescription: string = "Works on the task, and TeamRun allows each command and tool it asks for.";
  public static readonly cursorCreatePlanMethods: readonly string[] = ["cursor/create_plan"];
  public static readonly cursorCreatePlanTool: string = "create_plan";
  public static readonly cursorTodosField: string = "todos";
  public static readonly cursorPhasesField: string = "phases";
  public static readonly cursorUpdateToDosMethods: readonly string[] = ["cursor/update_todos"];
  public static readonly cursorMergeField: string = "merge";
  public static readonly cursorAcceptedOutcome: string = "accepted";
  public static readonly cursorRejectedOutcome: string = "rejected";
  public static readonly cursorAskQuestionMethods: readonly string[] = ["cursor/ask_question"];
  public static readonly cursorGenerateImageMethods: readonly string[] = ["cursor/generate_image"];
  public static readonly cursorFilePathField: string = "filePath";
  public static readonly posixTemporaryDirectory: string = "/tmp";
  public static readonly cursorAskQuestionTool: string = "ask_question";
  public static readonly cursorOutcomeField: string = "outcome";
  public static readonly cursorAllowMultipleField: string = "allowMultiple";
  public static readonly cursorQuestionIdField: string = "questionId";
  public static readonly cursorSelectedOptionsField: string = "selectedOptionIds";
  public static readonly cursorAnsweredOutcome: string = "answered";
  public static readonly cursorAboutArgument: string = "about";
  public static readonly cursorAboutLinePattern: RegExp = /^(.+?)\s{2,}(\S.*)$/;
  public static readonly cursorAboutVersionLabel: string = "CLI Version";
  public static readonly cursorAboutPlanLabel: string = "Subscription Tier";
  public static readonly cursorAboutEmailLabel: string = "User Email";
  public static readonly cursorMacPlatform: string = "darwin";
  public static readonly cursorOneAccountPerMac: string =
    "Cursor keeps its sign-in in this Mac's keychain, which every Cursor profile shares, so TeamRun takes one Cursor provider per Mac.";
  public static readonly fxKindId: string = "fx";
  public static readonly fxDisplayName: string = "fx";
  public static readonly fxExecutableName: string = "fx";
  public static readonly fxWindowsExecutableName: string = "fx.exe";
  public static readonly fxArguments: readonly string[] = ["acp"];
  public static readonly fxStatusArguments: readonly string[] = ["status", "--json"];
  public static readonly fxAccounts: readonly string[] = ["vercel", "codex", "grok"];
  public static readonly fxAuthField: string = "auth";
  public static readonly fxAuthMissing: string = "missing";
  public static readonly fxSignInCommand: string = "fx login";
  public static readonly fxToolTitle: string = "fx tool";
  public static readonly fxNotFound: string = "fx was not found. Install it with fx's own install command, then refresh.";
  public static readonly fxWindowsNotFound: string = "fx has no Windows build yet. Put fx.exe on the PATH, then refresh.";
  public static readonly fxSignInUnavailable: string = "fx signs in in a terminal: choose Sign in in the provider's menu, which runs fx login for your own fx.";
  public static readonly fxSignedOut: string = "fx isn't signed in. Choose Sign in in the provider's menu to run fx login, which signs in your own fx.";
  public static readonly fxHomeVariable: string = "FX_HOME";
  public static readonly fxFolderName: string = ".fx";
  public static readonly fxProfileEntries: readonly string[] = ["settings.json", "auth.json"];
  public static readonly fxInstallDirectoryVariable: string = "FX_INSTALL_DIR";
  public static readonly fxNoColorVariable: string = "NO_COLOR";
  public static readonly fxExcludedEnvironment: RegExp =
    /(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)|^(?:FX|VERCEL|AI_GATEWAY|ANTHROPIC|OPENAI|OPENROUTER|XAI|GROK|GEMINI|GOOGLE|AWS|AZURE|CODEX|CLAUDE|COPILOT|GITHUB|GH|CURSOR|OPENCODE|GIT_CONFIG|GIT_ASKPASS|SSH_ASKPASS)(?:_|$)/i;
  public static readonly fxInstallCommand: string = "curl -fsSL https://fx.sh/setup.sh | bash";
  public static readonly fxSubscribeUrl: string = "https://fx.sh";
  public static readonly fxSignedOutCode: number = -32600;
  public static readonly fxModelOption: string = "model";
  public static readonly fxSpeedOption: string = "fast";
  public static readonly fxStandardSpeedValue: string = "false";
  public static readonly fxFastSpeedValue: string = "true";
  public static readonly fxStandardSpeed: string = "standard";
  public static readonly fxStandardSpeedName: string = "Standard";
  public static readonly fxFastSpeed: string = "fast";
  public static readonly fxFastSpeedName: string = "Fast";
  public static readonly fxCacheReadTokensField: string = "cacheReadTokens";
  public static readonly fxCacheWriteTokensField: string = "cacheWriteTokens";
  public static readonly fxReasoningTokensField: string = "reasoningTokens";
  public static readonly fxAutoMode: string = "auto";
  public static readonly fxAutoModeName: string = "Auto";
  public static readonly fxAutoModeDescription: string = "Works on the task, and an automatic safety review checks each action instead of asking you.";
  public static readonly fxAskMode: string = "ask";
  public static readonly fxAskModeName: string = "Ask";
  public static readonly fxAskModeDescription: string = "Asks before it changes a file or runs a command.";
  public static readonly fxFullAccessMode: string = "full-access";
  public static readonly fxFullAccessModeName: string = "Full access";
  public static readonly fxFullAccessModeDescription: string = "Runs every action without asking, outside fx's sandbox.";
  public static readonly fxOneAccountPerComputer: string =
    "fx in TeamRun uses your own fx, with its sign-in, settings, sessions and MCP servers in .fx in your home folder, so TeamRun takes one fx provider per computer.";
  public static readonly textInputType = "text";
  public static readonly completedTurnStatus: string = "completed";
  public static readonly interruptedTurnStatus: string = "interrupted";
  public static readonly agentMessageItemType: string = "agentMessage";
  public static readonly reasoningItemType: string = "reasoning";
  public static readonly userMessageItemType: string = "userMessage";
  public static readonly planItemType: string = "plan";
  public static readonly commandExecutionItemType: string = "commandExecution";
  public static readonly fileChangeItemType: string = "fileChange";
  public static readonly mcpToolCallItemType: string = "mcpToolCall";
  public static readonly dynamicToolCallItemType: string = "dynamicToolCall";
  public static readonly webSearchItemType: string = "webSearch";
  public static readonly contextCompactionItemType: string = "contextCompaction";
  public static readonly enteredReviewModeItemType: string = "enteredReviewMode";
  public static readonly exitedReviewModeItemType: string = "exitedReviewMode";
  public static readonly reviewField: string = "review";
  public static readonly functionCallOutputItemType: string = "functionCallOutput";
  public static readonly codexErrorInfoField: string = "codexErrorInfo";
  public static readonly codexContextWindowExceeded: string = "contextWindowExceeded";
  public static readonly codexUsageLimitExceeded: string = "usageLimitExceeded";
  public static readonly imageGenerationItemType: string = "imageGeneration";
  public static readonly collabAgentToolCallItemType: string = "collabAgentToolCall";
  public static readonly subAgentActivityItemType: string = "subAgentActivity";
  public static readonly imageViewItemType: string = "imageView";
  public static readonly sleepItemType: string = "sleep";
  public static readonly hookPromptItemType: string = "hookPrompt";
  public static readonly codexFollowUpItemTypes: readonly string[] = [Resources.commandExecutionItemType, Resources.fileChangeItemType,
    Resources.mcpToolCallItemType, Resources.dynamicToolCallItemType, Resources.collabAgentToolCallItemType, Resources.imageViewItemType,
    Resources.sleepItemType, Resources.functionCallOutputItemType, Resources.userMessageItemType, Resources.hookPromptItemType];
  public static readonly codexToolItemTypes: readonly string[] = [Resources.commandExecutionItemType, Resources.fileChangeItemType, Resources.mcpToolCallItemType,
    Resources.dynamicToolCallItemType, Resources.webSearchItemType, Resources.imageGenerationItemType, Resources.collabAgentToolCallItemType];
  public static readonly threadStartedNotification: string = "thread/started";
  public static readonly codexSpawnAgentTool: string = "spawnAgent";
  public static readonly codexFollowedAgentTools: readonly string[] = ["sendInput", "followupTask", "resumeAgent"];
  public static readonly agentThreadIdField: string = "agentThreadId";
  public static readonly agentPathField: string = "agentPath";
  public static readonly agentPathSeparator: string = "/";
  public static readonly codexStartedActivity: string = "started";
  public static readonly codexInteractedActivity: string = "interacted";
  public static readonly codexInterruptedActivity: string = "interrupted";
  public static readonly promptField: string = "prompt";
  public static readonly receiverThreadIdsField: string = "receiverThreadIds";
  public static readonly agentsStatesField: string = "agentsStates";
  public static readonly parentThreadIdField: string = "parentThreadId";
  public static readonly agentRoleField: string = "agentRole";
  public static readonly agentNicknameField: string = "agentNickname";
  public static readonly durationMsField: string = "durationMs";
  public static readonly codexSubAgentDescription: string = "Sub-agent";
  public static readonly codexAgentStatuses: ReadonlyMap<string, SubAgentStatus> = new Map([["completed", SubAgentStatus.Completed],
    ["errored", SubAgentStatus.Failed], ["notFound", SubAgentStatus.Failed], ["interrupted", SubAgentStatus.Stopped], ["shutdown", SubAgentStatus.Stopped]]);
  public static readonly subAgentTaskStatuses: Readonly<Record<SubAgentStatus, BackgroundTaskStatus>> = {
    [SubAgentStatus.Running]: BackgroundTaskStatus.Running,
    [SubAgentStatus.Completed]: BackgroundTaskStatus.Completed,
    [SubAgentStatus.Failed]: BackgroundTaskStatus.Failed,
    [SubAgentStatus.Stopped]: BackgroundTaskStatus.Stopped
  };
  public static readonly acceptDecision: string = "accept";
  public static readonly acceptForSessionDecision: string = "acceptForSession";
  public static readonly declineDecision: string = "decline";
  public static readonly allowLabel: string = "Allow";
  public static readonly allowForSessionLabel: string = "Allow for this session";
  public static readonly denyLabel: string = "Deny";
  public static readonly cancelDecision: string = "cancel";
  public static readonly codexChildRequestAnswers: ReadonlyMap<string, { readonly cancel: JsonValue; readonly decline: JsonValue; readonly note: string }> = new Map([
    [Resources.commandApprovalRequest, { cancel: { decision: Resources.cancelDecision }, decline: { decision: Resources.declineDecision },
      note: "TeamRun declined its command without asking, since the reply had ended." }],
    [Resources.fileChangeApprovalRequest, { cancel: { decision: Resources.cancelDecision }, decline: { decision: Resources.declineDecision },
      note: "TeamRun declined its file change without asking, since the reply had ended." }],
    [Resources.userInputRequest, { cancel: { [Resources.answersField]: {} }, decline: { [Resources.answersField]: {} },
      note: "TeamRun skipped its question without asking, since the reply had ended." }],
    [Resources.mcpElicitationRequest, { cancel: { [Resources.acpActionField]: Resources.acpCancelAction },
      decline: { [Resources.acpActionField]: Resources.acpDeclineAction },
      note: "TeamRun declined its MCP tool call without asking, since the reply had ended." }]
  ]);
  public static readonly unsupportedServerRequestCode: number = -32601;
  public static readonly serverRequestFailedCode: number = -32000;

  public static readonly claudeAllowDecision: string = "allow";
  public static readonly claudeDenyDecision: string = "deny";
  public static readonly claudeCommandTools: readonly string[] = ["Bash", "PowerShell"];
  public static readonly claudePowerShellTool: string = "PowerShell";
  public static readonly claudeEditToolPattern: RegExp = /Edit|Write/;
  public static readonly claudeMcpToolPattern: string = "mcp__*";
  public static readonly claudeMcpToolKind: string = "mcp";
  public static readonly claudeMcpNameSeparator: string = "__";
  public static readonly claudeOwnServersNotSet: string = "Claude couldn't set this chat's MCP servers. Its reason isn't shown, since your own servers' settings can hold tokens.";
  public static readonly claudeOtherMcpToolDenied: string = "TeamRun lets Claude use only TeamRun's own MCP tools and the shared servers turned on for it.";
  public static readonly claudeWakeToolsRefused: string = "TeamRun's tools are unavailable in this reply: TeamRun refused the chat's token for them, because it expired or the "
    + "teammate was added again. The next message resumes the chat on a new one.";
  public static readonly claudeChatEndedForTools: string = "Claude's open chat ended, and any background tasks with it, because TeamRun refused its token for "
    + "TeamRun's tools: it expired or the teammate was added again. This turn resumes the chat on a new one.";
  public static readonly claudeChatEndedForToolsChange: string = "Claude's open chat ended, and its background tasks with it, because the tools TeamRun serves "
    + "changed, such as when computer use turned on. This turn resumes the chat on a new one.";
  public static readonly terminalRunTool: string = "terminal_run";
  public static readonly terminalWriteTool: string = "terminal_write";
  public static readonly terminalStepTools: readonly string[] = [Resources.terminalRunTool, Resources.terminalWriteTool];
  public static readonly terminalIdKey: string = "terminal_id";
  public static readonly terminalCommandKey: string = "command";
  public static readonly terminalKeysKey: string = "keys";
  public static readonly terminalTitleKey: string = "title";
  public static readonly terminalStatusKey: string = "status";
  public static readonly terminalExitCodeKey: string = "exit_code";
  public static readonly terminalOutputKey: string = "output";
  public static readonly killedTerminalStatus: string = "Killed";
  public static readonly runningTerminalStatuses: readonly string[] = ["Running", "AwaitingInput"];
  public static readonly terminalStillRunning: string = "(still running in the terminal)";
  public static readonly unnamedTerminal: string = "a terminal";
  public static readonly structuredContentField: string = "structuredContent";
  public static readonly argumentsField: string = "arguments";
  public static readonly claudeStdioServerType: "stdio" = "stdio";
  public static readonly claudeHttpServerType: "http" = "http";
  public static readonly authorizationHeader: string = "Authorization";
  public static readonly claudeToolTimeout: number = 420_000;
  public static readonly claudeInputCommandKey: string = "command";
  public static readonly claudeInputDescriptionKey: string = "description";
  public static readonly claudeInputPathKeys: readonly string[] = ["file_path", "path", "notebook_path"];
  public static readonly claudeApiKeySourceNone: string = "none";
  public static readonly claudeFailedStatus: string = "failed";
  public static readonly claudeNeedsAuthStatus: string = "needs-auth";
  public static readonly claudePendingStatus: string = "pending";
  public static readonly claudeServerSettleInterval: number = 500;
  public static readonly claudeServerSettleTimeout: number = 10_000;
  public static readonly claudeTokenSourceNone: string = "none";
  public static readonly claudeFirstPartyProvider: string = "firstParty";

  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly dataEvent: string = "data";
  public static readonly errorEvent: string = "error";
  public static readonly closeEvent: string = "close";
  public static readonly exitEvent: string = "exit";
  public static readonly endEvent: string = "end";
  public static readonly abortEvent: string = "abort";
  public static readonly pathVariable: string = "PATH";
  public static readonly parentDirectory: string = "..";
  public static readonly codexCredentialVariables: readonly string[] = [Resources.openAiApiKeyVariable, Resources.codexApiKeyVariable];
  public static readonly defaultProfileKey: string = "default";
  public static readonly modelReasoningEffortSetting: string = "model_reasoning_effort";
  public static readonly mcpServersSetting: string = "mcp_servers";
  public static readonly enabledSetting: string = "enabled";
  public static readonly codexToolTimeoutSetting: string = "tool_timeout_sec";
  public static readonly codexEnvironmentVariablesSetting: string = "env_vars";
  public static readonly codexHttpHeaderVariablesSetting: string = "env_http_headers";
  public static readonly codexBearerVariableSetting: string = "bearer_token_env_var";
  public static readonly codexHttpHeadersSetting: string = "http_headers";
  public static readonly codexToolTimeoutSeconds: number = 420;
  public static readonly codexToolsSetting: string = "tools";
  public static readonly codexToolApprovalSetting: string = "approval_mode";
  public static readonly codexToolsApprovalMode: string = "approve";
  public static readonly configField: string = "config";
  public static readonly tokenUsageUpdatedNotification: string = "thread/tokenUsage/updated";
  public static readonly codexChildNotifications: readonly string[] = [Resources.turnStartedNotification, Resources.itemStartedNotification,
    Resources.itemCompletedNotification, Resources.tokenUsageUpdatedNotification, Resources.turnCompletedNotification];
  public static readonly rateLimitsUpdatedNotification: string = "account/rateLimits/updated";
  public static readonly rateLimitsReadMethod: string = "account/rateLimits/read";
  public static readonly tokenUsageField: string = "tokenUsage";
  public static readonly totalField: string = "total";
  public static readonly lastField: string = "last";
  public static readonly inputTokensField: string = "inputTokens";
  public static readonly outputTokensField: string = "outputTokens";
  public static readonly totalTokensField: string = "totalTokens";
  public static readonly cachedInputTokensField: string = "cachedInputTokens";
  public static readonly cacheWriteInputTokensField: string = "cacheWriteInputTokens";
  public static readonly reasoningOutputTokensField: string = "reasoningOutputTokens";
  public static readonly modelContextWindowField: string = "modelContextWindow";
  public static readonly rateLimitsField: string = "rateLimits";
  public static readonly limitIdField: string = "limitId";
  public static readonly codexLimitId: string = "codex";
  public static readonly primaryField: string = "primary";
  public static readonly secondaryField: string = "secondary";
  public static readonly creditsField: string = "credits";
  public static readonly hasCreditsField: string = "hasCredits";
  public static readonly unlimitedField: string = "unlimited";
  public static readonly balanceField: string = "balance";
  public static readonly windowDurationMinsField: string = "windowDurationMins";
  public static readonly usedPercentField: string = "usedPercent";
  public static readonly resetsAtField: string = "resetsAt";
  public static readonly codexFiveHourMinutes: number = 300;
  public static readonly codexWeeklyMinutes: number = 10080;
  public static readonly millisecondsPerSecond: number = 1000;
  public static readonly percentScale: number = 100;
  public static readonly claudeModelUsageField: string = "modelUsage";
  public static readonly claudeCacheReadInputTokensField: string = "cacheReadInputTokens";
  public static readonly claudeCacheCreationInputTokensField: string = "cacheCreationInputTokens";
  public static readonly claudeTotalCostField: string = "total_cost_usd";
  public static readonly claudeTotalTokensField: string = "totalTokens";
  public static readonly claudeMaxTokensField: string = "maxTokens";
  public static readonly claudeContextWindowField: string = "contextWindow";
  public static readonly claudeAutoCompactEnabledField: string = "isAutoCompactEnabled";
  public static readonly claudeAutoCompactThresholdField: string = "autoCompactThreshold";
  public static readonly claudeRateLimitsAvailableField: string = "rate_limits_available";
  public static readonly rateLimitsSnakeField: string = "rate_limits";
  public static readonly claudeFiveHourWindow: string = "five_hour";
  public static readonly claudeSevenDayWindow: string = "seven_day";
  public static readonly claudeSevenDayOpusWindow: string = "seven_day_opus";
  public static readonly claudeSevenDaySonnetWindow: string = "seven_day_sonnet";
  public static readonly claudeUtilizationField: string = "utilization";
  public static readonly claudeResetsAtField: string = "resets_at";
  public static readonly claudeAutoCompactWindowMinimum: number = 100_000;
  public static readonly claudeAutoCompactWindowMaximum: number = 1_000_000;
  public static readonly claudeContextWindowPresets: readonly number[] = [200_000, 400_000, 1_000_000];
  public static readonly claudeContextDetail: "summary" = "summary";
  public static readonly claudeUsageTimeout: number = 10000;
  public static readonly planUsageTimedOut: string = "The provider did not report its plan usage in time.";
  public static readonly usageField: string = "usage";
  public static readonly claudeCacheCreationField: string = "cache_creation";
  public static readonly claudeHourCacheWritesField: string = "ephemeral_1h_input_tokens";
  public static readonly contextField: string = "context";
  public static readonly acpUsedField: string = "used";
  public static readonly acpSizeField: string = "size";
  public static readonly acpCostField: string = "cost";
  public static readonly acpAmountField: string = "amount";
  public static readonly acpCurrencyField: string = "currency";
  public static readonly acpUsdCurrency: string = "USD";
  public static readonly acpCachedReadTokensField: string = "cachedReadTokens";
  public static readonly acpCachedWriteTokensField: string = "cachedWriteTokens";
  public static readonly acpThoughtTokensField: string = "thoughtTokens";
  public static readonly xaiCostTicksField: string = "costUsdTicks";
  public static readonly xaiCachedReadTokensField: string = "cachedReadTokens";
  public static readonly xaiCacheCreationTokensField: string = "cacheCreationTokens";
  public static readonly xaiReasoningTokensField: string = "reasoningTokens";
  public static readonly xaiTicksPerUsd: number = 1e10;
  public static readonly xaiContextUsedField: string = "used";
  public static readonly xaiContextTotalField: string = "total";
  public static readonly xaiAutoCompactPercentField: string = "autoCompactThresholdPercent";
  public static readonly xaiCurrentPeriodField: string = "currentPeriod";
  public static readonly xaiPeriodEndField: string = "end";
  public static readonly xaiCreditUsagePercentField: string = "creditUsagePercent";
  public static readonly xaiWeeklyPeriod: string = "USAGE_PERIOD_TYPE_WEEKLY";
  public static readonly xaiMonthlyPeriod: string = "USAGE_PERIOD_TYPE_MONTHLY";
  public static readonly xaiSessionInfoMethods: readonly string[] = ["_x.ai/session/info", "x.ai/session/info"];
  public static readonly xaiModelListMethods: readonly string[] = ["_x.ai/models/list", "x.ai/models/list"];
  public static readonly xaiSessionForkMethods: readonly string[] = ["_x.ai/session/fork", "x.ai/session/fork"];
  public static readonly xaiSourceSessionIdField: string = "sourceSessionId";
  public static readonly xaiSourceCwdField: string = "sourceCwd";
  public static readonly xaiNewCwdField: string = "newCwd";
  public static readonly xaiTargetPromptIndexField: string = "targetPromptIndex";
  public static readonly xaiNewSessionIdField: string = "newSessionId";
  public static readonly xaiBillingMethods: readonly string[] = ["_x.ai/billing", "x.ai/billing"];
  public static readonly xaiInterjectMethods: readonly string[] = ["_x.ai/interject", "x.ai/interject"];
  public static readonly xaiAuthInfoMethods: readonly string[] = ["_x.ai/auth/info", "x.ai/auth/info"];
  public static readonly xaiMcpListMethods: readonly string[] = ["_x.ai/mcp/list", "x.ai/mcp/list"];
  public static readonly serversField: string = "servers";
  public static readonly xaiMethodIdField: string = "methodId";
  public static readonly xaiOrganizationNameField: string = "organizationName";
  public static readonly xaiTeamNameField: string = "teamName";
  public static readonly xaiSubscriptionTierField: string = "subscription_tier";
  public static readonly copilotSnapshotsField: string = "snapshots";
  public static readonly copilotPremiumInteractionsField: string = "premium_interactions";
  public static readonly copilotChatField: string = "chat";
  public static readonly copilotCompletionsField: string = "completions";
  public static readonly copilotEntitlementField: string = "entitlementRequests";
  public static readonly copilotUsedRequestsField: string = "usedRequests";
  public static readonly copilotUnlimitedField: string = "isUnlimitedEntitlement";
  public static readonly copilotRemainingPercentageField: string = "remainingPercentage";
  public static readonly copilotResetDateField: string = "resetDateEpochMs";
  public static readonly copilotProviderQuotasField: string = "providerQuotas";
  public static readonly copilotTokenBillingField: string = "isTbbUser";
  public static readonly copilotAcquisitionStatusField: string = "acquisitionStatus";
  public static readonly copilotSucceededStatus: string = "succeeded";
  public static readonly copilotAccessStateField: string = "accessState";
  public static readonly copilotDeniedState: string = "denied";
  public static readonly copilotCapacityStateField: string = "capacityState";
  public static readonly copilotExhaustedState: string = "exhausted";
  public static readonly copilotUnlimitedState: string = "unlimited";
  public static readonly copilotHasQuotaField: string = "hasQuota";
  public static readonly copilotNoQuotaStates: readonly string[] = ["not_required", "not_applicable", "unlimited"];
  public static readonly copilotQuantityKindField: string = "quantityKind";
  public static readonly copilotAuthoritativeBudget: string = "authoritative_budget";
  public static readonly copilotEntitledQuantityField: string = "entitledQuantity";
  public static readonly copilotCompatibilityKeyField: string = "compatibilityKey";
  public static readonly copilotUnitField: string = "unit";
  public static readonly copilotAiCreditsUnit: string = "ai_credits";
  public static readonly copilotBudgetMetadataField: string = "budgetMetadata";
  public static readonly copilotBudgetEntitlementField: string = "entitlement";
  public static readonly copilotConsumedField: string = "consumed";
  public static readonly copilotResetAtField: string = "resetAtEpochMs";
  public static readonly copilotUnlimitedQuantity: number = -1;
  public static readonly pendingSessionId: string = "pending";
  public static readonly unknownCommand: string = "(unknown command)";
  public static readonly errorPath: string = "$.error";
  public static readonly paramsPath: string = "$.params";
  public static readonly resultPath: string = "$.result";
  public static readonly signInStatusPath: string = "$.status";
  public static readonly toolInputPath: string = "$.input";
  public static readonly claudeStructuredContentPath: string = "$.tool_use_result.structuredContent";

  public static readonly systemMessageType: "system" = "system";
  public static readonly assistantMessageType: "assistant" = "assistant";
  public static readonly userMessageType: "user" = "user";
  public static readonly resultMessageType: "result" = "result";
  public static readonly rateLimitEventType: "rate_limit_event" = "rate_limit_event";
  public static readonly rejectedRateLimitStatus: string = "rejected";
  public static readonly allowedRateLimitStatuses: readonly string[] = ["allowed", "allowed_warning"];
  public static readonly rateLimitAssistantError: string = "rate_limit";
  public static readonly initSubtype: "init" = "init";
  public static readonly thinkingTokensSubtype: "thinking_tokens" = "thinking_tokens";
  public static readonly compactBoundarySubtype: "compact_boundary" = "compact_boundary";
  public static readonly taskStartedSubtype: "task_started" = "task_started";
  public static readonly taskUpdatedSubtype: "task_updated" = "task_updated";
  public static readonly taskNotificationSubtype: "task_notification" = "task_notification";
  public static readonly taskProgressSubtype: "task_progress" = "task_progress";
  public static readonly backgroundTasksChangedSubtype: "background_tasks_changed" = "background_tasks_changed";
  public static readonly sessionStateChangedSubtype: "session_state_changed" = "session_state_changed";
  public static readonly commandsChangedSubtype: "commands_changed" = "commands_changed";
  public static readonly runningSessionState: string = "running";
  public static readonly idleSessionState: string = "idle";
  public static readonly claudeShellTaskType: string = "local_bash";
  public static readonly claudeOwnedBySubAgentField: "owned_by_subagent" = "owned_by_subagent";
  public static readonly claudeTaskStatuses: Readonly<Record<"completed" | "failed" | "stopped", BackgroundTaskStatus>> = {
    completed: BackgroundTaskStatus.Completed, failed: BackgroundTaskStatus.Failed, stopped: BackgroundTaskStatus.Stopped
  };
  public static readonly claudeSubAgentStatuses: Readonly<Record<"completed" | "failed" | "stopped", SubAgentStatus>> = {
    completed: SubAgentStatus.Completed, failed: SubAgentStatus.Failed, stopped: SubAgentStatus.Stopped
  };
  public static readonly claudeAgentTools: readonly string[] = ["Agent", "Task"];
  public static readonly claudeSubagentTypeField: string = "subagent_type";
  public static readonly claudeRunInBackgroundField: string = "run_in_background";
  public static readonly claudeAgentCompletedStatus: string = "completed";
  public static readonly claudeAgentLaunchedStatus: string = "async_launched";
  public static readonly claudeAgentIdField: string = "agentId";
  public static readonly claudeTotalToolUseCountField: string = "totalToolUseCount";
  public static readonly claudeTotalDurationField: string = "totalDurationMs";
  public static readonly claudeSubAgentDescription: string = "Sub-agent";
  public static readonly subAgentField: string = "subAgent";
  public static readonly maximumTaskOutputBytes: number = 65536;
  public static readonly leadingReplacementPattern: RegExp = /^\uFFFD+/u;
  public static readonly claudeTaskOutputPattern: RegExp = /Output is being written to: (.+?\.output)(?=\.?(?:\s|$))/u;
  public static readonly taskOutputFollowInterval: number = 250;
  public static readonly followedTaskOutputFactor: number = 4;
  public static readonly nulCharacter: string = "\0";
  public static readonly utf16HeldEndPattern: RegExp = /(?:\uFFFD\uFFFD?|\uFEFF)[^\0]?$|\0$/u;
  public static readonly utf16LeadingMarkPattern: RegExp = /^(?:\uFFFD\uFFFD|\uFEFF)/u;
  public static readonly utf16TrailingMarkPattern: RegExp = /(?:\uFFFD\uFFFD?|\uFEFF)$/u;
  public static readonly utf16ContextPattern: RegExp = /^[^\0\uFFFD\uFEFF]$/u;
  public static readonly promptTooLongReason: "prompt_too_long" = "prompt_too_long";
  public static readonly successSubtype: "success" = "success";
  public static readonly textBlockType: "text" = "text";
  public static readonly thinkingBlockType: "thinking" = "thinking";
  public static readonly toolUseBlockType: "tool_use" = "tool_use";
  public static readonly streamEventType: "stream_event" = "stream_event";
  public static readonly messageStartEventType: "message_start" = "message_start";
  public static readonly contentBlockDeltaEventType: "content_block_delta" = "content_block_delta";
  public static readonly textDeltaType: "text_delta" = "text_delta";
  public static readonly thinkingDeltaType: "thinking_delta" = "thinking_delta";
  public static readonly streamIdPrefix: string = "stream";
  public static readonly toolResultBlockType: "tool_result" = "tool_result";
  public static readonly allowBehavior: "allow" = "allow";
  public static readonly denyBehavior: "deny" = "deny";
  public static readonly presetSystemPromptType: "preset" = "preset";
  public static readonly claudeCodePreset: "claude_code" = "claude_code";
  public static readonly claudeChatSettingSources: readonly ("user" | "project" | "local")[] = ["user", "project", "local"];
  public static readonly claudeUntrustedSettingSources: readonly ("user" | "project" | "local")[] = ["user"];
  public static readonly claudeTrustAcceptedField: string = "hasTrustDialogAccepted";
  public static readonly acceptEditsPermissionMode: PermissionMode = "acceptEdits";
  public static readonly defaultPermissionMode: PermissionMode = "default";
  public static readonly planPermissionMode: PermissionMode = "plan";
  public static readonly autoPermissionMode: PermissionMode = "auto";
  public static readonly bypassPermissionMode: PermissionMode = "bypassPermissions";
  public static readonly claudeAutoModeName: string = "Auto";
  public static readonly claudeAutoModeDescription: string = "A classifier approves or refuses each request.";
  public static readonly claudeManualModeName: string = "Manual";
  public static readonly claudeManualModeDescription: string = "Asks before edits and commands.";
  public static readonly claudeAcceptEditsModeName: string = "Accept edits";
  public static readonly claudeAcceptEditsModeDescription: string = "Makes file edits without asking, and asks before commands.";
  public static readonly claudePlanModeName: string = "Plan";
  public static readonly claudePlanModeDescription: string = "Reads and plans, and changes nothing.";
  public static readonly claudeBypassModeName: string = "Bypass permissions";
  public static readonly claudeBypassModeDescription: string = "Runs every tool without asking.";

  public static readonly executableParameterName: string = "executable";
  public static readonly pathParameterName: string = "path";
  public static readonly kindParameterName: string = "kind";
  public static readonly nameParameterName: string = "name";
  public static readonly titleParameterName: string = "title";
  public static readonly versionParameterName: string = "version";
  public static readonly userAgentParameterName: string = "userAgent";
  public static readonly threadIdParameterName: string = "threadId";
  public static readonly sessionIdParameterName: string = "sessionId";
  public static readonly modelParameterName: string = "model";
  public static readonly timeoutParameterName: string = "timeoutMilliseconds";
  public static readonly delayParameterName: string = "delayMilliseconds";
  public static readonly maximumLengthParameterName: string = "maximumLength";
  public static readonly maximumCountParameterName: string = "maximumCount";
  public static readonly turnIdParameterName: string = "turnId";
  public static readonly versionTimeoutParameterName: string = "versionTimeout";
  public static readonly signInCheckTimeoutParameterName: string = "signInCheckTimeout";
  public static readonly initializeTimeoutParameterName: string = "initializeTimeout";
  public static readonly requestTimeoutParameterName: string = "requestTimeout";
  public static readonly interruptTimeoutParameterName: string = "interruptTimeout";
  public static readonly interruptGraceParameterName: string = "interruptGrace";
  public static readonly stopGraceParameterName: string = "stopGrace";
  public static readonly killWaitParameterName: string = "killWait";
  public static readonly abortGraceParameterName: string = "abortGrace";
  public static readonly streamIntervalParameterName: string = "streamInterval";
  public static readonly resumeRetryDelayParameterName: string = "resumeRetryDelay";
  public static readonly wakeGraceParameterName: string = "wakeGrace";
  public static readonly taskOutputIntervalParameterName: string = "taskOutputInterval";
  public static readonly accountTimeoutParameterName: string = "accountTimeout";
  public static readonly modelListTimeoutParameterName: string = "modelListTimeout";
  public static readonly silenceLimitParameterName: string = "silenceLimit";
  public static readonly idleLimitParameterName: string = "idleLimit";
  public static readonly stopReportWaitParameterName: string = "stopReportWait";

  public static readonly codexNotFound: string = "The Codex CLI was not found. Install it with `npm install -g @openai/codex` and sign in once with `codex login`.";
  public static readonly claudeNotFound: string = "The Claude Code executable was not found. Install Claude Code and sign in once with `claude auth login`.";
  public static readonly appServerAlreadyStarted: string = "The Codex app-server was already started.";
  public static readonly appServerNoRequestHandler: string = "TeamRun has no handler for server requests.";
  public static readonly appServerExitedDuringTurn: string = "The Codex app-server exited during the turn.";
  public static readonly codexUnifiedExecFailure: string = "Failed to create unified exec process:";
  public static readonly codexSandboxSetupFailure: string = "setup refresh had errors";
  public static readonly failedItemStatus: string = "failed";
  public static readonly codexSandboxExitCode: number = -1;
  public static readonly codexSandboxFixedMinor: number = 163;
  public static readonly codexMinorVersionPattern: RegExp = /^(\d+)\.(\d+)\./;
  public static readonly codexSandboxSetupFailed: string = "Codex's Windows sandbox couldn't update its file permissions, so Codex can't run commands. "
    + "Update Codex CLI to 0.163.0 or later, or close the Codex app, then retry.";
  public static readonly codexSandboxSetupFailedOnFixedVersion: string = "Codex's Windows sandbox couldn't update its file permissions, so Codex can't run commands. "
    + "Close the Codex app, then retry.";
  public static readonly codexPackageMismatch: string = "version does not match its executable";
  public static readonly codexUpdatedWhileInUse: string = "Codex CLI was updated while in use, so it can't start. "
    + "Quit TeamRun and every other app using Codex, reinstall Codex CLI, then retry.";
  public static readonly appServerExitedDuringSignIn: string = "The Codex app-server exited during the sign-in.";
  public static readonly codexSignInCancelled: string = "The Codex sign-in was cancelled.";
  public static readonly codexShutDown: string = "Codex was stopped because TeamRun is closing.";
  public static readonly codexSignInNotCompleted: string = "the sign-in did not complete";
  public static readonly codexSignInPageRefused: string = "Codex asked to open a sign-in page that isn't on auth.openai.com over HTTPS, so TeamRun didn't open it.";
  public static readonly codexSignInUnreadable: string = "Codex reported the end of the sign-in in a form TeamRun can't read.";
  public static readonly claudeNoResult: string = "Claude Code ended without a result message.";
  public static readonly claudeAnsweredInOwnTurn: string = "Claude Code answered this message inside a turn of its own, the one it started when a background task ended.";
  public static readonly turnNotSettled: string = "The turn has not ended yet, so it has no result.";
  public static readonly claudeDenied: string = "Denied by the TeamRun user.";
  public static readonly claudeSubAgentUnasked: string =
    "Denied by TeamRun: the reply that started this sub-agent has ended, and no reply in the chat is running to ask the person in.";
  public static readonly claudeQuestionsSkipped: string = "The TeamRun user skipped these questions.";
  public static readonly claudeQuestionsUnanswered: string = "The TeamRun user didn't answer these questions.";
  public static readonly claudeQuestionsUnreadable: string = "TeamRun couldn't show these questions to its user.";
  public static readonly claudeAskUserQuestionTool: string = "AskUserQuestion";
  public static readonly claudeTodoWriteTool: string = "TodoWrite";
  public static readonly claudeTaskCreateTool: string = "TaskCreate";
  public static readonly claudeTaskUpdateTool: string = "TaskUpdate";
  public static readonly claudeTaskListTool: string = "TaskList";
  public static readonly claudeExitPlanModeTool: string = "ExitPlanMode";
  public static readonly claudePlanInputField: string = "plan";
  public static readonly maximumClaudePlans: number = 50;
  public static readonly claudePlanTools: readonly string[] = ["TodoWrite", "TaskCreate", "TaskUpdate", "TaskGet", "TaskList"];
  public static readonly claudeTodosField: string = "todos";
  public static readonly claudeSubjectField: string = "subject";
  public static readonly claudeTaskField: string = "task";
  public static readonly claudeTasksField: string = "tasks";
  public static readonly claudeSuccessField: string = "success";
  public static readonly claudeActiveFormFields: readonly string[] = ["activeForm", "active_form"];
  public static readonly claudeTaskIdFields: readonly string[] = ["taskId", "id", "task_id"];
  public static readonly claudeDeletedTaskStatus: string = "deleted";
  public static readonly claudePlanStatuses: Readonly<Record<string, PlanStepStatus>> = {
    pending: PlanStepStatus.Pending,
    in_progress: PlanStepStatus.InProgress,
    completed: PlanStepStatus.Completed
  };
  public static readonly claudeAnswerSeparator: string = ", ";
  public static readonly commandPrompt: string = "$ ";
  public static readonly runCommandPrefix: string = "Run command: ";
  public static readonly applyFileChanges: string = "Apply file changes";
  public static readonly retryableErrorPrefix: string = "Retryable error: ";
  public static readonly errorPrefix: string = "Error: ";
  public static readonly stderrHeading: string = "[stderr]";
  public static readonly copilotResumeAbility: string = "session/load";
  public static readonly cursorResumeAbility: string = "session/load; session/resume answers -32601";
  public static readonly antigravityResumeAbility: string = "session/resume";
  public static readonly piResumeAbility: string = "--session";
  public static readonly acpAgentResumeAbility: string = "when the agent offers resume or load";
  public static readonly claudeForkAbility: string = "at the next turn";
  public static readonly codexForkAbility: string = "thread/fork";
  public static readonly copilotForkAbility: string = "it offers no fork in the way TeamRun connects to it";
  public static readonly grokForkAbility: string = "x.ai/session/fork";
  public static readonly opencodeForkAbility: string = "its fork copies the whole chat, so a rewind can't keep just the turns before a point";
  public static readonly cursorForkAbility: string = "it offers no fork";
  public static readonly antigravityForkAbility: string = "it can only list and resume chats";
  public static readonly piForkAbility: string = "fork or clone";
  public static readonly fxForkAbility: string = "it doesn't offer this";
  public static readonly acpAgentForkAbility: string = "it can only copy a whole chat, so a rewind can't keep just the turns before a point";
  public static readonly codexCompactAbility: string = "thread/compact/start";
  public static readonly copilotCompactAbility: string = "/compact, listed and sent alone: \"Compacted conversation history\"";
  public static readonly grokCompactAbility: string = "/compact, listed and sent alone";
  public static readonly opencodeCompactAbility: string = "/compact runs summarize";
  public static readonly cursorCompactAbility: string = "it has no compact command; asking for one only makes the model write a summary";
  public static readonly antigravityCompactAbility: string = "it has no compact command; one sent alone just gets an answer, and the context meter keeps rising";
  public static readonly piCompactAbility: string = "compact";
  public static readonly fxCompactAbility: string = "it has no compact command";
  public static readonly fxCommandsAbility: string = "it lists no commands";
  public static readonly acpAgentCompactAbility: string = "when it lists /compact and reports the compaction";
  public static readonly copilotImagesAbility: string = "when offered";
  public static readonly grokImagesAbility: string = "when the model takes images";
  public static readonly opencodeImagesAbility: string = "offered";
  public static readonly claudeFilesAbility: string = "path in the prompt";
  public static readonly opencodeFilesAbility: string = "path and resource link";
  public static readonly opencodeChatTitleAbility: string = "TeamRun doesn't ask it for a title, since a title chat would run in your own setup and start your own servers and plugins";
  public static readonly piChatTitleAbility: string = "a Pi of its own with --no-tools, --no-extensions and --no-session";
  public static readonly museChatTitleAbility: string = "TeamRun doesn't ask it for a title, since its modes are approval levels and none only reads";
  public static readonly acpAgentChatTitleAbility: string = "TeamRun doesn't ask it for a title, since it has no known restricted mode and might start your own servers";
  public static readonly copilotChooseModelAbility: string = "a headless process lists, the launch sets";
  public static readonly grokChooseModelAbility: string = "session/set_model";
  public static readonly opencodeChooseModelAbility: string = "session options";
  public static readonly cursorChooseModelAbility: string = "at launch, though its session also offers a model option";
  public static readonly fxChooseModelAbility: string = "its model option";
  public static readonly acpAgentChooseModelAbility: string = "when its session offers one";
  public static readonly copilotChooseEffortAbility: string = "at launch";
  public static readonly grokChooseEffortAbility: string = "reasoningEffort in the prompt's _meta";
  public static readonly opencodeChooseEffortAbility: string = "each model's variants in opencode models --verbose; a model with none offers no Effort";
  public static readonly cursorChooseEffortAbility: string = "its models each have one fixed setting";
  public static readonly acpChooseEffortAbility: string = "where its options offer one";
  public static readonly antigravityChooseEffortAbility: string = "as model levels";
  public static readonly copilotChooseSpeedAbility: string = "as its own model, claude-opus-4.8-fast, in the model list";
  public static readonly grokChooseSpeedAbility: string = "as its own model, grok-4.7-build-fast, in the model list";
  public static readonly opencodeChooseSpeedAbility: string = "TeamRun doesn't support this for it yet; OpenCode keeps the speed inside each model, which hasn't been checked";
  public static readonly cursorChooseSpeedAbility: string = "its models each have one fixed speed, fast or normal";
  public static readonly antigravityChooseSpeedAbility: string = "it offers three flash models and no speed choice";
  public static readonly piChooseSpeedAbility: string = "it offers no speed choice";
  public static readonly acpAgentChooseSpeedAbility: string = "the standard way TeamRun talks to added agents has no place for this, so TeamRun can't offer it";
  public static readonly copilotChooseContextAbility: string = "TeamRun doesn't support this for it yet; its long-context setting gives about 1M tokens where the model and account offer it";
  public static readonly grokChooseContextAbility: string = "its model fixes the context size";
  public static readonly opencodeChooseContextAbility: string = "TeamRun doesn't support this for it yet; OpenCode keeps the context size inside each model, which hasn't been checked";
  public static readonly cursorChooseContextAbility: string = "each of its models comes with one context size, and it refuses any other";
  public static readonly antigravityChooseContextAbility: string = "its context size is fixed at 1,048,576";
  public static readonly piChooseContextAbility: string = "its model fixes the context size";
  public static readonly grokPlanModeAbility: string = "approval through x.ai/exit_plan_mode";
  public static readonly opencodePlanModeAbility: string = "permission set at launch";
  public static readonly cursorPlanModeAbility: string = "cursor/create_plan";
  public static readonly antigravityPlanModeAbility: string = "its plan command is a request in the message, not a mode: while it plans it still asks to run commands and create files, and it waits for approval only in its reply's text";
  public static readonly piPlanModeAbility: string = "its own guide says it leaves out plan mode";
  public static readonly fxPlanModeAbility: string = "its only modes are Auto, Ask and Full access";
  public static readonly acpAgentPlanModeAbility: string = "the agent protocol marks no mode as one that plans, so TeamRun could only guess which of an agent's modes does";
  public static readonly claudeReadOnlyModeAbility: string = "Plan";
  public static readonly grokReadOnlyModeAbility: string = "Plan, Ask";
  public static readonly opencodeReadOnlyModeAbility: string = "Plan, set at launch";
  public static readonly cursorReadOnlyModeAbility: string = "Ask, Plan";
  public static readonly antigravityReadOnlyModeAbility: string = "none of its modes only reads";
  public static readonly piReadOnlyModeAbility: string = "TeamRun's extension";
  public static readonly fxReadOnlyModeAbility: string = "none of its modes only reads, and Ask runs without asking a change the person's fx rules or an earlier answer allow";
  public static readonly acpAgentReadOnlyModeAbility: string = "the way TeamRun connects to it doesn't say which of its modes only reads";
  public static readonly copilotUnrestrictedModeAbility: string = "Autopilot, Allow All";
  public static readonly grokUnrestrictedModeAbility: string = "bypassPermissions";
  public static readonly cursorUnrestrictedModeAbility: string = "Allow all, where TeamRun allows each of its permission requests itself";
  public static readonly antigravityUnrestrictedModeAbility: string = "YOLO";
  public static readonly fxUnrestrictedModeAbility: string = "Full access";
  public static readonly acpAgentUnrestrictedModeAbility: string = "when it lists one, unmarked";
  public static readonly piPermissionCardsAbility: string = "extension dialogs";
  public static readonly copilotApprovedToolsAbility: string = "--allow-tool";
  public static readonly grokApprovedToolsAbility: string = "use_tool guard";
  public static readonly cursorApprovedToolsAbility: string = "allow list";
  public static readonly antigravityApprovedToolsAbility: string = "Read-only tools only, named in its _meta.mcp";
  public static readonly fxApprovedToolsAbility: string = "it names a tool in a way another server's tool could copy, so it asks";
  public static readonly museApprovedToolsAbility: string = "TeamRun's read-only tools may run without asking, but this hasn't been seen yet";
  public static readonly acpAgentApprovedToolsAbility: string = "Read-only tools only, for an agent that names them in _meta[\"gemini-cli\"].mcp as Gemini CLI does";
  public static readonly piApprovedToolsAbility: string = "TeamRun answers its extension's question for them";
  public static readonly copilotQuestionsAbility: string = "it gives its model no question tool; asked to use one, it says it has none";
  public static readonly grokQuestionsAbility: string = "x.ai/ask_user_question";
  public static readonly opencodeQuestionsAbility: string = "the way TeamRun connects to it passes on no questions";
  public static readonly cursorQuestionsAbility: string = "it has no question tool here; asked to use one, it says it has none";
  public static readonly antigravityQuestionsAbility: string = "it asks through a permission request whose options are its answers, which TeamRun reads as its question";
  public static readonly piQuestionsAbility: string = "its extensions' dialogs; Pi itself asks in its reply's text";
  public static readonly fxQuestionsAbility: string = "its question tool works only in its own terminal window, and elsewhere tells its model to ask in its reply's text";
  public static readonly acpAgentQuestionsAbility: string = "when the agent uses elicitation";
  public static readonly copilotPlanChecklistAbility: string = "from its session.db; over ACP its plan update comes empty";
  public static readonly opencodePlanChecklistAbility: string = "it sends no plan steps in the way TeamRun connects to it";
  public static readonly cursorPlanChecklistAbility: string = "the to-do list it sends as it works, and the to-dos of a plan it asks to approve";
  public static readonly antigravityPlanChecklistAbility: string = "it writes its plan's steps as plain text";
  public static readonly piPlanChecklistAbility: string = "it writes its checklist as plain text";
  public static readonly fxPlanChecklistAbility: string = "it has no to-do tool and sends no plan steps";
  public static readonly acpAgentPlanChecklistAbility: string = "when it sends plan updates";
  public static readonly copilotReplyUsageAbility: string = "the prompt answer's usage";
  public static readonly opencodeReplyUsageAbility: string = "usage_update";
  public static readonly cursorReplyUsageAbility: string = "it reports no usage and no tokens for a reply";
  public static readonly antigravityReplyUsageAbility: string = "it sends only its context meter, with no tokens for a reply";
  public static readonly fxReplyUsageAbility: string = "the prompt answer's usage";
  public static readonly acpAgentReplyUsageAbility: string = "the prompt answer's usage, where the agent sends it";
  public static readonly museReplyUsageAbility: string = "version 1.4.14 reports its context and its cost when known, but no tokens for a reply";
  public static readonly copilotPlanLimitsAbility: string = "headless session.quota.get";
  public static readonly grokPlanLimitsAbility: string = "x.ai/billing";
  public static readonly opencodePlanLimitsAbility: string = "it has no plan of its own, only model limits and token prices";
  public static readonly cursorPlanLimitsAbility: string = "it offers no plan-limit meters";
  public static readonly antigravityPlanLimitsAbility: string = "it offers no plan-limit meters";
  public static readonly piPlanLimitsAbility: string = "it offers no plan-limit meters";
  public static readonly opencodeSubAgentRowsAbility: string = "it sends nothing to make rows from, since a sub-agent's task is a plain tool call";
  public static readonly cursorSubAgentRowsAbility: string = "TeamRun doesn't support this for it yet; TeamRun doesn't read the sub-agent details Cursor sends";
  public static readonly antigravitySubAgentRowsAbility: string = "from its sub-agent tool call, while the sub-agent's steps come in with the main chat's";
  public static readonly piSubAgentRowsAbility: string = "its own guide says it leaves out sub-agents";
  public static readonly copilotBackgroundSubAgentsAbility: string = "it holds its turn open until they end, and their results come back in that turn";
  public static readonly opencodeBackgroundSubAgentsAbility: string = "version 1.19.5 has them only behind an experimental setting, and the turn it then starts by itself comes with no start or end, so TeamRun could only guess when that reply ends";
  public static readonly cursorBackgroundSubAgentsAbility: string = "TeamRun doesn't support this for it yet; Cursor may report a sub-agent's end after its turn, and when it does is unchecked";
  public static readonly antigravityBackgroundSubAgentsAbility: string = "asked for a background sub-agent, it waited for it and reported in the same turn";
  public static readonly piBackgroundSubAgentsAbility: string = "it has no sub-agents";
  public static readonly acpAgentBackgroundSubAgentsAbility: string = "the agent protocol has no turn an agent starts and no sub-agents, so TeamRun could only guess from a late update that a result came and start a turn for it";
  public static readonly codexStopSubAgentAbility: string = "nothing ends what a sub-agent runs in its sandbox; the reply's Stop interrupts it";
  public static readonly copilotStopSubAgentAbility: string = "it offers no way to stop one; its task list works only in its own terminal";
  public static readonly grokStopSubAgentAbility: string = "x.ai/subagent/cancel";
  public static readonly opencodeStopSubAgentAbility: string = "TeamRun gets no sub-agent rows from it";
  public static readonly cursorStopSubAgentAbility: string = "it offers no way to stop one; the reply's Stop ends the whole turn";
  public static readonly copilotBackgroundCommandsAbility: string = "it holds its turn open until a background command ends";
  public static readonly opencodeBackgroundCommandsAbility: string = "its shell tool has no background mode";
  public static readonly cursorBackgroundCommandsAbility: string = "it ends its turn and names nothing to follow or stop";
  public static readonly antigravityBackgroundCommandsAbility: string = "it holds its turn open until a background command ends";
  public static readonly piBackgroundCommandsAbility: string = "it has no background commands";
  public static readonly fxBackgroundCommandsAbility: string = "it offers no way to stop one";
  public static readonly acpAgentBackgroundCommandsAbility: string = "for a command it runs in TeamRun's terminal that outlives its tool call or turn";
  public static readonly claudeExplorerAbility: string = "Plan mode";
  public static readonly codexExplorerAbility: string = "a command a rule allows runs outside its sandbox, so an explorer could change files";
  public static readonly copilotExplorerAbility: string = "TeamRun doesn't support this for it yet; Copilot has a read-only mode, but TeamRun names none for it";
  public static readonly grokExplorerAbility: string = "TeamRun doesn't support this for it yet; Grok has a read-only mode, but TeamRun names none for it";
  public static readonly opencodeExplorerAbility: string = "TeamRun doesn't support this for it yet; it has a read-only mode, but TeamRun names none for it";
  public static readonly antigravityExplorerAbility: string = "it has no read-only mode";
  public static readonly piExplorerAbility: string = "its read-only mode, where it only reads and searches files";
  public static readonly fxExplorerAbility: string = "TeamRun doesn't support this for it yet; TeamRun names no read-only mode for fx";
  public static readonly acpAgentExplorerAbility: string = "TeamRun doesn't support this for it yet; TeamRun knows no read-only mode for an added agent";
  public static readonly claudeGeneratedImagesAbility: string = "its replies carry only text, thinking and tool calls; asked for an image, it wrote an SVG drawing as text";
  public static readonly piGeneratedImagesAbility: string = "its replies carry only text, thinking and tool calls; asked for an image, it drew one into a file with a shell command";
  public static readonly copilotGeneratedImagesAbility: string = "it has no image tool, and says so when asked";
  public static readonly grokGeneratedImagesAbility: string = "saving fails on Windows";
  public static readonly opencodeGeneratedImagesAbility: string = "TeamRun can show an image in its reply, but hasn't seen it send one yet";
  public static readonly cursorGeneratedImagesAbility: string = "the image file its cursor/generate_image notification names, in the chat's folder or the temp folder";
  public static readonly antigravityGeneratedImagesAbility: string = "an image block in its generate_image call's result";
  public static readonly fxGeneratedImagesAbility: string = "its replies carry only text, thinking and tool calls, and it has no image tool";
  public static readonly acpAgentGeneratedImagesAbility: string = "image blocks in its message";
  public static readonly grokTeamRunToolsAbility: string = "the person's requirements.toml can block it";
  public static readonly antigravityTeamRunToolsAbility: string = "HTTP offered";
  public static readonly piTeamRunToolsAbility: string =
    "TeamRun's extension adds them over HTTP, unless Pi's MCP is off or another extension replaces it, or the person has their own server named teamrun";
  public static readonly piTeamRunToolsUnlisted: string =
    "Pi never connected to TeamRun's tools. Its built-in MCP may be off, another extension such as pi-mcp-adapter may replace it, or its mcp.json may have a server named teamrun of its own, which wins.";
  public static readonly fxTeamRunToolsAbility: string = "when it offers HTTP";
  public static readonly copilotSharedStdioServersAbility: string = "it refuses each one";
  public static readonly antigravitySharedStdioServersAbility: string = "it keeps their values in its own chat database";
  public static readonly piSharedServersAbility: string =
    "TeamRun's extension adds them, with values from Pi's environment, unless Pi's MCP is off or another extension replaces it";
  public static readonly fxSharedStdioServersAbility: string = "TeamRun doesn't support this for it yet; these servers stay off until they're checked with a signed-in fx";
  public static readonly acpAgentSharedStdioServersAbility: string = "TeamRun doesn't support this for it yet; these servers stay off until they're checked with that agent";
  public static readonly codexOwnServersSwitchAbility: string = "with the apps connected to the account";
  public static readonly copilotOwnServersSwitchAbility: string = "in chat turns, by leaving out its --disable-mcp-server arguments";
  public static readonly grokOwnServersSwitchAbility: string = "it runs the servers its own settings turn on, so TeamRun leaves them to Grok";
  public static readonly opencodeOwnServersSwitchAbility: string = "rules in OPENCODE_PERMISSION at each launch";
  public static readonly opencodeNoOwnServersListAbility: string = "it offers no list of them";
  public static readonly cursorOwnServersSwitchAbility: string = "it always reads your own servers' file and can't be told to skip it";
  public static readonly antigravityOwnServersSwitchAbility: string = "TeamRun doesn't support this for it yet; TeamRun keeps them off until Antigravity is shown to read a profile's servers";
  public static readonly piOwnServersSwitchAbility: string = "they run as you set them up in Pi, and TeamRun can't switch them";
  public static readonly fxOwnServersSwitchAbility: string = "TeamRun doesn't support this for it yet; TeamRun keeps them off";
  public static readonly copilotOwnServersListAbility: string = "its files";
  public static readonly grokOwnServersListAbility: string = "x.ai/mcp/list";
  public static readonly cursorOwnServersListAbility: string = "your ~/.cursor/mcp.json; a project's .cursor/mcp.json isn't listed";
  public static readonly piOwnServersListAbility: string = "the mcp.json in its agent folder; a trusted project's .pi/mcp.json isn't listed";
  public static readonly museOwnServersListAbility: string = "its settings.json";
  public static readonly acpAgentOwnServersListAbility: string = "the agent protocol has no way to ask an agent for its own servers, and an added agent names no file it keeps them in";
  public static readonly antigravityOwnServersListAbility: string = "it offers no list of them";
  public static readonly claudeSignInAbility: string = "terminal";
  public static readonly codexSignInAbility: string = "in the app";
  public static readonly grokSignInAbility: string = "in the app, ACP authenticate";
  public static readonly piSignInAbility: string = "terminal, then /login";
  public static readonly acpAgentSignInAbility: string = "its ACP auth method, or a terminal";
  public static readonly copilotSignOutAbility: string = "its /logout";
  public static readonly grokSignOutAbility: string = "x.ai/auth/logout";
  public static readonly opencodeSignOutAbility: string = "opencode auth logout";
  public static readonly piSignOutAbility: string = "its /logout";
  public static readonly fxSignOutAbility: string = "fx logout, for its Vercel, Codex and Grok accounts";
  public static readonly acpAgentSignOutAbility: string = "when it offers logout";
  public static readonly copilotSeveralAccountsAbility: string = "a profile each";
  public static readonly cursorSeveralAccountsAbility: string = "a profile each; one per Mac on macOS";
  public static readonly acpListedCommandsAbility: string = "sent alone when it lists them; any other is answered with its list";
  public static readonly acpCommandsItListsAbility: string = "those it lists";
  public static readonly acpCommandsUncheckedAbility: string = "TeamRun sends the ones it lists, but which those are hasn't been checked yet";
  public static readonly antigravityBuiltInCommandsAbility: string = "/plan; its /logout is TeamRun's sign-out";
  public static readonly antigravityCustomCommandsAbility: string = "it lists none of the person's own commands";
  public static readonly museCommandsAbility: string = "TeamRun sends the ones it lists, but hasn't seen which it lists yet";
  public static readonly codexListedCommandsAbility: string = "it runs its commands only in its terminal app, and its app-server takes a message as a prompt";
  public static readonly codexBuiltInCommandsAbility: string = "/review, /fork, /rename and /archive; its other commands run only in its terminal app";
  public static readonly codexCustomCommandsAbility: string = "it runs custom prompts only in its terminal app";
  public static readonly piBuiltInCommandsAbility: string = "it runs its built-in commands only in its terminal app";
  public static readonly codexCommandNames: readonly string[] = ["model", "presets", "daybreak", "ide", "permissions", "keymap", "vim", "setup-default-sandbox", "experimental",
    "approve", "memories", "skills", "import", "hooks", "new", "delete", "resume", "worktree", "app", "init", "compact", "config", "recap",
    "plan", "voice", "goal", "agents", "side", "btw", "copy", "export", "raw", "tui", "diff", "mention", "status", "daemon", "warnings", "cd", "pwd", "cwd", "usage",
    "debug-config", "title", "statusline", "theme", "pets", "mcp", "apps", "plugins", "logout", "quit", "exit", "feedback", "rollout", "ps", "stop", "clean", "clear",
    "test-approval", "subagents"];
  public static readonly codexPromptCommandPrefix: string = "prompts:";
  public static readonly codexReviewCommand: string = "review";
  public static readonly codexForkCommand: string = "fork";
  public static readonly codexRenameCommand: string = "rename";
  public static readonly codexArchiveCommand: string = "archive";
  public static readonly codexAppServerCommandNames: readonly string[] = [Resources.codexReviewCommand, Resources.codexForkCommand, Resources.codexRenameCommand,
    Resources.codexArchiveCommand];
  public static readonly codexRenameNeedsName: string = "Codex can't run /rename without a name: write it after the command, such as /rename Parser fixes.";
  public static readonly codexForked: string = "Codex forked this chat's session; the chat goes on in the fork, and the earlier session stays in Codex's history.";
  public static readonly codexArchived: string = "Codex archived this chat's session; the chat's next message here takes it out of the archive.";
  public static readonly piBuiltInCommandNames: readonly string[] = ["settings", "model", "thinking", "scoped-models", "login", "logout", "llama", "new", "resume", "name",
    "session", "tree", "fork", "clone", "compact", "import", "copy", "export", "share", "bug", "trust", "mcp", "reload", "hotkeys", "changelog", "quit"];
  public static readonly claudeCommandNames: readonly string[] = ["add-dir", "advisor", "agents", "artifact-capabilities", "artifact-diagramming", "artifacts", "auto-mode-setup",
    "autocompact", "autofix-pr", "background", "batch", "branch", "btw", "bug", "cd", "chrome", "claude-api", "claude-in-chrome", "clear", "code-review", "color", "compact",
    "config", "context", "copy", "cost", "dataviz", "debug", "deep-research", "design", "design-login", "design-sync", "desktop", "diff", "doctor", "effort", "exit", "export",
    "fast", "feedback", "fewer-permission-prompts", "focus", "fork", "goal", "heapdump", "help", "hooks", "ide", "import", "init", "insights", "install-github-app",
    "install-slack-app", "keybindings", "list-agents", "login", "logout", "loop", "mcp", "memory", "mobile", "model", "output-style", "passes", "permissions", "plan", "plugin",
    "plugin-authoring", "powerup", "pr-comments", "privacy-settings", "radio", "rate-limit-options", "recap", "release-notes", "reload-plugins", "reload-skills",
    "remote-control", "remote-env", "rename", "restart", "resume", "review", "rewind", "run", "run-skill-generator", "sandbox", "schedule", "scroll-speed", "security-review",
    "setup-bedrock", "setup-vertex", "simplify", "skill-doctor", "skills", "slides", "stats", "status", "statusline", "stickers", "stop", "subtask", "tasks", "team-onboarding",
    "teleport", "terminal-setup", "theme", "tui", "ultraplan", "ultrareview", "update-config", "upgrade", "usage", "usage-credits", "verify", "vim", "voice", "web-setup",
    "workflow-authoring", "workflows"];
  public static readonly fxSeveralAccountsAbility: string = "it keeps everything in one folder and can't be pointed at another, so TeamRun takes one fx per computer";
  public static readonly fxChooseSpeedAbility: string = "Standard or Fast, from its session's Fast Mode option, set before each turn; its Ultra mode isn't offered, since fx's listing doesn't say which models support it";
  public static readonly fxChooseContextAbility: string = "it offers no context size";
  public static readonly fxOwnServersListAbility: string = "your ~/.fx/mcp.json; a project's .mcp.json isn't listed, even once approved";
  public static readonly fxAccountAbility: string = "it doesn't report the signed-in account";
  public static readonly acpAgentSeveralAccountsAbility: string = "an added agent names no folder it keeps its sign-in in, so TeamRun can't give each account its own";
  public static readonly grokAccountAbility: string = "x.ai/auth/info";
  public static readonly opencodeAccountAbility: string = "TeamRun doesn't support this for it yet; whether it reports the signed-in account hasn't been checked";
  public static readonly cursorAccountAbility: string = "cursor-agent about";
  public static readonly piAccountAbility: string = "it doesn't report the account; its sign-in check names only the provider and the kind of sign-in";
  public static readonly museAccountAbility: string = "it names the signed-in account only on a status card in its own window";
  public static readonly antigravityAccountAbility: string = "it doesn't report the account; only its sign-in file names it, and TeamRun doesn't read sign-in files";
  public static readonly opencodeInstallAbility: string = "moves it to a terminal";
  public static readonly piInstallAbility: string = "moves it to a terminal; you update it with pi update";
  public static readonly fxInstallAbility: string = "moves it to a terminal on macOS and Linux, since fx has no Windows build; you update it with fx upgrade";
  public static readonly acpAgentInstallAbility: string = "from the registry";
  public static readonly museRunTurnAbility: string = "TeamRun reaches it, but hasn't seen it answer a turn yet";
  public static readonly museResumeAbility: string = "TeamRun can ask it to resume a chat, but hasn't seen one resumed yet";
  public static readonly museForkAbility: string = "it offers no fork";
  public static readonly museCompactAbility: string = "TeamRun sends it the compact command, but hasn't seen how it answers yet";
  public static readonly musePlanModeAbility: string = "its own guide lists plan mode as missing";
  public static readonly museReadOnlyModeAbility: string = "its own guide lists read-only mode as missing";
  public static readonly museImagesAbility: string = "TeamRun can send it images, but hasn't seen it take one yet";
  public static readonly museFilesAbility: string = "TeamRun can send it files, but hasn't seen it take one yet";
  public static readonly museChooseSpeedAbility: string = "it offers a model, an effort and a mode, but no speed choice";
  public static readonly museChooseContextAbility: string = "version 1.4.14 offers a model, a mode and a thinking level, but no context size";
  public static readonly musePermissionCardsAbility: string = "TeamRun can show its approval requests, but hasn't seen one yet";
  public static readonly museQuestionsAbility: string = "TeamRun can show its questions, but hasn't seen one yet";
  public static readonly musePlanChecklistAbility: string = "TeamRun can show its plan steps, but hasn't seen it send any yet";
  public static readonly musePlanLimitsAbility: string = "it offers no plan usage";
  public static readonly museSubAgentRowsAbility: string = "it offers no sub-agents";
  public static readonly museBackgroundCommandsAbility: string = "it offers no background commands";
  public static readonly museGeneratedImagesAbility: string = "TeamRun can show an image in its reply, but hasn't seen it send one yet";
  public static readonly museTeamRunToolsAbility: string = "TeamRun offers it its tools, but hasn't seen it use them yet";
  public static readonly museSharedServersAbility: string = "TeamRun gives it the shared servers when a chat starts, but hasn't seen it use them yet";
  public static readonly museSignInAbility: string = "the provider's Sign in runs muse login in a terminal, but this hasn't been checked with Muse Code yet";
  public static readonly museSignOutAbility: string = "TeamRun runs muse logout in a terminal, which hasn't been seen signing it out yet";
  public static readonly museInstallAbility: string = "you install it with its own command in a terminal; TeamRun doesn't run it for you yet";
  public static readonly museSeveralAccountsAbility: string = "it keeps an account in each profile, though on macOS only one provider per Mac; two signed-in profiles haven't been seen yet";
  public static readonly acpSteerTurnAbility: string = "it takes no message during a running turn in the way TeamRun connects to it, so the message waits for the turn's end";
  public static readonly fxSteerTurnAbility: string = "a message sent during a running turn should reach it, and one with an image waits for the turn's end; this hasn't been seen yet";
  public static readonly claudeSteerTurnAbility: string = "it answers a message added to its running query in a turn of its own that TeamRun doesn't show, so the message waits for the turn's end";

  public static formatClaudeSubAgentUnasked(toolName: string): string {
    return `Asked to use ${toolName} after its reply ended, with no reply running in the chat to ask in, so TeamRun denied it.`;
  }

  public static formatAcpModelOptions(kind: string, options: string): string {
    return `${kind}: the session's model options: ${options}`;
  }

  public static readonly geminiCliUntrustedFolder: string =
    "Gemini CLI connects no MCP server in a folder it doesn't trust. To trust this chat's folder, run gemini in it and choose Trust folder, then send again.";
  public static readonly geminiCliToolsUnlisted: string =
    "Gemini CLI didn't list TeamRun's tools to this turn. Its settings can leave TeamRun's server out or turn MCP servers off, and TeamRun's endpoint may have failed.";

  public static formatTeamRunToolsUnlisted(kind: string, missing: string, blocked: string | null = null): string {
    const line = `${kind}: the prompt went without TeamRun's tools: ${missing}`;
    return Object.isNull(blocked) ? line : `${line}; the agent's log says it blocked TeamRun's server: ${blocked}`;
  }

  public static formatTeamRunToolsTimedOut(name: string, milliseconds: number): string {
    return `${name} didn't list them within ${milliseconds / 1000} s of starting its session.`;
  }

  public static formatTeamRunToolsFailed(name: string, reason: string): string {
    return `Listing them to ${name} failed: ${reason}`;
  }

  public static formatTeamRunToolsAgentEnded(name: string): string {
    return `${name} ended before it listed them.`;
  }

  public static formatShellEnvironmentSetting(name: string): string {
    return `shell_environment_policy.set.${name}`;
  }

  public static formatCodexSignInFailed(error: string): string {
    return `Codex couldn't sign in: ${error.replace(/\.+$/u, String.empty)}.`;
  }

  public static formatAppServerError(method: string, message: string, code: number): string {
    return `${method}: ${message} (code ${code})`;
  }

  public static formatAppServerNotRunning(method: string): string {
    return `The Codex app-server is not running (${method}).`;
  }

  public static formatAppServerTimedOut(method: string): string {
    return `The Codex app-server did not answer ${method} within the timeout.`;
  }

  public static formatAppServerExited(code: number | null, signal: string | null, stderr: string): string {
    const suffix = String.isNullOrWhitespace(stderr) ? String.empty : `: ${stderr}`;
    return `The Codex app-server exited (code ${String(code)}, signal ${String(signal)})${suffix}`;
  }

  public static formatTurnStatus(status: string): string {
    return `The turn ended with status "${status}".`;
  }

  public static formatUnsupportedServerRequest(method: string): string {
    return `TeamRun does not handle the server request ${method}.`;
  }

  public static formatUnknownEffort(effort: string, kind: string): string {
    return `The effort "${effort}" is not one ${kind} accepts.`;
  }

  public static formatHomeInstructions(kind: string, content: string): string {
    return `The ${kind} instruction files TeamRun loaded for this session, the person's own from their home, then the project's, since ${kind} reads none of them itself:\n\n${content}`;
  }

  public static formatPersonInstructions(content: string): string {
    return `Instruction files loaded by TeamRun as Claude Code reads them (the project's settings, MCP servers, plugins, and hooks stay off):\n\n${content}`;
  }

  public static formatInstructionFile(path: string, content: string): string {
    return `Contents of ${path}:\n\n${content}`;
  }

  public static formatInstructionsLeftOut(paths: readonly string[]): string {
    return `Left out to keep the instructions under ${Resources.maximumInstructionsTotalLength} characters: ${paths.join(", ")}.`;
  }

  public static formatClaudeOwnServerNotSet(name: string): string {
    return `Claude couldn't set the MCP server ${name}. Its reason isn't logged, since your own servers' settings can hold tokens.`;
  }

  public static formatClaudeOwnServersUnread(error: string): string {
    return `Claude's own MCP servers weren't read, so this chat starts without them: ${error}`;
  }

  public static formatClaudeProjectServersUnread(error: string): string {
    return `The project's .mcp.json servers weren't read, so the sender token waits only for the servers Claude lists: ${error}`;
  }

  public static formatClaudeTrustUnread(error: string): string {
    return `Claude's folder trust wasn't read, so this chat starts with only the person's user settings: ${error}`;
  }

  public static formatClaudeServerNotSet(name: string, error: string): string {
    return `Claude couldn't set the MCP server ${name}: ${error}`;
  }

  public static formatClaudeServerPendingAtTurnEnd(name: string): string {
    return `Claude hadn't finished connecting the shared MCP server ${name} when the turn ended, so TeamRun stopped reading its state.`;
  }

  public static formatBlockedServersUnnoted(kind: string, reason: string): string {
    return `${kind}: TeamRun couldn't note the shared MCP servers the agent blocked: ${reason}`;
  }

  public static readonly turnStepStart: string = "the turn's start";
  public static readonly turnStepPrompt: string = "the prompt's answer";
  public static readonly turnStepAnswer: string = "the answer's reading";
  public static readonly turnStepHandled: string = "the agent's messages already received";
  public static readonly turnStepBlockedServers: string = "the note of blocked servers";
  public static readonly turnStepFinish: string = "the turn's finish";
  public static readonly turnStepCompaction: string = "the compaction note";
  public static readonly turnStepSteers: string = "the turn's steers";
  public static readonly turnStepRelease: string = "the agent's release";

  public static formatTurnStopStuck(kind: string, step: string, subAgents: string): string {
    return `${kind}: a stopped turn still waits on ${step}; its sub-agents at the stop: ${subAgents.length === 0 ? "none" : subAgents}`;
  }

  public static formatSubAgentState(toolCallId: string, status: SubAgentStatus, background: boolean, kept: boolean): string {
    return `${toolCallId} ${status}${background ? " in the background" : ""}${kept ? ", kept" : ""}`;
  }

  public static formatClaudeServerSettleFailed(reason: string): string {
    return `TeamRun stopped reading Claude's shared MCP server states: ${reason}`;
  }

  public static formatClaudeServerStatusUnread(reason: string): string {
    return `Claude didn't say how its MCP servers stand: ${reason}`;
  }

  public static formatClaudeServerStillPending(name: string, milliseconds: number): string {
    return `Claude was still connecting the shared MCP server ${name} after ${milliseconds / 1000} s, so TeamRun didn't wait for it.`;
  }

  public static formatClaudeWakeTokenRefused(sessionId: string | null): string {
    return `TeamRun's tools are unavailable to Claude's wake on session ${sessionId}: the endpoint refused the chat's kept token, so the next turn opens a new chat.`;
  }

  public static formatClaudeTaskEndUnrecorded(taskId: string, reason: string): string {
    return `TeamRun couldn't record the end of Claude's task ${taskId} as its chat closed: ${reason}`;
  }

  public static formatClaudeChatCloseFailed(sessionId: string | null, reason: string): string {
    return `Claude's chat on session ${sessionId} closed, but TeamRun couldn't finish ending its turn, wake, sub-agents or tasks: ${reason}`;
  }

  public static formatClaudeCompactionWakeFailed(sessionId: string | null, reason: string): string {
    return `Claude's chat on session ${sessionId} didn't compact while idle, since its wake couldn't start: ${reason}`;
  }

  public static formatCodexTurnAwaitsThread(threadId: string): string {
    return `A Codex turn on thread ${threadId} waits for the turn running on it to end.`;
  }

  public static formatCodexFailedStartStopFailed(kind: string): string {
    return `A Codex app-server whose start failed did not stop: ${kind}.`;
  }

  public static formatProcessEnvironmentPath(processId: number): string {
    return `/proc/${String(processId)}/environ`;
  }

  public static formatCodexOrphansEnded(threadIds: string, processIds: readonly number[]): string {
    return `Ended processes ${processIds.join(", ")}, which Codex's thread/backgroundTerminals/clean on the sub-agent threads ${threadIds} left running outside `
      + "its app-server.";
  }

  public static formatSessionNotCarried(kind: string, sessionId: string, error: string): string {
    return `${kind}'s session ${sessionId} wasn't carried into the other account's profile, so the move hands over to a new session: ${error}`;
  }

  public static formatCodexHeldSenderRefused(threadId: string): string {
    return `The teamrun command from Codex's shell on thread ${threadId} doesn't act as the reply that runs on it: another reply still takes the `
      + "sender token the thread was loaded with.";
  }

  public static formatCodexHeldTokenRefused(threadId: string): string {
    return `TeamRun's tools are unavailable to Codex on thread ${threadId} until its background tasks end: the token the thread was loaded with was refused, `
      + "and Codex keeps it while the tasks hold the thread.";
  }

  public static readonly resumeNotePayload: JsonObject = { [ProtocolResources.sourceField]: ProtocolResources.resumeSource };

  public static formatCursorRefused(refusal: string): string {
    return `Cursor refused the turn: ${refusal}.`;
  }

  public static formatResumeFailed(error: string): string {
    return `The native session could not be resumed, so a fresh one was started: ${error}`;
  }

  public static formatClaudePlanModeKept(error: string): string {
    return `Claude Code couldn't leave its plan mode once the plan was approved: ${error}`;
  }

  public static formatClaudePlanModeNotReturned(sessionId: string | null, error: string): string {
    return `Claude's open chat on session ${sessionId} stayed out of its plan mode when the chat started planning first again, so its next turn tries again: ${error}`;
  }

  public static formatClaudePlanModeStayed(error: string): string {
    return `Claude Code may still be in its plan mode, though this reply doesn't plan first: ${error}`;
  }

  public static formatClaudeWakePlanModeRefused(error: string): string {
    return `TeamRun stopped this reply because Claude Code couldn't return to its plan mode while the chat plans first: ${error}`;
  }

  public static formatClaudePlanModeTimedOut(milliseconds: number): string {
    return `it didn't answer within ${milliseconds / 1000} s.`;
  }

  public static readonly claudeSenderLeftOut: string =
    "Claude Code's own MCP servers hadn't all started within 10 seconds, or their state couldn't be read, so this reply's sender token was kept from them and left out, and the messages it sends with teamrun fail.";

  public static formatClaudeSenderRefused(error: string): string {
    return `Claude Code refused this reply's sender token, so the messages it sends with teamrun fail: ${error}`;
  }

  public static formatCommandStatus(command: string, call: string | null, output: string, exitCode: number | null): string {
    const shown = Object.isNull(call) ? String.empty : `${call}${Resources.lineSeparator}`;
    const suffix = Object.isNull(exitCode) ? String.empty : `${Resources.lineSeparator}(exit ${exitCode})`;
    return `${Resources.commandPrompt}${command}${Resources.lineSeparator}${shown}${output}${suffix}`;
  }

  public static formatInnerCommand(command: string): string {
    const lines = command.split(Resources.lineSeparator);
    return lines.length === 1 ? command : `${lines[0]} ${Resources.ellipsis}`;
  }

  public static formatUnknownItem(type: string): string {
    return `Codex item ${type}`;
  }

  public static formatGeneratedImage(path: string | null): string {
    return `Generated image: ${path ?? Resources.imageNotSaved}`;
  }

  public static formatUnreadImage(provider: string): string {
    return `TeamRun can't show the file ${provider} named: it shows only an image file in the chat's folder or the temp folder, within the image size limit`;
  }

  public static formatFileChanges(verb: string, files: string): string {
    return `${verb} ${files}`;
  }

  public static formatMovedFile(from: string, to: string): string {
    return `${from} to ${to}`;
  }

  public static formatEnvironmentReference(variable: string): string {
    return `\${${variable}}`;
  }

  public static formatBearerReference(variable: string): string {
    return `Bearer \${${variable}}`;
  }


  public static formatSharedMcpVariableWithheld(provider: string, variable: string): string {
    return `TeamRun keeps ${variable} out of ${provider}'s environment.`;
  }

  public static formatSharedMcpVariableWithheldShort(variable: string): string {
    return `${variable} kept from it`;
  }

  public static formatPiOwnVariableWithheld(variable: string): string {
    return `TeamRun keeps ${variable}, a variable of its own Pi extension, from the MCP servers it passes Pi.`;
  }

  public static formatSharedMcpSenderTokenWithheld(provider: string, variable: string): string {
    return `TeamRun keeps ${variable}, TeamRun's own sender token, from the MCP servers it passes ${provider}.`;
  }

  public static formatSavedSecretsStdioOnly(provider: string): string {
    return `TeamRun passes saved secrets to ${provider}'s stdio servers only, until a run shows ${provider} keeps a header's value out of its session files.`;
  }

  public static formatSavedSecretsFromEnvironmentOnly(provider: string): string {
    return `${provider} reads a shared server's values only from its own environment, where TeamRun puts no saved secret.`;
  }

  public static formatSharedMcpUnconfirmed(provider: string): string {
    return `TeamRun passes no shared MCP servers to ${provider} until a run shows ${provider} keeps their values out of its session files.`;
  }

  public static formatToolsNotServed(provider: string): string {
    return `${provider} can't reach TeamRun's tools: TeamRun's tool endpoint isn't serving, and the runtime's log says why. Restart TeamRun to try again.`;
  }

  public static formatAcpToolsNeedHttp(provider: string): string {
    return `${provider} can't reach TeamRun's tools: it takes no HTTP MCP servers, and TeamRun serves its tools only over HTTP. Update ${provider} to a version that does.`;
  }

  public static formatAcpHttpServerUnsupported(provider: string, server: string): string {
    return `${provider} takes no HTTP MCP servers, so TeamRun can't pass it the shared server ${server}.`;
  }

  public static formatBearerValue(token: string): string {
    return `Bearer ${token}`;
  }

  public static formatMcpToolCall(server: string, tool: string): string {
    return `MCP tool ${server}/${tool}`;
  }

  public static formatCodexElicitationUnshown(server: string): string {
    return `The MCP server ${server} asked for something TeamRun can't show yet, so TeamRun cancelled its request.`;
  }

  public static formatCodexQuestionUnread(error: string): string {
    return `Codex asked a question TeamRun couldn't read, so it was answered with no answer: ${error}`;
  }

  public static formatCodexPostedQuestionUnread(error: string): string {
    return `Codex posted a question TeamRun couldn't read, so it isn't shown: ${error}`;
  }

  public static formatCodexNotificationFailed(method: string, error: string): string {
    return `TeamRun failed handling Codex's ${method} notification, so what it carried may not show: ${error}`;
  }

  public static formatTerminalStep(command: string, output: string, exitCode: number | null, isRunning: boolean): string {
    const text = Resources.formatCommandStatus(command, null, output, exitCode);
    return isRunning ? `${text}${Resources.lineSeparator}${Resources.terminalStillRunning}` : text;
  }

  public static formatTerminalStepTitle(tool: string, terminal: string | null): string {
    const name = terminal ?? Resources.unnamedTerminal;
    return tool === Resources.terminalRunTool ? `Run in ${name}` : `Sent keys to ${name}`;
  }

  public static formatToolCall(tool: string): string {
    return `Tool ${tool}`;
  }

  public static formatWebSearch(query: string): string {
    return `Web search: ${query}`;
  }

  public static formatSearchedTitle(pattern: string, paths: readonly string[]): string {
    return paths.length === 0 ? `Searched for ${pattern}` : `Searched for ${pattern} in ${paths.join(Resources.listSeparator)}`;
  }

  public static formatReadTitle(files: readonly string[]): string {
    return `Read ${files.join(Resources.listSeparator)}`;
  }

  public static formatReadStartTitle(file: string): string {
    return `Read the start of ${file}`;
  }

  public static formatReadEndTitle(file: string): string {
    return `Read the end of ${file}`;
  }

  public static formatListedTitle(path: string): string {
    return `Listed ${path}`;
  }

  public static formatListedTreeTitle(path: string): string {
    return `Listed ${path} and its subfolders`;
  }

  public static formatChangedFolderTitle(path: string): string {
    return `Changed to ${path}`;
  }

  public static formatModelRerouted(fromModel: string, toModel: string, reason: string): string {
    return `Codex rerouted the model from ${fromModel} to ${toModel} (${reason}).`;
  }

  public static formatFileChangeApproval(reason: string | null, grantRoot: string | null): string {
    const reasonText = Object.isNull(reason) ? String.empty : `: ${reason}`;
    const rootText = Object.isNull(grantRoot) ? String.empty : ` (grant root ${grantRoot})`;
    return `${Resources.applyFileChanges}${reasonText}${rootText}`;
  }

  public static formatUnexpectedSignInOutput(output: string): string {
    return `Unexpected output from the sign-in check: ${output}`;
  }

  public static formatPlanDetail(done: number, total: number): string {
    return `Plan, ${done} of ${total} done`;
  }

  public static formatCodexCommandNeedsSession(command: string): string {
    return `Codex can't run ${command} yet: this chat has no Codex session until its first reply.`;
  }

  public static formatCodexRenamed(name: string): string {
    return `Codex renamed this chat's session to "${name}".`;
  }

  public static formatCodexReviewStarted(hint: string): string {
    return `Codex reviews ${hint}.`;
  }

  public static formatContextCompacted(kind: string): string {
    return `${kind} compacted its context.`;
  }

  public static formatUsageLimitReached(kind: string): string {
    return `${kind} reached its usage limit.`;
  }

  public static formatContextFull(kind: string): string {
    return `${kind}'s context is full. Send /compact to compact it, then retry.`;
  }

  public static formatClaudeSignOutFailed(output: string | null): string {
    return Object.isNull(output) ? "Claude Code didn't sign out." : `Claude Code didn't sign out: ${output}`;
  }

  public static formatClaudeSignOutTimedOut(milliseconds: number): string {
    return `Claude Code didn't finish signing out within ${milliseconds / 1000} s.`;
  }

  public static formatClaudeModeSwitchTimedOut(mode: string, timeout: number): string {
    return `Claude Code didn't switch to its ${mode} mode within ${timeout} ms.`;
  }

  public static formatClaudeFailure(subtype: string, errors: readonly string[]): string {
    return errors.length === 0 ? subtype : `${subtype}: ${errors.join("; ")}`;
  }

  public static formatToolWithCommand(tool: string, command: string): string {
    return `${tool}: ${command}`;
  }

  public static formatGrokExecuteTitle(command: string): string {
    return `Execute \`${command}\``;
  }

  public static formatOpencodeSubAgentStart(agent: string, description: string | null): string {
    return Object.isNull(description) ? `Start the ${agent} sub-agent` : `Start the ${agent} sub-agent: ${description}`;
  }

  public static formatToolArgumentsFile(tool: string, path: string): string {
    return `${tool}: arguments in ${path}`;
  }

  public static formatRoutedMcpToolRefused(provider: string, tool: string): string {
    return `TeamRun refused ${provider}'s call to ${tool} without asking: it isn't one of TeamRun's tools in this turn.`;
  }

  public static formatToolWithKeys(tool: string, keys: string): string {
    return `${tool} (${keys})`;
  }

  public static formatAcpTimeout(method: string): string {
    return `The ACP agent did not answer ${method} in time.`;
  }

  public static formatAcpLogoutUnsupported(kind: string, version: string | null): string {
    const named = Object.isNull(version) ? `This ${kind} version` : `${kind} ${version}`;
    return `${named} doesn't support signing out: its ACP server doesn't offer ACP's logout.`;
  }

  public static formatSigningOut(kind: string): string {
    return `${kind} is signing out of this connection.`;
  }

  public static formatStoppedForShutdown(kind: string): string {
    return `${kind} was stopped because TeamRun is closing.`;
  }

  public static formatTurnStoppedForSignOut(kind: string): string {
    return `This reply stopped because ${kind} is signing out of this connection.`;
  }

  public static formatAcpSignOutTimedOut(kind: string, milliseconds: number): string {
    return `${kind} didn't finish signing out within ${milliseconds / 1000} s.`;
  }

  public static formatAcpSignOutUnanswered(kind: string, version: string | null, methods: readonly string[]): string {
    const named = Object.isNull(version) ? kind : `${kind} ${version}`;
    return `${named} answers neither sign-out request TeamRun knows, ${methods.join(" or ")}. Update ${kind}, then sign out again.`;
  }

  public static formatGrokSignIn(directory: string): string {
    return `Grok isn't signed in with its home at ${directory}. Sign in, then refresh.`;
  }

  public static formatCopilotSignIn(directory: string | null): string {
    return Object.isNull(directory) ? "GitHub Copilot CLI isn't signed in. Run copilot login in a terminal, then refresh."
      : `GitHub Copilot CLI isn't signed in for the profile at ${directory}. Run copilot login with COPILOT_HOME set to it, then refresh.`;
  }

  public static formatCopilotModelNameInvalid(model: string): string {
    const shown = model.length > Resources.maximumEchoedModelName ? `${model.slice(0, Resources.maximumEchoedModelName)}${Resources.ellipsis}` : model;
    return `"${shown}" isn't a model name Copilot can start with. Use up to 100 letters, digits, dots, underscores, colons, slashes and hyphens, starting with a letter or digit.`;
  }

  public static formatCopilotListingFailed(providerId: string | null, reason: string): string {
    return `Listing GitHub Copilot's models for ${CoreResources.formatLoggedProvider(providerId)} failed: ${reason}. The models came from its ACP server instead.`;
  }

  public static formatCopilotListingsFailed(providerId: string | null, reason: string, acpKind: string): string {
    return `Listing GitHub Copilot's models for ${CoreResources.formatLoggedProvider(providerId)} failed: ${reason}. Listing them over its ACP server failed too: ${acpKind}.`;
  }

  public static formatCopilotListingFailedAndAcpListsNone(providerId: string | null, reason: string): string {
    return `Listing GitHub Copilot's models for ${CoreResources.formatLoggedProvider(providerId)} failed: ${reason}. Its ACP server lists none either.`;
  }

  public static formatCopilotModelsNotListed(reason: string): string {
    return `GitHub Copilot's models could not be listed: ${reason}.`;
  }

  public static formatCopilotListingSessionDeleteFailed(kind: string): string {
    return `Deleting the session GitHub Copilot's model listing opened failed: ${kind}.`;
  }

  public static formatCopilotListingsEmpty(providerId: string | null): string {
    return `Listing GitHub Copilot's models for ${CoreResources.formatLoggedProvider(providerId)} came back empty from its headless server and from its ACP server.`;
  }

  public static formatCopilotListingStopFailed(kind: string): string {
    return `GitHub Copilot's model listing server did not stop: ${kind}.`;
  }

  public static formatOwnMcpConfigUnreadable(file: string): string {
    return `TeamRun couldn't read the MCP servers in ${file}. Fix the file, then open this view again.`;
  }

  public static formatMuseSettingsUnsupported(file: string): string {
    return `TeamRun didn't read the MCP servers in ${file}: Muse Code reads only settings whose schema_version is ${Resources.museSchemaVersion}. Fix the file, then open this view again.`;
  }

  public static formatOwnMcpConfigTooLarge(file: string): string {
    return `TeamRun didn't read the MCP servers in ${file}: it's larger than ${Resources.maximumConfigurationMegabytes} MB. Make it smaller, then open this view again.`;
  }

  public static formatCopilotMcpConfigUnreadable(file: string): string {
    return `GitHub Copilot didn't start: TeamRun couldn't read the MCP servers in ${file}, so it couldn't turn them off. Fix or remove the file, then try again.`;
  }

  public static formatCopilotMcpConfigTooLarge(file: string): string {
    return `GitHub Copilot didn't start: ${file} is larger than ${Resources.maximumConfigurationMegabytes} MB, so TeamRun couldn't read its MCP servers to turn them off. Make it smaller or remove it, then try again.`;
  }

  public static formatCopilotAllowedTools(server: string, tools: readonly string[]): string {
    return `${Resources.copilotAllowToolArgument}=${tools.map(t => `${server}(${t})`).join(",")}`;
  }

  public static formatCopilotTeamRunServerNamed(source: string, file: string): string {
    return `GitHub Copilot didn't start: the ${source} MCP servers in ${file} include one named teamrun, which Copilot could use in place of TeamRun's own. Rename that server, then try again.`;
  }

  public static formatCopilotStopped(reason: string): string {
    return `GitHub Copilot stopped before completing the turn: ${reason}.`;
  }

  public static formatGrokStopped(reason: string): string {
    return `Grok stopped before completing the turn: ${reason}.`;
  }

  public static formatOpencodeMcpConfigUnreadable(file: string): string {
    return `OpenCode didn't start: TeamRun couldn't read the MCP servers in ${file}, so it couldn't turn them off. Fix or remove the file, then try again.`;
  }

  public static formatOpencodeMcpConfigTooLarge(file: string): string {
    return `OpenCode didn't start: ${file} is larger than ${Resources.maximumConfigurationMegabytes} MB, so TeamRun couldn't read its MCP servers to turn them off. Make it smaller or remove it, then try again.`;
  }

  public static formatOpencodeStopped(reason: string): string {
    return `OpenCode stopped before completing the turn: ${reason}.`;
  }

  public static formatOpencodeUnsupported(version: string): string {
    return Number.parseInt(version, 10) >= Resources.opencodeUnsupportedMajor
      ? `OpenCode ${version} isn't supported yet: TeamRun hasn't checked that it keeps the approval rules TeamRun sets. Install OpenCode 1.x with curl -fsSL https://opencode.ai/install | bash, or on Windows with npm i -g opencode-ai@1.`
      : `OpenCode ${version} is too old for TeamRun, which works with OpenCode ${Resources.opencodeMinimumVersion.join(".")} and later 1.x versions. ` +
        "Update it with curl -fsSL https://opencode.ai/install | bash, or on Windows with npm i -g opencode-ai@1.";
  }

  public static opencodeAskRules(server: string, approvedTools: readonly string[], plans: boolean): Readonly<Record<string, string | Readonly<Record<string, string>>>> {
    return Object.fromEntries([...Resources.opencodeReadOnlyRules("ask"), [Resources.opencodeTodoTool, "allow"], ...Resources.opencodeAskedTools.map(t => [t, "ask"]),
      ...plans ? [["edit", "deny"]] : [], [`${server}_*`, "ask"], ...approvedTools.map(t => [`${server}_${t}`, "allow"]),
      [Resources.opencodeTaskTool, Object.fromEntries([["*", "ask"], ...Resources.opencodeSubAgents.map(t => [t, "allow"])])]]);
  }

  public static opencodeSubAgentRules(server: string, approvedTools: readonly string[]): Readonly<Record<string, string | Readonly<Record<string, string>>>> {
    return Object.fromEntries([["*", "deny"], ...Resources.opencodeRefusedRules(server, approvedTools, "deny")]);
  }

  public static opencodeRefuseRules(server: string, approvedTools: readonly string[], ownTools: boolean): Readonly<Record<string, string | Readonly<Record<string, string>>>> {
    return Object.fromEntries([["*", ownTools ? "ask" : "deny"], ...Resources.opencodeRefusedRules(server, approvedTools, "allow")]);
  }

  public static opencodeAllowAllRules(server: string, ownTools: boolean, under: boolean): Readonly<Record<string, string>> {
    const allowed = [Resources.opencodeReadTool, ...Resources.opencodeReadOnlyTools, Resources.opencodeTodoTool, Resources.opencodeTaskTool, ...Resources.opencodeAskedTools, `${server}_*`]
      .map(t => [t, "allow"]);
    return Object.fromEntries(ownTools ? [...allowed, ["*", "allow"]] : [...under ? [["*", "deny"]] : [], ...allowed]);
  }

  private static opencodeRefusedRules(server: string, approvedTools: readonly string[], todo: string): readonly (readonly [string, string | Readonly<Record<string, string>>])[] {
    return [...Resources.opencodeReadOnlyRules("deny"), [Resources.opencodeTodoTool, todo], ...Resources.opencodeAskedTools.map(t => [t, "deny"] as const),
      [`${server}_*`, "deny"], ...approvedTools.map(t => [`${server}_${t}`, "allow"] as const)];
  }

  private static opencodeReadOnlyRules(envFiles: string): readonly (readonly [string, string | Readonly<Record<string, string>>])[] {
    return [[Resources.opencodeReadTool, { "*": "allow", ...Resources.opencodeEnvReadRules(envFiles) }], ...Resources.opencodeReadOnlyTools.map(t => [t, "allow"] as const)];
  }

  private static opencodeEnvReadRules(envFiles: string): Readonly<Record<string, string>> {
    return Object.fromEntries([...Resources.opencodeEnvFilePatterns.map(t => [t, envFiles]), [Resources.opencodeEnvExamplePattern, "allow"]]);
  }

  public static formatCursorSignIn(directory: string, sharedSignIn: boolean = false): string {
    return `Cursor isn't signed in. Choose Sign in in the provider's menu to run cursor-agent login for the TeamRun profile at ${directory}; ` + (sharedSignIn
      ? "on this Mac, Cursor keeps its sign-in in the keychain, shared with your own Cursor CLI, so signing in replaces your Cursor CLI's sign-in."
      : "your own Cursor setup is separate.");
  }

  public static formatCursorStopped(reason: string): string {
    return `Cursor stopped before completing the turn: ${reason}.`;
  }

  public static formatFxNotFx(reason: string): string {
    return `The program named fx on this computer didn't answer fx status as fx does, so it may be another tool with the same name. Put fx first on the PATH, then refresh. It said: ${reason}`;
  }

  public static formatFxStopped(reason: string): string {
    return `fx stopped before completing the turn: ${reason}.`;
  }

  public static formatFxSignOutFailed(account: string, output: string | null): string {
    return Object.isNull(output) ? `fx didn't sign out of ${account}.` : `fx didn't sign out of ${account}: ${output}`;
  }

  public static formatFxSignOutTimedOut(account: string, milliseconds: number): string {
    return `fx didn't finish signing out of ${account} within ${milliseconds / 1000} s.`;
  }

  public static formatCursorSignOutFailed(output: string | null): string {
    return Object.isNull(output) ? "Cursor didn't sign out." : `Cursor didn't sign out: ${output}`;
  }

  public static formatCursorSignOutTimedOut(milliseconds: number): string {
    return `Cursor didn't finish signing out within ${milliseconds / 1000} s.`;
  }

  public static cursorSignInVariables(platform: string): Readonly<Record<string, string>> {
    return { ...Resources.cursorDataVariables, ...platform === Resources.windowsPlatform ? Resources.cursorWindowsVariables
      : platform === Resources.cursorMacPlatform ? {} : Resources.cursorXdgVariables };
  }

  public static cursorTitleHomeVariables(platform: string): readonly string[] {
    return platform === Resources.cursorMacPlatform ? [] : platform === Resources.windowsPlatform ? [Resources.homeVariable, Resources.userProfileVariable]
      : [Resources.homeVariable];
  }

  public static formatCursorConfig(server: string, approvedTools: readonly string[], allow: readonly string[] = [], deny: readonly string[] = []): string {
    return `${JSON.stringify({ version: 1, channel: Resources.cursorStaticChannel, approvalMode: Resources.cursorAllowlistApproval,
      permissions: { allow: [...new Set([...allow, ...approvedTools.map(t => `Mcp(${server}:${t})`)])], deny: [...deny] } }, null, 2)}\n`;
  }

  public static formatCursorConfigUnreadable(file: string): string {
    return `Cursor didn't start: TeamRun couldn't read the permissions in ${file}, so it couldn't keep your allow and deny rules. Fix the file, then try again.`;
  }

  public static formatCursorConfigTooLarge(file: string): string {
    return `Cursor didn't start: ${file} is larger than ${Resources.maximumConfigurationMegabytes} MB, so TeamRun couldn't read your allow and deny rules. ` +
      "Make it smaller, then try again.";
  }

  public static formatForkUnavailable(displayName: string): string {
    return `${displayName} can't fork a session; a rewind goes on in a fresh session that is told what was said before.`;
  }

  public static formatPromptIndexInvalid(turnId: string): string {
    return `The turn "${turnId}" isn't a prompt index, so the session can't be forked through it.`;
  }

  public static formatTaskNotListed(providerName: string): string {
    return `${providerName} no longer lists this task as running, so TeamRun stopped nothing.`;
  }

  public static formatTaskProcessUnknown(providerName: string): string {
    return `${providerName} named no process for this task, so TeamRun can't stop it.`;
  }

  public static formatAcpTerminalUnknown(terminalId: string): string {
    return `TeamRun has no terminal ${terminalId} for this session.`;
  }

  public static formatAcpTerminalOutside(providerName: string, directory: string): string {
    return `TeamRun runs ${providerName}'s commands only inside the chat's folder, not in ${directory}.`;
  }

  public static formatTreeEndRoundFailed(round: number, failure: string): string {
    return `Ending a process tree on Windows stopped at round ${String(round)}, whose script failed (${failure}); the tree may still run.`;
  }

  public static formatTreeLeftListed(processes: readonly (readonly [number, number])[]): string {
    return `Ending a process tree on Windows ran its ${String(Resources.processTreeFreezeRounds)} rounds and still listed ` +
      `${processes.map(([id, start]) => `${String(id)} (started ${new Date(start).toISOString()})`).join(", ")}.`;
  }

  public static formatTaskProcessGone(providerName: string): string {
    return `TeamRun couldn't confirm that this task's process still runs under ${providerName}, so it stopped nothing.`;
  }

  public static formatPowershellSessionInput(script: string, marker: string): string {
    return `${script}${Resources.lineSeparator}'${marker}'${Resources.lineSeparator}`;
  }

  public static formatPowershellSessionTimedOut(milliseconds: number): string {
    return `The PowerShell session took longer than ${String(milliseconds)} ms to answer.`;
  }

  public static formatProcessEndScript(processIds: readonly number[], starts: readonly number[]): string {
    return `$ids = @(${processIds.join(", ")}); $starts = @(${starts.join(", ")}); ` +
      `$deadline = [DateTime]::UtcNow.AddMilliseconds(${Resources.processExitWait}); ` +
      "for ($i = 0; $i -lt $ids.Count; $i++) { try { $p = [System.Diagnostics.Process]::GetProcessById($ids[$i]); $null = $p.Handle; " +
      "if ([Math]::Abs(([DateTimeOffset]$p.StartTime).ToUnixTimeMilliseconds() - $starts[$i]) -le 1) { $p.Kill(); " +
      "$null = $p.WaitForExit([int][Math]::Max(0, ($deadline - [DateTime]::UtcNow).TotalMilliseconds)) } } catch { } }; " +
      Resources.powershellProcessListScript;
  }

  public static formatAntigravityPathUnsupported(path: string, version: string | null): string {
    return `Antigravity's ACP server on PATH, ${path}, is ${version ?? "of an unknown version"}; TeamRun works with 1.3. Install 1.3.0 from TeamRun's providers.`;
  }

  public static formatAntigravityChosenNotFound(path: string): string {
    return `Antigravity's ACP server isn't at ${path}, or localharness_external isn't beside it. Choose another path, or clear it to run TeamRun's own copy.`;
  }

  public static formatAntigravityUnsupported(version: string | null): string {
    return `TeamRun works with Antigravity's ACP server 1.3; this one is ${version ?? "of an unknown version"}. Install 1.3.0 from TeamRun's providers.`;
  }

  public static formatAntigravityIncomplete(directory: string): string {
    return `An incomplete Antigravity installation is in ${directory}. Remove it, then install again.`;
  }

  public static formatAntigravityUnpackFailed(exitCode: number | null): string {
    return Object.isNull(exitCode) ? "Unpacking the Antigravity download was stopped. Nothing was installed."
      : `Unpacking the Antigravity download failed with exit code ${exitCode}. Nothing was installed.`;
  }

  public static formatAntigravitySignFailed(exitCode: number | null): string {
    return Object.isNull(exitCode) ? "Re-signing Antigravity's server for this Intel Mac with codesign did not finish. Nothing was installed."
      : `Re-signing Antigravity's server for this Intel Mac with codesign failed with exit code ${exitCode}. Nothing was installed.`;
  }

  public static formatDownloadFailed(name: string, status: number): string {
    return `Downloading ${name} failed with HTTP status ${status}. Nothing was installed.`;
  }

  public static formatAcpAgentArchiveInsecure(name: string): string {
    return `The ${name} download isn't at an HTTPS address, so it wasn't started.`;
  }

  public static formatDownloadInsecure(name: string): string {
    return `The ${name} download left HTTPS, and it has no SHA-256 to check it against, so it was stopped.`;
  }

  public static formatCommandNotOnPath(command: string): string {
    return `No ${command} is on PATH, and TeamRun runs a command named without a folder only from PATH, never from the chat's folder.`;
  }

  public static formatAcpArgumentLineBreak(command: string): string {
    return `${command} is a batch file, and Windows ends a batch file's command line at a line break, so an argument with one can't reach it.`;
  }

  public static formatAcpAgentNoExtractor(name: string): string {
    return `${name} comes as an archive, and this computer has no program to unpack it.`;
  }

  public static formatAcpAgentPackageRefused(name: string, packageName: string): string {
    return `${name} names its npm package as "${packageName}", which isn't an exact name and version, so it isn't passed to npm.`;
  }

  public static formatAcpAgentNoNpm(name: string): string {
    return `${name} installs through npm, and npm isn't on this computer's PATH. Install Node.js, then try again.`;
  }

  public static formatAcpAgentNoBuild(name: string): string {
    return `${name} has no build for this computer.`;
  }

  public static formatAcpAgentUvx(name: string): string {
    return `${name} installs through uvx, which isn't available for now.`;
  }

  public static formatAcpAgentFolderNotWritable(directory: string): string {
    return `${directory} can't be written to.`;
  }

  public static formatAcpAgentArchiveUnsafe(name: string): string {
    return `The ${name} archive reaches outside its folder, so it wasn't installed.`;
  }

  public static formatAcpAgentUnpackFailed(name: string, exitCode: number | null): string {
    return Object.isNull(exitCode) ? `Unpacking ${name} took too long.` : `Unpacking ${name} failed with exit code ${exitCode}.`;
  }

  public static formatAcpAgentNpmFailed(name: string, exitCode: number | null, output: string): string {
    return `${Object.isNull(exitCode) ? `npm took too long to install ${name}.` : `npm couldn't install ${name}: exit code ${exitCode}.`}${output.length === 0 ? String.empty : ` ${output}`}`;
  }

  public static formatAcpAgentPackageIncomplete(name: string, packageName: string): string {
    return `npm didn't install ${packageName} for ${name}.`;
  }

  public static formatAcpAgentNoProgram(packageName: string): string {
    return `${packageName} doesn't name one program to run.`;
  }

  public static formatAcpAgentProgramMissing(name: string, path: string): string {
    return `The ${name} download has no ${path}.`;
  }

  public static formatAcpAgentNotPlaced(name: string, folder: string, code: string, held: boolean): string {
    return `${name} couldn't be moved to ${folder}${held ? " because another program holds it" : String.empty}${code === String.empty ? String.empty : ` (${code})`}.`;
  }

  public static formatLocalAcpSecretUnreadable(name: string, variable: string, reason: string): string {
    return `${name}'s value for ${variable} can't be read: ${reason}`;
  }

  public static formatLocalAcpSecretMissing(name: string, variable: string): string {
    return `${name}'s value for ${variable} is no longer saved. Remove the command and add it again.`;
  }

  public static formatDownloadMismatch(name: string): string {
    return `The ${name} download failed its size or SHA-256 check. Nothing was installed.`;
  }

  public static formatDownloadTooLarge(name: string, limit: number): string {
    return `The ${name} download was larger than ${limit} bytes, more than any release TeamRun installs, so it was stopped. Nothing was installed.`;
  }

  public static formatReleasesUnreachable(name: string): string {
    return `TeamRun couldn't reach ${name}'s releases, or lost the connection while it downloaded one. Check the network connection and try again. Nothing was installed.`;
  }

  public static formatInstallCancelled(name: string): string {
    return `The ${name} install was cancelled. Nothing was installed.`;
  }

  public static formatInstallNotReadyReason(reason: string, isHeld: boolean): string {
    const code = reason.length === 0 ? String.empty : ` (${reason})`;
    return isHeld ? `${code}, as something such as a virus scanner still held it` : code;
  }

  public static formatGeneralAcpToolTitle(name: string): string {
    return `${name} tool`;
  }

  public static formatGeneralAcpNotFound(name: string): string {
    return `${name} was not found. Install it again, then refresh.`;
  }

  public static formatGeneralAcpSingleAccount(name: string): string {
    return `${name} runs in your home folder with the one sign-in it keeps there, so TeamRun takes one ${name} provider, and its profile folder holds nothing of ${name}'s.`;
  }

  public static formatGeneralAcpSignInUnavailable(name: string): string {
    return `${name} offers no sign-in TeamRun can start. Sign in with ${name}'s own command in a terminal, then refresh.`;
  }

  public static formatGeneralAcpSignIn(name: string): string {
    return `${name} isn't signed in. Choose Sign in in the provider's menu, or sign in with ${name}'s own command in a terminal.`;
  }

  public static formatGeneralAcpStopped(name: string, reason: string): string {
    return `${name} stopped before completing the turn: ${reason}.`;
  }

  public static formatLocalAcpIdInvalid(id: string): string {
    return `A local ACP command's id, "${id}", must be a lowercase letter, then lowercase letters, digits and hyphens, at most 64 in all.`;
  }

  public static formatAcpRegistryOwnProvider(id: string): string {
    return `TeamRun runs the ACP registry's ${id} as a provider of its own.`;
  }

  public static formatAcpRegistryFailed(status: number): string {
    return `Reading the ACP registry's list of agents failed with HTTP status ${status}.`;
  }

  public static formatAcpRegistryIdInvalid(id: string): string {
    return `The ACP registry lists an agent whose id, "${id}", isn't up to 64 lowercase letters, digits and hyphens other than a Windows device name.`;
  }

  public static formatAcpRegistryVersionInvalid(id: string, version: string): string {
    return `The ACP registry lists ${id} at "${version}", which isn't a version.`;
  }

  public static formatAcpRegistryArchiveInvalid(archive: string): string {
    return `The ACP registry lists an archive at "${archive}", which isn't an https address.`;
  }

  public static formatAcpRegistryCommandInvalid(command: string): string {
    return `The ACP registry lists the command "${command}", which isn't a path inside the agent's archive.`;
  }

  public static formatAcpRegistrySha256Invalid(sha256: string): string {
    return `The ACP registry lists "${sha256}" as a SHA-256, which isn't one.`;
  }

  public static formatAcpRegistryVariableInvalid(name: string): string {
    return `The ACP registry lists the environment variable "${name}", which isn't a variable name with a text value.`;
  }

  public static formatReleaseChannelFailed(name: string, status: number): string {
    return `Reading the latest ${name} version failed with HTTP status ${status}. Nothing was installed.`;
  }

  public static formatReleaseChannelUnreadable(name: string): string {
    return `The latest ${name} version TeamRun read isn't a version. Nothing was installed.`;
  }

  public static formatClaudeBuildMissing(version: string): string {
    return `Claude Code ${version} lists no build for this computer with its size and SHA-256. Nothing was installed.`;
  }

  public static formatClaudeSetupKept(version: string, installed: string | null): string {
    return Object.isNull(installed) ? `Claude Code ${version} was set up, but TeamRun can't read which version is installed now.`
      : `Claude Code ${version} was set up, but Claude Code ${installed} is still the one installed.`;
  }

  public static formatClaudeSetupFailed(version: string, exitCode: number | null): string {
    return Object.isNull(exitCode) ? `Setting up Claude Code ${version} was stopped before it finished.`
      : `Setting up Claude Code ${version} failed with exit code ${exitCode}.`;
  }

  public static formatCodexAppServerPackageMissing(version: string): string {
    return `Codex ${version} lists no app server package for this computer with its SHA-256.`;
  }

  public static formatCodexAppServerReleaseFailed(version: string, status: number): string {
    return `Reading the Codex ${version} release failed with HTTP status ${status}.`;
  }

  public static formatCodexAppServerUnpackFailed(exitCode: number | null): string {
    return Object.isNull(exitCode) ? "Unpacking the Codex app server download was stopped."
      : `Unpacking the Codex app server download failed with exit code ${exitCode}.`;
  }

  public static formatCodexAppServerIncomplete(version: string): string {
    return `The Codex ${version} app server package has no ${Resources.codexAppServerProgram}.`;
  }

  public static formatCodexAppServerNotDownloaded(version: string, reason: string): string {
    return `The Codex ${version} app server wasn't downloaded, so Codex threads TeamRun starts still show in the Codex app: ${reason}`;
  }

  public static formatCodexAppServerNotRemoved(path: string, reason: string): string {
    return `An older Codex app server download at ${path} wasn't removed: ${reason}`;
  }

  public static formatCodexAppServerRefused(program: string, reason: string): string {
    return `The downloaded Codex app server at ${program} didn't start, so TeamRun runs codex app-server instead, and its Codex threads show in the Codex app: ${reason}`;
  }

  public static formatCodexPackageMissing(version: string): string {
    return `Codex ${version} lists no package for this computer with its SHA-256. Nothing was installed.`;
  }

  public static formatCodexUnpackFailed(exitCode: number | null): string {
    return Object.isNull(exitCode) ? "Unpacking the Codex download was stopped. Nothing was installed."
      : `Unpacking the Codex download failed with exit code ${exitCode}. Nothing was installed.`;
  }

  public static formatCodexIncomplete(version: string): string {
    return `The Codex ${version} package is missing some of its files, or its codex doesn't report ${version}. Nothing was installed.`;
  }

  public static formatCodexNotReplaced(path: string): string {
    return `Codex wasn't switched to the new version, because ${path} is a file or a folder with files in it, not a link Codex's installer made.`;
  }

  public static formatCodexReleaseKept(version: string, directory: string, reason: string): string {
    return `Codex ${version} in ${directory} is missing some of its files, and TeamRun couldn't move it aside to replace it (${reason}), so it was kept as it was. `
      + "Close what runs Codex from it and install again.";
  }

  public static formatCodexReleaseNotReplaced(version: string, directory: string, reason: string): string {
    return `Codex ${version} in ${directory} is missing some of its files, and TeamRun couldn't put the new download in its place (${reason}), so the old one was kept as it was. `
      + "Close what runs Codex from it and install again.";
  }

  public static formatCodexReleaseSetAside(version: string, directory: string, aside: string, reason: string, backReason: string): string {
    return `Codex ${version} in ${directory} is missing some of its files, and TeamRun couldn't put the new download in its place (${reason}), nor move the old one back (${backReason}). `
      + `It is kept in ${aside} until Codex installs: move it back to ${directory}, or install Codex again.`;
  }

  public static formatCodexFolderNotWritable(directory: string): string {
    return `TeamRun can't write to ${directory}, where Codex's releases go. Nothing was installed.`;
  }

  public static formatCodexCommandNotWritable(version: string, root: string, directory: string): string {
    return `Codex ${version} was installed in ${root} and is now its current release, but TeamRun can't write the codex command to ${directory}. `
      + "Make that folder writable and install again.";
  }

  public static formatCodexNotFoundAfterInstall(directory: string): string {
    return `Codex was installed in ${directory}, but TeamRun can't find it there. Restart TeamRun, then install it again.`;
  }

  public static formatCodexShadowed(version: string, directory: string, path: string, found: string | null): string {
    return `Codex ${version} was installed in ${directory}, but TeamRun runs ${path}${Object.isNull(found) ? String.empty : `, Codex ${found},`} which comes first on the PATH. Remove that one, or put ${directory} first on the PATH, then restart TeamRun.`;
  }

  public static formatCopilotArchiveMissing(version: string): string {
    return `GitHub Copilot ${version} lists no build for this computer with its SHA-256. Nothing was installed.`;
  }

  public static formatCopilotUnpackFailed(exitCode: number | null): string {
    return Object.isNull(exitCode) ? "Unpacking the GitHub Copilot download was stopped. Nothing was installed."
      : `Unpacking the GitHub Copilot download failed with exit code ${exitCode}. Nothing was installed.`;
  }

  public static formatCopilotIncomplete(version: string): string {
    return `The GitHub Copilot ${version} download has no copilot that reports ${version}. Nothing was installed.`;
  }

  public static formatCopilotFolderNotWritable(directory: string): string {
    return `TeamRun can't write to ${directory}, where GitHub Copilot goes. Nothing was installed.`;
  }

  public static formatCopilotReleaseKept(version: string, directory: string, reason: string): string {
    return `TeamRun couldn't move GitHub Copilot ${version} in ${directory} aside to replace it (${reason}), so it was kept as it was. `
      + "Close what runs GitHub Copilot from it and install again.";
  }

  public static formatCopilotNotReady(version: string, directory: string, reason: string, isHeld: boolean): string {
    return `TeamRun couldn't move the new GitHub Copilot ${version} download into place in ${directory}${Resources.formatInstallNotReadyReason(reason, isHeld)}, `
      + `so nothing installed was changed.${isHeld ? " Install again in a moment." : String.empty}`;
  }

  public static formatCopilotReleaseNotReplaced(version: string, directory: string, reason: string): string {
    return `TeamRun couldn't put the new GitHub Copilot ${version} download in place of the one in ${directory} (${reason}), so the one there was kept as it was. `
      + "Close what runs GitHub Copilot from it and install again.";
  }

  public static formatCopilotReleaseSetAside(version: string, directory: string, aside: string, reason: string, backReason: string): string {
    return `TeamRun couldn't put the new GitHub Copilot ${version} download in place of the one in ${directory} (${reason}), nor move that one back (${backReason}). `
      + `It is kept in ${aside} until GitHub Copilot installs: move it back to ${directory}, or install GitHub Copilot again.`;
  }

  public static formatCopilotNotFoundAfterInstall(directory: string): string {
    return `GitHub Copilot was installed in ${directory}, but TeamRun can't find it there. Restart TeamRun, then install it again.`;
  }

  public static formatCopilotShadowed(version: string, directory: string, path: string, found: string | null): string {
    return `GitHub Copilot ${version} was installed in ${directory}, but TeamRun runs ${path}${Object.isNull(found) ? String.empty : `, GitHub Copilot ${found},`} which it finds first. Remove that one, then restart TeamRun.`;
  }

  public static formatCursorUnpackFailed(exitCode: number | null): string {
    return Object.isNull(exitCode) ? "Unpacking the Cursor download was stopped. Nothing was installed."
      : `Unpacking the Cursor download failed with exit code ${exitCode}. Nothing was installed.`;
  }

  public static formatCursorIncomplete(version: string): string {
    return `The Cursor ${version} download doesn't unpack to a Cursor CLI of the expected size that reports ${version}. Nothing was installed.`;
  }

  public static formatCursorFolderNotWritable(directory: string): string {
    return `TeamRun can't write to ${directory}, where Cursor goes. Nothing was installed.`;
  }

  public static formatCursorReleaseKept(version: string, directory: string, reason: string): string {
    return `TeamRun couldn't move Cursor ${version} in ${directory} aside to replace it (${reason}), so it was kept as it was. `
      + "Close what runs Cursor from it and install again.";
  }

  public static formatCursorReleaseNotReplaced(version: string, directory: string, reason: string): string {
    return `TeamRun couldn't put the new Cursor ${version} download in place of the one in ${directory} (${reason}), so the one there was kept as it was. `
      + "Close what runs Cursor from it and install again.";
  }

  public static formatCursorReleaseSetAside(version: string, directory: string, aside: string, reason: string, backReason: string): string {
    return `TeamRun couldn't put the new Cursor ${version} download in place of the one in ${directory} (${reason}), nor move that one back (${backReason}). `
      + `It is kept in ${aside} until Cursor installs: move it back to ${directory}, or install Cursor again.`;
  }

  public static formatCursorNotReady(version: string, directory: string, reason: string, isHeld: boolean): string {
    return `TeamRun couldn't move the new Cursor ${version} download into place in ${directory}${Resources.formatInstallNotReadyReason(reason, isHeld)}, `
      + `so nothing installed was changed.${isHeld ? " Install again in a moment." : String.empty}`;
  }

  public static formatCursorNotPlaced(version: string, directory: string, reason: string): string {
    return `TeamRun couldn't move the new Cursor ${version} download into ${directory} (${reason}). Nothing was installed. Install again.`;
  }

  public static formatCursorNotFoundAfterInstall(directory: string): string {
    return `Cursor was installed in ${directory}, but TeamRun can't find it there. Restart TeamRun, then install it again.`;
  }

  public static formatCursorShadowed(version: string, directory: string, path: string, found: string | null): string {
    return `Cursor ${version} was installed in ${directory}, but TeamRun runs ${path}${Object.isNull(found) ? String.empty : `, Cursor ${found},`} which it finds first. Remove that one, then restart TeamRun.`;
  }

  public static formatGrokIncomplete(version: string): string {
    return `The Grok ${version} download doesn't unpack to a grok that reports ${version}. Nothing was installed.`;
  }

  public static formatGrokFolderNotWritable(directory: string): string {
    return `TeamRun can't write to ${directory}, where Grok goes. Nothing was installed.`;
  }

  public static formatGrokKept(path: string, reason: string): string {
    return `TeamRun couldn't move ${path} aside to update Grok (${reason}), so Grok was kept as it was. Close what runs Grok and install again.`;
  }

  public static formatGrokNotReady(path: string, reason: string, isHeld: boolean): string {
    return `TeamRun couldn't move the new Grok into place at ${path}${Resources.formatInstallNotReadyReason(reason, isHeld)}, so Grok was kept as it was.`
      + (isHeld ? " Install again in a moment." : String.empty);
  }

  public static formatGrokNotReplaced(path: string, reason: string): string {
    return `TeamRun couldn't put the new Grok at ${path} (${reason}), so Grok was kept as it was. Close what runs Grok and install again.`;
  }

  public static formatGrokNotRestored(directory: string): string {
    return `TeamRun couldn't finish updating Grok in ${directory}, nor put back all of the Grok it had replaced. Install Grok again.`;
  }

  public static formatGrokNotFoundAfterInstall(directory: string): string {
    return `Grok was installed in ${directory}, but TeamRun can't find it there. Restart TeamRun, then install it again.`;
  }

  public static formatGrokShadowed(version: string, directory: string, path: string, found: string | null): string {
    return `Grok ${version} was installed in ${directory}, but TeamRun runs ${path}${Object.isNull(found) ? String.empty : `, Grok ${found},`} which it finds first. Remove that one, then restart TeamRun.`;
  }

  public static formatAntigravityNotLinked(path: string, target: string, error: string): string {
    return `TeamRun couldn't link ${target} into the Antigravity profile at ${path}, so Antigravity doesn't read it from there: ${error}`;
  }

  public static formatAntigravitySignIn(directory: string): string {
    return `Sign in to Google in the dedicated TeamRun Antigravity profile at ${directory}.`;
  }

  public static formatModelUnavailable(kind: string, model: string): string {
    return `${kind} doesn't offer the model ${model}. Open the teammate or the composer's model menu, refresh the models, and choose one.`;
  }

  public static formatPlanModeKept(provider: string, error: string): string {
    return `${provider} couldn't leave its plan mode once the plan was approved: ${error}`;
  }

  public static formatReadOnlyChatRefused(provider: string, tool: string): string {
    return `TeamRun refused ${provider}'s request to run ${tool}: the plan is approved, and the chat's own mode is read-only.`;
  }

  public static formatReadOnlyToolRefused(provider: string, tool: string): string {
    return `TeamRun refused ${provider}'s request to run ${tool}: the chat's mode is read-only, and ${provider} doesn't mark this tool as one that only reads.`;
  }

  public static formatChatModeKeptOut(provider: string, error: string): string {
    return `${provider} left its plan mode for its default mode and couldn't go back to the chat's mode: ${error}`;
  }

  public static formatToDoListUnread(provider: string, error: string): string {
    return `${provider}'s to-do list couldn't be read: ${error}`;
  }

  public static formatPlanUnread(provider: string, error: string): string {
    return `${provider}'s plan couldn't be read, so TeamRun cancelled it: ${error}`;
  }

  public static formatModeUnavailable(kind: string, mode: string): string {
    return `${kind} doesn't offer the mode ${mode} in this session. Choose another mode for the teammate.`;
  }

  public static formatWakeStillApproves(kind: string): string {
    return `${kind} was started to approve its own tools, so it still doesn't ask before using them in this reply; the chat's mode applies in full from ${kind}'s next reply.`;
  }

  public static formatWakeModeKept(kind: string, reason: string): string {
    return `${kind} couldn't switch this reply to the chat's current mode, so it runs in the mode it had: ${reason}`;
  }

  public static formatWakeBeganInEarlierMode(kind: string): string {
    return `${kind} began this reply on its own, so the steps it took before switching to the chat's current mode may have run in the mode it had.`;
  }

  public static formatWakeModeNoteLost(kind: string, reason: string): string {
    return `[${kind}] A woken reply's mode note was lost: ${reason}`;
  }

  public static formatUnrestrictedMode(kind: string, mode: string): string {
    return `${kind}'s session is in the mode ${mode}, which lifts its restrictions, and it couldn't switch to its default mode, so TeamRun didn't send the prompt.`;
  }

  public static formatModelsNotLoaded(kind: string, model: string): string {
    return `${kind} hasn't loaded its models yet, so it can't use ${model} now. Try again in a moment.`;
  }

  public static formatCompactionUnreported(kind: string): string {
    return `${kind} answered /compact without reporting a compaction, so its context may not be compacted.`;
  }

  public static formatCannotCompact(kind: string): string {
    return `${kind} can't compact its context.`;
  }

  public static formatRunCommand(command: string): string {
    return `run ${command}`;
  }

  public static formatCommandWithFiles(kind: string, command: string): string {
    return `TeamRun passes ${command} on to ${kind} only as a message of its own, without files, so it didn't send it.`;
  }

  public static formatCommandUnlisted(kind: string, command: string, listed: readonly string[]): string {
    return listed.length === 0 ? `${kind} listed no commands, so TeamRun didn't send ${command}.`
      : `${kind} didn't list ${command}, so TeamRun didn't send it. It lists ${listed.map(t => Resources.acpCommandPrefix + t).join(Resources.listSeparator)}.`;
  }

  public static formatAntigravityStopped(reason: string): string {
    return `Antigravity stopped before completing the turn: ${reason}.`;
  }

  public static formatTeamRunToolName(tool: string): string {
    return `mcp__teamrun__${tool}`;
  }

  public static formatPiMcpToolName(server: string, tool: string): string {
    return `mcp__${server}__${tool}`.replaceAll("-", "_");
  }

  public static formatPiUnsupported(version: string): string {
    return `Pi ${version} is too old for TeamRun, which works with Pi ${Resources.piMinimumVersion.join(".")} and later. Update Pi, then check again.`;
  }

  public static formatPiNotReady(provider: string): string {
    return `Pi isn't signed in to ${provider}: choose Sign in, which opens pi in a terminal, and type /login there.`;
  }

  public static formatPiAuthInvalid(provider: string, timedOut: boolean): string {
    return timedOut ? `Pi's sign-in check for ${provider} didn't finish in time.` : `Pi's sign-in for ${provider} is invalid: sign in again with /login in pi.`;
  }

  public static formatPiNotRunning(command: string): string {
    return `Pi is not running (${command}).`;
  }

  public static formatPiTimedOut(command: string): string {
    return `Pi did not answer ${command} within the timeout.`;
  }

  public static formatPiRefused(command: string, error: string | null): string {
    return `Pi refused ${command}: ${error ?? "it gave no reason"}.`;
  }

  public static formatPiExited(code: number | null, signal: string | null, stderr: string): string {
    const suffix = String.isNullOrWhitespace(stderr) ? String.empty : `: ${stderr}`;
    return `Pi exited (code ${String(code)}, signal ${String(signal)})${suffix}`;
  }

  public static formatPiEventFailed(type: string, error: string): string {
    return `TeamRun couldn't read a ${type} record from Pi: ${error}`;
  }

  public static formatPiCompactionFailed(error: string): string {
    return `Pi couldn't compact its context: ${error}`;
  }

  public static formatPiRetrying(error: string): string {
    return `Pi is retrying after an error: ${error}`;
  }

  public static formatPiExtensionFailed(error: string): string {
    return `A Pi extension failed: ${error}`;
  }

  public static formatPiApprovalFailed(error: string): string {
    return `TeamRun refused the tool because it couldn't ask: ${error}`;
  }

  public static formatPiQuestionFailed(error: string): string {
    return `TeamRun dismissed a Pi extension's question because it couldn't ask: ${error}`;
  }

  public static formatPiDialogTimedOut(header: string, question: string): string {
    const asked = String.isNullOrWhitespace(header) ? question : `${header}\n${question}`;
    return `A Pi extension's question timed out, so Pi used its default answer: ${asked}`;
  }

  public static formatPiTurnNotFound(entryId: string): string {
    return `Pi's session has no message ${entryId} to fork after.`;
  }

  public static formatRolePrompt(instructions: string | null, prompt: string): string {
    const role = instructions ?? "No additional teammate role instructions.";
    return `TeamRun teammate role for this turn (replaces any previous teammate role):\n${role}\n\nTask:\n\n${prompt}`;
  }
}
