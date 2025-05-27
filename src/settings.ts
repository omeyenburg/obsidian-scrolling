import { PluginSettingTab, Setting } from "obsidian";
import type { default as ScrollingPlugin } from "./main";

export interface ScrollingPluginSettings {
    smartScrollMode: string; // disabled, follow-cursor, page-jump
    smartScrollEditRadius: number;
    smartScrollEditSmoothness: number;
    smartScrollMoveRadius: number;
    smartScrollMoveSmoothness: number;
    smartScrollEnableMouse: boolean;
    smartScrollEnableSelection: boolean;
    smartScrollDynamicAnimation: boolean;

    scrollbarGlobal: boolean;
    scrollbarVisibility: string; // hide, scroll, show
    scrollbarWidth: number;

    mouseScrollEnabled: boolean;
    mouseScrollInvert: boolean;
    mouseScrollSmoothness: number;
    mouseScrollSpeed: number;
}

export const DEFAULT_SETTINGS: ScrollingPluginSettings = {
    smartScrollMode: "follow-cursor",
    smartScrollEditRadius: 75,
    smartScrollEditSmoothness: 25,
    smartScrollMoveRadius: 75,
    smartScrollMoveSmoothness: 25,
    smartScrollEnableMouse: false,
    smartScrollEnableSelection: false,
    smartScrollDynamicAnimation: true,

    scrollbarGlobal: false,
    scrollbarVisibility: "show",
    scrollbarWidth: 12,

    mouseScrollEnabled: true,
    mouseScrollInvert: false,
    mouseScrollSmoothness: 1,
    mouseScrollSpeed: 1,
};

export class ScrollingSettingTab extends PluginSettingTab {
    plugin: ScrollingPlugin;

    constructor(plugin: ScrollingPlugin) {
        super(plugin.app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const containerEl = this.containerEl;
        containerEl.empty();

        new Setting(containerEl).setName("Smart Scrolling").setHeading();

        new Setting(containerEl)
            .setName("Mode")
            .setDesc(
                createFragment((frag) => {
                    frag.createDiv(
                        {},
                        (div) =>
                            (div.innerHTML =
                                "Follow Cursor: Smoothly keeps cursor visible (like Vim's <code>scrolloff</code>).<br>" +
                                "Page Jumping: Reduces scrolling by jumping whole pages at screen edges."),
                    );
                }),
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("disabled", "Disabled")
                    .addOption("follow-cursor", "Follow Cursor")
                    .addOption("page-jump", "Page Jumping")
                    .setValue(this.plugin.settings.smartScrollMode)
                    .onChange(async (value) => {
                        this.plugin.settings.smartScrollMode = value;
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );

        if (this.plugin.settings.smartScrollMode !== "disabled") {
            new Setting(containerEl)
                .setName("Scroll zone radius when editing")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    this.plugin.settings.smartScrollMode === "follow-cursor"
                                        ? "Defines how far the cursor can move from the center before scrolling.<br>" +
                                          "0% keeps the cursor perfectly centered, while 100% effectively disables this feature."
                                        : "Defines how far the cursor can move before jumping.<br>" +
                                          "Lower values might appear buggy."),
                        );
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.smartScrollEditRadius =
                                DEFAULT_SETTINGS.smartScrollEditRadius;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.smartScrollEditRadius)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollEditRadius = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll smoothness when editing")
                .setDesc(
                    "Adjusts how fast or slow the scrolling animation is when editing moves the cursor.",
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.smartScrollEditSmoothness =
                                DEFAULT_SETTINGS.smartScrollEditSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.smartScrollEditSmoothness)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollEditSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll zone radius when moving cursor")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    this.plugin.settings.smartScrollMode === "follow-cursor"
                                        ? "Defines how far you can move the cursor from the center before scrolling.<br>" +
                                          "0% keeps the cursor perfectly centered, while 100% effectively disables this feature."
                                        : "Defines how far you can move the cursor before jumping.<br>" +
                                          "Lower values might appear buggy."),
                        );
                    }),
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.smartScrollMoveRadius =
                                DEFAULT_SETTINGS.smartScrollMoveRadius;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.smartScrollMoveRadius)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollMoveRadius = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll smoothness when moving cursor")
                .setDesc(
                    "Adjusts how fast or slow the scrolling animation is when you move the cursor.",
                )
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.smartScrollMoveSmoothness =
                                DEFAULT_SETTINGS.smartScrollMoveSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.smartScrollMoveSmoothness)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollMoveSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Invoke on mouse-driven cursor movement")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    "Also apply this feature when the text cursor is moved with the mouse.<br>" +
                                    "Scrolling is triggered when you lift the mouse."),
                        );
                    }),
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.smartScrollEnableMouse)
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollEnableMouse = value;
                            this.display();
                            await this.plugin.saveSettings();
                        }),
                );

            if (this.plugin.settings.smartScrollEnableMouse) {
                new Setting(containerEl)
                    .setName("Invoke on mouse selection")
                    .setDesc("Also trigger, when the mouse has selected text.")
                    .addToggle((toggle) =>
                        toggle
                            .setValue(this.plugin.settings.smartScrollEnableSelection)
                            .onChange(async (value) => {
                                this.plugin.settings.smartScrollEnableSelection = value;
                                await this.plugin.saveSettings();
                            }),
                    );
            }

            new Setting(containerEl)
                .setName("Dynamic animations")
                .setDesc(
                    createFragment((frag) => {
                        frag.createDiv(
                            {},
                            (div) =>
                                (div.innerHTML =
                                    "Skip animation frames if lots of scroll events occur.<br>" +
                                    "Should make scrolling with pressed arrow keys/vim motions much smoother."),
                        );
                    }),
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.smartScrollDynamicAnimation)
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollDynamicAnimation = value;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        new Setting(containerEl);
        new Setting(containerEl).setName("Scrollbar Appearance").setHeading();

        new Setting(containerEl)
            .setName("Apply to all scrollbars")
            .setDesc(
                "Whether the following options should apply to all scrollbars or only in markdown files.",
            )
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.scrollbarGlobal).onChange(async (value) => {
                    this.plugin.settings.scrollbarGlobal = value;
                    this.plugin.scrollbar.updateStyle();
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName("Scrollbar visibility")
            .setDesc("When to show scrollbars.")
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
                    .addOption("hide", "Always hide scrollbars")
                    .addOption("scroll", "Show scrollbars while scrolling")
                    .addOption("show", "Always show scrollbars")
                    .setValue(this.plugin.settings.scrollbarVisibility)
                    .onChange(async (value) => {
                        this.plugin.settings.scrollbarVisibility = value;
                        this.plugin.scrollbar.updateStyle();
                        this.display();
                        await this.plugin.saveSettings();
                    }),
            );

        if (this.plugin.settings.scrollbarVisibility !== "hide") {
            new Setting(containerEl)
                .setName("Scrollbar thickness")
                .setDesc("Width in pixels.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.scrollbarWidth = DEFAULT_SETTINGS.scrollbarWidth;
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

        new Setting(containerEl);
        new Setting(containerEl).setName("Mouse/Trackpad Scrolling (Experimental)").setHeading();

        new Setting(containerEl)
            .setName("Enabled")
            .setDesc("Whether mouse scrolling settings should be applied.")
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.mouseScrollEnabled).onChange(async (value) => {
                    this.plugin.settings.mouseScrollEnabled = value;
                    this.display();
                    await this.plugin.saveSettings();
                }),
            );

        if (this.plugin.settings.mouseScrollEnabled) {
            new Setting(containerEl)
                .setName("Scroll speed")
                .setDesc("Controls how fast you scroll using your mouse wheel or trackpad.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseScrollSpeed =
                                DEFAULT_SETTINGS.mouseScrollSpeed;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseScrollSpeed)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseScrollSpeed = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Scroll smoothness")
                .setDesc("Determines how smooth scrolling should be. 0 means instant.")
                .addExtraButton((button) => {
                    button
                        .setIcon("reset")
                        .setTooltip("Restore default")
                        .onClick(async () => {
                            this.plugin.settings.mouseScrollSmoothness =
                                DEFAULT_SETTINGS.mouseScrollSmoothness;
                            this.display();
                            await this.plugin.saveSettings();
                        });
                })
                .addSlider((slider) =>
                    slider
                        .setValue(this.plugin.settings.mouseScrollSmoothness)
                        .setLimits(0, 100, 1)
                        .setDynamicTooltip()
                        .onChange(async (value) => {
                            this.plugin.settings.mouseScrollSmoothness = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Invert scroll direction")
                .setDesc("Flips scroll direction.")
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.mouseScrollInvert)
                        .onChange(async (value) => {
                            this.plugin.settings.mouseScrollInvert = value;
                            await this.plugin.saveSettings();
                        }),
                );
        }
    }
}
