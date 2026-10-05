/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class GalleryResources {
  public static readonly scopeClass: string = "tr-theme-scope";
  public static readonly focusableSelector: string = "button:not(:disabled), input:not(:disabled), [tabindex=\"0\"], [role=\"tab\"][aria-selected=\"true\"]";
  public static readonly overlayContainerClass: string = "cdk-overlay-container";
  public static readonly longAttribute: string = "long";
  public static readonly stateAttribute: string = "data-tr-state";
  public static readonly hoverState: string = "hover";
  public static readonly focusState: string = "focus";
  public static readonly hoveredPill: string = ".tr-choice-pill[aria-checked=\"false\"]";
  public static readonly focusedPill: string = ".tr-choice-pill[aria-checked=\"true\"]";
  public static readonly focusedCheckbox: string = ".tr-checkbox-box";
  public static readonly focusedSelect: string = ".tr-select-button";
  public static readonly dialogTitleIdPrefix: string = "tr-gallery-dialog-";
  public static readonly text = {
    gallery: "Gallery",
    defaultState: "Default",
    focus: "Focus",
    hover: "Hover",
    secondaryHover: "Secondary, hover",
    longCaption: "Long text",
    secondaryDisabled: "Secondary, disabled",
    delayed: "Delayed",
    triggerCaption: "Trigger",
    openCaption: "Open",
    showFocus: "Show the keyboard focus",
    sample: "Sample",
    primary: "Primary",
    secondary: "Secondary",
    disabled: "Disabled",
    selected: "Selected",
    working: "Working",
    error: "Error",
    longText: "A control title that is far too long to fit the width its row gives it",
    button: "Button",
    iconButton: "Icon button",
    iconGlyph: "format_bold",
    iconLabel: "Bold",
    glyphAdd: "add",
    glyphSave: "save",
    glyphDescription: "description",
    pressed: "Pressed",
    checkbox: "Checkbox",
    checked: "Checked",
    unchecked: "Unchecked",
    textField: "Text field",
    placeholder: "Type here",
    longValue: "A value that is far too long to fit the width of its field and keeps going",
    invalidField: "Not a valid name",
    validationText: "Names have at most 20 characters.",
    select: "Select",
    selectOptions: [
      { value: "one", title: "First option" },
      { value: "two", title: "Second option" },
      { value: "long", title: "An option whose title is far too long to fit the width its select gives it" }
    ],
    progress: "Progress",
    determinate: "Half done",
    indeterminate: "Unknown amount",
    progressDeterminate: "Determinate",
    progressIndeterminate: "Indeterminate",
    spinner: "Spinner",
    spinnerWorking: "Loading the list",
    spinnerDelayed: "Loading after a short wait",
    chip: "Badge and key chip",
    chipCount: "Count",
    chipAdded: "Added",
    chipRemoved: "Removed",
    chipLargeCount: "Large count",
    chipKeyCaption: "Key",
    chipKey: "Ctrl+K",
    choicePills: "Choice pills",
    choicePillsLabel: "Mode",
    choicePillsLong: "Choice with a long title",
    choicePillOptions: [
      { value: "system", title: "System" },
      { value: "light", title: "Light" },
      { value: "dark", title: "Dark" }
    ],
    choicePillOptionsLong: [
      { value: "short", title: "Short" },
      { value: "long", title: "An option whose title is far too long to fit the width its group gives it" }
    ],
    choicePillInitial: "light",
    tab: "Tab",
    tabNormal: "Notes",
    tabSelected: "Outline",
    tabPreview: "Preview",
    tabWorking: "Syncing",
    tabBadge: "Inbox",
    tabLong: "A tab title that is far too long to fit the width of its strip",
    tabNotClosable: "Pinned",
    tabPreviewCaption: "Preview",
    tabBadgeCaption: "Badge",
    tabNotClosableCaption: "Not closable",
    viewBadge: "View badge",
    menuBar: "Menu bar",
    menuBarLabel: "Gallery menus",
    menuBarHover: "Menu bar, hover",
    toolbar: "Toolbar",
    toolbarLabel: "Gallery toolbar",
    toolbarButtons: "Toolbar button",
    toolbarButtonsLabel: "Gallery toolbar buttons",
    toolbarWithLabel: "With its label",
    sash: "Sash",
    sashVertical: "Resize the side",
    sashHorizontal: "Resize the bottom",
    sashVerticalCaption: "Vertical",
    sashHorizontalCaption: "Horizontal",
    panelCard: "Panel card",
    tree: "Tree",
    treeLabel: "Gallery files",
    treeProject: "Project",
    treeSource: "Source",
    treeApp: "App",
    treeStyles: "Styles",
    treeReadme: "Readme",
    treeNotes: "Notes",
    treeLong: "A file name that is far too long to fit the width of its tree",
    glyphFolder: "folder",
    panelShell: "On the shell surface",
    panelPanel: "On the panel surface",
    panelShellCaption: "Shell surface",
    panelPanelCaption: "Panel surface",
    menu: "Menu",
    menuTrigger: "Open a menu",
    contextMenu: "Right-click or press the context-menu key here",
    menuLabel: "Menu rows",
    menuRowsCaption: "Rows",
    contextMenuCaption: "Context menu",
    menuPlain: "A plain row",
    menuHovered: "A hovered row",
    menuIcon: "A row with an icon",
    menuShortcut: "A row with a shortcut",
    menuChecked: "A checked row",
    menuCheckbox: "A checkbox row",
    menuDisabled: "A disabled row",
    menuSubmenu: "A row that opens a submenu",
    menuLong: "A row whose label is far too long to fit the width its menu gives it",
    submenuRow: "Inside the submenu",
    file: "File",
    edit: "Edit",
    popover: "Popover",
    popoverTrigger: "Open a popover",
    popoverLabel: "Details",
    popoverTitle: "Details",
    popoverBody: "A popover holds a short list or a few actions beside the control that opened it.",
    popoverLong: "A line of text that is far too long to fit the width of the popover and keeps going",
    popoverClose: "Close",
    tooltip: "Tooltip",
    tooltipText: "What the control does",
    tooltipTrigger: "Hover or focus for a tooltip",
    tooltipLong: "A tooltip whose text is long enough to wrap onto a second line inside the width the kit gives it",
    dialog: "Dialog",
    dialogTitle: "Delete the note?",
    dialogBody: "The note and its history are removed from this device.",
    dialogCancel: "Cancel",
    dialogConfirm: "Delete",
    largeDialogTitle: "Notes",
    largeCaption: "Large",
    largeDialogBody: "A view or document shown large keeps its own layout inside the dialog's body.",
    quickInput: "Quick input",
    quickInputLabel: "Search the gallery",
    quickInputQuery: "o",
    quickInputOne: "Open the note",
    quickInputTwo: "Show the outline",
    quickInputLong: "Open a note whose title is far too long to fit the width of the search surface",
    quickInputDetail: "Notes",
    quickInputKey: "Ctrl+O",
    menuShortcutKeys: "Ctrl+K",
    tabBadgeLabel: "3 unread",
    selectInitial: "one",
    docking: "Docking guides",
    dockingGuide: "A chosen guide",
    dockingPlate: "A plate with the center chosen",
    dockingGuideCaption: "Guide",
    dockingChosenCaption: "Chosen guide",
    dockingPlateCaption: "Plate, center chosen"
  } as const;

  public static formatShowFocus(specimen: string): string {
    return `Show the keyboard focus on the ${specimen}`;
  }

  public static formatScope(themeName: string, mode: string): string {
    return `${themeName}, ${mode.toLowerCase()} mode`;
  }
}
