import {
    Setting,
    SettingDefinitionItem,
    SettingDefinitionPage,
    SettingDefinitionRender,
    SettingGroup,
} from "obsidian";
import {
    SettingDefinition,
    SettingDropdownControl,
    SettingSliderControl,
    SettingTextAreaControl,
    SettingTextControl,
    SettingToggleControl,
    SettingNumberControl,
} from "@core/settings.schema";
import type { Feature } from "@core/Feature";
import ScrollingPlugin from "@core/main";
import { ScrollingPluginSettings } from "@core/feature.schema";

function bindBoolFunc(
    func: boolean | (() => boolean),
    feature: Feature,
): boolean | (() => boolean) {
    if (func instanceof Function) {
        return func.bind(feature);
    }

    return func;
}

function evalBoolFunc(func: boolean | (() => boolean)): boolean {
    if (func instanceof Function) {
        return func();
    }

    return func;
}

export class SettingsFactory {
    private updateSubscribers: Set<() => void> = new Set();

    constructor(private readonly plugin: ScrollingPlugin) {}

    private addUpdateSubscriber(func: () => void): void {
        this.updateSubscribers.add(func);
        func();
    }

    private update() {
        for (const updateSubscriber of this.updateSubscribers) {
            updateSubscriber.apply(this);
        }
    }

    public getSettingDefinitions(features: Feature[]): SettingDefinitionItem[] {
        return features.flatMap((feature) => this.getFeatureSettingDefinitions(feature));
    }

    public getDefaultSettings(features: Feature[]): ScrollingPluginSettings {
        const defaults: Record<string, any> = {};
        for (const feature of features) {
            for (const item of feature.settings.items) {
                if (item.control && item.control.key) {
                    defaults[item.control.key] = item.control.defaultValue;
                }
            }
        }
        return defaults as ScrollingPluginSettings;
    }

    private getFeatureSettingDefinitions(feature: Feature): SettingDefinitionPage {
        const name = feature.settings.name;
        const desc = feature.settings.desc;
        const items = feature.settings.items.map((fsi) =>
            this.mapSettingDefinitionItem(fsi, feature),
        );

        return {
            name,
            desc,
            items,
            type: "page",
        };
    }

    private mapSettingDefinitionItem(
        fsi: SettingDefinition,
        feature: Feature,
    ): SettingDefinitionRender | null {
        const name = fsi.name;
        const desc = fsi.desc;
        const aliases = fsi.aliases;
        const searchable = fsi.searchable;
        const visible = bindBoolFunc(fsi.visible, feature);
        const disabled = bindBoolFunc(fsi.disabled, feature);
        const render = this.getRenderForSetting(fsi, feature, disabled);

        return {
            name,
            desc,
            aliases,
            searchable,
            visible,
            render,
            disabled,
        };
    }

    private getRenderForSetting(
        fsi: SettingDefinition,
        feature: Feature,
        disabled: boolean | (() => boolean),
    ): (setting: Setting, group: SettingGroup) => void | (() => void) {
        const onChange = async (value: boolean | string | number) => {
            this.plugin.settings[fsi.control.key] = value;
            fsi.onChange?.apply(feature);
            await this.plugin.saveData(this.plugin.settings);

            this.plugin.settingTab.refreshDomState();
            this.update();
        };

        switch (fsi.control.type) {
            case "toggle":
                return this.renderToggle(fsi.control as SettingToggleControl, onChange);
            case "dropdown":
                return this.renderDropDown(
                    fsi.control as SettingDropdownControl,
                    onChange,
                    disabled,
                );
            case "text":
                return this.renderText(fsi.control as SettingTextControl, onChange, disabled);
            case "textarea":
                return this.renderTextArea(
                    fsi.control as SettingTextAreaControl,
                    onChange,
                    disabled,
                );
            case "slider":
                return this.renderSlider(fsi.control as SettingSliderControl, onChange, disabled);
            case "number":
                return this.renderNumber(fsi.control as SettingNumberControl, onChange, disabled);
        }
    }

    private renderToggle(
        control: SettingToggleControl,
        onChange: (value: boolean) => void,
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            setting.addToggle((toggle) => {
                toggle.onChange(onChange);

                this.addUpdateSubscriber(() => {
                    toggle
                        .setValue(this.plugin.settings[control.key])
                });
            });
        };
    }

    private renderDropDown(
        control: SettingDropdownControl,
        onChange: (value: string) => void,
        disabled: boolean | (() => boolean),
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            if (control.defaultValue !== undefined) {
                this.addResetButton(setting, disabled, onChange.bind(this, control.defaultValue));
            }

            setting.addDropdown((dropdown) => {
                dropdown.addOptions(control.options).onChange(onChange);

                this.addUpdateSubscriber(() => {
                    dropdown
                        .setValue(this.plugin.settings[control.key])
                });
            });
        };
    }

    private renderSlider(
        control: SettingSliderControl,
        onChange: (value: number) => void,
        disabled: boolean | (() => boolean),
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            if (control.defaultValue !== undefined) {
                this.addResetButton(setting, disabled, onChange.bind(this, control.defaultValue));
            }

            setting.addSlider((slider) => {
                slider
                    .onChange(onChange)
                    .setLimits(control.min, control.max, control.step)
                    .setDisplayFormat(control.displayFormat)
                    .setInstant(control.instant ?? false);

                this.addUpdateSubscriber(() => {
                    slider
                        .setValue(this.plugin.settings[control.key])
                });
            });
        };
    }

    private renderNumber(
        control: SettingNumberControl,
        onChange: (value: number) => void,
        disabled: boolean | (() => boolean),
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            if (control.defaultValue !== undefined) {
                this.addResetButton(setting, disabled, onChange.bind(this, control.defaultValue));
            }

            setting.addText((text) => {
                text.onChange((value: string) =>
                    onChange(control.storeFormat(value)),
                ).setPlaceholder(control.placeholder);

                this.addUpdateSubscriber(() => {
                    text.setValue(this.plugin.settings[control.key])
                });
            });
        };
    }

    private renderText(
        control: SettingTextControl,
        onChange: (value: string) => void,
        disabled: boolean | (() => boolean),
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            if (control.defaultValue !== undefined) {
                this.addResetButton(setting, disabled, onChange.bind(this, control.defaultValue));
            }

            setting.addText((text) => {
                text.onChange(onChange).setPlaceholder(control.placeholder);

                this.addUpdateSubscriber(() => {
                    text.setValue(this.plugin.settings[control.key])
                });
            });
        };
    }

    private renderTextArea(
        control: SettingTextAreaControl,
        onChange: (value: string) => void,
        disabled: boolean | (() => boolean),
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            if (control.defaultValue !== undefined) {
                this.addResetButton(setting, disabled, onChange.bind(this, control.defaultValue));
            }

            setting.addTextArea((textArea) => {
                textArea.onChange(onChange).setPlaceholder(control.placeholder);

                this.addUpdateSubscriber(() => {
                    textArea
                        .setValue(this.plugin.settings[control.key])
                });
            });
        };
    }

    private addResetButton(
        setting: Setting,
        disabled: boolean | (() => boolean),
        onReset: () => void,
    ): void {
        setting.addExtraButton((button) => {
            button.setIcon("reset").onClick(async () => onReset());

            this.addUpdateSubscriber(() => {
                const isDisabled = evalBoolFunc(disabled);

                button.setDisabled(isDisabled);
                if (isDisabled) {
                    button.setTooltip("");
                    button.extraSettingsEl.setCssStyles({
                        filter: "grayscale(100%)",
                        opacity: "0.3",
                    });
                } else {
                    button.setTooltip("Restore default");
                    button.extraSettingsEl.setCssStyles({ filter: "", opacity: "" });
                }
            });
        });
    }
}
