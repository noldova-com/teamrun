/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly protocolVersion: string = "__PROTOCOL_VERSION__";
  public static readonly defaultMaximumFrameLength: number = 16 * 1024 * 1024;
  public static readonly frameDelimiter: string = "\n";
  public static readonly shellOwner: string = "shell";
  public static readonly nameSeparator: string = ".";
  public static readonly pathSeparator: string = ".";
  public static readonly ownerPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly memberPattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly protocolVersionPattern: RegExp = /^[1-9][0-9]*$/;
  public static readonly moduleVersionPattern: RegExp = /^(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})$/;

  public static readonly kindField: string = "kind";
  public static readonly idField: string = "id";
  public static readonly methodField: string = "method";
  public static readonly nameField: string = "name";
  public static readonly payloadField: string = "payload";
  public static readonly failureField: string = "failure";
  public static readonly codeField: string = "code";
  public static readonly messageField: string = "message";
  public static readonly timeoutField: string = "timeoutMilliseconds";
  public static readonly identityField: string = "identity";
  public static readonly tokenField: string = "token";
  public static readonly clientField: string = "client";
  public static readonly productVersionField: string = "productVersion";
  public static readonly protocolVersionField: string = "protocolVersion";
  public static readonly fingerprintField: string = "fingerprint";
  public static readonly detailsField: string = "details";
  public static readonly executablePathField: string = "executablePath";
  public static readonly policyField: string = "policy";
  public static readonly descriptionsField: string = "descriptions";
  public static readonly locationField: string = "location";
  public static readonly stateField: string = "state";
  public static readonly causeField: string = "cause";
  public static readonly displayNameField: string = "displayName";
  public static readonly versionField: string = "version";
  public static readonly dependenciesField: string = "dependencies";
  public static readonly contributesField: string = "contributes";
  public static readonly blockedByField: string = "blockedBy";
  public static readonly modulesField: string = "modules";
  public static readonly deviceField: string = "device";
  public static readonly windowField: string = "window";
  public static readonly valueField: string = "value";
  public static readonly titleField: string = "title";
  public static readonly iconField: string = "icon";
  public static readonly defaultKeyField: string = "defaultKey";
  public static readonly commandsField: string = "commands";
  public static readonly isEnabledField: string = "isEnabled";
  public static readonly isCheckedField: string = "isChecked";
  public static readonly argumentsField: string = "arguments";
  public static readonly commandsMember: string = "commands";
  public static readonly runCommandMember: string = "runCommand";
  public static readonly notificationsMember: string = "notifications";
  public static readonly postNotificationMember: string = "postNotification";
  public static readonly updateNotificationMember: string = "updateNotification";
  public static readonly dismissNotificationMember: string = "dismissNotification";
  public static readonly markNotificationsReadMember: string = "markNotificationsRead";
  public static readonly clearNotificationsMember: string = "clearNotifications";
  public static readonly keyField: string = "key";
  public static readonly textField: string = "text";
  public static readonly severityField: string = "severity";
  public static readonly openField: string = "open";
  public static readonly actionsField: string = "actions";
  public static readonly progressField: string = "progress";
  public static readonly commandField: string = "command";
  public static readonly postField: string = "post";
  public static readonly postedAtField: string = "postedAt";
  public static readonly isReadField: string = "isRead";
  public static readonly notificationsField: string = "notifications";
  public static readonly isDoNotDisturbField: string = "isDoNotDisturb";
  public static readonly quietDevicesField: string = "quietDevices";
  public static readonly mutedModulesField: string = "mutedModules";
  public static readonly idsField: string = "ids";
  public static readonly sequenceField: string = "sequence";
  public static readonly keyParameterName: string = "key";
  public static readonly commandTitleInvalid: string = "A command's title must not be blank.";
  public static readonly commandIconInvalid: string = "A command's icon, when it has one, must not be blank.";
  public static readonly notificationKeyInvalid: string = "A notification's key, when it has one, must not be blank.";
  public static readonly notificationTitleInvalid: string = "A notification's title must not be blank.";
  public static readonly notificationTextInvalid: string = "A notification's text, when it has one, must not be blank.";
  public static readonly notificationProgressInvalid: string = "A notification's progress must be indeterminate or a number from 0 to 1.";
  public static readonly notificationActionTitleInvalid: string = "A notification action's title must not be blank.";
  public static readonly notificationIdInvalid: string = "A notification's id must not be blank.";
  public static readonly notificationTimeInvalid: string = "A notification's time must be a date and time.";
  public static readonly quietDeviceInvalid: string = "A device with Do not disturb on must have an id.";
  public static readonly mutedModuleInvalid: string = "A muted module must have an id.";
  public static readonly recentCommandInvalid: string = "A recent command must have an id.";
  public static readonly recentCommandRepeated: string = "A recent command is listed once.";
  public static readonly notificationSequenceInvalid: string = "A notification's sequence must be a whole number from 1.";
  public static readonly currentSequenceInvalid: string = "The notifications' sequence must be a whole number from 0.";
  public static readonly workSequenceInvalid: string = "The work's sequence must be a whole number from 0.";
  public static readonly commandSequenceInvalid: string = "The commands' sequence must be a whole number from 0.";
  public static readonly macPlatform: string = "darwin";
  public static readonly standardPlatform: string = "win32";
  public static readonly keySeparator: string = "+";
  public static readonly modToken: string = "Mod";
  public static readonly ctrlToken: string = "Ctrl";
  public static readonly altToken: string = "Alt";
  public static readonly shiftToken: string = "Shift";
  public static readonly modifierTokens: readonly string[] = [Resources.modToken, Resources.ctrlToken, Resources.altToken, Resources.shiftToken];
  public static readonly macControlSymbol: string = "\u2303";
  public static readonly macOptionSymbol: string = "\u2325";
  public static readonly macShiftSymbol: string = "\u21E7";
  public static readonly macCommandSymbol: string = "\u2318";
  public static readonly controlLabel: string = "Ctrl";
  public static readonly altLabel: string = "Alt";
  public static readonly shiftLabel: string = "Shift";
  public static readonly asciiLetterPattern: RegExp = /^[A-Za-z]$/;
  public static readonly letterKeys: readonly string[] = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
  public static readonly digitKeys: readonly string[] = [..."0123456789"];
  public static readonly letterCodePrefix: string = "Key";
  public static readonly digitCodePrefix: string = "Digit";
  public static readonly functionKeyPrefix: string = "F";
  public static readonly functionKeyCount: number = 24;
  public static readonly spaceKey: string = "Space";
  public static readonly punctuationKeys: readonly (readonly [string, string])[] = [
    ["Backquote", "`"],
    ["Minus", "-"],
    ["Equal", "="],
    ["BracketLeft", "["],
    ["BracketRight", "]"],
    ["Backslash", "\\"],
    ["Semicolon", ";"],
    ["Quote", "'"],
    ["Comma", ","],
    ["Period", "."],
    ["Slash", "/"]
  ];
  public static readonly namedKeys: readonly (readonly [string, string, string])[] = [
    ["Enter", "\u21A9", "Enter"],
    ["Escape", "\u238B", "Esc"],
    ["Tab", "\u21E5", "Tab"],
    ["Space", "Space", "Space"],
    ["Backspace", "\u232B", "Backspace"],
    ["Delete", "\u2326", "Delete"],
    ["Insert", "Insert", "Insert"],
    ["Home", "\u2196", "Home"],
    ["End", "\u2198", "End"],
    ["PageUp", "\u21DE", "PageUp"],
    ["PageDown", "\u21DF", "PageDown"],
    ["ArrowUp", "\u2191", "Up"],
    ["ArrowDown", "\u2193", "Down"],
    ["ArrowLeft", "\u2190", "Left"],
    ["ArrowRight", "\u2192", "Right"]
  ];
  public static readonly editingKeys: readonly string[] = ["Mod+A", "Mod+C", "Mod+V", "Mod+X", "Mod+Z", "Mod+Y", "Mod+Shift+Z"];
  public static readonly macSystemKeys: readonly string[] = ["Mod+Q", "Mod+W", "Mod+H", "Mod+M", "Mod+Comma", "Mod+Tab", "Mod+Space", "Mod+Alt+Escape"];
  public static readonly standardSystemKeys: readonly string[] = ["Alt+F4", "Alt+Tab", "Mod+Escape"];
  public static readonly reservedKeys: readonly (readonly [string, string, readonly string[]])[] = [
    [Resources.macPlatform, "editing", Resources.editingKeys],
    [Resources.standardPlatform, "editing", Resources.editingKeys],
    [Resources.macPlatform, "macOS", Resources.macSystemKeys],
    [Resources.standardPlatform, "Windows and Linux", Resources.standardSystemKeys]
  ];
  public static readonly shellCommandKeys: readonly string[] = ["Mod+W", "Mod+Comma"];
  public static readonly stopMember: string = "stop";
  public static readonly moveAsideMember: string = "moveAside";
  public static readonly modulesMember: string = "modules";
  public static readonly workMember: string = "work";
  public static readonly readWindowBoundsMember: string = "readWindowBounds";
  public static readonly writeWindowBoundsMember: string = "writeWindowBounds";
  public static readonly readWindowLayoutMember: string = "readWindowLayout";
  public static readonly writeWindowLayoutMember: string = "writeWindowLayout";
  public static readonly settingsMember: string = "settings";
  public static readonly readSettingMember: string = "readSetting";
  public static readonly setSettingMember: string = "setSetting";
  public static readonly resetSettingMember: string = "resetSetting";
  public static readonly recentCommandsMember: string = "recentCommands";
  public static readonly recordCommandMember: string = "recordCommand";
  public static readonly settingsChangedMember: string = "settingsChanged";
  public static readonly commandsChangedMember: string = "commandsChanged";
  public static readonly recentCommandsChangedMember: string = "recentCommandsChanged";
  public static readonly saveFailedMember: string = "saveFailed";
  public static readonly saveUnfinishedMember: string = "saveUnfinished";
  public static readonly optionsField: string = "options";
  public static readonly minimumField: string = "minimum";
  public static readonly maximumField: string = "maximum";
  public static readonly stepField: string = "step";
  public static readonly maxLengthField: string = "maxLength";
  public static readonly labelField: string = "label";
  public static readonly descriptionField: string = "description";
  public static readonly typeField: string = "type";
  public static readonly defaultField: string = "default";
  public static readonly localityField: string = "locality";
  public static readonly scopesField: string = "scopes";
  public static readonly pageField: string = "page";
  public static readonly groupField: string = "group";
  public static readonly scopeField: string = "scope";
  public static readonly isSetField: string = "isSet";
  public static readonly definitionsField: string = "definitions";
  public static readonly entriesField: string = "entries";
  public static readonly stepTolerance: number = 1e-9;
  public static readonly textParameterName: string = "text";
  public static readonly maximumFrameLengthParameterName: string = "maximumFrameLength";

  public static readonly nameInvalid: string = "A name must be an owner, a dot and a member, such as \"shell.handshake\": the owner is \"shell\" or a module id in lowercase kebab-case, and the member starts with a lowercase letter followed by letters and digits.";
  public static readonly protocolVersionInvalid: string = "The protocol version must be a positive integer.";
  public static readonly stampedProtocolVersionInvalid: string = "The package's protocol version was not stamped by the build.";
  public static readonly timeoutInvalid: string = "The time limit must be a positive integer of milliseconds.";
  public static readonly maximumFrameLengthInvalid: string = "The maximum frame length must be a positive integer.";
  public static readonly responseOutcomeMissing: string = "A response must carry a payload or a failure.";
  public static readonly moduleVersionInvalid: string = "A module's version must have the form <major>.<minor>.<patch>: three whole numbers of up to nine digits without leading zeros, such as 0.0.1.";
  public static readonly moduleCauseInvalid: string = "An active module has no cause, and a failed or blocked module has one that is not blank.";
  public static readonly moduleBlockerInvalid: string = "A blocked module names the dependency that blocks it, and no other module names one.";
  public static readonly responseOutcomeAmbiguous: string = "A response cannot carry both a payload and a failure.";
  public static readonly unknownField: string = "The field is not part of this message, which accepts no unknown fields.";
  public static readonly settingTextInvalid: string = "A setting's title, description, page and group must not be blank.";
  public static readonly settingOptionsInvalid: string = "A choice needs at least one option, each with a distinct value and a title, none of them blank.";
  public static readonly settingRangeInvalid: string = "A number needs a finite minimum no greater than its finite maximum and a positive step.";
  public static readonly settingMaxLengthInvalid: string = "A text's maximum length must be a positive integer.";
  public static readonly settingLabelInvalid: string = "An action's label must not be blank.";
  public static readonly settingTypeFieldsInvalid: string = "A setting's type carries only the fields of its kind: options for a choice, minimum, maximum and step for a number, maxLength for a text, command and label for an action.";
  public static readonly settingDefaultInvalid: string = "A setting's default must be a value its type accepts.";
  public static readonly settingScopesInvalid: string = "A setting's scopes must be distinct, and a device setting takes none.";
  public static readonly settingScopeIdInvalid: string = "A scope's object id must not be blank.";
  public static readonly settingDeviceInvalid: string = "A device, when given, must not be blank.";
  public static readonly settingEntriesInvalid: string = "Settings must be distinct, and each entry must name a defined setting.";

  public static formatNotificationActionsTooMany(maximum: number): string {
    return `A notification has at most ${maximum} actions.`;
  }

  public static formatKeyInvalid(text: string): string {
    return `"${text}" is not a key. A key is any of Mod, Ctrl, Alt and Shift joined by "+" to one key, such as K, 1, Comma, Enter or F2; Mod is Ctrl on Windows and Linux and Cmd on macOS.`;
  }

  public static formatKeyAmbiguous(text: string): string {
    return `"${text}" names both Mod and Ctrl, which are the same key on Windows and Linux.`;
  }

  public static formatKeyNeedsModifier(text: string): string {
    return `The default key ${text} needs Mod, Ctrl or Alt, or a function key, so that typing is never taken.`;
  }

  public static formatKeyReserved(text: string, owner: string): string {
    return `The key ${text} is reserved for ${owner} and cannot be a command's default.`;
  }

  public static formatFrameTooLarge(maximumFrameLength: number): string {
    return `A frame exceeds the maximum length of ${maximumFrameLength} characters.`;
  }

  public static formatFieldPath(path: string, field: string): string {
    return `${path}${Resources.pathSeparator}${field}`;
  }
}
