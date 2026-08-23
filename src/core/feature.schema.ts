import type { Feature } from "@core/Feature";
import type { SettingDefinition } from "@core/settings.schema";

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

export interface FeatureSettingsDefinition<K extends string = string> {
    name: string;
    desc: string;
    items: readonly SettingDefinition<K>[];
    visible?: boolean | (() => boolean);
}

type FeatureConstructor = new () => Feature;

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

export type ScrollingPluginSettings = MergeFeatures<typeof features>;

type SettingItem = {
    control: {
        key: string;
    };
};

type ItemsOf<T> = T extends { items: readonly (infer I)[] }
    ? I
    : never;

type SettingObjectItem<S> = S extends SettingItem
    ? {
          [K in S["control"]["key"]]: ControlValue<S["control"]>;
      }
    : never;

type SettingObject<F extends Feature> = UnionToIntersection<
    SettingObjectItem<ItemsOf<F["settings"]>>
>;
