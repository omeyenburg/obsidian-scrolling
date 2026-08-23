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

export class SettingsFactory {
    constructor(private readonly plugin: ScrollingPlugin) {}

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
        const render = this.getRenderForSetting(fsi, feature);

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
    ): (setting: Setting, group: SettingGroup) => void | (() => void) {
        const onChange = async (value: boolean | string | number) => {
            this.plugin.settings[fsi.control.key] = value;
            fsi.onChange?.apply(feature);
            await this.plugin.saveData(this.plugin.settings);
            window.requestAnimationFrame(
                // this.plugin.settingTab.update.bind(this.plugin.settingTab),
                this.plugin.settingTab.refreshDomState.bind(this.plugin.settingTab),
            ); // TODO: test
        };

        switch (fsi.control.type) {
            case "toggle":
                return this.renderToggle(fsi.control as SettingToggleControl, onChange);
            case "dropdown":
                return this.renderDropDown(fsi.control as SettingDropdownControl, onChange);
            case "text":
                return this.renderText(fsi.control as SettingTextControl, onChange);
            case "textarea":
                return this.renderTextArea(fsi.control as SettingTextAreaControl, onChange);
            case "slider":
                return this.renderSlider(fsi.control as SettingSliderControl, onChange);
            case "number":
                return this.renderNumber(fsi.control as SettingNumberControl, onChange);
        }
    }

    private renderToggle(
        control: SettingToggleControl,
        onChange: (value: boolean) => void,
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            setting.addToggle((toggle) => {
                return toggle.setValue(this.plugin.settings[control.key]).onChange(onChange);
            });
        };
    }

    private renderDropDown(
        control: SettingDropdownControl,
        onChange: (value: string) => void,
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            setting.addDropdown((dropdown) => {
                return dropdown
                    .addOptions(control.options)
                    .setValue(this.plugin.settings[control.key])
                    .onChange(onChange);
            });
        };
    }

    private renderSlider(
        control: SettingSliderControl,
        onChange: (value: number) => void,
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            setting.addSlider((slider) => {
                return slider
                    .setValue(this.plugin.settings[control.key])
                    .onChange(onChange)
                    .setLimits(control.min, control.max, control.step)
                    .setDisplayFormat(control.displayFormat);
            });
        };
    }

    private renderNumber(
        control: SettingNumberControl,
        onChange: (value: number) => void,
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            setting.addText((slider) => {
                return slider
                    .setValue(control.displayFormat(this.plugin.settings[control.key]))
                    .onChange((value: string) => onChange(control.storeFormat(value)))
                    .setPlaceholder(control.placeholder)
            });
        };
    }

    private renderText(
        control: SettingTextControl,
        onChange: (value: string) => void,
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            setting.addText((text) => {
                return text
                    .setValue(this.plugin.settings[control.key])
                    .onChange(onChange)
                    .setPlaceholder(control.placeholder);
            });
        };
    }

    private renderTextArea(
        control: SettingTextAreaControl,
        onChange: (value: string) => void,
    ): (setting: Setting) => void {
        return (setting: Setting) => {
            setting.addTextArea((textArea) => {
                return textArea
                    .setValue(this.plugin.settings[control.key])
                    .onChange(onChange)
                    .setPlaceholder(control.placeholder);
            });
        };
    }
}
