import {
    Platform,
    PluginSettingTab,
    Setting,
    Notice,
    setIcon,
    TFile,
    TAbstractFile,
    normalizePath,
} from "obsidian";

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

    private proposedRestoreScrollStoreFile: string | null = null;

    constructor(plugin: ScrollingPlugin) {
        super(plugin.app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const containerEl = this.containerEl;
        containerEl.empty();

        new Setting(containerEl).setName("Follow Cursor").setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Keep the cursor near the center.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.followCursorEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.followCursorEnabled = value;
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );

        if (this.plugin.settings.followCursorEnabled) {
            new Setting(containerEl)
                .setName("Trigger distance")
                .setDesc(
                    createFragment((frag) => {
                        const div = frag.createDiv();

                        div.createEl("span", {
                            text: "How far the cursor can move from the center before scrolling.",
                        });
                        div.createEl("br");
                        div.createEl("span", {
                            text: "0% keeps the cursor perfectly centered.",
                        });
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.followCursorRadius =
                                DEFAULT_SETTINGS.followCursorRadius;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.followCursorRadius)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.followCursorRadius = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Animation duration")
                .setDesc("Length of the scrolling animation.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.followCursorSmoothness =
                                DEFAULT_SETTINGS.followCursorSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.followCursorSmoothness)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.followCursorSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Dynamic animations")
                .setDesc(
                    "If many scroll events happen quickly, skip animation frames to improve responsiveness.",
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.followCursorDynamicAnimation)
                        .onChange(async (value) => {
                            this.plugin.settings.followCursorDynamicAnimation = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Trigger on mouse interactions")
                .setDesc("Update when the cursor is moved using the mouse.")
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.followCursorEnableMouse)
                        .onChange(async (value) => {
                            this.plugin.settings.followCursorEnableMouse = value;
                            this.display();
                            await this.plugin.saveSettings();
                        }),
                );

            if (this.plugin.settings.followCursorEnableMouse) {
                new Setting(containerEl)
                    .setName("Trigger on mouse selection")
                    .setDesc("Also update when text is selected using the mouse.")
                    .addToggle((toggle) =>
                        toggle
                            .setValue(this.plugin.settings.followCursorEnableSelection)
                            .onChange(async (value) => {
                                this.plugin.settings.followCursorEnableSelection = value;
                                await this.plugin.saveSettings();
                            }),
                    );
            }
        }

        containerEl.createEl("br");
        new Setting(containerEl).setName("Remember scroll position").setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc(
                "Save scroll position before closing a file and restore it when opening the file again.",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.restoreScrollEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.restoreScrollEnabled = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Restore cursor position instead")
            .setDesc(
                "Try to restore cursor position first and use scroll position only as fallback.",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.restoreScrollCursor)
                    .onChange(async (value) => {
                        this.plugin.settings.restoreScrollCursor = value;
                        await this.plugin.saveSettings();
                    }),
            );

        const x = new Setting(containerEl)
            .setName("Restore in other files")
            .setDesc("Save and restore scroll position in markdown preview, image and pdf files.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.restoreScrollAllFiles)
                    .onChange(async (value) => {
                        this.plugin.settings.restoreScrollAllFiles = value;
                        await this.plugin.saveSettings();
                    }),
            );

        const confirmStoreFile = async () => {
            if (this.proposedRestoreScrollStoreFile === null) {
                new Notice("Nothing changed");
                return;
            }

            // Check empty/invalid paths before normalizing.
            if (
                !this.proposedRestoreScrollStoreFile ||
                this.proposedRestoreScrollStoreFile.trim() === "" ||
                this.proposedRestoreScrollStoreFile === "." ||
                this.proposedRestoreScrollStoreFile === ".."
            ) {
                new Notice("Invalid file path!");
                return;
            }

            // Assuming this.plugin.settings.restoreScrollStoreFile is valid
            const newFile = normalizePath(this.proposedRestoreScrollStoreFile);
            const oldFile = normalizePath(this.plugin.settings.restoreScrollStoreFile);
            const adapter = this.plugin.app.vault.adapter;

            if (!newFile) {
                new Notice("Invalid file path!");
                return;
            }

            const folder = newFile.substring(0, newFile.lastIndexOf("/"));
            if (!folder || !(await adapter.exists(folder))) {
                new Notice(`Directory does not exist: ${folder}`);
                return;
            }

            if (await adapter.exists(newFile)) {
                new Notice(`File already exists: ${newFile}`);
                return;
            }

            if (oldFile && (await adapter.exists(oldFile))) {
                try {
                    await adapter.rename(oldFile, newFile);
                } catch (e) {
                    new Notice("Invalid file path!");
                    return;
                }
            }

            new Notice(`Renamed storage file to: ${newFile}`);

            this.plugin.settings.restoreScrollStoreFile = newFile;
            this.proposedRestoreScrollStoreFile = null;
            await this.plugin.saveSettings();
        };

        new Setting(containerEl)
            .setName("Storage file path")
            .setDesc("Where to store scrolling & cursor positions.")
            .addText((input) => {
                input
                    .setValue(this.plugin.settings.restoreScrollStoreFile)
                    .onChange(async (value) => {
                        this.proposedRestoreScrollStoreFile = value;
                    });

                // Submit new file path when pressing enter
                const handleKeydown = (e: KeyboardEvent) => {
                    if (e.key === "Enter") confirmStoreFile();
                };
                input.inputEl.addEventListener("keydown", handleKeydown);
                this.plugin.register(() =>
                    input.inputEl.removeEventListener("keydown", handleKeydown),
                );

                // Try vertical layout
                let parentEl;
                if (input.inputEl.parentElement) {
                    parentEl = input.inputEl.parentElement;
                    parentEl.style.display = "flex";
                    parentEl.style.alignItems = "flex-end";
                    parentEl.style.flexDirection = "column";
                    parentEl.style.marginBottom = "-1.5em";
                } else {
                    parentEl = containerEl;
                }

                const buttonRow = parentEl.createDiv({ cls: "setting-item-control" });
                buttonRow.style.display = "flex";

                // Reset button
                const resetButton = buttonRow.createDiv({
                    cls: "clickable-icon extra-setting-button",
                });
                resetButton.setAttr("aria-label", "Restore last");
                setIcon(resetButton, "reset");
                resetButton.onclick = async () => {
                    if (this.proposedRestoreScrollStoreFile === null) return;
                    input.setValue(this.plugin.settings.restoreScrollStoreFile);
                    this.proposedRestoreScrollStoreFile = null;
                };

                // Submit new file path with confirm button
                const confirmButton = buttonRow.createEl("button", { text: "Confirm" });
                confirmButton.onclick = confirmStoreFile;
            });

        containerEl.createEl("br");
        new Setting(containerEl).setName("Scrollbar appearance").setHeading();

        new Setting(containerEl)
            .setName("Show horizontal scrollbar in file tree")
            .setDesc("Allow horizontal scrolling in the file tree and add a horizontal scrollbar.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.scrollbarFileTreeHorizontal)
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarFileTreeHorizontal = value;
                        this.plugin.scrollbar.updateStyle();
                        await this.plugin.saveSettings();
                    }),
            );

        if (!Platform.isMacOS) {
            new Setting(containerEl)
                .setName("Scrollbar visibility")
                .setDesc("When to show the scrollbar in markdown/pdf files.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.scrollbarVisibility =
                                DEFAULT_SETTINGS.scrollbarVisibility;
                            this.plugin.scrollbar.updateStyle();
                            await this.plugin.saveSettings();
                        });
                })
                .addDropdown((dropdown) =>
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

            if (Platform.isLinux && this.plugin.settings.scrollbarVisibility !== "hide") {
                new Setting(containerEl)
                    .setName("Scrollbar thickness")
                    .setDesc("Width of scrollbars in pixels.")
                    .addExtraButton((button) => {
                        button
                            .setIcon("reset")
                            .setTooltip("Restore default")
                            .onClick(async () => {
                                this.plugin.settings.scrollbarWidth =
                                    DEFAULT_SETTINGS.scrollbarWidth;
                                this.plugin.scrollbar.updateStyle();
                                this.display();
                                await this.plugin.saveSettings();
                            });
                    })
                    .addSlider((slider) =>
                        slider
                            .setValue(this.plugin.settings.scrollbarWidth)
                            .setLimits(0, 30, 1)
                            .setDynamicTooltip()
                            .onChange(async (value) => {
                                this.plugin.settings.scrollbarWidth = value;
                                this.plugin.scrollbar.updateStyle();
                                await this.plugin.saveSettings();
                            }),
                    );
            }
        }

        containerEl.createEl("br");
        new Setting(containerEl).setName("Mouse/Touchpad scrolling (Experimental)").setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Enable custom mouse/touchpad scrolling behavior.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.mouseEnabled).onChange(async (value) => {
                    this.plugin.settings.mouseEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
            );

        if (this.plugin.settings.mouseEnabled) {
            new Setting(containerEl)
                .setName("Invert scroll direction")
                .setDesc("Reverse the scroll direction for mouse wheel and touchpad input.")
                .addToggle((toggle) =>
                    toggle.setValue(this.plugin.settings.mouseInvert).onChange(async (value) => {
                        this.plugin.settings.mouseInvert = value;
                        await this.plugin.saveSettings();
                    }),
                );
            new Setting(containerEl)
                .setName("Scroll speed")
                .setDesc("How far the page scrolls per mouse wheel movement.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseSpeed = DEFAULT_SETTINGS.mouseSpeed;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseSpeed)
                        .setLimits(1, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseSpeed = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll smoothness")
                .setDesc("Duration of the scrolling animation.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseSmoothness = DEFAULT_SETTINGS.mouseSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseSmoothness)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Touchpad detection")
                .setDesc(
                    createFragment((frag) => {
                        const div = frag.createDiv();

                        div.createEl("span", {
                            text: "Detect touchpad input and apply dedicated scrolling behavior.",
                        });
                        div.createEl("br");
                        div.createEl("span", {
                            text: "Detection works reliably on most devices but may occasionally misidentify input type.",
                        });
                    }),
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.touchpadEnabled)
                        .onChange(async (value) => {
                            this.plugin.settings.touchpadEnabled = value;
                            this.display();
                            await this.plugin.saveSettings();
                        }),
                );

            if (this.plugin.settings.touchpadEnabled) {
                if (this.plugin.settings.mouseEnabled) {
                    new Setting(containerEl)
                        .setName("Touchpad scroll speed")
                        .setDesc("How fast the page scrolls on touchpad movement.")
                        .addExtraButton((button) => {
                            button
                                .setIcon("reset")
                                .setTooltip("Restore default")
                                .onClick(async () => {
                                    this.plugin.settings.touchpadSpeed =
                                        DEFAULT_SETTINGS.touchpadSpeed;
                                    this.display();
                                    await this.plugin.saveSettings();
                                });
                        })
                        .addSlider((slider) =>
                            slider
                                .setValue(this.plugin.settings.touchpadSpeed)
                                .setLimits(1, 100, 1)
                                .setDynamicTooltip()
                                .onChange(async (value) => {
                                    this.plugin.settings.touchpadSpeed = value;
                                    await this.plugin.saveSettings();
                                }),
                        );

                    new Setting(containerEl)
                        .setName("Touchpad scroll smoothness")
                        .setDesc("Scroll smoothness when using a touchpad.")
                        .addExtraButton((button) => {
                            button
                                .setIcon("reset")
                                .setTooltip("Restore default")
                                .onClick(async () => {
                                    this.plugin.settings.touchpadSmoothness =
                                        DEFAULT_SETTINGS.touchpadSmoothness;
                                    this.display();
                                    await this.plugin.saveSettings();
                                });
                        })
                        .addSlider((slider) =>
                            slider
                                .setValue(this.plugin.settings.touchpadSmoothness)
                                .setLimits(0, 100, 1)
                                .setDynamicTooltip()
                                .onChange(async (value) => {
                                    this.plugin.settings.touchpadSmoothness = value;
                                    await this.plugin.saveSettings();
                                }),
                        );

                    new Setting(containerEl)
                        .setName("Touchpad friction threshold")
                        .setDesc(
                            "Threshold between precise and smooth scrolling. Defines how much finger movement is needed before scrolling decelerates and stops.",
                        )
                        .addExtraButton((button) => {
                            button
                                .setIcon("reset")
                                .setTooltip("Restore default")
                                .onClick(async () => {
                                    this.plugin.settings.touchpadFrictionThreshold =
                                        DEFAULT_SETTINGS.touchpadFrictionThreshold;
                                    this.display();
                                    await this.plugin.saveSettings();
                                });
                        })
                        .addSlider((slider) =>
                            slider
                                .setValue(this.plugin.settings.touchpadFrictionThreshold)
                                .setLimits(1, 100, 1)
                                .setDynamicTooltip()
                                .onChange(async (value) => {
                                    this.plugin.settings.touchpadFrictionThreshold = value;
                                    await this.plugin.saveSettings();
                                }),
                        );
                }
            }
        }
    }
}
