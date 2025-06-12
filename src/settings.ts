import { Platform, PluginSettingTab, Setting } from "obsidian";
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
    smartScrollMode: "follow-cursor",
    smartScrollEditRadius: 75,
    smartScrollEditSmoothness: 25,
    smartScrollMoveRadius: 75,
    smartScrollMoveSmoothness: 25,
    smartScrollDynamicAnimation: true,
    smartScrollEnableMouse: false,
    smartScrollEnableSelection: false,

    scrollbarGlobal: false,
    scrollbarVisibility: "show",
    scrollbarWidth: 12,

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
    plugin: ScrollingPlugin;

    constructor(plugin: ScrollingPlugin) {
        super(plugin.app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const containerEl = this.containerEl;
        containerEl.empty();

        new Setting(containerEl).setName("Smart scrolling").setHeading();

        new Setting(containerEl)
            .setName("Mode")
            .setDesc(
                createFragment((frag) => {
                    const div = frag.createDiv();

                    div.createEl("span", {
                        text: "Follow cursor: Smoothly keeps cursor visible (like Vim's scrolloff).",
                    });
                    div.createEl("br");
                    div.createEl("span", {
                        text: "Page jumping: Reduces scrolling by jumping whole pages at screen edges.",
                    });
                }),
            )
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("disabled", "Disabled")
                    .addOption("follow-cursor", "Follow cursor")
                    .addOption("page-jump", "Page jumping")
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
                        const div = frag.createDiv();

                        if (this.plugin.settings.smartScrollMode === "follow-cursor") {
                            div.createEl("span", {
                                text: "Defines how far the cursor can move from the center before scrolling.",
                            });
                            div.createEl("br");
                            div.createEl("span", {
                                text: "0% keeps the cursor perfectly centered, while 100% effectively disables this feature.",
                            });
                        } else {
                            div.createEl("span", {
                                text: "Defines how far the cursor can move before jumping.",
                            });
                            div.createEl("br");
                            div.createEl("span", { text: "Lower values might appear buggy." });
                        }
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
                        const div = frag.createDiv();

                        if (this.plugin.settings.smartScrollMode === "follow-cursor") {
                            div.createEl("span", {
                                text: "Defines how far you can move the cursor from the center before scrolling.",
                            });
                            div.createEl("br");
                            div.createEl("span", {
                                text: "0% keeps the cursor perfectly centered, while 100% effectively disables this feature.",
                            });
                        } else {
                            div.createEl("span", {
                                text: "Defines how far you can move the cursor before jumping.",
                            });
                            div.createEl("br");
                            div.createEl("span", { text: "Lower values might appear buggy." });
                        }
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
                .setName("Dynamic animations")
                .setDesc(
                    "Skip animation frames if lots of scroll events occur for smoother animations.",
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.smartScrollDynamicAnimation)
                        .onChange(async (value) => {
                            this.plugin.settings.smartScrollDynamicAnimation = value;
                            await this.plugin.saveSettings();
                        }),
                );

            new Setting(containerEl)
                .setName("Invoke on mouse-driven cursor movement")
                .setDesc("Apply this feature when the text cursor is moved with the mouse.")
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
        }

        if (!Platform.isMacOS) {
            containerEl.createEl("br");
            new Setting(containerEl).setName("Scrollbar appearance").setHeading();

            new Setting(containerEl)
                .setName("Apply to all scrollbars")
                .setDesc(
                    "Whether scrollbar settings should apply to all scrollbars or only markdown files.",
                )
                .addToggle((toggle) =>
                    toggle
                        .setValue(this.plugin.settings.scrollbarGlobal)
                        .onChange(async (value) => {
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

            if (Platform.isLinux && this.plugin.settings.scrollbarVisibility !== "hide") {
                new Setting(containerEl)
                    .setName("Scrollbar thickness")
                    .setDesc("Width in pixels.")
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
            .setDesc("Whether mouse/touchpad scrolling settings are applied.")
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
                .setDesc("Reverse the scroll direction.")
                .addToggle((toggle) =>
                    toggle.setValue(this.plugin.settings.mouseInvert).onChange(async (value) => {
                        this.plugin.settings.mouseInvert = value;
                        await this.plugin.saveSettings();
                    }),
                );
            new Setting(containerEl)
                .setName("Mouse scroll speed")
                .setDesc("Scroll speed multiplier for mouse wheel.")
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
                .setName("Mouse scroll smoothness")
                .setDesc("Determines how smooth scrolling with a mouse should be.")
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
                            text: "Detect touchpad input to provide smoother scrolling.",
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
                        .setDesc("Adjusts scroll speed when using a touchpad.")
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
                        .setName("Touchpad smoothness")
                        .setDesc("Controls the smoothness of touchpad.")
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
                            "Sets the minimum scroll strength below which increased friction is applied for finer control.",
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
