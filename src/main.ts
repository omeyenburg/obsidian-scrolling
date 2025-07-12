import { Plugin } from "obsidian";

import { FollowCursor } from "./followcursor";
import { MouseScroll } from "./mousescroll";
import { Scrollbar } from "./scrollbar";
import { RestoreScroll } from "./restorescroll";
import { ScrollingSettingTab, ScrollingPluginSettings, DEFAULT_SETTINGS } from "./settings";

export default class ScrollingPlugin extends Plugin {
    settings: ScrollingPluginSettings;

    restoreScroll: RestoreScroll;
    followcursor: FollowCursor;
    mousescroll: MouseScroll;
    scrollbar: Scrollbar;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new ScrollingSettingTab(this));

        this.restoreScroll = new RestoreScroll(this);
        this.followcursor = new FollowCursor(this);
        this.mousescroll = new MouseScroll(this);
        this.scrollbar = new Scrollbar(this);

        this.restoreScroll.loadData();

        this.registerEvent(
            this.app.workspace.on("active-leaf-change", this.activeLeafChangeHandler.bind(this)),
        );

        console.log("ScrollingPlugin loaded");
    }

    private activeLeafChangeHandler() {
        this.scrollbar.activeLeafChangeHandler();
        this.mousescroll.activeLeafChangeHandler();
    }

    async onunload() {
        this.scrollbar?.removeStyle();

        console.log("ScrollingPlugin unloaded");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
