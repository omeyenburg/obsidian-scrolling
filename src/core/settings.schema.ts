export interface SettingDefinition<K extends string = string> {
    name: string;
    desc?: string | DocumentFragment;
    aliases?: string[];
    searchable?: boolean | (() => boolean);
    visible?: boolean | (() => boolean);
    disabled?: boolean | (() => boolean);
    control: SettingControl<K>;
    onChange?: () => void;
}

/**
 * Keep in sync with ControlValue and 
 */
type SettingControl<K extends string = string> =
    | SettingToggleControl<K>
    | SettingDropdownControl<K>
    | SettingTextControl<K>
    | SettingTextAreaControl<K>
    // | SettingNumberControl<K>
    // | SettingFileControl<K>
    // | SettingFolderControl<K>
    // | SettingColorControl<K>
    | SettingSliderControl<K>;

export interface SettingToggleControl<K extends string = string> extends SettingControlBase<
    boolean,
    K
> {
    type: "toggle";
}

export interface SettingDropdownControl<K extends string = string> extends SettingControlBase<
    string,
    K
> {
    type: "dropdown";
    options: Record<string, string>;
}

export interface SettingTextControl<K extends string = string> extends SettingControlBase<
    string,
    K
> {
    type: "text";
    placeholder?: string;
}

export interface SettingTextAreaControl<K extends string = string> extends SettingControlBase<
    string,
    K
> {
    type: "textarea";
    placeholder?: string;
    rows?: number;
}

export interface SettingSliderControl<K extends string = string> extends SettingControlBase<
    number,
    K
> {
    type: "slider";
    min: number;
    max: number;
    step: number;
    displayFormat?: (value: number) => string;
}

interface SettingControlBase<V, K extends string = string> {
    key: K;
    defaultValue?: V;
    validate?: (value: V) => string | void | Promise<string | void>;
}
