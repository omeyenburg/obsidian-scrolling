import { Platform, PluginSettingTab, Setting, SliderComponent, setIcon } from "obsidian";

import type { default as ScrollingPlugin } from "./main";
import { RestoreScroll } from "./restorescroll";

export interface ScrollingPluginSettings {
    followCursorEnabled: boolean;
    followCursorRadius: number;
    followCursorSmoothness: number;
    followCursorInstantEditScroll: boolean;
    followCursorEnableMouse: boolean;
    followCursorEnableSelection: boolean;
    followCursorDynamicAnimation: boolean;

    cursorScrollEnabled: boolean;

    horizontalScrollingCodeBlockEnabled: boolean;
    horizontalScrollingFileTreeEnabled: boolean;

    restoreScrollMode: string;
    restoreScrollLimit: number;
    restoreScrollDelay: number;
    restoreScrollAllFiles: boolean;
    restoreScrollFileEnabled: boolean;
    restoreScrollFilePath: string;

    imageZoomEnabled: boolean;

    scrollbarVisibility: string;
    scrollbarWidth: number;

    readingLineScrollEnabled: boolean;
    readingHalfPageScrollEnabled: boolean;
    readingTopBottomScrollEnabled: boolean;

    scrollMode: string;

    nativeScrollMultiplier: number;
    nativeAltMultiplier: number;
    nativeScrollInstant: boolean;

    simulatedMouseInvert: boolean;
    simulatedMouseSpeed: number;
    simulatedMouseSmoothness: number;
    simulatedTouchpadEnabled: boolean;
    simulatedTouchpadSpeed: number;
    simulatedTouchpadSmoothness: number;
    simulatedTouchpadFrictionThreshold: number;

    ribbonScrollButtonsEnabled: boolean;

    enableExperimentalSettings: boolean;
}

export const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    followCursorEnabled: true,
    followCursorRadius: 75,
    followCursorSmoothness: 25,
    followCursorInstantEditScroll: true,
    followCursorDynamicAnimation: true,
    followCursorEnableMouse: false,
    followCursorEnableSelection: false,

    cursorScrollEnabled: false,

    horizontalScrollingCodeBlockEnabled: false,
    horizontalScrollingFileTreeEnabled: false,

    restoreScrollMode: "scroll",
    restoreScrollLimit: -1,
    restoreScrollDelay: 100,
    restoreScrollAllFiles: true,
    restoreScrollFileEnabled: true,
    restoreScrollFilePath: RestoreScroll.DEFAULT_FILE_PATH,

    imageZoomEnabled: true,

    scrollbarVisibility: "show",
    scrollbarWidth: 12,

    readingLineScrollEnabled: true,
    readingHalfPageScrollEnabled: true,
    readingTopBottomScrollEnabled: true,

    scrollMode: "disabled",

    nativeScrollMultiplier: 1,
    nativeAltMultiplier: 1,
    nativeScrollInstant: false,

    simulatedMouseInvert: false,
    simulatedMouseSpeed: 50,
    simulatedMouseSmoothness: 75,
    simulatedTouchpadEnabled: true,
    simulatedTouchpadSmoothness: 75,
    simulatedTouchpadFrictionThreshold: 20,
    simulatedTouchpadSpeed: 50,

    ribbonScrollButtonsEnabled: true,

    enableExperimentalSettings: false,
};

export class ScrollingSettingTab extends PluginSettingTab {
    readonly plugin: ScrollingPlugin;

    private settingsEnabled = true;
    private proposedRestoreScrollStoreFile: string | null = null;

    constructor(plugin: ScrollingPlugin) {
        super(plugin.app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const previousScrollTop = this.containerEl.scrollTop;
        this.containerEl.empty();

        this.displayFollowCursorSettings();
        this.displayCursorScrollSettings();
        this.displayHorizontalScrollingSettings();
        this.displayRestoreScrollSettings();
        this.displayImageZoomSettings();
        this.displayScrollbarSettings();
        this.displayReadModeKeybinds();
        this.displayMouseScrollSettings();
        this.displayRibbonSettings();

        this.createHeading("Issues & feature requests").setDesc(
            createFragment((frag) => {
                frag.createEl("span", {
                    text: "To report bugs or provide feedback, please use the ",
                });
                frag.createEl("a", {
                    text: "issue tracker",
                    href: "https://github.com/omeyenburg/obsidian-scrolling/issues",
                });
                frag.createEl("span", {
                    text: " and the ",
                });
                frag.createEl("a", {
                    text: "discussion page",
                    href: "https://github.com/omeyenburg/obsidian-scrolling/discussions",
                });
                frag.createEl("span", {
                    text: " or send an email to ",
                });
                frag.createEl("a", {
                    text: "omeyenburg@gmail.com",
                    href: "mailto:omeyenburg@gmail.com",
                });
                frag.createEl("span", {
                    text: ".",
                });
            }),
        );

        this.containerEl.scrollTop = previousScrollTop;
    }

    private setDesc(setting: Setting, desc: string): void {
        if (!desc) return;
        if (!desc.includes("\n")) {
            setting.setDesc(desc);
            return;
        }
        const lines = desc.split("\n");

        setting.setDesc(
            createFragment((frag) =>
                lines.forEach((line, index) => {
                    frag.createEl("span", { text: line });
                    if (index < lines.length - 1) {
                        frag.createEl("br");
                    }
                }),
            ),
        );
    }

    private createHeading(name: string, desc?: string): Setting {
        const heading = new Setting(this.containerEl).setName(name).setHeading();
        this.setDesc(heading, desc);
        this.settingsEnabled = true;
        return heading;
    }

    private createSetting(name: string, desc?: string, onReset?: () => void): Setting {
        const setting = new Setting(this.containerEl).setName(name);
        this.setDesc(setting, desc);

        if (onReset) {
            setting.addExtraButton((button) => {
                button.setIcon("reset").onClick(async () => {
                    onReset();
                    this.display();
                    await this.plugin.saveSettings();
                });

                if (this.settingsEnabled) button.setTooltip("Restore default");
            });
        }

        if (!this.settingsEnabled) {
            setting.infoEl.style.opacity = "0.4";
            setting.controlEl.style.opacity = "0.4";
            setting.controlEl.style.filter = "grayscale(100%)";

            window.setTimeout(() => {
                setting.components.forEach((comp) => {
                    comp.setDisabled(true);
                });
            }, 1);
        } else {
            // Show tooltip on all enabled sliders
            // (removing later is not possible)
            window.setTimeout(() => {
                setting.components.forEach((comp) => {
                    if (comp instanceof SliderComponent) {
                        comp.setDynamicTooltip();
                    }
                });
            }, 1);
        }

        return setting;
    }

    private displayFollowCursorSettings() {
        this.createHeading("Scroll follows text cursor");

        this.createSetting(
            "Enable",
            "Scroll the view to keep the cursor near the center when you move the cursor.\nCan be used together with 'Text cursor follows scroll'.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.followCursorEnabled).onChange(async (value) => {
                this.plugin.settings.followCursorEnabled = value;
                this.display();
                await this.plugin.saveSettings();
            }),
        );

        this.settingsEnabled = this.plugin.settings.followCursorEnabled;

        this.createSetting(
            "Trigger distance",
            "How far the cursor can move from the center before scrolling (%).\n0% keeps the cursor perfectly centered.",
            () => (this.plugin.settings.followCursorRadius = DEFAULT_SETTINGS.followCursorRadius),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.followCursorRadius)
                .setLimits(0, 100, 1)
                .onChange(async (value) => {
                    this.plugin.settings.followCursorRadius = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Animation smoothness",
            "Duration of the scroll animation.",
            () =>
                (this.plugin.settings.followCursorSmoothness =
                    DEFAULT_SETTINGS.followCursorSmoothness),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.followCursorSmoothness)
                .setLimits(0, 100, 1)
                .onChange(async (value) => {
                    this.plugin.settings.followCursorSmoothness = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Instant scroll on edit",
            "Do not scroll smoothly while editing text.",
        ).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.followCursorInstantEditScroll)
                .onChange(async (value) => {
                    this.plugin.settings.followCursorInstantEditScroll = value;
                    await this.plugin.saveSettings();
                }),
        );

        if (!this.plugin.settings.enableExperimentalSettings) {
            this.plugin.settings.followCursorDynamicAnimation =
                DEFAULT_SETTINGS.followCursorDynamicAnimation;
        } else {
            this.createSetting(
                "Dynamic animations (Experimental)",
                "If many scroll events happen quickly, skip animation frames to improve responsiveness.",
            ).addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.followCursorDynamicAnimation)
                    .onChange(async (value) => {
                        this.plugin.settings.followCursorDynamicAnimation = value;
                        await this.plugin.saveSettings();
                    }),
            );
        }

        if (Platform.isDesktop) {
            if (!this.plugin.settings.enableExperimentalSettings) {
                this.plugin.settings.followCursorEnableMouse =
                    DEFAULT_SETTINGS.followCursorEnableMouse;
            } else {
                this.createSetting(
                    "Trigger on mouse interactions (Experimental)",
                    "Update when the cursor is moved using the mouse.",
                ).addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.followCursorEnableMouse)
                        .onChange(async (value) => {
                            this.plugin.settings.followCursorEnableMouse = value;
                            this.display();
                            await this.plugin.saveSettings();
                        }),
                );
            }

            if (!this.plugin.settings.enableExperimentalSettings) {
                this.plugin.settings.followCursorEnableSelection =
                    DEFAULT_SETTINGS.followCursorEnableSelection;
            } else {
                this.settingsEnabled &&= this.plugin.settings.followCursorEnableMouse;
                this.createSetting(
                    "Trigger on mouse selection (Experimental)",
                    "Also update when text is selected using the mouse.",
                ).addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.followCursorEnableSelection)
                        .onChange(async (value) => {
                            this.plugin.settings.followCursorEnableSelection = value;
                            await this.plugin.saveSettings();
                        }),
                );
            }
        }
    }

    private displayCursorScrollSettings() {
        if (Platform.isMobile) return;

        this.containerEl.createEl("br");
        this.createHeading("Text cursor follows scroll");

        this.createSetting(
            "Enable",
            "Move the cursor to stay visible when scrolling manually.\nCan be used together with 'Scroll follows text cursor'.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.cursorScrollEnabled).onChange(async (value) => {
                this.plugin.settings.cursorScrollEnabled = value;
                await this.plugin.saveSettings();
            }),
        );
    }

    private displayHorizontalScrollingSettings() {
        this.containerEl.createEl("br");
        this.createHeading("Horizontal scrolling");

        this.createSetting(
            "Code blocks",
            "Allow horizontal scrolling of code blocks in your notes.",
        ).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.horizontalScrollingCodeBlockEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.horizontalScrollingCodeBlockEnabled = value;
                    this.plugin.codeBlock.updateStyle();
                    await this.plugin.saveSettings();
                }),
        );

        if (Platform.isMobile) return;
        this.createSetting(
            "File tree",
            "Allow horizontal scrolling in the file tree and show a scrollbar.",
        ).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.horizontalScrollingFileTreeEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.horizontalScrollingFileTreeEnabled = value;
                    this.plugin.fileTree.updateStyle();
                    await this.plugin.saveSettings();
                }),
        );
    }

    private displayRestoreScrollSettings() {
        this.containerEl.createEl("br");
        this.createHeading(
            "Remember scroll/cursor position",
            "Automatically save your position before closing a file and restore it upon opening the file again.",
        );

        this.createSetting(
            "Mode",
            "Start at the top/bottom of the file, or restore the cursor or scroll position.",
            () => (this.plugin.settings.restoreScrollMode = DEFAULT_SETTINGS.restoreScrollMode),
        ).addDropdown((dropdown) =>
            dropdown
                .addOption("top", "Start at top (Obsidian's default)")
                .addOption("bottom", "Start at bottom")
                .addOption("cursor", "Restore cursor position")
                .addOption("scroll", "Restore scroll position")
                .setValue(this.plugin.settings.restoreScrollMode)
                .onChange(async (value) => {
                    this.plugin.settings.restoreScrollMode = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Delay after opening a note",
            "Number of milliseconds to wait before restoring scroll after a note is opened",
            () => (this.plugin.settings.restoreScrollDelay = DEFAULT_SETTINGS.restoreScrollDelay),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.restoreScrollDelay)
                .setLimits(0, 300, 10)
                .onChange(async (value) => {
                    this.plugin.settings.restoreScrollDelay = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.settingsEnabled = ["scroll", "cursor"].includes(
            this.plugin.settings.restoreScrollMode,
        );

        const count = this.plugin.restoreScroll.countEphemeralStates();
        this.createSetting(
            "Saved positions limit",
            `Number of files to remember scroll positions for. Leave empty for unlimited.\nCurrently positions for ${count} file${count == 1 ? "" : "s"} are stored.`,
            () => (this.plugin.settings.restoreScrollLimit = DEFAULT_SETTINGS.restoreScrollLimit),
        ).addText((input) => {
            input
                .setPlaceholder("Unlimited")
                .setValue(
                    this.plugin.settings.restoreScrollLimit > 0
                        ? this.plugin.settings.restoreScrollLimit.toString()
                        : "",
                )
                .onChange((value: string) => {
                    const limit = +value;
                    if (limit.toString().contains(".")) return;
                    if (limit <= 0) {
                        this.plugin.settings.restoreScrollLimit = -1;
                        return;
                    }

                    this.plugin.settings.restoreScrollLimit = limit;
                });
        });

        if (!this.plugin.settings.enableExperimentalSettings) {
            this.plugin.settings.restoreScrollAllFiles = DEFAULT_SETTINGS.restoreScrollAllFiles;
        } else {
            this.createSetting(
                "Restore position in other files (Experimental)",
                "Enable restoring scroll position in Markdown preview, images, and PDFs.",
            ).addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.restoreScrollAllFiles)
                    .onChange(async (value) => {
                        this.plugin.settings.restoreScrollAllFiles = value;
                        await this.plugin.saveSettings();
                    }),
            );
        }

        this.createSetting(
            "Store positions in file",
            "Save positions inside a file to keep them after Obsidian restarts.",
        ).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.restoreScrollFileEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.restoreScrollFileEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
        );

        this.settingsEnabled &&= this.plugin.settings.restoreScrollFileEnabled;

        this.createSetting(
            "Storage file path",
            "Where to store scrolling & cursor positions.",
        ).addText((input) => {
            input.setValue(this.plugin.settings.restoreScrollFilePath).onChange((value) => {
                this.proposedRestoreScrollStoreFile = value;
            });

            const onConfirm = async () => {
                const newFile = await this.plugin.restoreScroll.renameStoreFile(
                    this.proposedRestoreScrollStoreFile,
                );

                if (newFile) {
                    this.plugin.settings.restoreScrollFilePath = newFile;
                    this.proposedRestoreScrollStoreFile = null;
                    await this.plugin.saveSettings();
                }
            };

            // Submit new file path when pressing enter
            const handleKeydown = (e: KeyboardEvent) => {
                if (e.key === "Enter") onConfirm();
            };
            input.inputEl.addEventListener("keydown", handleKeydown);
            this.plugin.register(() => input.inputEl.removeEventListener("keydown", handleKeydown));

            // Try vertical layout
            let parentEl: HTMLElement;
            if (input.inputEl.parentElement) {
                parentEl = input.inputEl.parentElement;
                parentEl.style.display = "flex";
                parentEl.style.alignItems = "flex-end";
                parentEl.style.flexDirection = "column";
                parentEl.style.marginBottom = "-1.5em";
            } else {
                parentEl = this.containerEl;
            }

            const buttonRow = parentEl.createDiv({ cls: "setting-item-control" });
            buttonRow.style.display = "flex";

            // Reset button
            const resetButton = buttonRow.createDiv({
                cls: "clickable-icon extra-setting-button",
            });
            if (this.settingsEnabled) resetButton.setAttr("aria-label", "Cancel changes");
            setIcon(resetButton, "reset");
            resetButton.onclick = () => {
                if (this.proposedRestoreScrollStoreFile === null) return;
                input.setValue(this.plugin.settings.restoreScrollFilePath);
                this.proposedRestoreScrollStoreFile = null;
            };

            // Submit new file path with confirm button
            const confirmButton = buttonRow.createEl("button", { text: "Confirm" });
            confirmButton.onclick = onConfirm;
            confirmButton.disabled = !this.settingsEnabled;
        });
    }

    private displayImageZoomSettings() {
        if (Platform.isMobile) return;

        this.containerEl.createEl("br");
        this.createHeading("Scroll to zoom images");

        this.createSetting(
            "Enabled",
            "Hover over an image and scroll while holding the ctrl key to zoom.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.imageZoomEnabled).onChange(async (value) => {
                this.plugin.settings.imageZoomEnabled = value;
                await this.plugin.saveSettings();
            }),
        );
    }

    private displayScrollbarSettings() {
        this.containerEl.createEl("br");
        this.createHeading("Scrollbar appearance");

        if (!Platform.isMacOS) {
            this.createSetting(
                "Scrollbar visibility",
                "When to show the scrollbar in notes and PDFs.",
                () => {
                    this.plugin.settings.scrollbarVisibility = DEFAULT_SETTINGS.scrollbarVisibility;
                    this.plugin.scrollbar.updateStyle();
                },
            ).addDropdown((dropdown) =>
                dropdown
                    .addOption("hide", "Always hide scrollbar")
                    .addOption("scroll", "Show scrollbar while scrolling")
                    .addOption("show", "Always show scrollbar")
                    .setValue(this.plugin.settings.scrollbarVisibility)
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarVisibility = value;
                        this.plugin.scrollbar.updateStyle();
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );
        }

        if (Platform.isLinux && Platform.isDesktop) {
            this.settingsEnabled = this.plugin.settings.scrollbarVisibility !== "hide";

            this.createSetting("Scrollbar thickness", "Scrollbar width in pixels.", () => {
                this.plugin.settings.scrollbarWidth = DEFAULT_SETTINGS.scrollbarWidth;
                this.plugin.scrollbar.updateStyle();
            }).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.scrollbarWidth)
                    .setLimits(0, 30, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarWidth = value;
                        this.plugin.scrollbar.updateStyle();
                        await this.plugin.saveSettings();
                    }),
            );
        }
    }

    private displayReadModeKeybinds() {
        if (Platform.isMobile) return;

        this.containerEl.createEl("br");
        this.createHeading("Reading mode");

        this.createSetting("Line scroll keybinds", "Scroll by single lines with j/k.").addToggle(
            (toggle) =>
                toggle
                    .setValue(this.plugin.settings.readingLineScrollEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.readingLineScrollEnabled = value;
                        await this.plugin.saveSettings();
                    }),
        );

        this.createSetting(
            "Half page scroll keybinds",
            "Scroll half pages with d/u.",
        ).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.readingHalfPageScrollEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.readingHalfPageScrollEnabled = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Top/bottom scroll keybinds",
            "Scroll to top/bottom with g/G.",
        ).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.readingTopBottomScrollEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.readingTopBottomScrollEnabled = value;
                    await this.plugin.saveSettings();
                }),
        );
    }

    private displayMouseScrollSettings() {
        if (Platform.isMobile) return;

        this.containerEl.createEl("br");
        this.createHeading("Mouse & Touchpad scroll");

        this.createSetting(
            "Mode",
            "Native scroll provides simplicity and stability; Simulated scroll is configurable.",
            () => (this.plugin.settings.scrollMode = DEFAULT_SETTINGS.scrollMode),
        ).addDropdown((dropdown) =>
            dropdown
                .addOption("disabled", "Disable feature")
                .addOption("native", "Native")
                .addOption("simulated", "Simulated (Experimental)")
                .setValue(this.plugin.settings.scrollMode)
                .onChange(async (value) => {
                    this.plugin.settings.scrollMode = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
        );

        if (this.plugin.settings.scrollMode === "native") {
            this.createSetting(
                "Scroll speed multiplier",
                "Increase the scroll speed. Slowing speed down with values below 1 is only supported with 'Disable smooth scrolling'",
                () =>
                    (this.plugin.settings.nativeScrollMultiplier =
                        DEFAULT_SETTINGS.nativeScrollMultiplier),
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.nativeScrollMultiplier)
                    .setLimits(1 - 0.9 * +this.plugin.settings.nativeScrollInstant, 3, 0.1)
                    .onChange(async (value) => {
                        this.plugin.settings.nativeScrollMultiplier = value;
                        await this.plugin.saveSettings();
                    }),
            );

            this.createSetting(
                "Alt speed multiplier",
                "Speed multiplier while holding the alt key.",
                () =>
                    (this.plugin.settings.nativeAltMultiplier =
                        DEFAULT_SETTINGS.nativeAltMultiplier),
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.nativeAltMultiplier)
                    .setLimits(1 - 0.9 * +this.plugin.settings.nativeScrollInstant, 3, 0.1)
                    .onChange(async (value) => {
                        this.plugin.settings.nativeAltMultiplier = value;
                        await this.plugin.saveSettings();
                    }),
            );

            this.createSetting(
                "Disable smooth scrolling",
                "Scroll instantly without transition effect.",
            ).addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.nativeScrollInstant)
                    .onChange(async (value) => {
                        this.plugin.settings.nativeScrollInstant = value;
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );
        } else if (this.plugin.settings.scrollMode === "simulated") {
            this.createSetting(
                "Invert scroll direction (Experimental)",
                "Reverse the scroll direction for mouse wheel and touchpad input.",
            ).addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.simulatedMouseInvert)
                    .onChange(async (value) => {
                        this.plugin.settings.simulatedMouseInvert = value;
                        await this.plugin.saveSettings();
                    }),
            );

            this.createSetting(
                "Mouse scroll speed",
                "How far the page scrolls.",
                () =>
                    (this.plugin.settings.simulatedMouseSpeed =
                        DEFAULT_SETTINGS.simulatedMouseSpeed),
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.simulatedMouseSpeed)
                    .setLimits(1, 100, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.simulatedMouseSpeed = value;
                        await this.plugin.saveSettings();
                    }),
            );

            this.createSetting(
                "Mouse scroll smoothness",
                "Duration of the scroll animation.",
                () =>
                    (this.plugin.settings.simulatedMouseSmoothness =
                        DEFAULT_SETTINGS.simulatedMouseSmoothness),
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.simulatedMouseSmoothness)
                    .setLimits(0, 100, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.simulatedMouseSmoothness = value;
                        await this.plugin.saveSettings();
                    }),
            );

            this.createSetting(
                "Touchpad detection (Experimental)",
                "Detect touchpad input and apply dedicated scrolling behavior.\nDetection works reliably on most devices but may occasionally misidentify input type.",
            ).addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.simulatedTouchpadEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.simulatedTouchpadEnabled = value;
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );
            this.settingsEnabled &&= this.plugin.settings.simulatedTouchpadEnabled;

            this.createSetting(
                "Touchpad scroll speed",
                "How far the page scrolls.",
                () =>
                    (this.plugin.settings.simulatedTouchpadSpeed =
                        DEFAULT_SETTINGS.simulatedTouchpadSpeed),
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.simulatedTouchpadSpeed)
                    .setLimits(1, 100, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.simulatedTouchpadSpeed = value;
                        await this.plugin.saveSettings();
                    }),
            );

            this.createSetting(
                "Touchpad scroll smoothness",
                "Duration of the scroll animation.",
                () =>
                    (this.plugin.settings.simulatedTouchpadSmoothness =
                        DEFAULT_SETTINGS.simulatedTouchpadSmoothness),
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.simulatedTouchpadSmoothness)
                    .setLimits(0, 100, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.simulatedTouchpadSmoothness = value;
                        await this.plugin.saveSettings();
                    }),
            );

            this.createSetting(
                "Touchpad friction threshold",
                "Threshold between precise and smooth scrolling.\nDefines how much finger movement is needed before scrolling decelerates and stops.",
                () =>
                    (this.plugin.settings.simulatedTouchpadFrictionThreshold =
                        DEFAULT_SETTINGS.simulatedTouchpadFrictionThreshold),
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.simulatedTouchpadFrictionThreshold)
                    .setLimits(1, 100, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.simulatedTouchpadFrictionThreshold = value;
                        await this.plugin.saveSettings();
                    }),
            );
        }
    }

    private displayRibbonSettings() {
        if (Platform.isDesktop) return;

        this.containerEl.createEl("br");
        this.createHeading("Ribbon commands");

        this.createSetting(
            "Commands for scrolling to top/bottom",
            "Adds buttons to the ribbon bar for scrolling to the top/bottom of the file.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.ribbonScrollButtonsEnabled).onChange(async (value) => {
                this.plugin.settings.ribbonScrollButtonsEnabled = value;
                this.plugin.commands.updateRibbonButtons();
                await this.plugin.saveSettings();
            }),
        );
    }
}
