import { Platform, PluginSettingTab, Setting, SliderComponent, setIcon } from "obsidian";

import type { default as ScrollingPlugin } from "./main";

export interface ScrollingPluginSettings {
    followCursorEnabled: boolean;
    followCursorRadius: number;
    followCursorSmoothness: number;
    followCursorEnableMouse: boolean;
    followCursorEnableSelection: boolean;
    followCursorDynamicAnimation: boolean;

    restoreScrollEnabled: boolean;
    restoreScrollCursor: boolean;
    restoreScrollAllFiles: boolean;
    restoreScrollStoreFile: string;

    scrollbarVisibility: string; // hide, scroll, show
    scrollbarWidth: number;
    scrollbarFileTreeHorizontal: boolean;

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

    restoreScrollEnabled: false,
    restoreScrollCursor: false,
    restoreScrollAllFiles: false,
    restoreScrollStoreFile: ".obsidian/plugins/obsidian-scrolling/scrolling-positions.json",

    scrollbarVisibility: "show",
    scrollbarWidth: 12,
    scrollbarFileTreeHorizontal: false,

    mouseEnabled: true,
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
        containerEl.createEl("br");

        this.rememberScrollSettings();
        containerEl.createEl("br");

        this.scrollbarSettings();
        containerEl.createEl("br");

        this.mouseScrollSettings();
    }

    createHeading(heading: string): void {
        new Setting(this.containerEl).setName(heading).setHeading();
        this.settingsEnabled = true;
    }

    createSetting(name: string, desc?: string, onReset?: () => void): Setting {
        const setting = new Setting(this.containerEl).setName(name);

        if (desc) {
            if (desc.includes("\n")) {
                const lines = desc.split("\n");

                setting.setDesc(
                    createFragment((frag) => {
                        const div = frag.createDiv();
                        lines.forEach((line, index) => {
                            div.createEl("span", { text: line });
                            if (index < lines.length - 1) {
                                div.createEl("br");
                            }
                        });
                    }),
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

    private rememberScrollSettings() {
        this.createHeading("Remember scroll position");

        this.createSetting(
            "Enabled",
            "Save scroll position before closing a file and restore it when opening the file again.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.restoreScrollEnabled).onChange(async (value) => {
                this.plugin.settings.restoreScrollEnabled = value;
                this.display();
                await this.plugin.saveSettings();
            }),
        );

        this.settingsEnabled = this.plugin.settings.restoreScrollEnabled;

        this.createSetting(
            "Restore cursor position instead",
            "Try to restore cursor position first and use scroll position only as fallback.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.restoreScrollCursor).onChange(async (value) => {
                this.plugin.settings.restoreScrollCursor = value;
                await this.plugin.saveSettings();
            }),
        );

        this.createSetting(
            "Restore in other files",
            "Save and restore scroll position in markdown preview, image and pdf files.",
        ).addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.restoreScrollAllFiles).onChange(async (value) => {
                this.plugin.settings.restoreScrollAllFiles = value;
                await this.plugin.saveSettings();
            }),
        );

        this.createSetting(
            "Storage file path",
            "Where to store scrolling & cursor positions.",
        ).addText((input) => {
            input.setValue(this.plugin.settings.restoreScrollStoreFile).onChange(async (value) => {
                this.proposedRestoreScrollStoreFile = value;
            });

            const onConfirm = async () => {
                const newFile = await this.plugin.restoreScroll.renameStoreFile(
                    this.proposedRestoreScrollStoreFile,
                );

                if (newFile) {
                    this.plugin.settings.restoreScrollStoreFile = newFile;
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
            let parentEl;
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
            resetButton.onclick = async () => {
                if (this.proposedRestoreScrollStoreFile === null) return;
                input.setValue(this.plugin.settings.restoreScrollStoreFile);
                this.proposedRestoreScrollStoreFile = null;
            };

            // Submit new file path with confirm button
            const confirmButton = buttonRow.createEl("button", { text: "Confirm" });
            confirmButton.onclick = onConfirm;
            confirmButton.disabled = !this.settingsEnabled;
        });
    }

    private scrollbarSettings() {
        this.createHeading("Scrollbar appearance");

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

    private mouseScrollSettings() {
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
