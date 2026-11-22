/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FocusOrigin } from "@angular/cdk/a11y";
import { GitHubNames } from "@noldova/git.github.protocol";
import { CheckState, ReviewDecision } from "@noldova/git.hosting.protocol";
import { GitNames } from "@noldova/git.protocol";
import { ApprovalKind, AuthStatus, DetailKind, MessageDelivery, MessageStatus, MethodName, type NodeType, PlanStepStatus as ReplyPlanStepStatus, PlanWindowName,
  type ProviderKindInstallation, ReplyPanel, Resources as ProtocolResources, SharedMcpSetting, SharedMcpTransport, SharedMcpVariableSource, SubAgentStatus } from "@noldova/teamrun.protocol";
import { TerminalShellKind } from "@noldova/terminal.window";
import { PlanStepStatus, ToolCallStatus } from "@noldova/ui.components.angular";

import { BrowserStepPhase } from "./app/enums/browser-step-phase";
import { ChatAction } from "./app/enums/chat-action";
import { ImageOpenMode } from "./app/enums/image-open-mode";
import { OrganizationBoardSort } from "./app/enums/organization-board-sort";
import { OrganizationCardField } from "./app/enums/organization-card-field";
import { OrganizationViewMode } from "./app/enums/organization-view-mode";
import { StepCategory } from "./app/enums/step-category";
import { TeammateStatus } from "./app/enums/teammate-status";
import { BrowserStepWords } from "./app/models/browser-step-words";
import { CiLabel } from "./app/models/ci-label";
import { GrantColumnShares } from "./app/models/grant-column-shares";
import { LowRiskReadWords } from "./app/models/low-risk-read-words";
import { PanStep } from "./app/models/pan-step";
import { RelativeTimeUnit } from "./app/models/relative-time-unit";
import { TeammateColumnShares } from "./app/models/teammate-column-shares";
import type { ProviderAction } from "./app/types/provider-action";

export class Resources {
  public static readonly moduleId: string = "teamrun";
  public static readonly nameSeparator: string = ".";
  public static readonly lineSeparator: string = "\n";
  public static readonly ellipsis: string = "…";
  public static readonly recentCount: number = 5;
  public static readonly messagePageSize: number = 50;
  public static readonly searchLimit: number = 20;
  public static readonly searchDelayMilliseconds: number = 150;
  public static readonly messageSearchCap: number = 1000;
  public static readonly abortEvent: string = "abort";
  public static readonly newConversationTitle: string = "New chat";
  public static readonly titleModelSetting: string = "teamrun.titleModel";
  public static readonly titleModelSameAsChat: string = "Same as the chat";
  public static readonly titleModelSeparator: string = "/";
  public static readonly kindsUnavailable: string = "The provider types couldn't be loaded, so no reply can start.";
  public static readonly retryLabel: string = "Retry";
  public static readonly kindsUnavailableForProviders: string = "The provider types couldn't be loaded, so providers can't be edited or checked.";
  public static readonly kindsUnavailableForMcpServers: string = "The provider types couldn't be loaded, so their MCP servers can't be shown.";
  public static readonly kindsUnavailableForAbilities: string = "The provider types couldn't be loaded, so their abilities can't be shown.";
  public static readonly signInKindsNotRead: string = "The provider types couldn't be read again, so the sign-in didn't start.";
  public static readonly signOutKindsNotRead: string = "The provider types couldn't be read again, so the sign-out didn't start.";
  public static readonly nullKind: string = "null";
  public static readonly modelCatalogUnavailable: string = "Models could not be refreshed. Previously loaded choices are kept.";
  public static readonly errorCodeField: string = "code";
  public static readonly errorArgumentsField: string = "arguments";
  public static readonly modelCatalogLifetime: number = 300_000;
  public static readonly draftSaveInterval: number = 500;
  public static readonly typingSettleTime: number = 2000;
  public static readonly draftSaveIntervalToken: string = "teamrun.draftSaveInterval";
  public static readonly maximumModelCatalogs: number = 20;
  public static readonly composerChoicesStorageKey: string = "teamrun.composerChoices";
  public static readonly keptComposerDraftsStorageKey: string = "teamrun.keptComposerDrafts";
  public static readonly defaultChoiceField: string = "defaultChoice";
  public static readonly chatChoicesField: string = "chats";
  public static readonly legacyChatChoicesField: string = "conversations";
  public static readonly kindField: string = "kind";
  public static readonly modelField: string = "model";
  public static readonly effortField: string = "effort";
  public static readonly speedField: string = "speed";
  public static readonly modeField: string = "mode";
  public static readonly providerIdField: string = "providerId";
  public static readonly responderTeammateIdField: string = "responderTeammateId";
  public static readonly titleSeparator: string = " · ";
  public static readonly subscriptionSeparator: string = " ·\u00a0";
  public static readonly replyProviderMark: string = "·\u00a0";
  public static readonly teamRunLabel: string = "TeamRun";
  public static readonly thisComputerLabel: string = "This computer";
  public static readonly binaryMediaType: string = "application/octet-stream";
  public static readonly dataUrlSeparator: string = ",";
  public static readonly enterKey: string = "Enter";
  public static readonly expandedAttribute: string = "aria-expanded";
  public static readonly trueValue: string = "true";
  public static readonly filesTransferType: string = "Files";
  public static readonly composerLabel: string = "Message";
  public static readonly composerPlaceholder: string = "Describe the work. Enter sends, Shift+Enter adds a line.";
  public static readonly mentionListLabel: string = "Teammates";
  public static readonly conversationMembersLabel: string = "Chat members";
  public static readonly otherTeammatesLabel: string = "Other teammates";
  public static readonly addMemberLabel: string = "Add chat member";
  public static readonly removeMemberLabel: string = "Remove from chat";
  public static readonly noTeammatesToAdd: string = "No teammates yet";
  public static readonly attachmentsLabel: string = "Attachments";
  public static readonly addFilesLabel: string = "Add files";
  public static readonly removeAttachmentLabel: string = "Remove attachment";
  public static readonly attachmentLimitExceeded: string = "Attach up to 10 files: 10 MiB per image and 100 MiB per file.";
  public static readonly attachmentReadFailed: string = "The attachment could not be read. Try adding it again.";
  public static readonly draftNotSaved: string = "The unsent message could not be saved.";
  public static readonly draftStale: string = "Another window changed the unsent message since this one read it.";
  public static readonly draftUnreadable: string = "The unsent message could not be read, so what is written here is not kept.";
  public static readonly modelImagesUnsupported: string = "No one in this chat takes images.";
  public static readonly chatPermissionsLabel: string = "Permissions in this chat";
  public static readonly toolsFollowMode: string = "TeamRun's own tools follow this mode.";
  public static readonly planFirstLabel: string = "Plan first";
  public static readonly planFirstDescription: string = "Plans for your approval before it changes anything";
  public static readonly pickerLabel: string = "Model and effort";
  public static readonly permissionsAndPickerLabel: string = "Permissions, model and effort";
  public static readonly answerWithoutTeammateLabel: string = "Answer without a teammate";
  public static readonly kindLabel: string = "Provider type";
  public static readonly providerLabel: string = "Provider";
  public static readonly modelLabel: string = "Model";
  public static readonly effortLabel: string = "Effort";
  public static readonly defaultTeammateLabel: string = "Default";
  public static readonly defaultTeammateTitle: string = "Default teammate";
  public static readonly unavailableProviderLabel: string = "Saved provider unavailable";
  public static readonly loadingModelsLabel: string = "Loading models…";
  public static readonly providerDefaultModel: string = "Default model";
  public static readonly modelDefaultEffort: string = "Model default";
  public static readonly modelDefaultSpeed: string = "Model default";
  public static readonly speedLabel: string = "Speed";
  public static readonly contextWindowLabel: string = "Context window";
  public static readonly defaultContextWindow: string = "Default";
  public static readonly customContextWindowValue: string = "custom";
  public static readonly customContextWindowOption: string = "Custom…";
  public static readonly changeEffortAction: string = "change effort";
  public static readonly changeSpeedAction: string = "change speed";
  public static readonly changeContextWindowAction: string = "change the context window";
  public static readonly planFirstAction: string = "plan first";
  public static readonly useReadOnlyModeAction: string = "use a read-only mode";
  public static readonly useUnrestrictedModeAction: string = "use an unrestricted mode";
  public static readonly readOnlyModeLabel: string = "Read-only";
  public static readonly unrestrictedModeLabel: string = "Unrestricted";
  public static readonly modeHintId: string = "nol-teamrun-mode-hint";
  public static readonly signOutAction: string = "sign out here";
  public static readonly stopSubAgentAction: string = "stop one sub-agent";
  public static readonly kindRefusalId: string = "nol-teamrun-kind-refusal";
  public static readonly customContextWindowLabel: string = "Context window size";
  public static readonly contextWindowNextMessage: string = "A change applies from the teammate's next message.";
  public static readonly recommendedEffortTag: string = "Recommended";
  public static readonly permissionModeLabel: string = "Permission mode";
  public static readonly permissionsLabel: string = "Permissions";
  public static readonly defaultModeTag: string = "Default";
  public static readonly noEffortLevels: string = "Effort levels unavailable. The model's default is used.";
  public static readonly refreshModelsLabel: string = "Refresh models";
  public static readonly settingsMenuWidth: number = 15.75;
  public static readonly sendLabel: string = "Send";
  public static readonly stopLabel: string = "Stop";
  public static readonly addGlyph: string = "add";
  public static readonly removeGlyph: string = "close";
  public static readonly permissionsGlyph: string = "shield";
  public static readonly unrestrictedModeGlyph: string = "warning";
  public static readonly planFirstGlyph: string = "checklist";
  public static readonly expandGlyph: string = "expand_more";
  public static readonly refreshGlyph: string = "refresh";
  public static readonly sendGlyph: string = "arrow_upward";
  public static readonly stopGlyph: string = "stop";
  public static readonly projectsViewName: string = "teamrun.projects";
  public static readonly projectsViewTitle: string = "Projects";
  public static readonly explorerTitle: string = "Explorer";
  public static readonly projectsViewIcon: string = "folder_open";
  public static readonly conversationDocumentName: string = "teamrun.conversation";
  public static readonly imageDocumentName: string = "teamrun.image";
  public static readonly noChatPlaceholderName: string = "teamrun.noChat";
  public static readonly imageOpenModeSetting: string = "teamrun.imageOpenMode";
  public static readonly organizationMessageFlowSetting: string = "teamrun.organizationMessageFlow";
  public static readonly timeFormatSetting: string = "desktop.timeFormat";
  public static readonly dateTimeFormatSetting: string = "desktop.dateTimeFormat";
  public static readonly defaultTimeFormat: string = "h:mm a";
  public static readonly defaultDateTimeFormat: string = "MMM d, yyyy, h:mm a";
  public static readonly defaultShortDateFormat: string = "d MMM";
  public static readonly datePatternToken: RegExp = /('[^']*'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|ss|a)/u;
  public static readonly datePatternQuote: string = "'";
  public static readonly yearAndWeekdayTokens: readonly string[] = ["yyyy", "yy", "EEEE", "EEE"];
  public static readonly timeTokens: readonly string[] = ["HH", "H", "hh", "h", "mm", "ss", "a"];
  public static readonly shortWeekdayToken: string = "EEE";
  public static readonly newTerminalsSetting: string = "teamrun.newTerminals";
  public static readonly chatNewTerminals: string = "Chat";
  public static readonly runOpensInSetting: string = "teamrun.runOpensIn";
  public static readonly runOpensInPanel: string = "Panel";
  public static readonly inlineTerminalRows: number = 15;
  public static readonly inlineTerminalMinimumRows: number = 8;
  public static readonly inlineTerminalRowTolerance: number = 1e-3;
  public static readonly runBodySite: string = "body";
  public static readonly runPlanSite: string = "plan";
  public static readonly runStepSitePrefix: string = "step:";
  public static readonly terminalNewCommand: string = "terminal.new";
  public static readonly browserOpenPageCommand: string = "browser.openPage";
  public static readonly browserPageDocumentName: string = "browser.page";
  public static readonly browserProfileKeyField: string = "profileKey";
  public static readonly browserInstanceField: string = "instance";
  public static readonly browserModuleId: string = "browser";
  public static readonly computerUseModuleId: string = "computer-use";
  public static readonly computerUseBorderColorSetMethod: string = "computer-use.borderColorSet";
  public static readonly gitHubReferenceProtocol: string = "https:";
  public static readonly gitHubReferenceHost: string = "github.com";
  public static readonly gitHubIssuesSegment: string = "issues";
  public static readonly gitHubPullSegment: string = "pull";
  public static readonly gitHubFilesSegment: string = "files";
  public static readonly gitHubAppsSegment: string = "apps";
  public static readonly gitHubOwnerPattern: RegExp = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
  public static readonly gitHubRepositoryPattern: RegExp = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
  public static readonly gitHubNumberPattern: RegExp = /^[1-9][0-9]{0,9}$/;
  public static readonly gitHubTextReferencePattern: RegExp =
    /(?<![\w./#&-])(?:[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}#)[A-Za-z0-9._-]{1,100})?#[1-9][0-9]{0,9}(?![\w-])/gu;
  public static readonly gitHubHomePattern: RegExp = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;
  public static readonly gitHubTextNumberMark: string = "#";
  public static readonly gitHubReferenceReadLimit: number = 4;
  public static readonly gitHubReferenceMemoryLimit: number = 500;
  public static readonly gitHubBotSuffix: string = "[bot]";
  public static readonly terminalOwnerField: string = "owner";
  public static readonly terminalTabGroupField: string = "tabGroup";
  public static readonly imageClipboardToken: string = "teamrun.imageClipboard";
  public static readonly rowRevealToken: string = "teamrun.rowReveal";
  public static readonly listViewportSelector: string = ".nol-virtual-list-viewport";
  public static readonly stepLineSelector: string = ".activity-step";
  public static readonly workingLineSelector: string = ".activity-line";
  public static readonly anyElementSelector: string = "*";
  public static readonly terminalLauncherToken: string = "teamrun.terminalLauncher";
  public static readonly embeddedTerminalToken: string = "teamrun.embeddedTerminal";
  public static readonly providerTerminalRows: number = 16;
  public static readonly imageOpenActionLabels: Readonly<Record<ImageOpenMode, string>> = {
    [ImageOpenMode.Popup]: "Open modal",
    [ImageOpenMode.Tab]: "Open in a new tab"
  };
  public static readonly imageOpenActionGlyphs: Readonly<Record<ImageOpenMode, string>> = {
    [ImageOpenMode.Popup]: "open_in_new",
    [ImageOpenMode.Tab]: "tab"
  };
  public static readonly imageMenuLabel: string = "Image";
  public static readonly copyImageLabel: string = "Copy Image";
  public static readonly downloadImageLabel: string = "Download Image";
  public static readonly copyImageGlyph: string = "content_copy";
  public static readonly copiedImageLabel: string = "Copied";
  public static readonly copiedImageGlyph: string = "check";
  public static readonly copiedDuration: number = 1500;
  public static readonly downloadImageGlyph: string = "download";
  public static readonly imageCopyFailed: string = "The image could not be copied. Try again.";
  public static readonly imageSaveFailed: string = "The image could not be saved. Try again.";
  public static readonly imageLoading: string = "Loading image…";
  public static readonly imageLoadFailed: string = "This image could not be loaded.";
  public static readonly imageGenerationFailed: string = "Image generation failed";
  public static readonly imageLimitReached: string = "The image generation limit was reached.";
  public static readonly imageNotShown: string = "The image couldn't be shown.";
  public static readonly previousImageLabel: string = "Previous image";
  public static readonly nextImageLabel: string = "Next image";
  public static readonly previousImageGlyph: string = "arrow_back";
  public static readonly nextImageGlyph: string = "arrow_forward";
  public static readonly zoomInLabel: string = "Zoom in";
  public static readonly zoomOutLabel: string = "Zoom out";
  public static readonly fitImageLabel: string = "Fit image";
  public static readonly zoomInGlyph: string = "add";
  public static readonly zoomOutGlyph: string = "remove";
  public static readonly imageMinimumZoom: number = 0.1;
  public static readonly imageMaximumZoom: number = 4;
  public static readonly imageZoomStep: number = 1.25;
  public static readonly percentScale: number = 100;
  public static readonly imageCloseKey: string = "Escape";
  public static readonly imageCloseTabKey: string = "w";
  public static readonly imagePreviousKey: string = "ArrowLeft";
  public static readonly imageNextKey: string = "ArrowRight";
  public static readonly imagePanKeys: Readonly<Record<string, PanStep>> = {
    ArrowLeft: new PanStep(-1, 0),
    ArrowRight: new PanStep(1, 0),
    ArrowUp: new PanStep(0, -1),
    ArrowDown: new PanStep(0, 1)
  };
  public static readonly imagePanFraction: number = 0.1;
  public static readonly imageZoomInKeys: readonly string[] = ["+", "="];
  public static readonly imageZoomOutKey: string = "-";
  public static readonly imageFitKey: string = "0";
  public static readonly imageDisabledButtonSelector: string = "button:disabled";
  public static readonly imageCloseSelector: string = ".nol-teamrun-image-close";
  public static readonly imageSizeLimit: number = 256;
  public static readonly generatedImageLimit: number = 32;
  public static readonly imageReadLimit: number = 16;
  public static readonly imageShareLifetime: number = 9 * 60 * 1000;
  public static readonly imageByteLimit: number = 48 * 1024 * 1024;
  public static readonly clipboardImageMediaType: string = "image/png";
  public static readonly canvasContext: "2d" = "2d";
  public static readonly fallbackImageWidth: number = 300;
  public static readonly fallbackImageHeight: number = 150;
  public static readonly svgMediaType: DOMParserSupportedType = "image/svg+xml";
  public static readonly svgSizeAttributes: readonly string[] = ["width", "height"];
  public static readonly viewBoxAttribute: string = "viewBox";
  public static readonly viewBoxSeparatorPattern: RegExp = /[\s,]+/;
  public static readonly planNames: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
    ["claude", new Map([["pro", "Pro"], ["max", "Max"]])],
    ["codex", new Map([["plus", "Plus"], ["pro", "Pro"], ["team", "Business"], ["business", "Business"], ["self_serve_business_usage_based", "Business"],
      ["enterprise", "Enterprise"]])]
  ]);
  public static readonly planCodeSeparator: string = "_";
  public static readonly planWordSeparator: string = " ";
  public static readonly upperCasePattern: RegExp = /\p{Lu}/u;
  public static readonly percentSuffix: string = "%";
  public static readonly speedPendingReason: string = "pending";
  public static readonly speedUnavailableNote: string = "Fast mode isn't available now.";
  public static readonly standardSpeedNote: string = "Replies run at standard speed.";
  public static readonly speedReasons: Readonly<Record<string, string>> = {
    free: "Fast mode needs a paid plan.",
    preference: "Fast mode is turned off in this provider's Claude Code preferences.",
    extra_usage_disabled: "Fast mode needs usage credits, which are turned off.",
    network_error: "Claude Code couldn't reach Anthropic to check fast mode.",
    not_first_party: "Fast mode works only when Claude Code connects to Anthropic directly.",
    disabled_by_env: "Fast mode is turned off by CLAUDE_CODE_DISABLE_FAST_MODE.",
    model_not_allowed: "The organization doesn't allow the fast mode model.",
    sdk_opt_in_required: "Claude Code takes fast mode only in a session started with it.",
    cooldown: "Fast mode reached its rate limit and comes back after a cooldown.",
    tier_not_served: "The provider served another speed."
  };

  public static readonly imageExtensions: Readonly<Record<string, string>> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg"
  };
  public static readonly imageExtensionPattern: RegExp = /\.(?:png|jpe?g|gif|webp|svg)$/i;
  public static readonly base64PaddingPattern: RegExp = /=+$/;
  public static readonly writtenImageMediaTypes: Readonly<Record<string, string>> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };
  public static readonly imageKeySeparator: string = ":";
  public static readonly generatedImageName: string = "Generated image";
  public static readonly markdownImageName: string = "Image";
  public static readonly markdownImageKey: string = "markdown";
  public static readonly dataImageUrlPattern: RegExp = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,([A-Za-z0-9+/]+={0,2})$/i;
  public static readonly webAddressPattern: RegExp = /^https?:\/\/\S+$/i;
  public static readonly whitespacePattern: RegExp = /\s+/g;
  public static readonly middleButton: number = 1;
  public static readonly auxclickEventName: string = "auxclick";
  public static readonly base64PaddingCharacter: string = "=";
  public static readonly dataImagePixelLimit: number = 40_000_000;
  public static readonly imageHeaderBytes: number = 256 * 1024;
  public static readonly pngMediaType: string = "image/png";
  public static readonly gifMediaType: string = "image/gif";
  public static readonly webpMediaType: string = "image/webp";
  public static readonly jpegMediaType: string = "image/jpeg";
  public static readonly pngSignature: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  public static readonly pngHeaderChunk: readonly number[] = [0x49, 0x48, 0x44, 0x52];
  public static readonly gifSignature: readonly number[] = [0x47, 0x49, 0x46, 0x38];
  public static readonly riffSignature: readonly number[] = [0x52, 0x49, 0x46, 0x46];
  public static readonly webpSignature: readonly number[] = [0x57, 0x45, 0x42, 0x50];
  public static readonly webpLossyChunk: readonly number[] = [0x56, 0x50, 0x38, 0x20];
  public static readonly webpLosslessChunk: readonly number[] = [0x56, 0x50, 0x38, 0x4c];
  public static readonly webpExtendedChunk: readonly number[] = [0x56, 0x50, 0x38, 0x58];
  public static readonly projectsLayoutStorageKey: string = "teamrun.projectsLayout";
  public static readonly projectsLayoutFailureNotAnError: string = "a value that isn't an error";
  public static readonly collapsedProjectsField: string = "collapsedProjects";
  public static readonly pinnedChatsField: string = "pinnedChats";
  public static readonly projectOrderField: string = "projectOrder";
  public static readonly chatOrderField: string = "chatOrder";
  public static readonly collapsedGroupsField: string = "collapsedGroups";
  public static readonly collapsedDepartmentsField: string = "collapsedDepartments";
  public static readonly organizationCardsShowField: string = "cardsShow";
  public static readonly organizationCardsField: string = "cards";
  public static readonly teammateGitIcon: string = "call_split";
  public static readonly teammatePullRequestsIcon: string = "merge";
  public static readonly teammateDocumentsIcon: string = "description";
  public static readonly teammatePageIcon: string = "web";
  public static readonly teammateCanvasIcon: string = "dashboard";
  public static readonly teammateWorkReading: string = "Reading…";
  public static readonly teammateNoBranch: string = "No branch checked out";
  public static readonly teammateNoFolder: string = "No working folder yet";
  public static readonly teammateNoChanges: string = "No changes";
  public static readonly teammateNoUpstream: string = "No upstream branch";
  public static readonly teammateGitMissing: string = "The Git module isn't installed";
  public static readonly teammateGitHubMissing: string = "The GitHub module isn't installed";
  public static readonly teammateGitHubSignedOut: string = "Sign in to GitHub to see pull requests";
  public static readonly teammateNoPullRequests: string = "No open pull requests";
  public static readonly teammatePullRequestFolderLimit: number = 10;
  public static readonly teammateNoDocuments: string = "None";
  public static readonly teammateNoArtifacts: string = "No artifacts yet";
  public static readonly teammateDraftPullRequest: string = "Draft";
  public static readonly teammateReviewLabels: Readonly<Record<ReviewDecision, string>> = {
    [ReviewDecision.Waiting]: "Waiting for review",
    [ReviewDecision.ChangesRequested]: "Changes requested",
    [ReviewDecision.Approved]: "Approved"
  };
  public static readonly teammateDocumentSeparator: string = ", ";
  public static readonly teammateCiLabels: Readonly<Record<CheckState, CiLabel>> = {
    [CheckState.Failed]: new CiLabel("CI failed", "ci-failed"),
    [CheckState.Running]: new CiLabel("CI running", "ci-running"),
    [CheckState.Queued]: new CiLabel("CI running", "ci-running"),
    [CheckState.Succeeded]: new CiLabel("CI passed", "ci-passed"),
    [CheckState.Neutral]: new CiLabel("CI passed", "ci-passed")
  };
  public static readonly organizationViewField: string = "view";
  public static readonly organizationFocusField: string = "focus";
  public static readonly legacyPinnedChatsField: string = "pinnedConversations";
  public static readonly legacyChatOrderField: string = "conversationOrder";
  public static readonly conversationListIdPrefix: string = "teamrun-conversations-";
  public static readonly pinnedGroupId: string = "teamrun-pinned-group";
  public static readonly projectsGroupId: string = "teamrun-projects-group";
  public static readonly chatsGroupId: string = "teamrun-chats-group";
  public static readonly organizationsGroupId: string = "teamrun-organizations-group";
  public static readonly projectConversationCount: number = 10;
  public static readonly newConversationLabel: string = "New chat";
  public static readonly openProjectLabel: string = "Open folder";
  public static readonly openBrowserLabel: string = "Open browser";
  public static readonly searchConversationsLabel: string = "Search chats";
  public static readonly forgetProjectLabel: string = "Forget project";
  public static readonly renameConversationLabel: string = "Rename";
  public static readonly deleteConversationLabel: string = "Delete";
  public static readonly pinLabel: string = "Pin";
  public static readonly unpinLabel: string = "Unpin";
  public static readonly pinnedTitle: string = "Pinned";
  public static readonly pinnedIcon: string = "keep";
  public static readonly projectsIcon: string = "folder_copy";
  public static readonly chatsTitle: string = "Chats";
  public static readonly chatsIcon: string = "chat";
  public static readonly organizationsTitle: string = "Organizations";
  public static readonly organizationsIcon: string = "corporate_fare";
  public static readonly departmentPathSeparator: string = " › ";
  public static readonly openOrganizationLabel: string = "Open organization";
  public static readonly renameOrganizationTitle: string = "Rename organization";
  public static readonly newOrganizationTitle: string = "New organization";
  public static readonly organizationNameFieldLabel: string = "Name";
  public static readonly organizationNameMaxLength: number = 100;
  public static readonly controlCharacterPattern: RegExp = /[\p{Cc}\p{Zl}\p{Zp}]/u;
  public static readonly nameHasControlCharacter: string = "A name can't hold a tab, a line break or another control character.";
  public static readonly setOrganizationFolderLabel: string = "Set the default folder…";
  public static readonly changeOrganizationFolderLabel: string = "Change the default folder…";
  public static readonly clearOrganizationFolderLabel: string = "Clear the default folder";
  public static readonly deleteOrganizationTitle: string = "Delete organization";
  public static readonly noProjects: string = "Open a folder to start.";
  public static readonly noConversations: string = "No chats yet.";
  public static readonly untitledConversation: string = "Untitled";
  public static readonly workingLabel: string = "Working";
  public static readonly awaitingApprovalLabel: string = "Waiting for permission";
  public static readonly awaitingAnswerLabel: string = "Waiting for your answer";
  public static readonly awaitingApprovalGlyph: string = "front_hand";
  public static readonly awaitingAnswerGlyph: string = "help";
  public static readonly rowMenuLabel: string = "More";
  public static readonly waitingMessagesLabel: string = "Waiting messages";
  public static readonly editWaitingLabel: string = "Edit";
  public static readonly sendWaitingNowLabel: string = "Send now";
  public static readonly removeWaitingLabel: string = "Remove";
  public static readonly deliveryMenuLabel: string = "Other ways to send";
  public static readonly saveWaitingLabel: string = "Save the waiting message";
  public static readonly cancelEditingLabel: string = "Cancel";
  public static readonly editingWaitingNote: string = "Editing a waiting message. Its files stay as they are.";
  public static readonly editingFilesRefused: string = "Files can't be added to a waiting message. Send them in a new message once the edit is saved.";
  public static readonly deliveryGlyphs: Readonly<Record<MessageDelivery, string>> = {
    [MessageDelivery.Steer]: "subdirectory_arrow_right",
    [MessageDelivery.Queue]: "queue",
    [MessageDelivery.StopAndSend]: "arrow_upward"
  };
  public static readonly steerTurnAction: string = "read a message during its reply";
  public static readonly deliveryLabels: Readonly<Record<MessageDelivery, string>> = {
    [MessageDelivery.Steer]: "Steer",
    [MessageDelivery.Queue]: "Queue",
    [MessageDelivery.StopAndSend]: "Stop and send"
  };
  public static readonly treeMoveShortcuts: string = "Control+Shift+ArrowUp Control+Shift+ArrowDown";
  public static readonly macTreeMoveShortcuts: string = "Meta+Shift+ArrowUp Meta+Shift+ArrowDown";
  public static readonly treeMoveGroup: string = "teamrun-tree-move";
  public static readonly renameKey: string = "F2";
  public static readonly showMoreKeyPrefix: string = "more:";
  public static readonly noConversationsKeyPrefix: string = "none:";
  public static readonly chatsShowMoreKey: string = "more:chats";
  public static readonly chatsOrderKey: string = "chats";
  public static readonly renameTitle: string = "Rename chat";
  public static readonly renameFieldLabel: string = "Title";
  public static readonly deleteTitle: string = "Delete chat";
  public static readonly moveToProjectLabel: string = "Move to project…";
  public static readonly moveToAnotherProjectLabel: string = "Move to another project…";
  public static readonly moveToFolderLabel: string = "Move to a folder…";
  public static readonly moveTitle: string = "Move chat to a project";
  public static readonly moveConfirmLabel: string = "Move";
  public static readonly moveToProjectIcon: string = "drive_file_move";
  public static readonly attachFolderLabel: string = "Attach a folder…";
  public static readonly replaceFolderLabel: string = "Replace the folder…";
  public static readonly detachFolderLabel: string = "Detach the folder";
  public static readonly attachFolderIcon: string = "folder_open";
  public static readonly detachFolderIcon: string = "folder_off";
  public static readonly replaceFolderTitle: string = "Replace the attached folder";
  public static readonly replaceFolderConfirmLabel: string = "Replace";
  public static readonly forgetTitle: string = "Forget project";
  public static readonly forgetConfirmLabel: string = "Forget";
  public static readonly rewindLabel: string = "Rewind to here";
  public static readonly rewindGlyph: string = "history";
  public static readonly messageStatusLabels: Readonly<Record<MessageStatus, string | null>> = {
    [MessageStatus.Pending]: null,
    [MessageStatus.Running]: null,
    [MessageStatus.AwaitingApproval]: Resources.awaitingApprovalLabel,
    [MessageStatus.Completed]: null,
    [MessageStatus.Failed]: "Failed",
    [MessageStatus.Cancelled]: "Cancelled",
    [MessageStatus.Interrupted]: "Interrupted"
  };
  public static readonly rewindTitle: string = "Rewind the chat";
  public static readonly rewindWithinSessionAction: string = "rewind within its session";
  public static readonly rewindRemovedText: string = "This message and everything after it will be removed.";
  public static readonly rewindKeptText: string =
    "The next reply keeps the provider session when it can; otherwise it starts a fresh session that is told what was said before.";
  public static readonly restoreFilesLabel: string = "Also put the project's files back to before this message (git projects, when a snapshot exists)";
  public static readonly rewindConfirmLabel: string = "Rewind";
  public static readonly replaceDraftTitle: string = "Replace your unsent message";
  public static readonly replaceDraftText: string = "The composer holds a message you haven't sent. Put the rewound message in its place?";
  public static readonly replaceDraftLabel: string = "Replace";
  public static readonly closeLabel: string = "Close";
  public static readonly saveLabel: string = "Save";
  public static readonly dismissLabel: string = "Dismiss";
  public static readonly newConversationIcon: string = "edit_square";
  public static readonly openProjectIcon: string = "folder_open";
  public static readonly openBrowserIcon: string = "language";
  public static readonly searchIcon: string = "search";
  public static readonly moreIcon: string = "more_vert";
  public static readonly expandedIcon: string = "expand_more";
  public static readonly collapsedIcon: string = "chevron_right";
  public static readonly addIcon: string = "add";
  public static readonly forgetIcon: string = "delete";
  public static readonly folderMissingIcon: string = "folder_off";
  public static readonly folderMissingLabel: string = "Folder missing or unreachable";
  public static readonly editIcon: string = "edit";
  public static readonly pinIcon: string = "keep";
  public static readonly unpinIcon: string = "keep_off";
  public static readonly closeIcon: string = "close";
  public static readonly providerMenuIcon: string = "more_horiz";
  public static readonly enableProviderIcon: string = "check_circle";
  public static readonly approvalRequesterKind: string = "Teammate";
  public static readonly approvalDecidedBy: string = "You";
  public static readonly approvalHeadings: Readonly<Record<ApprovalKind, string>> = {
    [ApprovalKind.Command]: "Run a command",
    [ApprovalKind.FileChange]: "Change files",
    [ApprovalKind.Tool]: "Use a tool",
    [ApprovalKind.Question]: "Answer questions",
    [ApprovalKind.Permission]: "Allow a change"
  };
  public static readonly approvalKindNames: Readonly<Record<ApprovalKind, string | null>> = {
    [ApprovalKind.Command]: "command",
    [ApprovalKind.FileChange]: "file change",
    [ApprovalKind.Tool]: "tool",
    [ApprovalKind.Question]: null,
    [ApprovalKind.Permission]: null
  };
  public static readonly permissionModuleNames: Readonly<Record<string, string>> = {
    [GitNames.moduleId]: "Git",
    [GitHubNames.moduleId]: "GitHub",
    [Resources.browserModuleId]: "Browser",
    [Resources.computerUseModuleId]: "Computer use",
    [Resources.moduleId]: "TeamRun"
  };
  public static readonly permissionWaitMilliseconds: number = 300_000;
  public static readonly secretDetailValue: string = "hidden";
  public static readonly answerOptionId: string = "answer";
  public static readonly skipOptionId: string = "skip";
  public static readonly approvalIdAttribute: string = "data-nol-teamrun-approval";
  public static readonly replyArticleSelector: string = "[role='article']";
  public static readonly questionControlSelector: string = "nol-teamrun-question-card :is(input:not([aria-disabled='true']), button):not(:disabled)";
  public static readonly questionPickAny: string = "Pick any";
  public static readonly questionOtherPlaceholder: string = "Other…";
  public static readonly questionTextPlaceholder: string = "Your answer";
  public static readonly questionAnswerLabel: string = "Answer";
  public static readonly questionSkipLabel: string = "Skip";
  public static readonly questionActionsLabel: string = "Answer or skip";
  public static readonly questionSending: string = "Sending your answer";
  public static readonly questionSendFailed: string = "Your answer couldn't be sent. Try again.";
  public static readonly questionHiddenAnswer: string = "Hidden";
  public static readonly questionAnswerSeparator: string = ", ";
  public static readonly questionIdPrefix: string = "nol-teamrun-question-";
  public static readonly questionSendingKeyPrefix: string = "nol-teamrun-question-sending-";
  public static readonly replyEndedKeyPrefix: string = "nol-teamrun-reply-ended-";
  public static readonly approvalAskedKeyPrefix: string = "nol-teamrun-approval-asked-";
  public static readonly historyLabel: string = "Messages";
  public static readonly emptyHistoryText: string = "Say what you need; the team replies here.";
  public static readonly noConversationText: string = "Choose or create a chat.";
  public static readonly activitySlot: string = "activity";
  public static readonly stepsSlot: string = "steps";
  public static readonly filesSlot: string = "files";
  public static readonly pagesSlot: string = "pages";
  public static readonly writtenImagesSlot: string = "writtenImages";
  public static readonly attachedImagesSlot: string = "attachedImages";
  public static readonly wakeNoteSlot: string = "wakeNote";
  public static readonly wakeReceivedSlot: string = "wakeReceived";
  public static readonly resumeNoteSlot: string = "resumeNote";
  public static readonly sustainNoteSlot: string = "sustainNote";
  public static readonly planBlockSlot: string = "planBlock";
  public static readonly planActionsInset: string = "calc(var(--nol-space-2) + var(--nol-border-width) + (var(--nol-code-header-height) - var(--nol-icon-button-target)) / 2)";
  public static readonly planCardSelector: string = "nol-teamrun-plan-card";
  public static readonly markdownLinkSelector: string = "a.nol-markdown-link";
  public static readonly planUsageStatusItem: string = "teamrun.planUsage";
  public static readonly planUsageGlyph: string = "data_usage";
  public static readonly planLimitGlyph: string = "warning";
  public static readonly planWarningPercent: number = 75;
  public static readonly planCriticalPercent: number = 90;
  public static readonly wholePercent: number = 100;
  public static readonly organizationUsageWarning: number = 0.8;
  public static readonly planUsageLabel: string = "Plan usage";
  public static readonly nearPlanLimitLabel: string = "Near the plan limit";
  public static readonly usedUpLabel: string = "Used up";
  public static readonly noPlanUsageLabel: string = "Not reported";
  public static readonly noPlanUsageMark: string = "—";
  public static readonly noUsageReportedLabel: string = "No usage reported";
  public static readonly unlimitedPlanLabel: string = "Unlimited";
  public static readonly noResetLabel: string = "no reset time reported";
  public static readonly shownPlanWindows: number = 2;
  public static readonly dayMilliseconds: number = 86_400_000;
  public static readonly weekMilliseconds: number = 604_800_000;
  public static readonly minuteMilliseconds: number = 60_000;
  public static readonly hourMinutes: number = 60;
  public static readonly dayHours: number = 24;
  public static readonly usageNumberLocale: string = "en-US";
  public static readonly smallCostUsd: number = 0.01;
  public static readonly smallCostDigits: number = 4;
  public static readonly costDigits: number = 2;
  public static readonly compactCountOptions: Intl.NumberFormatOptions = { notation: "compact" };
  public static readonly newInputKinds: readonly string[] = ["claude", "codex"];
  public static readonly statsGlyph: string = "query_stats";
  public static readonly showStatsLabel: string = "Show stats";
  public static readonly replyStatsLabel: string = "Reply stats";
  public static readonly tokensInLabel: string = "Tokens in";
  public static readonly fromCacheLabel: string = "From cache";
  public static readonly writtenToCacheLabel: string = "Written to cache";
  public static readonly newInputLabel: string = "New";
  public static readonly tokensOutLabel: string = "Tokens out";
  public static readonly reasoningLabel: string = "Reasoning";
  public static readonly costLabel: string = "Cost";
  public static readonly contextLabel: string = "Context";
  public static readonly timeWorkedLabel: string = "Time worked";
  public static readonly noTokensReportedText: string = "The provider reported no token counts for this reply.";
  public static readonly fullPercent: number = 100;
  public static readonly planWindowLabels: Readonly<Record<PlanWindowName, string>> = {
    [PlanWindowName.FiveHour]: "5-hour",
    [PlanWindowName.Weekly]: "Weekly",
    [PlanWindowName.WeeklyOpus]: "Weekly Opus",
    [PlanWindowName.WeeklySonnet]: "Weekly Sonnet",
    [PlanWindowName.MonthlyPremiumRequests]: "Monthly premium requests",
    [PlanWindowName.MonthlyChatRequests]: "Monthly chat requests",
    [PlanWindowName.MonthlyCompletions]: "Monthly completions",
    [PlanWindowName.WeeklyCredits]: "Weekly credits",
    [PlanWindowName.MonthlyCredits]: "Monthly credits",
    [PlanWindowName.Credits]: "Credits",
    [PlanWindowName.Quota]: "Quota"
  };
  public static readonly planWindowShortLabels: Readonly<Record<PlanWindowName, string>> = {
    [PlanWindowName.FiveHour]: "5h",
    [PlanWindowName.Weekly]: "Week",
    [PlanWindowName.WeeklyOpus]: "Opus week",
    [PlanWindowName.WeeklySonnet]: "Sonnet week",
    [PlanWindowName.MonthlyPremiumRequests]: "Premium",
    [PlanWindowName.MonthlyChatRequests]: "Chat",
    [PlanWindowName.MonthlyCompletions]: "Completions",
    [PlanWindowName.WeeklyCredits]: "Credits week",
    [PlanWindowName.MonthlyCredits]: "Credits month",
    [PlanWindowName.Credits]: "Credits",
    [PlanWindowName.Quota]: "Quota"
  };
  public static readonly replyErrorGlyph: string = "error";
  public static readonly cancelReplyLabel: string = "Stop";
  public static readonly chooseModelLabel: string = "Choose a model";
  public static readonly programFocusOrigin: FocusOrigin = "program";
  public static readonly personAuthorId: string = "person";
  public static readonly teammateColorCount: number = 8;
  public static readonly teammateColorHashOffset: number = 2166136261;
  public static readonly teammateColorHashPrime: number = 16777619;
  public static readonly historyEstimate: number = 160;
  public static readonly historyHeldRows: number = 1_000;
  public static readonly historyReadAhead: number = 8_000;
  public static readonly historyWarmUpTag: string = "nol-teamrun-history-warm-up";
  public static readonly historyWarmUpQuestion: string = "Warm up";
  public static readonly historyWarmUpReply: string = "Warm up with `code`, **bold** and a list:\n\n- one\n- two";
  public static readonly youLabel: string = "You";
  public static readonly organizationInboxTitle: string = "Inbox";
  public static readonly organizationChatsLabel: string = "Chats";
  public static readonly organizationRecipientsLabel: string = "Recipients";
  public static readonly organizationRecipientNoReply: string = "No reply yet";
  public static readonly organizationRecipientStatusLabels: Readonly<Record<MessageStatus, string>> = {
    [MessageStatus.Pending]: "Queued",
    [MessageStatus.Running]: "Replying",
    [MessageStatus.AwaitingApproval]: Resources.awaitingApprovalLabel,
    [MessageStatus.Completed]: "Replied",
    [MessageStatus.Failed]: "Failed",
    [MessageStatus.Cancelled]: "Stopped",
    [MessageStatus.Interrupted]: "Interrupted"
  };
  public static readonly organizationAllRead: string = "All read";
  public static readonly organizationNoMessages: string = "No messages yet";
  public static readonly organizationChooseTarget: string = "Choose whom to message.";
  public static readonly organizationLeadersTitle: string = "All leaders and your direct reports";
  public static readonly organizationLeadersChat: string = "Chat with all leaders and your direct reports";
  public static readonly organizationEveryoneTitle: string = "Everyone";
  public static readonly organizationDeletedDepartment: string = "Deleted unit";
  public static readonly organizationRemovedTeammate: string = "Removed teammate";
  public static readonly organizationGroupIcon: string = "forum";
  public static readonly senderChatGone: string = "from a deleted chat";
  public static readonly wakeReceivedLabel: string = "Received a message from";
  public static readonly wakeEndedLabel: string = "No reply came back from";
  public static readonly wakeLostText: string = "TeamRun restarted before the work sent there ended.";
  public static readonly wakeChatDeletedText: string = "The chat was deleted before the work sent there ended.";
  public static readonly wakeTaskLostText: string = "TeamRun restarted before it ended.";
  public static readonly wakeCommandLostText: string = "TeamRun restarted before it ended, so it was stopped.";
  public static readonly wakeOldTaskLabel: string = "A sub-agent or background command of this chat ended";
  public static readonly wakeChatGone: string = "a deleted chat";
  public static readonly wakeRepliesLabel: string = "The message received";
  public static readonly wakeNoReplyLabel: string = "Why no reply came back";
  public static readonly wakeCommandOutputLabel: string = "The command's last lines";
  public static readonly wakeSubAgentResultLabel: string = "The sub-agent's summary";
  public static readonly wakeTaskLostLabel: string = "Why it didn't end";
  public static readonly thinkingLabel: string = "Thinking…";
  public static readonly savingCheckpointLabel: string = "Saving a checkpoint…";
  public static readonly stoppingLabel: string = "Stopping…";
  public static readonly waitingForTurnLabel: string = "Waiting for its turn";
  public static readonly didNotStartLabel: string = "Did not start";
  public static readonly stepLabel: string = "Step";
  public static readonly deniedStepLabel: string = "Denied";
  public static readonly showMoreLabel: string = "Show more";
  public static readonly showLessLabel: string = "Show less";
  public static readonly previewLineCount: number = 6;
  public static readonly stepGlyphs: Readonly<Record<StepCategory, string>> = {
    [StepCategory.Command]: "terminal",
    [StepCategory.Edit]: "edit_document",
    [StepCategory.Read]: "description",
    [StepCategory.Search]: "search",
    [StepCategory.Thought]: "psychology",
    [StepCategory.Other]: "build"
  };
  public static readonly detailGlyphs: Readonly<Partial<Record<DetailKind, string>>> = {
    [DetailKind.Error]: "error",
    [DetailKind.Note]: "info"
  };
  public static readonly textGlyph: string = "notes";
  public static readonly planStepStatuses: Readonly<Record<ReplyPlanStepStatus, PlanStepStatus>> = {
    [ReplyPlanStepStatus.Pending]: PlanStepStatus.Pending,
    [ReplyPlanStepStatus.InProgress]: PlanStepStatus.InProgress,
    [ReplyPlanStepStatus.Completed]: PlanStepStatus.Completed
  };
  public static readonly subAgentStatuses: Readonly<Record<SubAgentStatus, ToolCallStatus>> = {
    [SubAgentStatus.Running]: ToolCallStatus.Running,
    [SubAgentStatus.Completed]: ToolCallStatus.Succeeded,
    [SubAgentStatus.Failed]: ToolCallStatus.Failed,
    [SubAgentStatus.Stopped]: ToolCallStatus.Cancelled
  };
  public static readonly browserStepPhases: Readonly<Record<ToolCallStatus, BrowserStepPhase>> = {
    [ToolCallStatus.Pending]: BrowserStepPhase.Running,
    [ToolCallStatus.AwaitingPermission]: BrowserStepPhase.Running,
    [ToolCallStatus.AwaitingAnswer]: BrowserStepPhase.Running,
    [ToolCallStatus.Running]: BrowserStepPhase.Running,
    [ToolCallStatus.Succeeded]: BrowserStepPhase.Done,
    [ToolCallStatus.Failed]: BrowserStepPhase.Failed,
    [ToolCallStatus.Cancelled]: BrowserStepPhase.Failed,
    [ToolCallStatus.Denied]: BrowserStepPhase.Denied
  };
  public static readonly subAgentField: string = "subAgent";
  public static readonly activityChildrenStep: number = 20;
  public static readonly paragraphSeparator: string = "\n\n";
  public static readonly paragraphBreak: RegExp = /\n\s*\n/;
  public static readonly reducedMotionQuery: string = "(prefers-reduced-motion: reduce)";
  public static readonly accentProperty: string = "--nol-accent";
  public static readonly styleAttribute: string = "style";
  public static readonly borderColorPattern: RegExp = /^#[0-9A-Fa-f]{6}$/;
  public static readonly sentenceEnd: RegExp = /[.!?][*_~`]*(?=\s|$)/;
  public static readonly preloadedCodeLanguages: readonly string[] = ["ts", "bash", "json", "js", "python", "diff", "yaml", "html", "css"];
  public static readonly markdownEscapePattern: RegExp = /\\([!-/:-@[-`{-~])/g;
  public static readonly markdownEscapeBase: number = 0xe000;
  public static readonly markdownEscapedPattern: RegExp = /[\ue000-\ue07f]/g;
  public static readonly markdownEscapeMark: string = "\\";
  public static readonly markdownCodeSpanPattern: RegExp = /(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g;
  public static readonly markdownCodeSpacePattern: RegExp = /^ (?=[\s\S]*\S)([\s\S]*) $/;
  public static readonly markdownFencePattern: RegExp = /^ {0,3}(`{3,}|~{3,})/;
  public static readonly markdownIndentedCodePattern: RegExp = /^(?: {4}|\t)/;
  public static readonly markdownLiteralPattern: RegExp = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)|!?\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])|<[^<>\s]+>|\b(?:[a-z][a-z\d+.-]*:\/\/|www\.)\S+/gi;
  public static readonly markdownOpenLiteralPattern: RegExp = /`|\[[^\]]*(?:\]|\]\([^)]*|\]\[[^\]]*)?$|<[^<>\s]*$/;
  public static readonly markdownPunctuationPattern: RegExp = /[!-/:-@[-`{-~]/g;
  public static readonly markdownPunctuationEscape: string = "\\$&";
  public static readonly chatLinkScheme: string = "teamrun-chat";
  public static readonly chatLinkPrefix: string = `${Resources.chatLinkScheme}:`;
  public static readonly chatIdTail: number = 37;
  public static readonly chatIdPattern: RegExp = /(?<![\w\-/\\.:@#])[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}(?![\w\-/\\]|\.\w)/gi;
  public static readonly markdownLinkPatterns: readonly RegExp[] = [
    /!\[([^\]]*)\](?:\([^)]*\)|\[[^\]]*\])/g,
    /\[([^\]]+)\](?:\([^)]*\)|\[[^\]]*\])/g,
    /<((?:https?|mailto):[^<>\s]+)>/g
  ];
  public static readonly markdownEmphasisPatterns: readonly RegExp[] = [
    /\*\*(?=\S)([\s\S]*?\S)\*\*/g,
    /(?<![\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu,
    /~~(?=\S)([\s\S]*?\S)~~/g,
    /\*(?=\S)([\s\S]*?\S)\*/g,
    /(?<![\p{L}\p{N}_])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/gu
  ];
  public static readonly markdownMarkedText: string = "$1";
  public static readonly projectRootMarker: string = ".";
  public static readonly toolField: string = "tool";
  public static readonly titleField: string = "title";
  public static readonly toolUseIdField: string = "toolUseId";
  public static readonly isErrorField: string = "isError";
  public static readonly deniedField: string = "denied";
  public static readonly exitCodeField: string = "exitCode";
  public static readonly commandStatusField: string = "status";
  public static readonly endedStepStatuses: readonly string[] = ["completed", "failed", "declined"];
  public static readonly failedStepStatuses: readonly string[] = ["failed"];
  public static readonly declinedStepStatus: string = "declined";
  public static readonly itemTypeField: string = "itemType";
  public static readonly imageGenerationItemType: string = "imageGeneration";
  public static readonly savedPathField: string = "savedPath";
  public static readonly storedPathField: string = "storedPath";
  public static readonly browserToolPrefix: string = "browser_";
  public static readonly browserNavigateTool: string = "browser_navigate";
  public static readonly browserClickTool: string = "browser_click";
  public static readonly browserTypeTool: string = "browser_type";
  public static readonly browserPressKeyTool: string = "browser_press_key";
  public static readonly browserPageField: string = "page";
  public static readonly browserElementField: string = "element";
  public static readonly browserUrlField: string = "url";
  public static readonly browserNameField: string = "name";
  public static readonly browserIsSecretField: string = "isSecret";
  public static readonly browserKeyField: string = "key";
  public static readonly browserActionField: string = "action";
  public static readonly browserTextField: string = "text";
  public static readonly browserLineReads: ReadonlyMap<string, LowRiskReadWords> = new Map([
    ["browser_snapshot", new LowRiskReadWords("read", "read the page")],
    ["browser_screenshot", new LowRiskReadWords("took a screenshot of", "took a screenshot")],
    ["browser_console", new LowRiskReadWords("read the console of", "read the console")],
    ["browser_wait_for", new LowRiskReadWords("waited on", "waited")]
  ]);
  public static readonly staleFailureCode: string = "Stale";
  public static readonly deniedFailureCode: string = "Denied";
  public static readonly browserStaleReferenceCode: string = "browser.staleReference";
  public static readonly browserOriginRefusedCode: string = "browser.originRefused";
  public static readonly browserSchemePattern: RegExp = /^[a-z][a-z0-9+.-]*:\/\//iu;
  public static readonly browserUnnamedElement: string = "an element";
  public static readonly browserThePage: string = "the page";
  public static readonly browserDeniedNote: string = "you denied it";
  public static readonly permissionDetailLines: number = 12;
  public static readonly browserLowRisk: string = "Low";
  public static readonly browserLowRiskNote: string = "low risk, allowed";
  public static readonly browserAllowedEarlierNote: string = "allowed earlier";
  public static readonly browserDeniedEarlierNote: string = "denied earlier";
  public static readonly browserModeAllowedNote: string = "allowed by this chat's mode";
  public static readonly browserDeniedUnaskedNote: string = "denied without asking";
  public static readonly browserAllowedDecisions: readonly string[] = ["AllowedOnce", "AllowedAlways"];
  public static readonly browserAnsweredDecisions: readonly string[] = ["AllowedOnce", "AllowedAlways", "Denied", "DeniedAlways"];
  public static readonly browserDecisionNotes: ReadonlyMap<string, string> = new Map([
    ["AllowedOnce", "you allowed it"],
    ["AllowedAlways", "you allowed it from now on"],
    ["Denied", Resources.browserDeniedNote],
    ["DeniedAlways", "you denied it from now on"],
    ["Expired", "nobody answered"],
    ["Withdrawn", "stopped before an answer"],
    ["TakenOver", "you typed it yourself"]
  ]);
  public static readonly browserHiddenNote: string = "hidden";
  public static readonly stepWaitingNote: string = "waiting for your answer";
  public static readonly browserNotAllowedNote: string = "not an allowed site";
  public static readonly browserStepSeparator: string = " \u00b7 ";
  public static readonly lowRiskLead: string = "Low risk, allowed without asking: ";
  public static readonly lowRiskIcon: string = "verified_user";
  public static readonly chatPageNotShown: string = "Couldn't bring the chat's page forward.";
  public static readonly imageDataField: string = "imageData";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly failureField: string = "failure";
  public static readonly failureTypeField: string = "type";
  public static readonly usageLimitFailure: string = "usageLimitExceeded";
  public static readonly failureMessageField: string = "message";
  public static readonly sourceField: string = "source";
  public static readonly workingTreeSource: string = "workingTree";
  public static readonly handOffSource: string = "handOff";
  public static readonly handedOffField: string = "handedOff";
  public static readonly usageHandedOffGlyph: string = "arrow_forward";
  public static readonly usageStoppedGlyph: string = "info";
  public static readonly steeredIntoField: string = "steeredInto";
  public static readonly wakeSource: string = "wake";
  public static readonly resumeSource: string = "resume";
  public static readonly sustainSource: string = "sustain";
  public static readonly sustainStoppedField: string = "stopped";
  public static readonly sustainCarriedField: string = "carried";
  public static readonly sustainReadsField: string = "reads";
  public static readonly sustainHandoverLabel: string = "What the handover carried";
  public static readonly sustainHandoverHeading: string = "The handover, the new session's first prompt";
  public static readonly sustainShowHandover: string = "Show handover";
  public static readonly sustainHideHandover: string = "Hide handover";
  public static readonly commandTools: readonly string[] = ["Bash", "PowerShell"];
  public static readonly readTools: readonly string[] = ["Read"];
  public static readonly searchTools: readonly string[] = ["Glob", "Grep", "WebSearch", "WebFetch", "webSearch"];
  public static readonly acpReadKinds: readonly string[] = ["read"];
  public static readonly acpSearchKinds: readonly string[] = ["search", "fetch"];
  public static readonly acpToolCallIdField: string = "toolCallId";
  public static readonly clockIntervalMilliseconds: number = 1000;
  public static readonly flashMilliseconds: number = 1600;
  public static readonly viewMoveEvents: readonly string[] = ["wheel", "touchstart", "pointerdown", "keydown"];
  public static readonly positionSaveMilliseconds: number = 2000;
  public static readonly shownFileCount: number = 3;
  public static readonly editedFilesGlyph: string = "edit_document";
  public static readonly addedChangeKind: string = "add";
  public static readonly deletedChangeKind: string = "delete";
  public static readonly addedFileLabel: string = "Added";
  public static readonly deletedFileLabel: string = "Deleted";
  public static readonly editedFileLabel: string = "Edited";
  public static readonly slash: string = "/";
  public static readonly backslash: string = "\\";
  public static readonly diffAddedPrefix: string = "+";
  public static readonly diffRemovedPrefix: string = "-";
  public static readonly diffContextPrefix: string = " ";
  public static readonly expandDiffLabel: string = "Expand diff";
  public static readonly collapseDiffLabel: string = "Collapse diff";
  public static readonly enableWordWrapLabel: string = "Enable word wrap";
  public static readonly disableWordWrapLabel: string = "Disable word wrap";
  public static readonly wordWrapIcon: string = "wrap_text";
  public static readonly expandIcon: string = "expand_more";
  public static readonly collapseIcon: string = "expand_less";
  public static readonly teammatesDocumentName: string = "teamrun.teammates";
  public static readonly teammatesDocumentInstance: string = "teammates";
  public static readonly teammatesViewIcon: string = "group";
  public static readonly organizationDocumentName: string = "teamrun.organization";
  public static readonly organizationDocumentInstance: string = "my-organization";
  public static readonly organizationOldDocumentInstance: string = "organization";
  public static readonly organizationUnloadedTime: string = "1970-01-01T00:00:00.000Z";
  public static readonly organizationViewIcon: string = "lan";
  public static readonly providersDocumentName: string = "teamrun.providers";
  public static readonly providersDocumentInstance: string = "providers";
  public static readonly providersViewIcon: string = "key";
  public static readonly mcpServersDocumentName: string = "teamrun.mcpServers";
  public static readonly abilitiesPageName: string = "teamrun.abilities";
  public static readonly abilitiesProviderLabel: string = "Provider";
  public static readonly abilitiesNoProviders: string = "TeamRun hasn't read its providers yet.";
  public static readonly abilityGroupChats: string = "Chats";
  public static readonly abilityGroupChoices: string = "Choices";
  public static readonly abilityGroupModes: string = "Modes and approvals";
  public static readonly abilityGroupReply: string = "In a reply";
  public static readonly abilityGroupSubAgents: string = "Sub-agents and commands";
  public static readonly abilityGroupMcpServers: string = "MCP servers";
  public static readonly abilityGroupSignIn: string = "Sign-in and install";
  public static readonly abilityGroupCommands: string = "/ commands";
  public static readonly sentenceEnds: string = ".!?";
  public static readonly mcpServersDocumentInstance: string = "mcpServers";
  public static readonly mcpServersViewIcon: string = "hub";
  public static readonly computerUseGrantsDocumentName: string = "teamrun.computerUseGrants";
  public static readonly computerUseGrantsDocumentInstance: string = "computerUseGrants";
  public static readonly computerUseGrantsViewIcon: string = "desktop_windows";
  public static readonly outsideDocumentName: string = "teamrun.outsideConnection";
  public static readonly outsideDocumentInstance: string = "outsideConnection";
  public static readonly outsideViewIcon: string = "hub";
  public static readonly changesViewName: string = "teamrun.changes";
  public static readonly changesTitle: string = "Changes";
  public static readonly changesViewIcon: string = "difference";
  public static readonly activityViewName: string = "teamrun.activity";
  public static readonly activityTitle: string = "Activity";
  public static readonly activityViewIcon: string = "list_alt";
  public static readonly planViewName: string = "teamrun.plan";
  public static readonly planTitle: string = "Plan";
  public static readonly planHeading: RegExp = /^\s*(?:#{1,6}(?:\s|$)|(?![-*+]\s|\d{1,9}[.)]\s)\S[^\n]*\n {0,3}(?:=+|-+)[ \t]*\r?(?:\n|$))/u;
  public static readonly plansTitle: string = "Plans";
  public static readonly planNotApproved: string = "Not approved";
  public static readonly planApproved: string = "Approved";
  public static readonly approvePlanLabel: string = "Approve plan";
  public static readonly planViewIcon: string = "checklist";
  public static readonly backgroundTasksViewName: string = "teamrun.backgroundTasks";
  public static readonly pagesViewName: string = "teamrun.pages";
  public static readonly pagesTitle: string = "Pages";
  public static readonly pagesViewIcon: string = "web_asset";
  public static readonly backgroundTasksTitle: string = "Background tasks";
  public static readonly backgroundTasksViewIcon: string = "pending_actions";
  public static readonly noBackgroundTasksText: string = "No background tasks in this chat.";
  public static readonly backgroundTasksIdPrefix: string = "nol-teamrun-tasks-";
  public static readonly composerReachIdPrefix: string = "nol-teamrun-composer-reach-";
  public static readonly backgroundTasksHeadingLevel: number = 3;
  public static readonly runningTasksTitle: string = "Running";
  public static readonly finishedTasksTitle: string = "Finished";
  public static readonly finishedTasksShown: number = 10;
  public static readonly listFollowDistance: number = 120;
  public static readonly backgroundTaskPageSize: number = 100;
  public static readonly showMoreTasksLabel: string = "Show more";
  public static readonly clearFinishedTasksLabel: string = "Clear finished tasks";
  public static readonly clearFinishedTasksIcon: string = "clear_all";
  public static readonly taskToggleSelector: string = ".nol-tool-call-toggle";
  public static readonly subAgentsViewName: string = "teamrun.subAgents";
  public static readonly subAgentsTitle: string = "Sub-agents";
  public static readonly subAgentsViewIcon: string = "device_hub";
  public static readonly noSubAgentsText: string = "No sub-agents in this chat.";
  public static readonly subAgentsIdPrefix: string = "nol-teamrun-sub-agents-";
  public static readonly openTranscriptLabel: string = "Open transcript";
  public static readonly backgroundSubAgentLabel: string = "Background";
  public static readonly stopSubAgentLabel: string = "Stop sub-agent";
  public static readonly subAgentStepSelector: string = "li.sub-agent-step";
  public static readonly subAgentStatusGlyphs: Readonly<Record<SubAgentStatus, string>> = {
    [SubAgentStatus.Running]: "progress_activity",
    [SubAgentStatus.Completed]: "check_circle",
    [SubAgentStatus.Failed]: "error",
    [SubAgentStatus.Stopped]: "block"
  };
  public static readonly subAgentEndLabels: Readonly<Record<SubAgentStatus, string | null>> = {
    [SubAgentStatus.Running]: null,
    [SubAgentStatus.Completed]: null,
    [SubAgentStatus.Failed]: "Failed",
    [SubAgentStatus.Stopped]: "Cancelled"
  };
  public static readonly compactCountFormat: Intl.NumberFormatOptions = { notation: "compact", maximumFractionDigits: 1 };
  public static readonly taskIdAttribute: string = "data-nol-teamrun-task";
  public static readonly noChangesText: string = "No files were edited in this chat.";
  public static readonly noFolderChangesText: string = "No files changed in this chat's folder.";
  public static readonly noActivityText: string = "No activity in this chat.";
  public static readonly noPlanText: string = "No plans in this chat.";
  public static readonly replyPanelTitles: Readonly<Record<ReplyPanel, string>> = {
    [ReplyPanel.Activity]: Resources.activityTitle,
    [ReplyPanel.Changes]: Resources.changesTitle,
    [ReplyPanel.Plan]: Resources.plansTitle,
    [ReplyPanel.SubAgents]: Resources.subAgentsTitle
  };
  public static readonly replyPanelEmptyTexts: Readonly<Record<ReplyPanel, string>> = {
    [ReplyPanel.Activity]: Resources.noActivityText,
    [ReplyPanel.Changes]: Resources.noChangesText,
    [ReplyPanel.Plan]: Resources.noPlanText,
    [ReplyPanel.SubAgents]: Resources.noSubAgentsText
  };
  public static readonly replyPanelPages: Readonly<Record<ReplyPanel, MethodName>> = {
    [ReplyPanel.Activity]: MethodName.MessageActivityPage,
    [ReplyPanel.Changes]: MethodName.MessageChangesPage,
    [ReplyPanel.Plan]: MethodName.MessagePlanPage,
    [ReplyPanel.SubAgents]: MethodName.MessageSubAgentsPage
  };
  public static readonly replyHistoryLoading: string = "Loading…";
  public static readonly replyHistoryRetry: string = "Retry";
  public static readonly replyPageSize: number = 50;
  public static readonly replyEdgeRows: number = 10;
  public static readonly replyEstimate: number = 120;
  public static readonly replyRefreshDelay: number = 120;
  public static readonly changedDetailsLimit: number = 1_000;
  public static readonly showTeammatesCommand: string = "teamrun.showTeammates";
  public static readonly showTeammatesTitle: string = "Manage teammates";
  public static readonly showOrganizationCommand: string = "teamrun.showOrganization";
  public static readonly showOrganizationTitle: string = "Show organization";
  public static readonly chooseDefaultTeammateCommand: string = "teamrun.chooseDefaultTeammate";
  public static readonly chooseDefaultTeammateTitle: string = "Choose default teammate";
  public static readonly showProvidersCommand: string = "teamrun.showProviders";
  public static readonly showProvidersTitle: string = "Manage providers";
  public static readonly showMcpServersCommand: string = "teamrun.showMcpServers";
  public static readonly showMcpServersTitle: string = "Manage MCP servers";
  public static readonly showComputerUseGrantsCommand: string = "teamrun.showComputerUseGrants";
  public static readonly showComputerUseGrantsTitle: string = "Manage computer use";
  public static readonly showOutsideSessionsCommand: string = "teamrun.showOutsideSessions";
  public static readonly showOutsideSessionsTitle: string = "Connect outside agents";
  public static readonly showDataFolderCommand: string = "teamrun.showDataFolder";
  public static readonly showDataFolderTitle: string = "Show data folder";
  public static readonly dataFolderIcon: string = "folder_open";
  public static readonly newChatTerminalCommand: string = "teamrun.newChatTerminal";
  public static readonly newChatTerminalTitle: string = "New chat terminal";
  public static readonly newChatTerminalIcon: string = "terminal";
  public static readonly newChatTerminalKey: string = "Mod+Alt+Backquote";
  public static readonly shellRunKinds: ReadonlyMap<string, readonly TerminalShellKind[]> = new Map([
    ["bash", [TerminalShellKind.Bash]],
    ["sh", [TerminalShellKind.Bash, TerminalShellKind.Zsh]],
    ["shell", [TerminalShellKind.Bash, TerminalShellKind.Zsh]],
    ["zsh", [TerminalShellKind.Zsh]],
    ["powershell", [TerminalShellKind.PowerShell]],
    ["pwsh", [TerminalShellKind.PowerShell]],
    ["cmd", [TerminalShellKind.CommandPrompt]]
  ]);
  public static readonly shellRunRefused: string =
    "The code block can't run as written: it's too long, or it holds a control or invisible character that would make it read differently from what runs.";
  public static readonly shellRunEmpty: string = "The code block is empty, so there's nothing to run.";
  public static readonly shellRunBusy: string = "The chat's terminal is still running a command.";
  public static readonly shellRunStop: string = "Stop it and run";
  public static readonly shellRunNewTerminal: string = "Run in a new terminal";
  public static readonly inlineTerminalComposerKeyCode: string = "Backquote";
  public static readonly keyDownEvent: "keydown" = "keydown";
  public static readonly windowsPlatformPrefix: string = "Win";
  public static readonly windowsProviderShellKinds: readonly TerminalShellKind[] = [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt];
  public static readonly macPlatformPrefix: string = "Mac";
  public static readonly macPlatform: string = "darwin";
  public static readonly windowsPlatform: string = "win32";
  public static readonly keySeparator: string = "+";
  public static readonly newConversationCommand: string = "teamrun.newConversation";
  public static readonly newConversationKey: string = "Mod+N";
  public static readonly openProjectCommand: string = "teamrun.openProject";
  public static readonly openProjectKey: string = "Mod+O";
  public static readonly openBrowserCommand: string = "teamrun.openBrowser";
  public static readonly searchConversationsCommand: string = "teamrun.searchConversations";
  public static readonly searchConversationsTitle: string = "Search chats";
  public static readonly teammateNamesSeparator: string = ", ";
  public static readonly desktopSearchCommand: string = "desktop.search";
  public static readonly sourceArgument: string = "source";
  public static readonly chatsSearchSource: string = "teamrun.chats";
  public static readonly chatsPlaceholderName: string = "chats";
  public static readonly recentChatsHeading: string = "Recent chats";
  public static readonly messagesSearchSource: string = "teamrun.messages";
  public static readonly messagesSearchLabel: string = "Messages";
  public static readonly messagesPlaceholderName: string = "messages";
  public static readonly messagesSearchHeading: string = "In messages";
  public static readonly messagesSearchIcon: string = "notes";
  public static readonly relativeTime: Intl.RelativeTimeFormat = new Intl.RelativeTimeFormat("en-US", { numeric: "always" });
  public static readonly relativeTimeUnits: readonly RelativeTimeUnit[] = [new RelativeTimeUnit("minute", 1), new RelativeTimeUnit("hour", 60),
    new RelativeTimeUnit("day", 1_440), new RelativeTimeUnit("month", 43_200), new RelativeTimeUnit("year", 525_600)];
  public static readonly focusComposerCommand: string = "teamrun.focusComposer";
  public static readonly focusComposerTitle: string = "Go to the message box";
  public static readonly focusComposerIcon: string = "edit_note";
  public static readonly focusComposerKey: string = "Mod+L";
  public static readonly openChatPageCommand: string = "teamrun.openChatPage";
  public static readonly openChatPageTitle: string = "Open the chat's Browser page";
  public static readonly openChatPageIcon: string = "language";
  public static readonly noChatPageTitle: string = "Open a chat to open its Browser page";
  public static readonly stopReplyCommand: string = "teamrun.stopReply";
  public static readonly stopReplyTitle: string = "Stop the running reply";
  public static readonly stopReplyIcon: string = "stop";
  public static readonly stopReplyKey: string = "Mod+Period";
  public static readonly previousConversationCommand: string = "teamrun.previousConversation";
  public static readonly previousConversationTitle: string = "Previous recent chat";
  public static readonly previousConversationIcon: string = "arrow_upward";
  public static readonly previousConversationKey: string = "Alt+ArrowUp";
  public static readonly nextConversationCommand: string = "teamrun.nextConversation";
  public static readonly nextConversationTitle: string = "Next recent chat";
  public static readonly nextConversationIcon: string = "arrow_downward";
  public static readonly nextConversationKey: string = "Alt+ArrowDown";
  public static readonly moveRowUpCommand: string = "teamrun.moveRowUp";
  public static readonly moveRowUpTitle: string = "Move row up";
  public static readonly moveRowUpIcon: string = "arrow_upward";
  public static readonly moveRowUpKey: string = "Mod+Shift+ArrowUp";
  public static readonly moveRowDownCommand: string = "teamrun.moveRowDown";
  public static readonly moveRowDownTitle: string = "Move row down";
  public static readonly moveRowDownIcon: string = "arrow_downward";
  public static readonly moveRowDownKey: string = "Mod+Shift+ArrowDown";
  public static readonly openChatCommand: string = "teamrun.openChat";
  public static readonly openChatTitle: string = "Open chat";
  public static readonly openChatIcon: string = "chat";
  public static readonly enableProviderCommand: string = "teamrun.enableProvider";
  public static readonly enableProviderTitle: string = "Enable provider";
  public static readonly reloadCommand: string = "teamrun.reload";
  public static readonly reloadTitle: string = "Load TeamRun's data again";
  public static readonly reloadIcon: string = "refresh";
  public static readonly tryAgainLabel: string = "Try again";
  public static readonly chatIdArgument: string = "chatId";
  public static readonly legacyChatIdArgument: string = "conversationId";
  public static readonly providerIdArgument: string = "providerId";
  public static readonly windowIdArgument: string = "windowId";
  public static readonly noticeKeyArgument: string = "noticeKey";
  public static readonly messageNotSentNotice: string = "teamrun.messageNotSent";
  public static readonly chatActionFailedNotice: string = "teamrun.chatActionFailed";
  public static readonly loadFailedNotice: string = "teamrun.loadFailed";
  public static readonly noticeKeySeparator: string = "/";
  public static readonly messageNotSentTitle: string = "Message not sent";
  public static readonly kindsLoad: string = "kinds";
  public static readonly catalogLoad: string = "catalog";
  public static readonly chatLoad: string = "chat";
  public static readonly workingLoad: string = "working";
  public static readonly firstLaunchLoad: string = "firstLaunch";
  public static readonly toolsLoad: string = "tools";
  public static readonly kindsNotLoaded: string = "Couldn't load the providers TeamRun supports";
  public static readonly catalogNotLoaded: string = "Couldn't load the projects, chats and teammates";
  public static readonly chatNotLoaded: string = "Couldn't load the chat";
  public static readonly workingNotLoaded: string = "Couldn't check the running replies";
  public static readonly firstLaunchNotLoaded: string = "Couldn't check whether TeamRun is set up";
  public static readonly toolsNotLoaded: string = "Couldn't check the providers' tools";
  public static readonly windowClosedTitle: string = "Couldn't try again";
  public static readonly windowClosedText: string = "The window this failed in was closed or reloaded.";
  public static readonly chatActionTitles: Readonly<Record<ChatAction, string>> = {
    [ChatAction.OpenProject]: "Couldn't open the folder",
    [ChatAction.ShowProject]: "Couldn't show the project",
    [ChatAction.ForgetProject]: "Couldn't remove the project",
    [ChatAction.StartChat]: "Couldn't start a chat",
    [ChatAction.AddMember]: "Couldn't add the teammate to the chat",
    [ChatAction.RemoveMember]: "Couldn't remove the teammate from the chat",
    [ChatAction.SetMemberMode]: "Couldn't change the teammate's permissions in the chat",
    [ChatAction.SetMemberSettings]: "Couldn't change the teammate's model or effort in the chat",
    [ChatAction.SetPlanFirst]: "Couldn't change Plan first in the chat",
    [ChatAction.MoveChat]: "Couldn't move the chat",
    [ChatAction.AttachFolder]: "Couldn't attach the folder to the chat",
    [ChatAction.DetachFolder]: "Couldn't detach the folder from the chat",
    [ChatAction.RenameChat]: "Couldn't rename the chat",
    [ChatAction.SetResponder]: "Couldn't change who answers in the chat",
    [ChatAction.DeleteChat]: "Couldn't delete the chat",
    [ChatAction.SaveDraft]: "Couldn't save the unsent message",
    [ChatAction.DiscardDraft]: "Couldn't discard the unsent message",
    [ChatAction.StopReply]: "Couldn't stop the reply",
    [ChatAction.StopReplies]: "Couldn't stop the chat's replies",
    [ChatAction.Answer]: "Couldn't send the answer",
    [ChatAction.ApprovePlan]: "Couldn't approve the plan",
    [ChatAction.ShowInFolder]: "Couldn't show the file in its folder",
    [ChatAction.OpenAttachment]: "Couldn't open the attached file",
    [ChatAction.OpenFile]: "Couldn't open the file",
    [ChatAction.CopyImage]: "Couldn't copy the image",
    [ChatAction.SaveImage]: "Couldn't save the image",
    [ChatAction.FinishSetup]: "Couldn't finish setting up TeamRun",
    [ChatAction.AddProvider]: "Couldn't add the provider",
    [ChatAction.ChangeProvider]: "Couldn't change the provider",
    [ChatAction.EnableProvider]: "Couldn't enable the provider",
    [ChatAction.DisableProvider]: "Couldn't disable the provider",
    [ChatAction.CheckProvider]: "Couldn't check the provider's sign-in",
    [ChatAction.SignIn]: "Couldn't sign in to the provider",
    [ChatAction.OpenSignInPage]: "Couldn't open the sign-in page",
    [ChatAction.CancelSignIn]: "Couldn't cancel the sign-in",
    [ChatAction.SignOut]: "Couldn't sign out of the provider",
    [ChatAction.InstallKind]: "Couldn't install the provider",
    [ChatAction.CancelInstall]: "Couldn't cancel the install",
    [ChatAction.RemoveProvider]: "Couldn't remove the provider",
    [ChatAction.InstallTool]: "Couldn't install the provider's tool",
    [ChatAction.AddAcpAgent]: "Couldn't add the ACP agent",
    [ChatAction.RemoveAcpAgent]: "Couldn't remove the ACP agent",
    [ChatAction.OpenPage]: "Couldn't open the page",
    [ChatAction.OpenBrowser]: "Couldn't open the Browser",
    [ChatAction.SaveTeammate]: "Couldn't save the teammate",
    [ChatAction.SetDefaultTeammate]: "Couldn't set the default teammate",
    [ChatAction.DeleteTeammate]: "Couldn't delete the teammate",
    [ChatAction.Rewind]: "Couldn't rewind the chat",
    [ChatAction.ShowTerminals]: "Couldn't show the chat's terminals",
    [ChatAction.CloseTerminals]: "Couldn't close the deleted chat's terminals",
    [ChatAction.RunCode]: "Couldn't run the code block",
    [ChatAction.ShowLatest]: "Couldn't show the chat's latest messages",
    [ChatAction.EditWaiting]: "Couldn't change the waiting message",
    [ChatAction.RemoveWaiting]: "Couldn't remove the waiting message",
    [ChatAction.SendWaitingNow]: "Couldn't send the waiting message now",
    [ChatAction.ShowRunOutputs]: "Couldn't show the output of the chat's earlier Runs",
    [ChatAction.KeepRunOutput]: "Couldn't keep a Run's output with its block"
  };
  public static readonly providerActionTitles: Readonly<Record<ProviderAction, (name: string) => string>> = {
    [ChatAction.AddProvider]: t => `Couldn't add ${t}`,
    [ChatAction.ChangeProvider]: t => `Couldn't change ${t}`,
    [ChatAction.EnableProvider]: t => `Couldn't enable ${t}`,
    [ChatAction.DisableProvider]: t => `Couldn't disable ${t}`,
    [ChatAction.CheckProvider]: t => `Couldn't check ${t}'s sign-in`,
    [ChatAction.SignIn]: t => `Couldn't sign in to ${t}`,
    [ChatAction.SignOut]: t => `Couldn't sign out of ${t}`,
    [ChatAction.InstallKind]: t => `Couldn't install ${t}`,
    [ChatAction.RemoveProvider]: t => `Couldn't remove ${t}`,
    [ChatAction.InstallTool]: t => `Couldn't install ${t}'s tool`
  };
  public static readonly chatPageAction: string = "teamrun.chatPage";
  public static readonly sendKeySetting: string = "teamrun.sendKey";
  public static readonly whileReplyingSetting: string = "teamrun.whileReplying";
  public static readonly escapeKey: string = "Escape";
  public static readonly arrowUpKey: string = "ArrowUp";
  public static readonly ctrlModifierKey: string = "Ctrl";
  public static readonly macModifierKey: string = "Cmd";
  public static readonly altModifierKey: string = "Alt";
  public static readonly shiftModifierKey: string = "Shift";
  public static readonly teamRunTagPrefix: string = "nol-teamrun-";
  public static readonly escapeOwnersSelector: string = "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='menu'], [role='listbox'], [role='dialog'], dialog";
  public static readonly teammatesTitle: string = "Teammates";
  public static readonly organizationTitle: string = "Organization";
  public static readonly organizationStructureLabel: string = "Organization structure";
  public static readonly organizationOwnerName: string = "You";
  public static readonly organizationPersonId: string = "person";
  public static readonly organizationFlowPersonKey: string = "person";
  public static readonly organizationFlowRemembered: number = 256;
  public static readonly organizationFlowWritingDuration: number = 1200;
  public static readonly organizationFlowPulseDuration: number = 900;
  public static readonly organizationFlowGlowDuration: number = 1200;
  public static readonly organizationFlowFadeDuration: number = 600;
  public static readonly flowNodeSelector: string = "[data-flow-node]";
  public static readonly flowKidSelector: string = ".kid";
  public static readonly flowKidsSelector: string = ".kids";
  public static readonly flowReportsSelector: string = ".reports";
  public static readonly flowNodeData: string = "flowNode";
  public static readonly flowParentData: string = "flowParent";
  public static readonly flowShapeData: string = "flowShape";
  public static readonly beforePseudo: string = "::before";
  public static readonly borderBox: string = "border-box";
  public static readonly organizationEmpty: string = "No units yet.";
  public static readonly organizationReportsToYou: string = "Reports to you";
  public static readonly organizationCardsShowLabel: string = "Cards show";
  public static readonly organizationCardsShowIcon: string = "tune";
  public static readonly organizationEveryCardShows: string = "Every card shows";
  public static readonly organizationClearEveryCard: string = "Clear every card's own choice";
  public static readonly organizationUseEveryCard: string = "Use what every card shows";
  public static readonly organizationResetIcon: string = "restart_alt";
  public static readonly organizationEditStructure: string = "Edit structure";
  public static readonly organizationDoneEditing: string = "Done editing";
  public static readonly organizationEditIcon: string = "account_tree";
  public static readonly organizationStatusKeyLabel: string = "Status key";
  public static readonly organizationStatusKey: readonly TeammateStatus[] = [TeammateStatus.Working, TeammateStatus.WaitingForYou, TeammateStatus.Idle,
    TeammateStatus.Stopped];
  public static readonly organizationDepartmentNameLabel: string = "Unit name";
  public static readonly organizationLeaderLabel: string = "Leader";
  public static readonly organizationNoLeader: string = "No leader";
  public static readonly organizationAddMemberIcon: string = "person_add";
  public static readonly organizationAddDepartment: string = "Add unit";
  public static readonly organizationAddDepartmentIcon: string = "add";
  public static readonly organizationNewDepartment: string = "New unit";
  public static readonly organizationNewTeammateOption: string = "New teammate…";
  public static readonly organizationNewTeammateValue: string = "new-teammate";
  public static readonly organizationTypeLabel: string = "Type";
  public static readonly organizationChooseType: string = "Choose a type";
  public static readonly organizationNewTypeOption: string = "New type…";
  public static readonly organizationNewTypeValue: string = "new-type";
  public static readonly organizationNewTypeTitle: string = "New type";
  public static readonly organizationEditTypeTitle: string = "Edit type";
  public static readonly organizationTypeNameLabel: string = "Type name";
  public static readonly organizationTypeIconLabel: string = "Icon";
  public static readonly organizationTypeColorLabel: string = "Icon color";
  public static readonly organizationTypesTitle: string = "Types";
  public static readonly organizationTypesButton: string = "Types…";
  public static readonly organizationNoTypes: string = "No types yet. Add one here, or when you add a unit.";
  public static readonly organizationEditTypeIcon: string = "edit";
  public static readonly organizationTypesIcon: string = "category";
  public static readonly organizationDragType: string = "application/x-noldova-organization-node";
  public static readonly organizationDragEffect: "move" = "move";
  public static readonly organizationDraggable: string = "true";
  public static readonly organizationLastOrder: number = Number.MAX_SAFE_INTEGER;
  public static readonly organizationCreateLabel: string = "Create";
  public static readonly organizationAddTeammate: string = "Add teammate";
  public static readonly organizationAddTeammateSearch: string = "Find a teammate";
  public static readonly organizationAddTeammateSearchIcon: string = "search";
  public static readonly organizationAddTeammateEmpty: string = "Type a teammate's name.";
  public static readonly organizationAddTeammateNone: string = "No teammate has that name.";
  public static readonly organizationDeleteIcon: string = "delete";
  public static readonly organizationRemoveIcon: string = "person_remove";
  public static readonly organizationNowRunningIcon: string = "progress_activity";
  public static readonly organizationNowIdleIcon: string = "pause_circle";
  public static readonly organizationNothingRunning: string = "Nothing running";
  public static readonly organizationNowReplying: string = "Replying";
  public static readonly organizationDetailsStatus: string = "Status";
  public static readonly organizationDetailsReportsTo: string = "Reports to";
  public static readonly organizationDetailsModel: string = "Model";
  public static readonly organizationDetailsUsage: string = "Usage";
  public static readonly organizationDetailsLastSaid: string = "Last said";
  public static readonly organizationDetailsNow: string = "Now";
  public static readonly organizationDetailsNoUsage: string = "Not reported";
  public static readonly organizationDetailsNothingSaid: string = "Nothing yet";
  public static readonly organizationDetailsWorksIn: string = "Works in";
  public static readonly organizationOwnFolder: string = "Its own folder";
  public static readonly organizationOwnFolderInText: string = "its own folder";
  public static readonly organizationMessagesLabel: string = "Messages";
  public static readonly organizationMessageButton: string = "Message";
  public static readonly organizationMessageIcon: string = "chat";
  public static readonly organizationToLabel: string = "To";
  public static readonly organizationDeleteLabel: string = "Delete";
  public static readonly organizationRemoveMemberTitle: string = "Remove member";
  public static readonly organizationRemoveLabel: string = "Remove";
  public static readonly organizationRemoveTeammate: string = "Remove teammate";
  public static readonly organizationOfferedFields: readonly OrganizationCardField[] =
    [OrganizationCardField.Status, OrganizationCardField.Now, OrganizationCardField.Usage, OrganizationCardField.Last,
      OrganizationCardField.Model, OrganizationCardField.Git, OrganizationCardField.PullRequests, OrganizationCardField.Documents, OrganizationCardField.Artifacts];
  public static readonly organizationWorkFields: readonly OrganizationCardField[] =
    [OrganizationCardField.Git, OrganizationCardField.PullRequests, OrganizationCardField.Documents, OrganizationCardField.Artifacts];
  public static readonly organizationFieldLabels: Readonly<Record<OrganizationCardField, string>> = {
    [OrganizationCardField.Status]: "Status",
    [OrganizationCardField.Now]: "Current activity",
    [OrganizationCardField.Usage]: "Usage today",
    [OrganizationCardField.Last]: "Last message",
    [OrganizationCardField.Model]: "Model and effort",
    [OrganizationCardField.Git]: "Git branch",
    [OrganizationCardField.PullRequests]: "Pull requests",
    [OrganizationCardField.Documents]: "Documents",
    [OrganizationCardField.Artifacts]: "Artifacts"
  };
  public static readonly organizationViewLabel: string = "View";
  public static readonly organizationViewLabels: Readonly<Record<OrganizationViewMode, string>> = {
    [OrganizationViewMode.Tree]: "Tree",
    [OrganizationViewMode.Board]: "Board",
    [OrganizationViewMode.Focus]: "Focus"
  };
  public static readonly teammateStatusLabels: Readonly<Record<TeammateStatus, string>> = {
    [TeammateStatus.Working]: "Working",
    [TeammateStatus.WaitingForYou]: "Waiting for you",
    [TeammateStatus.Idle]: "Idle",
    [TeammateStatus.UsageLimit]: "Usage limit",
    [TeammateStatus.Stopped]: "Stopped"
  };
  public static readonly teammateStatusTones: Readonly<Record<TeammateStatus, string>> = {
    [TeammateStatus.Working]: "working",
    [TeammateStatus.WaitingForYou]: "waiting",
    [TeammateStatus.Idle]: "idle",
    [TeammateStatus.UsageLimit]: "waiting",
    [TeammateStatus.Stopped]: "stopped"
  };
  public static readonly teammatesHint: string = "Create and configure teammates here. Add them to a chat using its member strip or an @mention.";
  public static readonly defaultTeammateHint: string = "The provider, model and effort a new chat starts with. Chats you already have keep their own.";
  public static readonly lastMessageSentLabel: string = "Last message sent";
  public static readonly changeLabel: string = "Change";
  public static readonly clearLabel: string = "Clear";
  public static readonly changeDefaultTeammateLabel: string = "Change default teammate";
  public static readonly clearDefaultTeammateLabel: string = "Clear default teammate";
  public static readonly addTeammateLabel: string = "Add teammate";
  public static readonly editTeammateLabel: string = "Edit teammate";
  public static readonly deleteTeammateLabel: string = "Delete teammate";
  public static readonly noTeammates: string = "No teammates yet";
  public static readonly teammateNameLabel: string = "Name";
  public static readonly teammateNameHint: string = "1–100 characters, a separate accent or vowel sign counting as one: letters, digits, dashes or underscores, with single spaces between words";
  public static readonly teammateRoleLabel: string = "Role (optional, Markdown)";
  public static readonly teammateRoleRows: number = 4;
  public static readonly connectionColumn: string = "Provider";
  public static readonly actionsColumn: string = "Actions";
  public static readonly editLabel: string = "Edit";
  public static readonly unavailableTeammateLabel: string = "Unavailable";
  public static readonly notInCatalogNote: string = "Not in catalog";
  public static readonly noProvidersForTeammate: string = "Add a provider first, in Providers.";
  public static readonly providersTitle: string = "Providers";
  public static readonly providersHint: string = "TeamRun runs each provider's own tool, signed in to your subscription.";
  public static readonly yourProvidersTitle: string = "Your providers";
  public static readonly foundProvidersTitle: string = "Found on this computer";
  public static readonly providerKindOrder: readonly string[] = ["codex", "claude", "copilot", "cursor", "grok", "opencode", "antigravity"];
  public static readonly checkAllLabel: string = "Check every provider again";
  public static readonly searchAgainLabel: string = "Search this computer again";
  public static readonly searchingLabel: string = "Searching…";
  public static readonly checkingLabel: string = "Checking…";
  public static readonly justNowLabel: string = "just now";
  public static readonly lookedForKinds: number = 5;
  public static readonly noneFound: string = "No signed-in tools found. Add provider installs one and signs it in.";
  public static readonly notSearchedLabel: string = "Not searched yet";
  public static readonly notSearchedText: string = "Not searched yet: the search starts once the provider types load.";
  public static readonly addProviderLabel: string = "Add provider";
  public static readonly addAndSignInLabel: string = "Add and sign in";
  public static readonly addOnlyLabel: string = "Add";
  public static readonly cancelAddLabel: string = "Cancel";
  public static readonly acpCardName: string = "ACP agent";
  public static readonly acpCardNote: string = "From the ACP registry";
  public static readonly kindInstalledNote: string = "Installed";
  public static readonly kindInstallingNote: string = "Installing…";
  public static readonly kindOwnInstallNote: string = "Not installed · TeamRun installs it";
  public static readonly kindUpdatesItselfNote: string = "updates on its own";
  public static readonly providerChecksAtOnce: number = 3;
  public static readonly kindToolInstallNote: string = "Not installed · you install it";
  public static readonly kindMissingNote: string = "Not installed";
  public static readonly kindUnavailableNote: string = "Can't install here";
  public static readonly unknownUnavailableStep: string = "TeamRun can't install it on this computer. Choose Try again to check again.";
  public static readonly newFolderNote: string = "Folder: TeamRun makes one for this provider.";
  public static readonly useExistingFolderLabel: string = "Use an existing folder";
  public static readonly spareProviderName: string = "Spare";
  public static readonly providerNames: readonly string[] = ["Personal", "Work", "Lab", Resources.spareProviderName];
  public static readonly megabyte: number = 1_048_576;
  public static readonly noProviderLabel: string = "No provider chosen";
  public static readonly addAProviderLabel: string = "Add a provider";
  public static readonly welcomeTitle: string = "Welcome to TeamRun";
  public static readonly doneLabel: string = "Done";
  public static readonly toolInstalledText: string = "Installed";
  public static readonly notAddedLabel: string = "Not added";
  public static readonly addFoundLabel: string = "Add";
  public static readonly toolInstallingText: string = "Installing in the terminal below; close it once the install finishes.";
  public static readonly subscribeLabel: string = "Get a subscription";
  public static readonly notNowLabel: string = "Not now";
  public static readonly firstTeammateTitle: string = "Let's add your first teammate";
  public static readonly welcomeLine: string =
    "TeamRun runs AI teammates through each provider's own tool. Add a provider for each subscription you want to use; you can change them later in Settings.";
  public static readonly skipForNowLabel: string = "Skip for now";
  public static readonly continueLabel: string = "Continue";
  public static readonly firstTeammateStepTitle: string = "Your first teammate";
  public static readonly firstTeammateStepText: string =
    "A teammate is a name you can @mention, answered by one of your providers. You can add more, and change this one, in Settings, TeamRun.";
  public static readonly answeredByLabel: string = "Answered by";
  public static readonly firstTeammateDefaults: string = "Model, effort and permissions start at the provider's defaults.";
  public static readonly chooseNowLabel: string = "Choose now";
  public static readonly startChattingLabel: string = "Start chatting";
  public static readonly openFolderLabel: string = "Open a folder";
  public static readonly firstTeammateNames: ReadonlyMap<string, string> =
    new Map([["claude", "Claude"], ["codex", "Codex"], ["copilot", "Copilot"], ["grok", "Grok"], ["opencode", "OpenCode"], ["cursor", "Cursor"], ["fx", "fx"], ["antigravity", "Antigravity"], ["pi", "Pi"], ["muse", "Muse Code"]]);
  public static readonly editProviderLabel: string = "Edit provider";
  public static readonly noProviders: string = "None yet. Add one found below, or choose Add provider.";
  public static readonly noProvidersBesideFound: string = "None yet.";
  public static readonly namesNotice: string = "Product names and trademarks belong to their owners.";
  public static readonly mcpServersTitle: string = "MCP servers";
  public static readonly computerUseGrantsTitle: string = "Computer use";
  public static readonly computerUseGrantsTableTitle: string = "What chats may control";
  public static readonly computerUseGrantsHint: string =
    "Each app, and the screen, you allowed in a chat, which the chat uses without asking again. Revoke an app, and the chat's next input to it is refused; revoke the screen, and the chat's next session asks for it again.";
  public static readonly computerUseGrantColumnShares: GrantColumnShares = new GrantColumnShares(3, 4, 3, 2);
  public static readonly grantAppColumn: string = "App";
  public static readonly grantChatColumn: string = "Chat";
  public static readonly grantGrantedColumn: string = "Allowed";
  public static readonly revokeGrantLabel: string = "Revoke";
  public static readonly noComputerUseGrants: string = "No chat may control an app or the screen";
  public static readonly readingComputerUseGrants: string = "Reading what chats may control…";
  public static readonly screenGrantName: string = "The screen";
  public static readonly revokeScreenGrantLabel: string = "Revoke the screen";
  public static readonly outsideTitle: string = "Outside sessions";
  public static readonly outsideTableTitle: string = "Connect an outside agent";
  public static readonly outsideHint: string = "A coding agent running outside TeamRun on this computer reaches your teammates and chats through this address and token: it can list them, "
    + "post into any chat or into a teammate's own chat for outside messages, and read the replies to its own messages. Its messages show as coming from outside TeamRun, and the teammate treats them as data from an unknown sender.";
  public static readonly outsideStateColumn: string = "Outside sessions";
  public static readonly outsideAddressColumn: string = "Address";
  public static readonly outsideTokenColumn: string = "Token";
  public static readonly outsideOn: string = "On";
  public static readonly outsideOff: string = "Off. Turn on Outside sessions in Settings to let outside agents in.";
  public static readonly outsideNoToken: string = "Made when you turn outside sessions on";
  public static readonly outsideHiddenToken: string = "••••••••••••••••";
  public static readonly showTokenLabel: string = "Show";
  public static readonly hideTokenLabel: string = "Hide";
  public static readonly copyLabel: string = "Copy";
  public static readonly copiedLabel: string = "Copied";
  public static readonly copyFailed: string = "TeamRun couldn't copy to the clipboard.";
  public static readonly resetTokenLabel: string = "Reset token";
  public static readonly readingOutside: string = "Reading how outside agents connect…";
  public static readonly outsideSetupTitle: string = "Settings for the outside agent";
  public static readonly outsideSetupHint: string = "Set the environment variable TEAMRUN_TOKEN to the token where the agent runs, then add TeamRun "
    + "to its MCP settings. These settings name the variable, not the token, so the token stays out of every file.";
  public static readonly outsideCodexSetup: string = "Codex, in config.toml";
  public static readonly outsideClaudeSetup: string = "Claude Code, in .mcp.json";
  public static readonly outsideSenderChip: string = "Outside";
  public static readonly outsideSenderLine: string = "from outside TeamRun";
  public static readonly deletedChatLabel: string = "Deleted chat";
  public static readonly appPathSeparators: RegExp = /[\\/]/u;
  public static readonly appIconSourcePrefix: string = "data:image/png;base64,";
  public static readonly ownMcpServersTitle: string = "From your providers' own settings";
  public static readonly ownMcpServersHint: string = "What each provider is set up with outside TeamRun. Switch one on to use them in TeamRun chats too.";
  public static readonly readingOwnMcpServers: string = "Reading its configuration…";
  public static readonly noOwnMcpServers: string = "None set up";
  public static readonly ownMcpServersNotOffered: string = "Can't list them";
  public static readonly ownMcpServersUsesOwn: string = "uses its own while on";
  public static readonly ownMcpServersHeld: string = "Can't use their own servers in TeamRun yet";
  public static readonly ownMcpServerNamesShown: number = 3;
  public static readonly ownMcpHeldReasonsId: string = "nol-teamrun-own-mcp-held-reasons";
  public static readonly whyLabel: string = "Why";
  public static readonly showReasonsLabel: string = "Show";
  public static readonly hideReasonsLabel: string = "Hide";
  public static readonly statusRole: string = "status";
  public static readonly noProvidersForMcpServers: string = "No providers yet. Add one in Providers.";
  public static readonly ownMcpServersSwitchIdPrefix: string = "nol-teamrun-own-mcp-switch-";
  public static readonly sharedMcpServersTitle: string = "Added in TeamRun";
  public static readonly sharedMcpServersHint: string = "You choose which providers and teammates get each one.";
  public static readonly addSharedMcpServerLabel: string = "Add server";
  public static readonly addGitHubMcpServerLabel: string = "Add GitHub's server";
  public static readonly gitHubReadSignInMethod: string = "git-github.readSignIn";
  public static readonly gitHubSignInChangedEvent: string = "git-github.signInChanged";
  public static readonly gitHubStateField: string = "state";
  public static readonly gitHubSignedInState: string = "SignedIn";
  public static readonly sharedMcpDetailsId: string = "nol-teamrun-shared-mcp-details";
  public static readonly sharedMcpRefusedId: string = "nol-teamrun-shared-mcp-refused";
  public static readonly sharedMcpHttpType: string = "HTTP";
  public static readonly sharedMcpStateSeparator: string = " · ";
  public static readonly sharedMcpNameSeparator: string = ", ";
  public static readonly sharedMcpSignedInShort: string = "signed in";
  public static readonly sharedMcpNotSignedInShort: string = "not signed in";
  public static readonly sharedMcpSigningInShort: string = "waiting for the browser";
  public static readonly sharedMcpSignInNeededShort: string = "needs a new sign-in";
  public static readonly sharedMcpProvidersHeading: string = "Providers";
  public static readonly sharedMcpTeammatesHeading: string = "Teammates";
  public static readonly sharedMcpTeammatesFollow: string = "Each teammate gets it when its provider does.";
  public static readonly sharedMcpGetsItLabel: string = "Gets it:";
  public static readonly sharedMcpExceptionsLabel: string = "Exceptions:";
  public static readonly sharedMcpNoneLabel: string = "none";
  public static readonly sharedMcpAddExceptionLabel: string = "Add exception";
  public static readonly sharedMcpRemoveExceptionLabel: string = "Remove exception";
  public static readonly sharedMcpFollowSetting: SharedMcpSetting = SharedMcpSetting.AsProvider;
  public static readonly deleteLabel: string = "Delete";
  public static readonly sharedMcpSettingLabels: Readonly<Record<SharedMcpSetting, string>> = {
    [SharedMcpSetting.AsProvider]: "As its provider",
    [SharedMcpSetting.On]: "On",
    [SharedMcpSetting.Off]: "Off"
  };
  public static readonly sharedMcpSettingOrder: readonly SharedMcpSetting[] = [SharedMcpSetting.AsProvider, SharedMcpSetting.On, SharedMcpSetting.Off];
  public static readonly sharedMcpExceptionOrder: readonly SharedMcpSetting[] = [SharedMcpSetting.On, SharedMcpSetting.Off];
  public static readonly readingSharedMcpServers: string = "Reading the servers…";
  public static readonly noSharedMcpServers: string = "No servers added yet";
  public static readonly noProvidersForSharedMcp: string = "No providers yet";
  public static readonly noTeammatesForSharedMcp: string = "No teammates yet";
  public static readonly addSharedMcpServerTitle: string = "Add shared MCP server";
  public static readonly editSharedMcpServerTitle: string = "Edit shared MCP server";
  public static readonly deleteSharedMcpServerLabel: string = "Delete server";
  public static readonly sharedMcpNameLabel: string = "Name";
  public static readonly sharedMcpNameHint: string = "Lowercase letters, digits, - and _, starting with a letter.";
  public static readonly sharedMcpTransportLabel: string = "Type";
  public static readonly sharedMcpTransportLabels: Readonly<Record<SharedMcpTransport, string>> = {
    [SharedMcpTransport.Stdio]: "Command (stdio)",
    [SharedMcpTransport.Http]: "Address (HTTP)"
  };
  public static readonly sharedMcpCommandLabel: string = "Command";
  public static readonly sharedMcpArgumentsLabel: string = "Arguments";
  public static readonly sharedMcpArgumentsHint: string = "One per line.";
  public static readonly sharedMcpVariablesLabel: string = "Variables";
  public static readonly sharedMcpVariablesHint: string = "One name per line. Each takes its value from this machine's environment or a saved secret, under Values.";
  public static readonly sharedMcpUrlLabel: string = "Address";
  public static readonly sharedMcpHeadersLabel: string = "Headers";
  public static readonly sharedMcpHeadersHint: string = "One per line, as Name: VARIABLE. Each header takes its variable's value as Values sets it.";
  public static readonly sharedMcpBearerLabel: string = "Bearer token variable";
  public static readonly sharedMcpBearerHint: string = "A variable whose value goes in the Authorization header as a bearer token.";
  public static readonly sharedMcpSignsInLabel: string = "Sign in with OAuth";
  public static readonly sharedMcpSignsInHint: string = "You sign in once in your browser from the MCP servers page; TeamRun keeps the tokens in the secret store and renews them.";
  public static readonly sharedMcpAccountRefusal: string =
    "A server that signs in with GitHub takes no Authorization header, bearer token or OAuth sign-in; TeamRun sends its token.";
  public static readonly sharedMcpAccountUrlHint: string = "TeamRun sends GitHub's sign-in only to GitHub's own address, so it stays as it is.";
  public static readonly sharedMcpSignsInRefusal: string = "A server that signs in with OAuth takes no Authorization header; TeamRun sends its token.";
  public static readonly sharedMcpSignInLabel: string = "Sign in";
  public static readonly sharedMcpSignOutLabel: string = "Sign out";
  public static readonly sharedMcpNotSignedIn: string = "Not signed in.";
  public static readonly sharedMcpSignedIn: string = "Signed in.";
  public static readonly sharedMcpSigningIn: string = "Waiting for the browser.";
  public static readonly sharedMcpHeaderSeparator: string = ":";
  public static readonly sharedMcpValuesLabel: string = "Values";
  public static readonly sharedMcpValuesHint: string = "Noldova Desktop's secret store keeps a saved secret; TeamRun keeps only where to find it.";
  public static readonly sharedMcpVariableSourceLabels: Readonly<Record<SharedMcpVariableSource, string>> = {
    [SharedMcpVariableSource.Environment]: "From this machine's environment",
    [SharedMcpVariableSource.Saved]: "Saved secret"
  };
  public static readonly sharedMcpVariableSourceOrder: readonly SharedMcpVariableSource[] = [SharedMcpVariableSource.Environment, SharedMcpVariableSource.Saved];
  public static readonly sharedMcpSecretSavedLabel: string = "Saved";
  public static readonly sharedMcpVariableColumn: string = "Variable";
  public static readonly sharedMcpSourceColumn: string = "Source";
  public static readonly sharedMcpValueColumn: string = "Value";
  public static readonly sharedMcpValueSelector: string = ".nol-teamrun-shared-mcp-value";
  public static readonly sharedMcpSecretSelector: string = ".nol-teamrun-shared-mcp-secret";
  public static readonly sharedMcpSourceSelector: string = ".nol-teamrun-shared-mcp-source .nol-select-button";
  public static readonly sharedMcpShowValueLabel: string = "Show";
  public static readonly sharedMcpHideValueLabel: string = "Hide";
  public static readonly sharedMcpVariableNotSetLabel: string = "Not set on this machine";
  public static readonly sharedMcpSecretReferencePrefix: string = "teamrun.mcpSecret";
  public static readonly acpRowKind: string = "acp:agents";
  public static readonly acpMaskedIconPrefix: string = "data:image/svg+xml";
  public static readonly acpKindOption: string = "ACP agents…";
  public static readonly acpAgentsTitle: string = "ACP agents";
  public static readonly acpAgentsHint: string = "Add an agent from the ACP registry, and it is installed for TeamRun alone. Then add a provider for it.";
  public static readonly acpSearchLabel: string = "Search agents";
  public static readonly acpAboutLabel: string = "About";
  public static readonly acpAddLabel: string = "Add";
  public static readonly acpRemoveLabel: string = "Remove";
  public static readonly acpAgentSelector: string = "[data-agent]";
  public static readonly acpAddSelector: string = ".nol-teamrun-acp-add";
  public static readonly acpRemoveSelector: string = ".nol-teamrun-acp-remove";
  public static readonly acpNotCheckedLabel: string = "Not checked";
  public static readonly acpNotCheckedHint: string = "The registry lists no SHA-256 for this download, so TeamRun can't check it. It still comes over HTTPS, up to a size limit.";
  public static readonly acpNoAgentsText: string = "No agents to show.";
  public static readonly acpLocalHeading: string = "Local ACP commands";
  public static readonly acpLocalOpenLabel: string = "Local ACP command";
  public static readonly acpLocalAddLabel: string = "Add command";
  public static readonly acpLocalFormKey: string = "acp:local";
  public static readonly acpLocalCancelLabel: string = "Cancel";
  public static readonly acpLocalNameLabel: string = "Name";
  public static readonly acpLocalCommandLabel: string = "Command";
  public static readonly acpLocalArgumentsLabel: string = "Arguments";
  public static readonly acpLocalArgumentsHint: string = "One argument on each line. Arguments are saved as plain text, so put a secret in a variable.";
  public static readonly acpLocalArgumentRows: number = 3;
  public static readonly acpArgumentLineSeparator: RegExp = /\r?\n/u;
  public static readonly acpLocalVariablesLabel: string = "Variables";
  public static readonly acpLocalVariablesHint: string = "Their values are kept as saved secrets, never in TeamRun's database.";
  public static readonly acpLocalVariableNameLabel: string = "Variable name";
  public static readonly acpLocalVariableValueLabel: string = "Value";
  public static readonly acpLocalAddVariableLabel: string = "Add variable";
  public static readonly acpLocalNameRequired: string = "Name the command.";
  public static readonly acpLocalCommandRequired: string = "Enter the command that starts the agent.";
  public static readonly acpLocalVariableRepeated: string = "Each variable's name can be used once.";
  public static readonly acpLocalValueRequired: string = "Enter a value for each variable.";
  public static readonly acpVariableNamePattern: RegExp = /^[A-Za-z_][A-Za-z0-9_]*$/u;
  public static readonly sharedMcpValueIdPrefix: string = "nol-teamrun-shared-mcp-value-";
  public static readonly sharedMcpNameRefusal: string =
    "Start with a lowercase letter, then use lowercase letters, digits, - or _, up to 64 in all, with no _ twice in a row or at the end.";
  public static readonly sharedMcpOwnNameRefusal: string = "teamrun is TeamRun's own. Give the server another name.";
  public static readonly sharedMcpVariablesRefusal: string = "Name each variable once, with letters, digits and _, starting with a letter or _.";
  public static readonly sharedMcpAddressRefusal: string = "Give an address that starts with http:// or https://.";
  public static readonly sharedMcpAddressSecretRefusal: string =
    "Leave user names, passwords, keys and tokens out of the address, and give their variables as headers or the bearer token.";
  public static readonly sharedMcpHeaderLineRefusal: string =
    "Write each header as Name: VARIABLE, the name in letters, digits and -, and the variable in letters, digits and _, starting with a letter or _.";
  public static readonly sharedMcpHeaderNamesRefusal: string = "Name each header once, and leave Authorization out when the bearer token has a variable.";
  public static readonly sharedMcpBearerRefusal: string = "Name the variable with letters, digits and _, starting with a letter or _.";
  public static readonly sharedMcpProviderSwitchIdPrefix: string = "nol-teamrun-shared-mcp-switch-";
  public static readonly signedInColumn: string = "Signed in as";
  public static readonly planColumn: string = "Plan";
  public static readonly limitsColumn: string = "Limits";
  public static readonly noPlanTag: string = "—";
  public static readonly profileFolderLabel: string = "Profile folder";
  public static readonly binaryPathLabel: string = "Binary path";
  public static readonly binaryPathHint: string = "Leave it empty to run TeamRun's own copy, or a compatible server on PATH when TeamRun hasn't installed one.";
  public static readonly checkProviderLabel: string = "Check again";
  public static readonly editProviderMenuLabel: string = "Edit…";
  public static readonly removeProviderLabel: string = "Remove…";
  public static readonly showProfileFolderLabel: string = "Show profile folder";
  public static readonly signInLabel: string = "Sign in";
  public static readonly signOutLabel: string = "Sign out";
  public static readonly cancelSignInLabel: string = "Cancel sign-in";
  public static readonly openSignInLabel: string = "Open sign-in page";
  public static readonly signingInLabel: string = "Signing in…";
  public static readonly signingInBrowserNote: string = "Signing in: finish in your browser";
  public static readonly signingInTerminalNote: string = "Signing in: finish in the terminal below";
  public static readonly checksWhenAdded: string = "Checks when added";
  public static readonly signInDidNotOpen: string = "Didn't open?";
  public static readonly copyLinkLabel: string = "Copy link";
  public static readonly signInLinkNotCopied: string = "TeamRun couldn't copy the sign-in page's link.";
  public static readonly signInAgainLabel: string = "Sign in again";
  public static readonly signInUnfinished: string = "Sign-in didn't finish: the terminal closed before it signed in.";
  public static readonly cancelLabel: string = "Cancel";
  public static readonly showTerminalLabel: string = "Show terminal";
  public static readonly terminalUnavailable: string = "The terminal can't show here while Terminal is off in this window.";
  public static readonly signingInHint: string = "Finish signing in in the browser that opened.";
  public static readonly stopSignOutLabel: string = "Stop sign-out";
  public static readonly signingOutLabel: string = "Signing out…";
  public static readonly openTerminalLabel: string = "Open terminal";
  public static readonly logoutCommand: string = "/logout";
  public static readonly logoutUnavailable: string =
    "This chat's provider isn't signed in, or TeamRun can't sign it out, so nothing was signed out. Your message wasn't sent.";
  public static readonly terminalSigningInHint: string =
    "Finish signing in in the terminal that opened; TeamRun checks the sign-in again once the command ends, if the terminal can tell, or when you close the terminal. To give up, choose Stop sign-in.";
  public static readonly terminalSignInNotice: string =
    "TeamRun checks this provider's sign-in again when this command ends, if the terminal can tell, or when this terminal closes, and closes the terminal once it's signed in.";
  public static readonly terminalSigningInHints: ReadonlyMap<string, string> = new Map([
    ["pi", "In the terminal that opened, type /login in Pi and sign in to the provider of your default model, then type /quit; TeamRun checks the sign-in again once " +
      "Pi quits, if the terminal can tell, or when you close the terminal. To give up, choose Stop sign-in."]]);
  public static readonly terminalSignInNotices: ReadonlyMap<string, string> = new Map([
    ["pi", "Type /login to sign in to the provider of your default model in Pi, then /quit. TeamRun checks this provider's sign-in again when Pi quits, if the " +
      "terminal can tell, or when this terminal closes, and closes the terminal once it's signed in."]]);
  public static readonly terminalSignOutNotice: string =
    "TeamRun checks this provider's sign-in again when this tool ends, if the terminal can tell, or when this terminal closes, and closes the terminal once it's signed out.";
  public static readonly terminalSignOutCommandNotice: string =
    "TeamRun closes this terminal and checks this provider's sign-in again when this command ends without an error, if the terminal can tell, or when this terminal closes.";
  public static readonly terminalSigningOutCommandHint: string =
    "Finish signing out in the terminal that opened; TeamRun checks the sign-in again once the command ends without an error, if the terminal can tell, or when you close " +
    "the terminal. To give up, choose Stop sign-out.";
  public static readonly terminalSigningOutHint: string =
    "Sign out in the tool that opened in a terminal, then leave it; TeamRun checks the sign-in again once it ends, if the terminal can tell, or when you close the " +
    "terminal. To give up, choose Stop sign-out.";
  public static readonly terminalInstallNotice: string =
    "TeamRun looks for the tool again when this command ends, if the terminal can tell, or when this terminal closes, and closes the terminal once it finds the tool.";
  public static readonly terminalTitleLimit: number = 200;
  public static readonly notInstalledLabel: string = "Not installed";
  public static readonly unsupportedProviderLabel: string = "Unavailable";
  public static readonly unsupportedProviderHint: string = "TeamRun no longer supports this kind of provider. Remove this provider.";
  public static readonly disabledProviderLabel: string = "Disabled";
  public static readonly disabledProviderHint: string = "TeamRun doesn't check its sign-in or read its usage, and its teammates can't reply until you enable it.";
  public static readonly providerDisabledLabel: string = "Provider disabled";
  public static readonly disableProviderLabel: string = "Disable";
  public static readonly enableProviderLabel: string = "Enable";
  public static readonly installLabel: string = "Install";
  public static readonly updateLabel: string = "Update";
  public static readonly cancelInstallLabel: string = "Cancel";
  public static readonly removeLabel: string = "Remove";
  public static readonly keepLabel: string = "Keep";
  public static readonly removeQuestion: string = "Remove it? Its folder and sign-in stay on this computer.";
  public static readonly providerNameLabel: string = "Name";
  public static readonly providerNameHint: string = "For example, Personal or Work";
  public static readonly chooseProfileLabel: string = "Choose profile folder";
  public static readonly newFolderLabel: string = "New folder";
  public static readonly existingFolderLabel: string = "Existing folder";
  public static readonly existingProfileFolderLabel: string = "Existing profile folder";
  public static readonly newFolderUnnamedHint: string = "TeamRun makes a new folder for the provider in its data folder, named after the provider's name.";
  public static readonly newFolderSignInHint: string = "TeamRun then signs the provider in.";
  public static readonly newFolderInstallHint: string = "Then choose Install here, then Sign in in the provider's menu.";
  public static readonly newFolderCommandStart: string = "TeamRun then opens a terminal where you run ";
  public static readonly newFolderCommandMiddle: string = ", with ";
  public static readonly newFolderCommandEnd: string = " set to that folder.";
  public static readonly hintSeparator: string = " ";
  public static readonly newFolderOwnSignInHint: string = "Sign-in is managed by the provider's own application.";
  public static readonly profileHint: string = "Use the full path to the profile folder. Sign-in is managed by the provider's own application.";
  public static readonly noProviderProfileHint: string = "Choose a provider first; the hint then says where its profile folder usually is.";
  public static readonly profileHints: ReadonlyMap<string, string> = new Map([
    ["codex", "Choose the Codex profile that holds your CLI sign-in (usually the .codex folder in your home directory). TeamRun can sign Codex in too: choose Sign in in the provider's menu."],
    ["claude", "Choose your Claude CLI profile folder (usually .claude). A Claude desktop login does not necessarily sign in this CLI profile: choose Sign in in the provider's menu to sign this profile in " +
      "from a terminal."],
    ["copilot", "Choose your Copilot CLI folder (usually the .copilot folder in your home directory). Copilot CLI keeps its own sign-in: choose Sign in in the provider's menu to sign this profile in " +
      "from a terminal."],
    ["grok", "Choose your Grok home (usually the .grok folder in your home directory); Grok in TeamRun uses its settings, memory, rules, MCP servers and " +
      "sign-in, shared with your own Grok CLI, so signing in here replaces its sign-in and signing out signs it out too; another folder keeps a " +
      "sign-in of its own. TeamRun signs Grok in: after adding the provider, choose Sign in in its menu."],
    ["opencode", "Choose your OpenCode data folder (usually .local/share in your home directory); OpenCode in TeamRun uses your own settings, plugins, MCP servers and " +
      "sign-in, shared with your own OpenCode, so signing out here signs it out too; another folder keeps a sign-in of its own beside the same settings. " +
      "OpenCode signs in in a terminal: after adding the provider, choose Sign in in its menu to run opencode auth login."],
    ["cursor", "Choose an empty folder for this Cursor profile, such as profiles/cursor/default in TeamRun's data folder; your own Cursor setup stays separate. " +
      "Cursor signs in in a terminal: after adding the provider, choose Sign in in its menu to run cursor-agent login for this profile. " +
      "Cursor in TeamRun also starts the MCP servers in your ~/.cursor/mcp.json, outside the profile; Cursor CLI 2026.11.22 has no setting to skip them."],
    ["fx", "Choose your own fx folder (the .fx folder in your home directory); fx in TeamRun uses your own fx, with its sign-in, settings, sessions and " +
      "MCP servers, whatever folder you choose, so TeamRun takes one fx provider per computer. fx signs in in a terminal: after adding the provider, choose " +
      "Sign in in its menu to run fx login, which signs in your own fx."],
    ["antigravity", "Choose an empty folder for this Antigravity profile, such as a new folder under profiles/antigravity in TeamRun's data folder. TeamRun installs Antigravity and signs it in with Google: choose Install here, then, after adding the provider, Sign in in its menu."],
    ["muse", "Choose your Muse Code config folder (usually the .config folder in your home directory); Muse Code in TeamRun uses its settings and your own muse login, " +
      "shared with your own Muse Code. Muse Code signs in in a terminal: choose Sign in in the provider's menu, which runs muse login."],
    ["pi", "Choose your Pi folder (usually the .pi/agent folder in your home directory); Pi in TeamRun uses its settings, sign-ins, sessions and extensions, shared " +
      "with your own Pi, and checks the sign-in of the provider your default model uses. Pi signs in in a terminal: choose Sign in in the provider's menu, then " +
      "type /login in Pi."]
  ]);
  public static readonly sharedSignInProfileHints: ReadonlyMap<string, string> = new Map([
    ["cursor", "Choose an empty folder for this Cursor profile, such as profiles/cursor/default in TeamRun's data folder. On this Mac, Cursor keeps its sign-in in " +
      "the keychain, shared with your own Cursor CLI: signing in here replaces your Cursor CLI's sign-in, and signing out signs it out too. Cursor signs " +
      "in in a terminal: after adding the provider, choose Sign in in its menu to run cursor-agent login for this profile. Cursor in TeamRun also starts the " +
      "MCP servers in your ~/.cursor/mcp.json, outside the profile; Cursor CLI 2026.11.22 has no setting to skip them."]]);
  public static readonly windowsProfileHints: ReadonlyMap<string, string> = new Map([
    ["cursor", "Choose an empty folder for this Cursor profile, such as profiles/cursor/default in TeamRun's data folder; your own Cursor setup stays separate. " +
      "Cursor signs in in a terminal: after adding the provider, choose Sign in in its menu to run cursor-agent login for this profile. " +
      "Cursor in TeamRun also starts the MCP servers in your %USERPROFILE%\\.cursor\\mcp.json, outside the profile; Cursor CLI 2026.11.22 has no setting to skip them."]]);
  public static readonly planChangeHints: ReadonlyMap<string, (profileDir: string | null) => string> = new Map([
    ["copilot", (profileDir: string | null) => Resources.formatCopilotPlanChange(profileDir)]
  ]);
  public static readonly addProviderHint: string = "Connect one of the supported providers using a local profile. After adding it, check it from its menu to verify the connection.";
  public static readonly editProviderHint: string = "A different profile folder clears the last sign-in check, and chats with this provider start fresh sessions.";
  public static readonly providerStatusLabels: Readonly<Record<AuthStatus, string>> = {
    [AuthStatus.Unknown]: "Not checked",
    [AuthStatus.LoggedIn]: "Connected",
    [AuthStatus.LoggedOut]: "Sign-in required",
    [AuthStatus.Expired]: "Sign-in expired",
    [AuthStatus.Error]: "Connection error"
  };
  public static readonly connectedStatusDot: string = "nol-teamrun-status-dot nol-teamrun-status-dot-connected";
  public static readonly neededStatusDot: string = "nol-teamrun-status-dot nol-teamrun-status-dot-needed";
  public static readonly failedStatusDot: string = "nol-teamrun-status-dot nol-teamrun-status-dot-failed";
  public static readonly warningStatusDot: string = "nol-teamrun-status-dot nol-teamrun-status-dot-warning";
  public static readonly quietStatusDot: string = "nol-teamrun-status-dot";
  public static readonly liveStatusDot: string = "nol-teamrun-status-dot nol-teamrun-status-dot-live";
  public static readonly providerStatusDots: Readonly<Record<AuthStatus, string>> = {
    [AuthStatus.Unknown]: Resources.quietStatusDot,
    [AuthStatus.LoggedIn]: Resources.connectedStatusDot,
    [AuthStatus.LoggedOut]: Resources.neededStatusDot,
    [AuthStatus.Expired]: Resources.warningStatusDot,
    [AuthStatus.Error]: Resources.failedStatusDot
  };
  public static readonly checkErrorStatuses: readonly AuthStatus[] = [AuthStatus.Unknown, AuthStatus.LoggedIn];
  public static readonly signInStatuses: readonly AuthStatus[] = [AuthStatus.LoggedOut, AuthStatus.Expired, AuthStatus.Error];
  public static readonly signInAgainStatuses: readonly AuthStatus[] = [AuthStatus.Error];
  public static readonly kindTitleColumns: number = 3;
  public static readonly kindActionColumns: number = 3;
  public static readonly hiddenDisplay: string = "none";
  public static readonly teammateColumnShares: TeammateColumnShares = new TeammateColumnShares(3, 4, 3, 3, 3);
  public static readonly fallbackActionSlots: readonly number[] = [0, 1, 2];
  public static readonly sustainGroupLabel: string = "When usage runs out";
  public static readonly sustainSwitchLabel: string = "Continue elsewhere when a limit is hit";
  public static readonly sustainHint: string = "Sustain: at the start of each turn, the first entry with usage left runs it.";
  public static readonly sustainUnreadKindsGroup: string = "Can't read usage limits yet";
  public static readonly fallbackOrderTitle: string = "Fallback order";
  public static readonly fallbackOrderHint: string = "The first entry is the teammate's own choice above; change it there.";
  public static readonly addFallbackLabel: string = "Add";
  public static readonly fallbackPositionColumn: string = "#";
  public static readonly sustainOwnChoiceWay: string = "Own choice";
  public static readonly sustainSameSessionWay: string = "Same session";
  public static readonly sustainSameSessionUncheckedWay: string = "Same session, not yet checked";
  public static readonly sustainNewSessionWay: string = "New session with handover";
  public static readonly resetsSoonestFirstLabel: string = "After the teammate's own choice, use the entry whose usage resets soonest first";
  public static readonly usageHandOffsTitle: string = "Hand off to";
  public static readonly usageHandOffsHint: string = "When every entry is out as a turn starts, the first teammate here with usage left takes the turn.";
  public static readonly addUsageHandOffLabel: string = "Add";
  public static readonly usageHandOffPositionColumn: string = "#";
  public static readonly usageHandOffTeammateColumn: string = "Teammate";
  public static readonly usageHandOffsOff: string = "Off: no teammate takes over.";
  public static readonly usageHandOffsHeadingLevel: number = 3;
  public static readonly sustainReasonId: string = "nol-teamrun-sustain-reason";
  public static readonly moveUpLabel: string = "Move up";
  public static readonly fallbackUpSelector: string = ".nol-teamrun-fallback-up";
  public static readonly fallbackDownSelector: string = ".nol-teamrun-fallback-down";
  public static readonly moveDownLabel: string = "Move down";
  public static readonly organizationBoardLeadersTitle: string = "Reports to you";
  public static readonly organizationBoardLeadersNote: string = "They report to you; the leaders talk across units.";
  public static readonly organizationBoardMessageLeaders: string = "Message all leaders and your direct reports";
  public static readonly organizationBoardMessageLeadersIcon: string = "forum";
  public static readonly organizationBoardDepartmentsTitle: string = "Units";
  public static readonly organizationBoardDepartmentsNote: string = "Each column's members, sorted by who needs you first.";
  public static readonly organizationBoardMessageIcon: string = "chat";
  public static readonly organizationBoardNoMembers: string = "No members yet.";
  public static readonly organizationBoardNeedsTitle: string = "Needs you";
  public static readonly organizationBoardNeedsIcon: string = "pan_tool";
  public static readonly organizationBoardNobodyWaiting: string = "Nobody is waiting for you.";
  public static readonly organizationBoardAnswer: string = "Answer";
  public static readonly organizationBoardOpen: string = "Open";
  public static readonly organizationBoardMessage: string = "Message";
  public static readonly organizationBoardSortLabels: Readonly<Record<OrganizationBoardSort, string>> = {
    [OrganizationBoardSort.Status]: "Status",
    [OrganizationBoardSort.Name]: "Name"
  };
  public static readonly organizationFocusOutlineLabel: string = "Organization outline";
  public static readonly organizationFocusStructure: string = "Structure";
  public static readonly organizationFocusRootIcon: string = "domain";
  public static readonly organizationFocusDepartmentIcon: string = "groups";
  public static readonly organizationFocusShowIcon: string = "chevron_right";
  public static readonly organizationFocusHideIcon: string = "expand_more";
  public static readonly organizationFocusCrumbIcon: string = "chevron_right";
  public static readonly organizationFocusLeads: string = "leads";
  public static readonly organizationFocusUnitLabel: string = "Focused unit";
  public static readonly organizationFocusNobody: string = "Nobody here yet.";

  public static formatTeammateWorkSummary(pullRequests: number, documents: number, artifacts: number, branch: string | null): string {
    const counts = [Resources.formatCount(pullRequests, "pull request", "pull requests"), Resources.formatCount(documents, "document", "documents"),
      Resources.formatCount(artifacts, "artifact", "artifacts")].join(" · ");
    return Object.isNull(branch) ? counts : `${counts} · on ${branch}`;
  }

  private static formatCount(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
  }

  public static formatTeammateChanges(count: number): string {
    return Resources.formatCount(count, "changed file", "changed files");
  }

  public static formatTeammateUpstream(ahead: number, behind: number, upstream: string): string {
    return `${ahead} ahead, ${behind} behind ${upstream}`;
  }

  public static formatTeammateGitMeta(changes: string, upstream: string): string {
    return `${changes} · ${upstream}`;
  }

  public static formatTeammatePullRequestNumber(number: number): string {
    return `#${number}`;
  }

  public static formatTeammateArtifact(kind: string, title: string): string {
    return `${kind}: ${title}`;
  }

  public static formatTeammateFolderUnread(folder: string, error: string): string {
    return `The teammate's pull requests leave out ${folder}, whose Git state couldn't be read: ${error}`;
  }

  public static formatTeammateFolderUnwatched(folder: string, error: string): string {
    return `The teammate's Git state doesn't follow changes in ${folder}: ${error}`;
  }

  public static formatSustainUnavailable(kind: string): string {
    return `TeamRun can't read ${kind}'s usage limits yet, so neither Sustain nor a hand-off can start for this teammate.`;
  }

  public static formatSustainEntry(position: number, provider: string): string {
    return `entry ${position}, ${provider}`;
  }

  public static formatFallbackField(position: number, field: string): string {
    return `Entry ${position} ${field.toLowerCase()}`;
  }

  public static formatMoveUp(entry: string): string {
    return `Move ${entry} up`;
  }

  public static formatMoveDown(entry: string): string {
    return `Move ${entry} down`;
  }

  public static formatOrganizationHeadcount(teammates: number, departments: number): string {
    return `${teammates === 1 ? "1 teammate" : `${teammates} teammates`} in ${departments === 1 ? "1 unit" : `${departments} units`}`;
  }

  public static formatOrganizationOwnerRole(reports: number): string {
    return reports === 1 ? "Owner · 1 direct report" : `Owner · ${reports} direct reports`;
  }

  public static formatOrganizationDepartmentSummary(statuses: readonly TeammateStatus[]): string {
    const counts = Object.values(TeammateStatus).flatMap(t => {
      const count = statuses.filter(u => u === t).length;
      return count === 0 ? [] : [`${count} ${Resources.teammateStatusLabels[t].toLowerCase()}`];
    });
    return counts.join(" · ");
  }

  public static formatOrganizationCollapseLabel(name: string, open: boolean): string {
    return open ? `Hide ${name}'s members` : `Show ${name}'s members`;
  }

  public static formatOrganizationDeleteDepartment(name: string, parent: string | null): string {
    return Object.isNull(parent) ? `Delete ${name}? Its units move up to report to you, and its members leave every unit.`
      : `Delete ${name}? Its units and members move to ${parent}.`;
  }

  public static formatOrganizationUnitNameLabel(type: NodeType | null): string {
    return Object.isNull(type) ? Resources.organizationDepartmentNameLabel : `${type.name} name`;
  }

  public static formatOrganizationDeleteUnit(type: NodeType | null): string {
    return Object.isNull(type) ? "Delete unit" : `Delete ${type.name}`;
  }

  public static formatOrganizationRemoveUnit(type: NodeType | null): string {
    return Object.isNull(type) ? "Remove unit" : `Remove ${type.name}`;
  }

  public static formatOrganizationDeleteNamed(name: string): string {
    return `Delete ${name}`;
  }

  public static formatOrganizationRemoveNamed(name: string): string {
    return `Remove ${name}`;
  }

  public static formatOrganizationMoveLabel(name: string): string {
    return `Who ${name} reports to`;
  }

  public static formatOrganizationRemoveMember(teammate: string, department: string): string {
    return `Remove ${teammate} from ${department}? ${teammate} will report to you.`;
  }

  public static formatOrganizationHidden(count: number): string {
    return count === 1 ? "1 member hidden" : `${count} members hidden`;
  }

  public static formatOrganizationCardShows(name: string): string {
    return `${name}'s card shows`;
  }

  public static formatOrganizationWorksIn(name: string, place: string): string {
    return `${name} works in ${place}`;
  }

  public static formatOrganizationCardMenu(name: string): string {
    return `Choose what ${name}'s card shows and where ${name} works`;
  }

  public static formatOrganizationReportsTo(manager: string): string {
    return `Reports to ${manager}`;
  }

  public static formatOrganizationRoleIn(role: string | null, department: string | null): string | null {
    const parts = [role, department].filter(t => !Object.isNull(t) && t.length > 0);
    return parts.length === 0 ? null : parts.join(" · ");
  }

  public static formatOrganizationNowOf(name: string): string {
    return `What ${name} is doing now`;
  }

  public static formatOrganizationNowFor(milliseconds: number, more: number): string {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    const lasted = seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${Math.floor(seconds / 60)} min`
      : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
    return more > 0 ? `${lasted} +${more}` : lasted;
  }

  public static formatOrganizationUsage(used: number): string {
    return `${Math.round(used * Resources.wholePercent)}%`;
  }

  public static formatOrganizationModel(model: string, effort: string | null): string {
    return [model, effort].filter(t => !Object.isNull(t)).join(Resources.titleSeparator);
  }

  public static formatOrganizationDetailsLabel(name: string): string {
    return `${name}'s details`;
  }

  public static formatOrganizationDetailsUsage(used: number, limit: string): string {
    return `${Resources.formatOrganizationUsage(used)} used${Resources.titleSeparator}${limit}`;
  }

  public static formatRemove(entry: string): string {
    return `Remove ${entry}`;
  }

  public static formatAbilitySettingId(ability: string): string {
    return `teamrun.providers.${ability.charAt(0).toLowerCase()}${ability.slice(1)}`;
  }

  public static formatAbilitySettingDescription(section: string, answer: string): string {
    return `${section}: ${answer}`;
  }

  private static readonly browserWent: Readonly<Record<string, BrowserStepWords>> = {
    back: new BrowserStepWords("Went back", "Going back", "Didn't go back"),
    forward: new BrowserStepWords("Went forward", "Going forward", "Didn't go forward"),
    reload: new BrowserStepWords("Reloaded the page", "Reloading the page", "Didn't reload the page")
  };
  private static readonly browserReads: Readonly<Record<string, BrowserStepWords>> = {
    browser_snapshot: new BrowserStepWords("Read", "Reading", "read"),
    browser_screenshot: new BrowserStepWords("Took a screenshot of", "Taking a screenshot of", "take a screenshot of"),
    browser_console: new BrowserStepWords("Read the console of", "Reading the console of", "read the console of"),
    browser_wait_for: new BrowserStepWords("Waited on", "Waiting on", "wait on")
  };
  private static readonly browserStale: Readonly<Record<string, string>> = {
    browser_click: "the page changed before the click, so nothing was clicked",
    browser_type: "the page changed before the typing, so nothing was typed"
  };

  public static formatAbilityReason(reason: string): string {
    const sentence = `${reason.charAt(0).toUpperCase()}${reason.slice(1)}`;
    return Resources.sentenceEnds.includes(sentence.slice(-1)) ? sentence : `${sentence}.`;
  }

  public static formatAcpIconMask(icon: string): string {
    return `url("${icon}")`;
  }

  public static formatTitleModelOption(provider: string, model: string): string {
    return `${provider}: ${model}`;
  }

  public static formatApprovalKind(provider: string, kind: string): string {
    return `${provider}${Resources.titleSeparator}${kind}`;
  }

  public static formatServedRequester(module: string, tool: string, teammate: string, chat: string | null): string {
    const who = Object.isNull(chat) ? teammate : `${teammate} in "${chat}"`;
    return [Resources.permissionModuleNames[module] ?? module, tool, who].join(Resources.titleSeparator);
  }

  public static formatApprovalNativeKind(nativeKind: string): string {
    return `Kind: ${nativeKind}`;
  }

  public static formatAcpListOld(failure: string): string {
    return `This list may be out of date: ${failure}`;
  }

  public static formatAcpLocalVariableInvalid(name: string): string {
    return `"${name}" can't be a variable's name. A name is a letter or _, then letters, digits or _.`;
  }

  public static formatStopSubAgent(description: string): string {
    return `${Resources.stopSubAgentLabel} ${description}`;
  }

  public static formatPermissionDetail(label: string, value: string | null): string {
    return `${label}: ${value ?? Resources.secretDetailValue}`;
  }

  public static formatRefusedModeValue(name: string): string {
    return `refused:${name}`;
  }

  public static formatForkRefused(refusal: string): string {
    return `${refusal} The next reply starts a fresh one that is told what was said before.`;
  }

  public static formatForkUnavailable(displayName: string): string {
    return `${displayName} can't fork a session, so the next reply starts a fresh one that is told what was said before.`;
  }

  public static formatShellRunUnknown(language: string): string {
    return `TeamRun doesn't know which shell runs a code block marked ${language}, so it didn't run.`;
  }

  public static formatCodexSetup(url: string): string {
    return `[mcp_servers.teamrun]\nurl = ${JSON.stringify(url)}\nbearer_token_env_var = "TEAMRUN_TOKEN"`;
  }

  public static formatClaudeSetup(url: string): string {
    return JSON.stringify({ mcpServers: { teamrun: { type: "http", url, headers: { Authorization: "Bearer ${TEAMRUN_TOKEN}" } } } }, null, 2);
  }

  public static formatTaskWakeLabel(kind: string, name: string | null, ending: string | null): string {
    const command = kind === ProtocolResources.wakeCommandTask;
    const work = Object.isNull(name) ? `${command ? "A background command" : "A sub-agent"} of this chat` : `${command ? "Background command" : "Sub-agent"} "${name}"`;
    return `${work} ${ending ?? (command ? "was stopped" : "didn't come back")}`;
  }

  public static formatWakeReplyHeading(name: string, status: MessageStatus, text: string | null): string {
    if (status === MessageStatus.Cancelled)
      return `${name}'s reply was cancelled.`;
    if (status === MessageStatus.Failed)
      return `${name}'s reply failed.`;
    if (status === MessageStatus.Interrupted)
      return `${name}'s reply was interrupted.`;
    return Object.isNull(text) ? `${name} replied without text.` : `${name} replied:`;
  }

  public static formatSenderChat(title: string): string {
    return `from ${title}`;
  }

  public static formatImagesNotSeen(names: readonly string[]): string {
    return `${names.join(", ")} won't see the attached images: ${names.length === 1 ? "its model doesn't" : "their models don't"} take images.`;
  }

  public static formatNoticeKey(action: string, target: string): string {
    return `${action}${Resources.noticeKeySeparator}${target}`;
  }

  public static formatChatPageNotChanged(conversationId: string, failure: string): string {
    return `TeamRun could not open or close chat ${conversationId}'s Browser page: ${failure}.`;
  }

  public static formatProjectsLayoutNotRead(failure: string): string {
    return `TeamRun could not read the projects' layout, so it keeps the changes made since and reads it again at the next change or resync: ${failure}.`;
  }

  public static formatProjectsLayoutNotSaved(failure: string): string {
    return `TeamRun could not save the projects' layout, so the change stays in this window only: ${failure}.`;
  }

  public static formatNoticeNotPosted(kind: string, failure: string): string {
    return `TeamRun could not post a ${kind} notification: ${failure}.`;
  }

  public static formatOrganizationFlowDepartmentKey(departmentId: string): string {
    return `department:${departmentId}`;
  }

  public static formatOrganizationFlowSendId(sendId: string): string {
    return `send:${sendId}`;
  }

  public static formatOrganizationFlowId(messageId: string, outbound: boolean): string {
    return `${messageId}:${outbound ? "out" : "in"}`;
  }

  public static formatQualifiedName(name: string): string {
    return `${Resources.moduleId}${Resources.nameSeparator}${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  }

  public static formatDraftNotSaved(error: string): string {
    return `${Resources.draftNotSaved} ${error}`;
  }

  public static formatDraftUnreadable(error: string): string {
    return `${Resources.draftUnreadable} ${error}`;
  }

  public static formatOrganizationUnread(count: number): string {
    return `${count} unread`;
  }

  public static formatOrganizationChat(name: string): string {
    return `Chat with ${name}`;
  }

  public static formatOrganizationMessageNamed(name: string): string {
    return `Message ${name}`;
  }

  public static formatOrganizationEditType(name: string): string {
    return `Edit ${name}`;
  }

  public static formatOrganizationDepartmentOption(name: string, type: NodeType | null): string {
    return Object.isNull(type) ? name : `${name} (${type.name})`;
  }

  public static formatOrganizationLeaderOption(name: string, department: string): string {
    return `${name} (leads ${department})`;
  }

  public static formatOrganizationLastLine(author: string, text: string): string {
    return `${author}: ${text}`;
  }

  public static formatOrganizationReach(count: number): string {
    return count === 1 ? "Goes to 1 teammate" : `Goes to ${count} teammates`;
  }

  public static formatOrganizationFanOutKey(organizationId: string, teammateIds: readonly string[]): string {
    return `organization:${organizationId}:${teammateIds.join(",")}`;
  }

  public static formatOrganizationChatKey(organizationId: string, teammateId: string): string {
    return `${organizationId}/${teammateId}`;
  }

  public static formatOrganizationExplorerKey(organizationId: string): string {
    return `organization:${organizationId}`;
  }

  public static formatOrganizationChatNotOpened(message: string): string {
    return `The Explorer couldn't open the Organization chat: ${message}`;
  }

  public static formatNameTooLong(limit: number): string {
    return `A name can have at most ${limit} characters.`;
  }

  public static formatOrganizationActionFailed(message: string): string {
    return `The Explorer couldn't change the organization: ${message}`;
  }

  public static formatDeleteOrganizationText(name: string): string {
    return `Delete ${name}? Its units go, and its teammates leave it. The teammates themselves and their chats stay.`;
  }

  public static formatOrganizationFanOutRetry(key: string, text: string, sources: readonly string[]): string {
    return JSON.stringify([key, text, sources]);
  }


  public static formatValueKind(value: unknown): string {
    return Object.isNull(value) ? Resources.nullKind : typeof value;
  }

  public static formatListNotArray(kind: string): string {
    return `The runtime part answered a list with a value of kind ${kind}, which isn't a list.`;
  }

  public static formatHistoryReadMismatch(start: number, end: number): string {
    return `The messages from ${start} to ${end - 1} did not come back in order.`;
  }

  public static formatDataUrl(mediaType: string, data: string): string {
    return `data:${mediaType};base64,${data}`;
  }

  public static formatImageFileName(name: string, mediaType: string): string {
    return Resources.imageExtensionPattern.test(name) ? name : `${name}${Resources.imageExtensions[mediaType] ?? String.empty}`;
  }

  public static formatImageLoadFailed(name: string): string {
    return `${name} could not be loaded.`;
  }

  public static formatProfileFolderNotShown(reason: string): string {
    return `TeamRun couldn't show the profile folder. ${reason}`;
  }

  public static formatShowInFolderFailed(name: string): string {
    return `${name} could not be shown in its folder.`;
  }

  public static formatLinkedFileFailed(name: string): string {
    return `${name} could not be opened or shown in its folder; it may have been moved or deleted.`;
  }

  public static formatLinkedFileRefused(name: string): string {
    return `${name} wasn't opened: a reply's link opens a file in the chat's folder, or elsewhere on this computer by its full path.`;
  }

  public static formatAttachmentGone(name: string): string {
    return `${name} is no longer in TeamRun's data folder.`;
  }

  public static formatDraftFilesMissing(names: readonly string[]): string {
    return `These files of the unsent message are gone: ${names.join(", ")}.`;
  }

  public static formatDefaultTeammateError(error: string): string {
    return `${Resources.defaultTeammateTitle}: ${error}`;
  }

  public static formatTeammateError(name: string, error: string): string {
    return `@${name}: ${error}`;
  }

  public static formatAcpAgentActionTitle(action: ChatAction.AddAcpAgent | ChatAction.RemoveAcpAgent, name: string): string {
    return action === ChatAction.AddAcpAgent ? `Couldn't add ${name}` : `Couldn't remove ${name}`;
  }

  public static formatProviderActionTitle(action: ProviderAction, name: string | null): string {
    return Object.isNull(name) ? Resources.chatActionTitles[action] : Resources.providerActionTitles[action](name);
  }

  public static formatLocalProvider(label: string): string {
    return `${label}${Resources.titleSeparator}${Resources.thisComputerLabel}`;
  }

  public static formatReplyProvider(provider: string): string {
    return `${Resources.replyProviderMark}${provider}`;
  }

  public static formatMention(name: string): string {
    return `${ProtocolResources.mentionMarker}${name}`;
  }

  public static formatProviderChoice(kind: string, label: string): string {
    return kind === label ? kind : `${kind}${Resources.titleSeparator}${label}`;
  }

  public static formatRemoveAttachment(name: string): string {
    return `${Resources.removeAttachmentLabel}: ${name}`;
  }

  public static formatQuestionsAsked(name: string): string {
    return `${name} asks you`;
  }

  public static formatReplied(name: string): string {
    return `${name} replied`;
  }

  public static formatAsks(name: string, title: string): string {
    return `${name} asks: ${title}`;
  }

  public static formatQuestionsAnswered(name: string): string {
    return `You answered ${name}`;
  }

  public static formatQuestionsSkipped(name: string): string {
    return `You skipped ${name}'s questions`;
  }

  public static formatQuestionsWithdrawn(name: string): string {
    return `${name}'s questions were withdrawn`;
  }

  public static formatChatPermissions(mode: string): string {
    return `${Resources.chatPermissionsLabel}: ${mode}`;
  }

  public static formatChatPermissionsOf(provider: string): string {
    return `${Resources.chatPermissionsLabel}${Resources.titleSeparator}${provider}`;
  }

  public static formatOwnDefaultMode(name: string): string {
    return `${name}'s default`;
  }

  public static formatChangeDefaultMode(name: string): string {
    return `Change ${name}'s default…`;
  }

  public static formatPicker(summary: string): string {
    return `${Resources.pickerLabel}: ${summary}`;
  }

  public static formatPermissionsAndPicker(mode: string, summary: string): string {
    return `${Resources.permissionsAndPickerLabel}: ${mode}, ${summary}`;
  }

  public static formatAppliesInChat(name: string): string {
    return `Applies to ${Resources.formatMention(name)} in this chat.`;
  }

  public static formatMakeDefault(name: string): string {
    return `Make it ${Resources.formatMention(name)}'s default`;
  }

  public static formatModelUnavailable(model: string, reason: string): string {
    return `${model}${Resources.titleSeparator}${reason}`;
  }

  public static formatEditTeammate(name: string): string {
    return `Edit ${name}…`;
  }

  public static formatDefaultModel(model: string | null): string {
    return Object.isNull(model) ? Resources.providerDefaultModel : `${Resources.providerDefaultModel}${Resources.titleSeparator}${model}`;
  }

  public static formatProviderDefault(kind: string, model: string | null): string {
    return Object.isNull(model) ? `${kind}'s default` : `${kind}'s default${Resources.titleSeparator}${model}`;
  }

  public static formatUnavailable(name: string): string {
    return `${name} (unavailable)`;
  }

  public static formatProviderDisabled(name: string): string {
    return `${name} (provider disabled)`;
  }

  public static formatDisabledProviderOption(label: string): string {
    return `${label} (disabled)`;
  }

  public static formatContextWindowBounds(minimum: string, maximum: string): string {
    return `Type a size from ${minimum} to ${maximum}, with K or M after it.`;
  }

  public static formatContextWindowSummary(size: string, window: string | null): string {
    return Object.isNull(window) ? `The chat is summarised as it nears ${size}; the model's window stays the same.`
      : `The chat is summarised as it nears ${size} of the model's ${window} window, which stays the same.`;
  }

  public static formatDefaultContextWindow(window: string): string {
    return `Default (${window})`;
  }

  public static formatDefaultContextWindowSummary(window: string | null): string {
    return Object.isNull(window) ? "The chat is summarised as it nears the model's window." : `The chat is summarised as it nears the model's ${window} window.`;
  }

  public static formatUnlisted(value: string): string {
    return `${value} (not in the current catalog)`;
  }

  public static formatUnrestrictedModeTitle(mode: string): string {
    return `Use ${mode}?`;
  }

  public static formatUnrestrictedModeText(provider: string, description: string | null): string {
    const warning = `${provider} won't ask you before it acts, and its own restrictions are off. Choose it only for work you'd let it do unattended.`;
    return Object.isNull(description) ? warning : `${description} ${warning}`;
  }

  public static formatUseMode(mode: string): string {
    return `Use ${mode}`;
  }

  public static formatDeleteText(title: string): string {
    return `"${title}" and its messages are removed. This cannot be undone.`;
  }

  public static formatDeleteWithFilesText(title: string, count: number): string {
    return `"${title}", its messages and the ${Resources.formatFileCount(count)} it holds are removed. This cannot be undone. `
      + "To keep the chat and its files, move it to a folder instead.";
  }

  public static formatReplaceFolderText(attached: string, chosen: string): string {
    return `From the next turn, this chat's teammates work in "${chosen}" instead of "${attached}". No files are copied, moved or changed.`;
  }

  public static formatAttachedFolderNote(folder: string): string {
    return `Works in the attached folder ${folder}`;
  }

  public static formatAttachedFolderKept(folder: string): string {
    return `The folder attached to it, "${folder}", and its files stay as they are.`;
  }

  public static formatMoveText(count: number, project: string): string {
    return `The ${Resources.formatFileCount(count)} this chat holds ${count === 1 ? "is" : "are"} copied to "${project}", and the chat goes on there. Its own Git history isn't copied.`;
  }

  public static formatFileCount(count: number): string {
    return count === 1 ? "1 file" : `${count} files`;
  }

  public static formatOwnMcpServersAnd(servers: string, note: string): string {
    return `${servers} and ${note}`;
  }

  public static formatOwnMcpServersWithNote(summary: string, note: string): string {
    return `${summary}; ${note}`;
  }

  public static formatServerCount(count: number): string {
    return count === 1 ? "1 server" : `${count} servers`;
  }

  public static formatForgetText(name: string): string {
    return `"${name}" and every chat under it are removed from TeamRun. The folder itself stays.`;
  }

  public static formatShowMore(count: number): string {
    return `Show ${count} more`;
  }

  public static formatProjectFolderMissing(rootPath: string): string {
    return `The folder is missing or didn't answer: ${rootPath}`;
  }

  public static formatRowMoved(label: string, position: number, count: number): string {
    return `Moved ${label} to position ${position} of ${count}`;
  }

  public static formatRowMoveRefused(label: string, isUp: boolean): string {
    return isUp ? `${label} is first, so it can't move up` : `${label} is last, so it can't move down`;
  }

  public static formatProvenance(kind: string | null, model: string | null, effort: string | null): string {
    return [kind, model, effort].filter(t => !Object.isNull(t)).join(Resources.titleSeparator);
  }

  public static formatContextGauge(percent: number): string {
    return `Context ${percent}%`;
  }

  public static formatContextHint(gauge: string, detail: string): string {
    return `${gauge}. ${detail}`;
  }

  public static formatContextDetail(teammate: string, used: string, window: string): string {
    return `${teammate}'s session holds ${used} of ${window} tokens.`;
  }

  public static formatCompactsAt(percent: number): string {
    return `It compacts at ${percent}%.`;
  }

  public static formatTokensIn(count: string): string {
    return `${count} tokens in`;
  }

  public static formatTokensOut(count: string): string {
    return `${count} tokens out`;
  }

  public static formatShortTokensIn(count: string): string {
    return `${count} in`;
  }

  public static formatShortTokensOut(count: string): string {
    return `${count} out`;
  }

  public static formatShortContext(percent: number): string {
    return `${percent}% context`;
  }

  public static formatContextShare(percent: number, window: string): string {
    return `${percent}% of ${window} tokens`;
  }

  public static formatShowStats(label: string): string {
    return `Stats: ${label}`;
  }

  public static formatCost(amount: string): string {
    return `$${amount}`;
  }

  public static formatPlanWindow(label: string, figure: string, reset: string | null): string {
    return Object.isNull(reset) ? `${label}: ${figure}` : `${label}: ${figure}, ${reset}`;
  }

  public static formatPlanShort(label: string, figure: string): string {
    return `${label} ${figure}`;
  }

  public static formatPercentUsed(percent: number): string {
    return `${percent}% used`;
  }

  public static formatCountUsed(used: string, allowance: string, percent: number | null): string {
    return Object.isNull(percent) ? `${used} of ${allowance} used` : `${used} of ${allowance} used (${percent}%)`;
  }

  public static formatPercentLeft(percent: number): string {
    return `${percent}% left`;
  }

  public static formatShortPercent(percent: number): string {
    return `${percent}%`;
  }

  public static formatShortCount(used: string, allowance: string, percent: number | null): string {
    return Object.isNull(percent) ? `${used}/${allowance}` : `${used}/${allowance} (${percent}%)`;
  }

  public static formatShortLeft(percent: number): string {
    return `${percent}% left`;
  }

  public static formatShortCountLeft(left: string, allowance: string): string {
    return `${left} of ${allowance} left`;
  }

  public static formatNoLimits(kind: string): string {
    return `${kind} reports no limits`;
  }

  public static formatBalanceLeft(balance: string): string {
    return `${balance} left`;
  }

  public static formatWeekdayTimePattern(time: string): string {
    return `${Resources.shortWeekdayToken} ${time}`;
  }

  public static formatSignInUnfinished(command: string | null): string {
    return Object.isNull(command) ? Resources.signInUnfinished : `Sign-in didn't finish: the terminal closed before ${command} ended.`;
  }

  public static formatUsedUp(time: string): string {
    return `${Resources.usedUpLabel}, ${Resources.formatResets(time)}`;
  }

  public static formatLimitUsedUp(limit: string): string {
    return `${limit} limit used up`;
  }

  public static formatUsedUpNote(what: string, time: string): string {
    return `${what}${Resources.titleSeparator}${Resources.formatResets(time)}`;
  }

  public static formatWasUsedUp(time: string): string {
    return `Was used up until ${time}`;
  }

  public static formatUsedUpTurn(provider: string, state: string): string {
    return `${provider}: ${state.charAt(0).toLowerCase()}${state.slice(1)}.`;
  }

  public static formatResets(time: string): string {
    return `resets ${time}`;
  }

  public static formatSentences(parts: readonly string[]): string {
    return parts.map(t => `${t}.`).join(" ");
  }

  public static formatWorkedFor(duration: string): string {
    return `Worked for ${duration}`;
  }

  public static formatWorkingFor(duration: string): string {
    return `${Resources.workingLabel} for ${duration}`;
  }

  public static formatThinkingFor(duration: string): string {
    return `${Resources.thinkingLabel} ${duration}`;
  }

  public static formatSavingCheckpointFor(duration: string): string {
    return `${Resources.savingCheckpointLabel} ${duration}`;
  }

  public static formatCommandCount(count: number): string {
    return count === 1 ? "ran 1 command" : `ran ${count} commands`;
  }

  public static formatAddCount(count: number): string {
    return count === 1 ? "added 1 file" : `added ${count} files`;
  }

  public static formatEditCount(count: number): string {
    return count === 1 ? "edited 1 file" : `edited ${count} files`;
  }

  public static formatDeleteCount(count: number): string {
    return count === 1 ? "deleted 1 file" : `deleted ${count} files`;
  }

  public static formatReadCount(count: number): string {
    return count === 1 ? "read 1 file" : `read ${count} files`;
  }

  public static formatSearchCount(count: number): string {
    return count === 1 ? "searched once" : `searched ${count} times`;
  }

  public static formatThoughtCount(count: number): string {
    return count === 1 ? "thought once" : `thought ${count} times`;
  }

  public static formatSubAgentTitle(type: string | null, description: string): string {
    return Object.isNull(type) || type === description ? description : `${type}${Resources.titleSeparator}${description}`;
  }

  public static formatToolUseCount(count: number): string {
    return count === 1 ? "1 tool use" : `${count} tool uses`;
  }

  public static formatTokenCount(count: string): string {
    return `${count} tokens`;
  }

  public static formatToolCount(count: number): string {
    return count === 1 ? "1 tool" : `${count} tools`;
  }

  public static formatCompactTokens(count: number): string {
    return Resources.formatTokenCount(count.toLocaleString(Resources.usageNumberLocale, Resources.compactCountFormat).toLowerCase());
  }

  public static formatRunningSubAgents(count: number): string {
    return `${count} running`;
  }

  public static formatStepSelector(step: number): string {
    return `li[data-step="${step}"]`;
  }

  public static formatSubAgentStepSelector(messageId: string, step: number | null): string {
    return `[data-message-id="${CSS.escape(messageId)}"] ${Resources.subAgentStepSelector}[data-step="${step}"]`;
  }

  public static formatSubAgentAsks(name: string): string {
    return `${name} asks`;
  }

  public static formatOtherStepCount(count: number, alone: boolean): string {
    if (alone)
      return Resources.formatSteps(count);
    return count === 1 ? "1 more step" : `${count} more steps`;
  }

  public static formatActivitySummary(parts: readonly string[]): string {
    const joined = parts.join(", ");
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }

  public static formatRunningTasks(count: number): string {
    return count === 1 ? "1 task running" : `${count} tasks running`;
  }

  public static formatSteps(count: number): string {
    return count === 1 ? "1 step" : `${count} steps`;
  }

  public static formatDuration(milliseconds: number): string {
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    if (seconds < 60)
      return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
      return `${minutes}m ${seconds % 60}s`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  public static formatShowMoreFiles(count: number): string {
    return count === 1 ? "Show 1 more file" : `Show ${count} more files`;
  }

  public static formatErrorSlot(key: number): string {
    return `error-${key}`;
  }

  public static formatImageSlot(key: number): string {
    return `image-${key}`;
  }

  public static formatPlanProgress(done: number, total: number): string {
    return `${done} of ${total}`;
  }

  public static formatPlanSlot(key: number): string {
    return `plan-${key}`;
  }

  public static formatSteerSlot(messageId: string): string {
    return `steer-${messageId}`;
  }

  public static formatApprovalsSlot(key: number): string {
    return `approvals-${key}`;
  }

  public static installActionOf(installation: ProviderKindInstallation): string {
    return Object.isNull(installation.version) ? "Installing…" : "Updating…";
  }

  public static formatLiveStatus(subject: string, status: string): string {
    return `${subject}: ${status}`;
  }

  public static formatInstalling(installation: ProviderKindInstallation): string {
    return `${Resources.installActionOf(installation)} ${Resources.installProgressOf(installation)}`;
  }

  public static formatKindInstalling(kind: string, installation: ProviderKindInstallation): string {
    const action = Object.isNull(installation.version) ? "Installing" : "Updating";
    return `${action} ${kind}… ${Resources.installProgressOf(installation)}`;
  }

  public static formatAddInstalling(kind: string, installation: ProviderKindInstallation): string {
    if (!installation.cancellable)
      return `Installing ${kind}: setting up`;
    if (installation.total === 0)
      return `Installing ${kind}: starting`;
    const received = Math.floor(installation.received / Resources.megabyte);
    return `Installing ${kind}: downloading ${received} of ${Math.ceil(installation.total / Resources.megabyte)} MB`;
  }

  public static formatToolInstallFailed(kind: string): string {
    return `The install command ended without installing ${kind}. Choose Add to run it again.`;
  }

  public static formatUpdateTo(version: string): string {
    return `Update to ${version}`;
  }

  public static formatKindUpdate(version: string): string {
    return `version ${version} is available`;
  }

  public static formatKindInstalledNote(version: string | null): string {
    return Object.isNull(version) ? Resources.kindInstalledNote : `${Resources.kindInstalledNote}${Resources.titleSeparator}${version}`;
  }

  public static formatKindUnavailableNote(missingTool: string | null): string {
    return Object.isNull(missingTool) ? Resources.kindUnavailableNote : `Needs ${missingTool} first`;
  }

  public static formatShownAs(name: string, kind: string): string {
    return `Shown as "${name}${Resources.titleSeparator}${kind}"`;
  }

  public static formatExistingFolderNote(folder: string): string {
    return `Folder: ${folder}`;
  }

  public static formatUnavailableStep(reason: string | null): string {
    return Object.isNull(reason) ? Resources.unknownUnavailableStep : `${reason} Once it has, choose Try again.`;
  }

  public static formatToolInstallStep(kind: string): string {
    return `TeamRun doesn't install ${kind} itself. Add runs its install command in a terminal below and adds the provider once it finds ${kind}; if you install it another way, choose Try again:`;
  }

  public static nextProviderName(taken: readonly string[]): string {
    const used = new Set(taken.map(t => t.toLocaleLowerCase()));
    const free = Resources.providerNames.find(t => !used.has(t.toLocaleLowerCase()));
    if (!Object.isUndefined(free))
      return free;
    let number = 2;
    while (used.has(`${Resources.spareProviderName} ${number}`.toLocaleLowerCase()))
      number++;
    return `${Resources.spareProviderName} ${number}`;
  }

  public static installProgressOf(installation: ProviderKindInstallation): string {
    if (!installation.cancellable)
      return "setting up";
    const percent = installation.total === 0 ? 0 : Math.floor(installation.received * Resources.percentScale / installation.total);
    return `${percent}%`;
  }

  public static formatShortcut(...keys: readonly string[]): string {
    return keys.join("+");
  }

  public static formatWaitingCount(count: number): string {
    return `Waiting (${count})`;
  }

  public static formatWaitingMenu(text: string): string {
    return `More actions for "${text}"`;
  }

  public static formatSteerWaits(refusal: string): string {
    return `Waits for the reply to end. ${refusal}`;
  }

  public static formatProviderMenu(label: string): string {
    return `More actions for ${label}`;
  }

  public static formatTerminalHeading(title: string): string {
    return `Terminal${Resources.titleSeparator}${title}`;
  }

  public static formatCloseTerminal(title: string): string {
    return `Close ${title}`;
  }

  public static formatSignInTerminal(provider: string, kind: string): string {
    return `${Resources.signInLabel} ${provider}${Resources.titleSeparator}${kind}`;
  }

  public static formatKindAction(action: string, kind: string): string {
    return `${action} ${kind}`;
  }

  public static formatSameSignIn(label: string): string {
    return `Same sign-in as ${label}`;
  }

  public static formatProfileFolder(path: string): string {
    return `${Resources.profileFolderLabel}: ${path}`;
  }

  public static formatBinaryPath(path: string): string {
    return `Runs ${path}`;
  }

  public static formatRowAction(action: string, name: string): string {
    return `${action} ${name}`;
  }

  public static formatGrantChat(title: string | null, teammateName: string | null): string {
    const chat = title ?? Resources.deletedChatLabel;
    return Object.isNull(teammateName) ? chat : `${chat}${Resources.titleSeparator}${teammateName}`;
  }

  public static formatMessageSearchDetail(teammate: string, chat: string, since: string): string {
    return `${teammate} in ${chat}${Resources.titleSeparator}${since}`;
  }

  public static formatSince(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / Resources.minuteMilliseconds);
    const unit = Resources.relativeTimeUnits.findLast(t => minutes >= t.minutes);
    return Object.isUndefined(unit) ? Resources.justNowLabel : Resources.relativeTime.format(-Math.floor(minutes / unit.minutes), unit.unit);
  }

  public static formatAgo(minutes: number): string {
    if (minutes < 1)
      return Resources.justNowLabel;
    if (minutes < Resources.hourMinutes)
      return `${minutes} min ago`;
    const hours = Math.floor(minutes / Resources.hourMinutes);
    return hours < Resources.dayHours ? `${hours} h ago` : `${Math.floor(hours / Resources.dayHours)} d ago`;
  }

  public static formatChecked(ago: string): string {
    return `Checked ${ago}`;
  }

  public static formatSearched(ago: string): string {
    return `Searched ${ago}`;
  }

  public static formatLookingFor(kinds: readonly string[]): string {
    const named = kinds.slice(0, Resources.lookedForKinds);
    if (kinds.length > named.length)
      return `Looking for ${named.join(", ")} and the others…`;
    return named.length > 1 ? `Looking for ${named.slice(0, -1).join(", ")} and ${named.at(-1)}…` : `Looking for ${named.join("")}…`;
  }

  public static formatAddFound(name: string, about: string): string {
    return `${Resources.addFoundLabel} ${name}, ${about}`;
  }

  public static formatSharedMcpServersUnread(error: string): string {
    return `The shared servers couldn't be read: ${error}`;
  }

  public static formatDeleteSharedMcpServer(name: string): string {
    return `Delete the shared MCP server ${name}? Providers and teammates stop getting it from their next session.`;
  }

  public static formatSharedMcpTeammate(server: string, teammate: string): string {
    return `${server} for ${teammate}`;
  }

  public static formatSharedMcpVariableSource(variable: string): string {
    return `Where ${variable} comes from`;
  }

  public static formatSharedMcpReveal(variable: string, shown: boolean): string {
    return `${shown ? "Hide" : "Show"} the value of ${variable}`;
  }

  public static formatSharedMcpSecretUpdated(at: string): string {
    return `Updated ${at}`;
  }

  public static formatSharedMcpMovedToSaved(variables: readonly string[]): string {
    return `${variables.join(", ")} now ${variables.length === 1 ? "takes a saved secret" : "take saved secrets"}. Saving keeps what you typed.`;
  }

  public static formatSharedMcpSecretsSaved(server: string, variables: readonly string[]): string {
    return `Saved ${variables.join(", ")} for ${server} in the secret store.`;
  }

  public static formatSharedMcpSecret(variable: string): string {
    return `Value of ${variable}`;
  }

  public static formatOwnMcpServersUnread(error: string): string {
    return `TeamRun couldn't read its configuration: ${error}`;
  }

  public static formatNewChatWith(name: string): string {
    return `New chat with ${name}`;
  }

  public static formatDeleteTeammate(name: string): string {
    return `Delete @${name}? Their memberships will be removed. Existing messages will keep their name.`;
  }

  public static formatExitCode(code: number): string {
    return `Exited with code ${code}`;
  }

  public static formatProviderNeeded(kind: string): string {
    return `Choose a ${kind} provider for this chat in the Provider menu, or add one on the Providers page.`;
  }

  public static formatProviderNotSignedIn(kind: string): string {
    return `${kind} isn't signed in. Choose Providers to connect one.`;
  }

  public static formatProviderModelsUnavailable(kind: string): string {
    return `${kind} can't list its models, so it can't reply. Choose Providers to check its sign-in.`;
  }

  public static formatModelsCameBackEmpty(kind: string): string {
    return `${kind}'s model list came back empty. Choose ${Resources.refreshModelsLabel} to try again.`;
  }

  public static formatModelNotAvailable(fallback: string, model: string): string {
    return `${fallback}, ${model} not available`;
  }

  public static formatSpeedUnavailable(reason: string, served: string | null = null): string | null {
    return reason === Resources.speedPendingReason ? null
      : `${Resources.speedReasons[reason] ?? Resources.speedUnavailableNote} ${Object.isNull(served) ? Resources.standardSpeedNote : `Replies run at ${served} speed.`}`;
  }

  public static formatUsageHandOffField(position: number): string {
    return `Hand-off teammate ${position}`;
  }

  public static formatEffort(effort: string | null): string {
    return Object.isNull(effort) ? Resources.modelDefaultEffort : effort.charAt(0).toUpperCase() + effort.slice(1);
  }

  public static formatWithPlanChange(note: string, kind: string, profileDir: string | null): string {
    const hint = Resources.planChangeHints.get(kind);
    return Object.isUndefined(hint) ? note : `${note} ${hint(profileDir)}`;
  }

  public static formatCopilotPlanChange(profileDir: string | null): string {
    const login = Object.isNull(profileDir) ? "copilot login in a terminal" : `copilot login in a terminal with COPILOT_HOME set to ${profileDir}`;
    return `If your Copilot plan changed, sign in again by running ${login}, then choose ${Resources.refreshModelsLabel}; until then Copilot keeps the old plan's models.`;
  }

  public static formatPlanIncludesOnly(plan: string, model: string): string {
    return `Your ${plan} plan currently includes only ${model}, which automatically selects the best available model for each task.`;
  }

  public static formatModelsAwaitFirstReply(kind: string): string {
    return `${kind}'s models aren't listed yet. They show after this provider's first reply; until then it uses its own default.`;
  }

  public static formatModelsNotListed(kind: string): string {
    return `${kind} doesn't list its models, so it uses its own default.`;
  }

  public static formatSignedOut(label: string): string {
    return `Signed out of “${label}”.`;
  }

  public static formatSignOutUnknown(label: string): string {
    return `TeamRun couldn't tell whether “${label}” finished signing out: its terminal closed without the command's exit code.`;
  }

  public static formatStillSignedIn(label: string): string {
    return `“${label}” is still signed in.`;
  }

  public static formatSignOut(label: string, kind: string): string {
    return `Sign out of “${label}”? ${kind} forgets its sign-in in this connection's profile folder, so a reply it's running now may fail, and teammates using this ` +
      "connection can't reply until it signs in again.";
  }

  public static formatSignOutShared(label: string, kind: string): string {
    return `Sign out of “${label}”? ${kind} keeps its sign-in in this computer's keychain, shared with your own ${kind} CLI, so this signs your ${kind} CLI out ` +
      `too, and signing in again replaces its sign-in. A reply it's running now may fail, and teammates using this connection can't reply until it ` +
      "signs in again.";
  }

  public static formatSignOutPersonal(label: string, kind: string): string {
    return `Sign out of “${label}”? It runs in your own ${kind} home with its sign-in, shared with your own ${kind} CLI, so this signs your ${kind} CLI out ` +
      `too, and signing in again replaces its sign-in. A reply it's running now may fail, and teammates using this connection can't reply until it ` +
      "signs in again.";
  }

  public static formatSignOutByCommand(label: string, kind: string, command: string, folder: string): string {
    return `${kind} signs “${label}” out with its own command. TeamRun runs ${command} in a terminal with this connection's profile folder, ${folder}, ` +
      "where you choose what to sign out of, and closes it once the command ends without an error. A reply running now may fail.";
  }

  public static formatSignOutInTool(label: string, kind: string, command: string, folder: string): string {
    return `${kind} signs “${label}” out only in its own session. TeamRun opens it in a terminal with this connection's profile folder, ${folder}, where you type ` +
      `${command}, then leave it. ${kind} may keep its sign-in in this computer's keychain, which other connections can share, so they may sign out too, and a ` +
      "reply running now may fail.";
  }

  public static formatRemoveQuestion(teammates: readonly string[]): string {
    const named = teammates.map(t => `@${t}`);
    if (named.length === 0)
      return Resources.removeQuestion;
    const users = named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named.at(-1)} use` : `${named.join("")} uses`;
    return `${Resources.removeQuestion} ${users} it and will stop answering until you give them another provider.`;
  }

  public static formatNewFolder(dataFolder: string | null, kind: string, name: string): string {
    if (Object.isNull(dataFolder))
      return `TeamRun makes a folder named ${name} for the provider in its data folder.`;

    const separator = dataFolder.includes(Resources.backslash) ? Resources.backslash : Resources.slash;
    return `TeamRun makes the folder ${[dataFolder, ProtocolResources.profilesDirectoryName, kind, name].join(separator)} for the provider.`;
  }

  public static formatToolFound(kind: string, version: string | null): string {
    return `Installed: TeamRun runs ${kind} through its command-line tool${Object.isNull(version) ? "" : `, version ${version}`}, found on this computer.`;
  }

  public static formatToolMissing(kind: string): string {
    return `Not installed: TeamRun runs ${kind} through its command-line tool, which isn't on this computer.`;
  }

  public static formatOwnCopyInstalled(kind: string, version: string | null, update: string | null): string {
    const installed = `Installed: TeamRun runs ${kind} through a copy it installed itself${Object.isNull(version) ? "" : `, version ${version}`}.`;
    return Object.isNull(update) ? installed : `${installed} Version ${update} is available.`;
  }

  public static formatOwnCopyMissing(kind: string): string {
    return `Not installed: TeamRun runs ${kind} through a copy it downloads and installs itself, not one you installed.`;
  }

  public static formatTerminalInstallTitle(displayName: string): string {
    return `${Resources.installLabel} ${displayName}`;
  }

  public static formatTerminalSignInTitle(label: string): string {
    return Resources.formatTerminalTitle(Resources.signInLabel, label);
  }

  public static formatTerminalSignOutTitle(label: string): string {
    return Resources.formatTerminalTitle(Resources.signOutLabel, label);
  }

  public static formatNewFolderNameless(label: string): string {
    return `The name "${label}" has no character a folder name can use. Choose another name.`;
  }

  public static profileHintFor(kind: string, sharesSignIn: boolean = false, windows: boolean = false): string {
    if (kind.length === 0)
      return Resources.noProviderProfileHint;

    return (sharesSignIn ? Resources.sharedSignInProfileHints.get(kind) : undefined) ?? (windows ? Resources.windowsProfileHints.get(kind) : undefined)
      ?? Resources.profileHints.get(kind) ?? Resources.profileHint;
  }

  private static formatTerminalTitle(action: string, label: string): string {
    const title = `${action} ${label}`;
    if (title.length <= Resources.terminalTitleLimit)
      return title;
    let kept = String.empty;
    for (const character of title) {
      if (kept.length + character.length >= Resources.terminalTitleLimit)
        break;
      kept += character;
    }
    return `${kept}${Resources.ellipsis}`;
  }

  public static formatSharedMcpSignInNeeded(reason: string): string {
    return `Needs a new sign-in. ${reason}`;
  }

  public static formatSharedMcpSignIn(server: string): string {
    return `Sign in to ${server}`;
  }

  public static formatSharedMcpRow(server: string, state: string): string {
    return `${server}, ${state}`;
  }

  public static formatSharedMcpUnset(variables: readonly string[]): string {
    return `${variables.join(Resources.sharedMcpNameSeparator)} not set`;
  }

  public static formatSharedMcpCanCount(count: number): string {
    return `+ ${count} can`;
  }

  public static formatSharedMcpCantTake(count: number): string {
    return `${count} can't take it yet`;
  }

  public static formatSharedMcpReasonGroup(providers: readonly string[], reason: string): string {
    return `${providers.join(Resources.sharedMcpNameSeparator)}: ${reason}`;
  }

  public static formatSharedMcpProviderSwitch(server: string, provider: string): string {
    return `${server} for ${provider}`;
  }

  public static formatOwnMcpServersSwitch(provider: string): string {
    return `Use ${provider}'s own servers`;
  }

  public static formatSharedMcpRemoveException(teammate: string): string {
    return `Remove ${teammate}'s exception`;
  }

  public static formatSharedMcpSignOut(server: string): string {
    return `Sign out of ${server}`;
  }

  public static formatGitHubReferenceLocation(owner: string, repository: string, number: number): string {
    return `${owner}/${repository} #${number}`;
  }

  public static formatGitHubRepositoryAddress(owner: string, repository: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubReferenceHost}/${owner}/${repository}`;
  }

  public static formatGitHubTextAddress(reference: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubReferenceHost}/${reference.replace(Resources.gitHubTextNumberMark, `/${Resources.gitHubIssuesSegment}/`)}`;
  }

  public static formatGitHubPullFilesAddress(owner: string, repository: string, number: number): string {
    return `${Resources.formatGitHubRepositoryAddress(owner, repository)}/${Resources.gitHubPullSegment}/${number}/${Resources.gitHubFilesSegment}`;
  }

  public static formatGitHubPersonAddress(login: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubReferenceHost}/${encodeURIComponent(login)}`;
  }

  public static formatGitHubAppAddress(name: string): string {
    return `${Resources.gitHubReferenceProtocol}//${Resources.gitHubReferenceHost}/${Resources.gitHubAppsSegment}/${encodeURIComponent(name)}`;
  }

  public static formatGitHubReferenceReadFailed(error: string): string {
    return `Reading a GitHub reference failed, so it shows as a plain link: ${error}`;
  }

  public static formatBrowserShowPage(url: string): string {
    return `Bring ${url} forward in the chat's page`;
  }

  public static formatBrowserElement(name: string | null): string {
    return Object.isNull(name) ? Resources.browserUnnamedElement : `"${name}"`;
  }

  public static formatBrowserStaleNote(tool: string): string {
    return Resources.browserStale[tool] ?? "the page changed before it acted, so nothing happened";
  }

  public static formatBrowserClicked(element: string, phase: BrowserStepPhase, why: string | null): string {
    return Resources.browserStep(new BrowserStepWords(`Clicked ${element}`, `Clicking ${element}`, `Didn't click ${element}`), phase, [why]);
  }

  public static formatBrowserTyped(element: string, isSecret: boolean, phase: BrowserStepPhase, why: string | null): string {
    return Resources.browserStep(new BrowserStepWords(`Typed into ${element}`, `Typing into ${element}`, `Didn't type into ${element}`), phase, [isSecret ? Resources.browserHiddenNote : null, why]);
  }

  public static formatBrowserPressed(key: string, phase: BrowserStepPhase, why: string | null): string {
    return Resources.browserStep(new BrowserStepWords(`Pressed ${key}`, `Pressing ${key}`, `Didn't press ${key}`), phase, [why]);
  }

  public static formatBrowserWent(action: string, phase: BrowserStepPhase, why: string | null): string {
    return Resources.browserStep(Resources.browserWent[action] ?? new BrowserStepWords(`Went ${action}`, `Going ${action}`, `Didn't go ${action}`), phase, [why]);
  }

  public static formatBrowserOpened(url: string, phase: BrowserStepPhase, why: string | null): string {
    return Resources.browserStep(new BrowserStepWords(`Opened ${url}`, `Opening ${url}`, `Didn't open ${url}`), phase, [why]);
  }

  public static formatBrowserRefusedSite(url: string): string {
    return [`Couldn't open ${URL.parse(url)?.host ?? url}`, Resources.browserNotAllowedNote].join(Resources.browserStepSeparator);
  }

  public static formatBrowserRead(tool: string, url: string | null, phase: BrowserStepPhase, why: string | null): string {
    const words = Resources.browserReads[tool] ?? new BrowserStepWords("Used", "Using", "use");
    const target = url ?? Resources.browserThePage;
    return Resources.browserStep(new BrowserStepWords(`${words.done} ${target}`, `${words.doing} ${target}`, `Couldn't ${words.undone} ${target}`), phase, [why]);
  }

  public static isBrowserReading(tool: string): boolean {
    return Object.hasOwn(Resources.browserReads, tool);
  }

  public static formatLowRiskRead(words: LowRiskReadWords, url: string | null, text: string | null): string {
    const done = Object.isNull(text) ? words.same : `waited for "${text}"`;
    return Object.isNull(url) ? done : Object.isNull(text) ? `${words.changed} ${url}` : `${done} on ${url}`;
  }

  public static formatLowRiskLine(requester: string, steps: readonly string[]): string {
    return `${Resources.lowRiskLead}${requester} ${steps.join(Resources.browserStepSeparator)}`;
  }

  public static formatOrganizationBoardMessage(name: string): string {
    return `Message ${name}`;
  }

  public static formatOrganizationBoardAnswer(action: string, name: string): string {
    return `${action} ${name}`;
  }

  public static formatOrganizationBoardAskAgo(endedAt: number, now: number): string {
    return `· ${Resources.formatAgo(Math.floor((now - endedAt) / Resources.minuteMilliseconds))}`;
  }

  public static formatOrganizationBoardSort(name: string): string {
    return `Sort ${name} by`;
  }

  public static formatOrganizationBoardSummary(leader: string | null, counts: ReadonlyMap<TeammateStatus, number>): string {
    return [...Object.isNull(leader) ? [] : [`Led by ${leader}`], ...Resources.statusCountParts(counts)].join(" · ");
  }

  public static formatOrganizationFocusLeaders(count: number, counts: ReadonlyMap<TeammateStatus, number>, under: number = 0): string {
    const reports = `Your ${count} ${count === 1 ? "direct report" : "direct reports"}`;
    return [under === 0 ? reports : `${reports} and ${under} under them`, ...Resources.statusCountParts(counts)].join(" · ");
  }

  public static formatOrganizationFocusDepartment(count: number, counts: ReadonlyMap<TeammateStatus, number>): string {
    return [`${count} ${count === 1 ? "teammate" : "teammates"}`, ...Resources.statusCountParts(counts)].join(" · ");
  }

  public static formatOrganizationFocusTeammate(role: string | null, department: string, model: string | null): string {
    return [Object.isNull(role) ? department : `${role} in ${department}`, ...Object.isNull(model) ? [] : [model]].join(" · ");
  }

  public static formatOrganizationFocusAddMember(name: string): string {
    return `Add a member to ${name}`;
  }

  public static formatOrganizationFocusAsks(count: number): string {
    return `${count} need you`;
  }

  public static formatOrganizationFocusToggle(isOpen: boolean, name: string): string {
    return `${isOpen ? "Hide" : "Show"} ${name}'s teammates`;
  }

  private static statusCountParts(counts: ReadonlyMap<TeammateStatus, number>): readonly string[] {
    return Object.values(TeammateStatus).flatMap(t => (counts.get(t) ?? 0) > 0 ? [`${counts.get(t)} ${Resources.teammateStatusLabels[t].toLowerCase()}`] : []);
  }

  private static browserStep(words: BrowserStepWords, phase: BrowserStepPhase, notes: readonly (string | null)[]): string {
    const shown = phase === BrowserStepPhase.Running ? words.doing : phase === BrowserStepPhase.Done ? words.done : words.undone;
    return [shown, ...notes.filter(t => !Object.isNull(t))].join(Resources.browserStepSeparator);
  }
}
