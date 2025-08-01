import { Platform, PluginSettingTab, Setting, SliderComponent, setIcon } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

export interface ScrollingPluginSettings {
    followCursorEnabled: boolean;
    followCursorRadius: number;
    followCursorSmoothness: number;
    followCursorEnableMouse: boolean;
    followCursorEnableSelection: boolean;
    followCursorDynamicAnimation: boolean;

    restoreScrollMode: string; // scroll, cursor, top, bottom
    restoreScrollAllFiles: boolean;
    restoreScrollFileEnabled: boolean;
    restoreScrollFilePath: string;

    scrollbarVisibility: string; // hide, scroll, show
    scrollbarWidth: number;
    scrollbarFileTreeHorizontal: boolean;

    lineWidthMode: string;
    lineWidthPercentage: number;
    lineWidthCharacters: number;

    mouseEnabled: boolean;
    mouseInvert: boolean;
    mouseSpeed: number;
    mouseSmoothness: number;

    touchpadEnabled: boolean;
    touchpadSmoothness: number;
    touchpadFrictionThreshold: number;
    touchpadSpeed: number;
}

export const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    followCursorEnabled: true,
    followCursorRadius: 75,
    followCursorSmoothness: 25,
    followCursorDynamicAnimation: true,
    followCursorEnableMouse: false,
    followCursorEnableSelection: false,

    restoreScrollMode: "scroll",
    restoreScrollAllFiles: false,
    restoreScrollFileEnabled: true,
    restoreScrollFilePath: ".obsidian/plugins/obsidian-scrolling/scrolling-positions.json",

    scrollbarVisibility: "show",
    scrollbarWidth: 12,
    scrollbarFileTreeHorizontal: false,

    lineWidthMode: "disabled",
    lineWidthPercentage: 50,
    lineWidthCharacters: 70,

    mouseEnabled: false,
    mouseInvert: false,
    mouseSpeed: 50,
    mouseSmoothness: 75,

    touchpadEnabled: true,
    touchpadSmoothness: 75,
    touchpadFrictionThreshold: 20,
    touchpadSpeed: 50,
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
        const containerEl = this.containerEl;
        containerEl.empty();

        this.followCursorSettings();
        this.restoreScrollSettings();
        this.linewidthSettings();
        this.scrollbarSettings();
        this.mouseScrollSettings();
    }

    createHeading(name: string, desc?: string): void {
        const heading = new Setting(this.containerEl).setName(name).setHeading();
        if (desc) heading.setDesc(desc);
        this.settingsEnabled = true;
    }

    createSetting(name: string, desc?: string, onReset?: () => void): Setting {
        const setting = new Setting(this.containerEl).setName(name);

        if (desc) {
            if (desc.includes("\n")) {
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
            } else {
                setting.setDesc(desc);
            }
        }

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

    private followCursorSettings() {
        this.createHeading("Follow Cursor");

        this.createSetting("Enabled", "Keep the cursor near the center.").addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.followCursorEnabled).onChange(async (value) => {
                this.plugin.settings.followCursorEnabled = value;
                this.display();
                await this.plugin.saveSettings();
            }),
        );

        this.settingsEnabled = this.plugin.settings.followCursorEnabled;

        this.createSetting(
            "Trigger distance",
            "How far the cursor can move from the center before scrolling.\n0% keeps the cursor perfectly centered.",
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
            "Animation duration",
            "Length of the scrolling animation.",
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
            "Dynamic animations",
            "If many scroll events happen quickly, skip animation frames to improve responsiveness.",
        ).addToggle((toggle) =>
            toggle
                .setValue(this.plugin.settings.followCursorDynamicAnimation)
                .onChange(async (value) => {
                    this.plugin.settings.followCursorDynamicAnimation = value;
                    await this.plugin.saveSettings();
                }),
        );

        if (Platform.isDesktop) {
            this.createSetting(
                "Trigger on mouse interactions",
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

            this.settingsEnabled &&= this.plugin.settings.followCursorEnableMouse;

            this.createSetting(
                "Trigger on mouse selection",
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

    private restoreScrollSettings() {
        this.containerEl.createEl("br");
        this.createHeading(
            "Remember scroll position",
            "Save scroll position or cursor position before closing a file and restore it when opening the file again.",
        );

        this.createSetting(
            "Enabled",
            "Choose between starting at the top/bottom of the file, restore the last cursor position, or restore cursor & last scroll position",
            () => (this.plugin.settings.restoreScrollMode = DEFAULT_SETTINGS.restoreScrollMode),
        ).addDropdown((dropdown) =>
            dropdown
                .addOption("top", "Start at top")
                .addOption("bottom", "Start at bottom")
                .addOption("cursor", "Restore only cursor")
                .addOption("scroll", "Restore scroll position")
                .setValue(this.plugin.settings.restoreScrollMode)
                .onChange(async (value) => {
                    this.plugin.settings.restoreScrollMode = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
        );

        this.settingsEnabled = ["scroll", "cursor"].includes(
            this.plugin.settings.restoreScrollMode,
        );

        this.createSetting(
            "Restore position in other files",
            "Save and restore scroll position in markdown preview, image and pdf files.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.restoreScrollAllFiles).onChange(async (value) => {
                this.plugin.settings.restoreScrollAllFiles = value;
                await this.plugin.saveSettings();
            }),
        );

        this.createSetting(
            "Store positions in file",
            "Store scroll & cursor positions locally in a file to persist when closing Obsidian.",
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
            if (this.settingsEnabled) resetButton.setAttr("aria-label", "Restore last");
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

    private scrollbarSettings() {
        this.containerEl.createEl("br");
        this.createHeading("Scrollbar appearance");

        if (Platform.isDesktop) {
            this.createSetting(
                "Show horizontal scrollbar in file tree",
                "Allow horizontal scrolling in the file tree and add a horizontal scrollbar.",
            ).addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.scrollbarFileTreeHorizontal)
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarFileTreeHorizontal = value;
                        this.plugin.scrollbar.updateStyle();
                        await this.plugin.saveSettings();
                    }),
            );
        }

        if (!Platform.isMacOS) {
            this.createSetting(
                "Scrollbar visibility",
                "When to show the scrollbar in markdown/pdf files.",
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

            if (Platform.isLinux) {
                this.settingsEnabled = this.plugin.settings.scrollbarVisibility !== "hide";

                this.createSetting("Scrollbar thickness", "Width of scrollbars in pixels.", () => {
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
    }

    private linewidthSettings() {
        if (Platform.isMobile) return;

        const readableLineWidthEnabled = this.plugin.linewidth.isReadableLineWidthEnabled();

        // In case readableLineWidth was toggled
        this.plugin.linewidth.updateLineWidth();

        this.containerEl.createEl("br");
        if (readableLineWidthEnabled) {
            this.plugin.settings.lineWidthMode = "disabled";
            this.createHeading(
                "Line length",
                "This feature is unavailable while 'Readable line length' is enabled in the editor settings. Disable it to use this feature.",
            );
        } else {
            this.createHeading("Line width");
        }

        this.settingsEnabled = !readableLineWidthEnabled;

        this.createSetting("Mode", "Choose how to control the maximum line width.").addDropdown(
            (dropdown) => {
                dropdown
                    .addOption("disabled", "Disabled")
                    .addOption("characters", "Characters (ch)")
                    .addOption("percentage", "Percentage (%)")
                    .setValue(this.plugin.settings.lineWidthMode)
                    .onChange(async (value) => {
                        this.plugin.settings.lineWidthMode = value;
                        this.plugin.linewidth.updateLineWidth();
                        this.display();
                        await this.plugin.saveSettings();
                    });
            },
        );

        if (this.plugin.settings.lineWidthMode === "percentage") {
            this.createSetting(
                "Maximum line length",
                "Maximum line length as percentage of the window width (%).",
                () => {
                    this.plugin.settings.lineWidthPercentage = DEFAULT_SETTINGS.lineWidthPercentage;
                    this.plugin.linewidth.updateLineWidth();
                },
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.lineWidthPercentage)
                    .setLimits(20, 100, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.lineWidthPercentage = value;
                        this.plugin.linewidth.updateLineWidth();
                        await this.plugin.saveSettings();
                    }),
            );
        } else {
            this.settingsEnabled &&= this.plugin.settings.lineWidthMode === "characters";

            this.createSetting(
                "Maximum line length",
                "Maximum line length as character count (ch).",
                () => {
                    this.plugin.settings.lineWidthCharacters = DEFAULT_SETTINGS.lineWidthCharacters;
                    this.plugin.linewidth.updateLineWidth();
                },
            ).addSlider((slider) =>
                slider
                    .setValue(this.plugin.settings.lineWidthCharacters)
                    .setLimits(30, 200, 1)
                    .onChange(async (value) => {
                        this.plugin.settings.lineWidthCharacters = value;
                        this.plugin.linewidth.updateLineWidth();
                        await this.plugin.saveSettings();
                    }),
            );
        }
    }

    private mouseScrollSettings() {
        if (Platform.isMobile) return;

        this.containerEl.createEl("br");
        this.createHeading("Mouse/Touchpad scrolling (Experimental)");

        this.createSetting("Enabled", "Enable custom mouse/touchpad scrolling behavior.").addToggle(
            (toggle) =>
                toggle.setValue(this.plugin.settings.mouseEnabled).onChange(async (value) => {
                    this.plugin.settings.mouseEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
        );

        this.settingsEnabled = this.plugin.settings.mouseEnabled;

        this.createSetting(
            "Invert scroll direction",
            "Reverse the scroll direction for mouse wheel and touchpad input.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.mouseInvert).onChange(async (value) => {
                this.plugin.settings.mouseInvert = value;
                await this.plugin.saveSettings();
            }),
        );

        this.createSetting(
            "Scroll speed",
            "How far the page scrolls per mouse wheel movement.",
            () => (this.plugin.settings.mouseSpeed = DEFAULT_SETTINGS.mouseSpeed),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.mouseSpeed)
                .setLimits(1, 100, 1)
                .onChange(async (value) => {
                    this.plugin.settings.mouseSpeed = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Scroll smoothness",
            "Duration of the scrolling animation.",
            () => (this.plugin.settings.mouseSmoothness = DEFAULT_SETTINGS.mouseSmoothness),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.mouseSmoothness)
                .setLimits(0, 100, 1)
                .onChange(async (value) => {
                    this.plugin.settings.mouseSmoothness = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Touchpad detection",
            "Detect touchpad input and apply dedicated scrolling behavior.\nDetection works reliably on most devices but may occasionally misidentify input type.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.touchpadEnabled).onChange(async (value) => {
                this.plugin.settings.touchpadEnabled = value;
                this.display();
                await this.plugin.saveSettings();
            }),
        );

        this.settingsEnabled &&= this.plugin.settings.touchpadEnabled;

        this.createSetting(
            "Touchpad scroll speed",
            "How fast the page scrolls on touchpad movement.",
            () => (this.plugin.settings.touchpadSpeed = DEFAULT_SETTINGS.touchpadSpeed),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.touchpadSpeed)
                .setLimits(1, 100, 1)
                .onChange(async (value) => {
                    this.plugin.settings.touchpadSpeed = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Touchpad scroll smoothness",
            "Scroll smoothness when using a touchpad.",
            () => (this.plugin.settings.touchpadSmoothness = DEFAULT_SETTINGS.touchpadSmoothness),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.touchpadSmoothness)
                .setLimits(0, 100, 1)
                .onChange(async (value) => {
                    this.plugin.settings.touchpadSmoothness = value;
                    await this.plugin.saveSettings();
                }),
        );

        this.createSetting(
            "Touchpad friction threshold",
            "Threshold between precise and smooth scrolling. Defines how much finger movement is needed before scrolling decelerates and stops.",
            () =>
                (this.plugin.settings.touchpadFrictionThreshold =
                    DEFAULT_SETTINGS.touchpadFrictionThreshold),
        ).addSlider((slider) =>
            slider
                .setValue(this.plugin.settings.touchpadFrictionThreshold)
                .setLimits(1, 100, 1)
                .onChange(async (value) => {
                    this.plugin.settings.touchpadFrictionThreshold = value;
                    await this.plugin.saveSettings();
                }),
        );
    }
}
