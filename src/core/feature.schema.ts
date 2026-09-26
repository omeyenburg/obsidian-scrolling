import { CenterCursorFeature } from "@features/CenterCursorFeature";
import { CodeBlockFeature } from "@features/CodeBlockFeature";
import { CommandsFeature } from "@features/CommandsFeature";
import { FileTreeFeature } from "@features/FileTreeFeature";
import { LineLengthFeature } from "@features/LineLengthFeature";
import { MathJaxFeature } from "@features/MathJaxFeature";
import { MouseScrollFeature } from "@features/MouseScrollFeature";
import { PreviewScrollKeysFeature } from "@features/PreviewScrollKeysFeature";
import { RememberFileStateFeature } from "@features/RememberFileStateFeature";
import { ScrollButtonsFeature } from "@features/ScrollButtonsFeature";
import { ScrollbarFeature } from "@features/ScrollbarFeature";

/**
 * The only shape the derivation below needs from a feature instance.
 *
 * Deliberately narrower than `Feature`: constraining to the full contract would make
 * this file depend on `Feature`, which depends on the setting callbacks, which depend
 * on `ScrollingPluginSettings` — a cycle through the type being defined right here.
 */
type FeatureSettingsShape = {
    items?: readonly SettingShape[];
    groups?: readonly { items: readonly SettingShape[] }[];
};

type SettingShape = { control: { key: string } };

type FeatureConstructor = new () => { settings: FeatureSettingsShape };

/**
 * Every feature the plugin loads.
 *
 * Adding an entry here is enough: its settings contribute to
 * `ScrollingPluginSettings`, its definitions are registered with the settings
 * store, and the layout is required to place it (see `@core/settings.layout`).
 */
export const features = [
    CenterCursorFeature,
    CodeBlockFeature,
    CommandsFeature,
    FileTreeFeature,
    LineLengthFeature,
    MathJaxFeature,
    MouseScrollFeature,
    PreviewScrollKeysFeature,
    RememberFileStateFeature,
    ScrollButtonsFeature,
    ScrollbarFeature,
];

type ControlValue<C> = C extends { type: "toggle" }
    ? boolean
    : C extends { type: "text" }
      ? string
      : C extends { type: "textarea" }
        ? string
        : C extends { type: "number" }
          ? number
          : C extends { type: "slider" }
            ? number
            : C extends { type: "dropdown"; options: Record<string, any> }
              ? keyof C["options"]
              : unknown;

type InstanceOf<C> = C extends new () => infer I ? I : never;

type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
    arg: infer I,
) => void
    ? I
    : never;

type MergeFeatures<F extends readonly FeatureConstructor[]> = UnionToIntersection<
    SettingObject<InstanceOf<F[number]>>
>;

/** The flat, fully typed settings object. Every key is declared exactly once. */
export type ScrollingPluginSettings = MergeFeatures<typeof features>;

type SettingItem = SettingShape;

type ItemsOf<T> = T extends { items?: readonly (infer I)[] } ? I : never;

type GroupsOf<T> = T extends { groups?: readonly (infer G)[] } ? G : never;

type SettingObjectItem<S> = S extends SettingItem
    ? {
          [K in S["control"]["key"]]: ControlValue<S["control"]>;
      }
    : never;

type SettingObject<F extends { settings: FeatureSettingsShape }> = UnionToIntersection<
    SettingObjectItem<ItemsOf<F["settings"]> | ItemsOf<GroupsOf<F["settings"]>>>
>;
