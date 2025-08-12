import {
    View,
    EditorRange,
    FileView,
    MarkdownView,
    Notice,
    TAbstractFile,
    TFile,
    debounce,
    normalizePath,
} from "obsidian";

import { default as ScrollingPlugin } from "./main";

interface EphemeralState {
    timestamp: number;
    scroll?: number;
    scrollTop?: number;
    cursor?: EditorRange;
}

function getScroller(view: FileView): HTMLElement | null {
    switch (view.getViewType()) {
        case "markdown":
            return view.containerEl.querySelector(".markdown-preview-view");
        case "pdf":
            return view.containerEl.querySelector(".pdf-viewer-container");
        case "image":
            return view.containerEl.querySelector(".image-container")?.parentElement;
        default:
            return null;
    }
}

export class RestoreScroll {
    private readonly plugin: ScrollingPlugin;

    private ephemeralStates: Record<string, EphemeralState> = {};

    private skipViewSet = false;
    private expectEphemeralState = true; // On initial load open-file triggers too late

    public readonly storeStateDebounced: (file?: TFile) => void;
    public readonly writeStateFileDebounced: () => void;

    // Prime numbers :)
    private readonly STORE_INTERVAL = 97;
    private readonly FILE_WRITE_INTERVAL = 293;

    public static readonly DEFAULT_FILE_PATH =
        ".obsidian/plugins/scrolling/scrolling-positions.json";
    public static readonly FALLBACK_FILE_PATH =
        ".obsidian/plugins/obsidian-scrolling/scrolling-positions.json";

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        this.storeStateDebounced = debounce(this.storeState.bind(this), this.STORE_INTERVAL, false);

        this.writeStateFileDebounced = debounce(
            this.writeStateFile.bind(this),
            this.FILE_WRITE_INTERVAL,
            true,
        );
    }

    public scrollHandler(): void {
        const file = this.plugin.app.workspace.getActiveFile();
        if (file) {
            this.plugin.restoreScroll.storeStateDebounced(file);
            this.plugin.restoreScroll.writeStateFileDebounced();
        }
    }

    public openFileHandler(): void {
        this.expectEphemeralState = true;
        window.setTimeout(() => (this.expectEphemeralState = false), 0);
    }

    public ephemeralStateHandler(
        view: View,
        args: [{ cursor?: EditorRange; scroll?: number; focus?: boolean }],
    ) {
        // Only proceed if there was a file open event.
        if (!this.expectEphemeralState || !args[0]) return;
        this.expectEphemeralState = false;

        // Cancel any further calculations if link has been used.
        const linkUsed = this.plugin.app.workspace.containerEl.querySelector("span.is-flashing");
        if (linkUsed || this.plugin.settings.restoreScrollMode === "top") {
            this.skipViewSet = true;
            window.setTimeout(() => (this.skipViewSet = false), 0);
            return;
        }

        // Only works in markdown source mode.
        if (!(view instanceof MarkdownView) || !view.file) return;
        if (view.getMode() !== "source") return;

        this.skipViewSet = true;
        window.setTimeout(() => (this.skipViewSet = false), 0);

        const ephemeralState = this.ephemeralStates[view.file.path];
        if (!ephemeralState) return;
        const { cursor, scroll } = ephemeralState;

        if (this.plugin.settings.restoreScrollMode === "bottom") {
            args[0].cursor = undefined;
            args[0].focus = false;
            args[0].scroll = Infinity;
        } else if (cursor && this.plugin.settings.restoreScrollMode === "cursor") {
            delete args[0].scroll;
            args[0].focus = true;
            args[0].cursor = cursor;
            window.requestAnimationFrame(() => view.editor.scrollIntoView(cursor, true));
        } else {
            args[0].cursor = undefined;
            args[0].focus = false;
            args[0].scroll = scroll;
        }
    }

    public viewStateHandler(view: View): void {
        this.writeStateFileDebounced();

        if (this.skipViewSet) return;

        if (this.plugin.settings.restoreScrollMode === "top") return;

        // Must be file view
        if (!view || !(view instanceof FileView) || !view.file) return;

        const ephemeralState = this.ephemeralStates[view.file.path];
        if (!ephemeralState) return;
        const { cursor, scroll, scrollTop } = ephemeralState;

        if (view instanceof MarkdownView && view.getMode() === "source" && (scroll || cursor)) {
            if (cursor && this.plugin.settings.restoreScrollMode === "cursor") {
                view.setEphemeralState({ cursor, focus: true });
                view.editor.scrollIntoView(cursor, true);
            } else {
                view.setEphemeralState({ scroll });
            }
        } else if (scrollTop && this.plugin.settings.restoreScrollAllFiles) {
            window.requestAnimationFrame(() => {
                const scroller = getScroller(view);
                if (scroller) {
                    scroller.scrollTop = scrollTop;
                }
            });
        }
    }

    public deleteFileHandler(file: TAbstractFile): void {
        delete this.ephemeralStates[file.path];
    }

    public renameFileHandler(file: TAbstractFile, old: string): void {
        this.ephemeralStates[file.path] = this.ephemeralStates[old];
        delete this.ephemeralStates[old];
    }

    public quitHandler(): void {
        this.writeStateFile();
    }

    private async directoryOfFileExists(filePath: string): Promise<boolean> {
        const lastSlashIndex = filePath.lastIndexOf("/");
        if (lastSlashIndex === -1) {
            return true;
        }
        const dirPath = filePath.substring(0, lastSlashIndex);
        return await this.plugin.app.vault.adapter.exists(dirPath);
    }

    private async checkWriteStorePath(): Promise<void> {
        // Check saved path
        if (await this.directoryOfFileExists(this.plugin.settings.restoreScrollFilePath)) return;

        // Check default path
        if (await this.directoryOfFileExists(RestoreScroll.DEFAULT_FILE_PATH)) {
            this.plugin.settings.restoreScrollFilePath = RestoreScroll.DEFAULT_FILE_PATH;
            return;
        }

        // Check fallback path
        if (await this.directoryOfFileExists(RestoreScroll.FALLBACK_FILE_PATH)) {
            this.plugin.settings.restoreScrollFilePath = RestoreScroll.FALLBACK_FILE_PATH;
            return;
        }
    }

    private async writeStateFile() {
        if (!this.plugin.settings.restoreScrollFileEnabled) return;

        await this.checkWriteStorePath();
        const filePath = this.plugin.settings.restoreScrollFilePath;

        const data = JSON.stringify(this.ephemeralStates);
        this.plugin.app.vault.adapter.write(filePath, data);
    }

    private async checkLoadStorePath(): Promise<boolean> {
        // Check saved path
        if (await this.plugin.app.vault.adapter.exists(this.plugin.settings.restoreScrollFilePath))
            return true;

        // Check default path
        if (await this.plugin.app.vault.adapter.exists(RestoreScroll.DEFAULT_FILE_PATH)) {
            this.plugin.settings.restoreScrollFilePath = RestoreScroll.DEFAULT_FILE_PATH;
            return true;
        }

        // Check fallback path
        if (await this.plugin.app.vault.adapter.exists(RestoreScroll.FALLBACK_FILE_PATH)) {
            this.plugin.settings.restoreScrollFilePath = RestoreScroll.FALLBACK_FILE_PATH;
            return true;
        }

        return false;
    }

    public async loadData(): Promise<void> {
        const exists = await this.checkLoadStorePath();
        if (!exists) return;
        const filePath = this.plugin.settings.restoreScrollFilePath;

        try {
            const data = await this.plugin.app.vault.adapter.read(filePath);
            this.ephemeralStates = JSON.parse(data);
        } catch {
            this.ephemeralStates = {};
        }
    }

    private storeState(file?: TFile): void {
        const mode = this.plugin.settings.restoreScrollMode;
        if (mode === "top" || mode === "bottom") return;

        const view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        if (!view || !view.file || view.file !== this.plugin.app.workspace.getActiveFile()) return;
        if (file && view.file !== file) return;

        const timestamp = Date.now();
        if (view instanceof MarkdownView && view.getMode() == "source") {
            const scrollTop = view.editor.getScrollInfo().top;
            const { cursor, scroll } = view.getEphemeralState() as {
                cursor?: EditorRange;
                scroll?: number;
            };

            this.ephemeralStates[view.file.path] = {
                timestamp,
                cursor,
                scroll,
                scrollTop,
            };
        } else if (this.plugin.settings.restoreScrollAllFiles) {
            const scrollTop = getScroller(view)?.scrollTop;
            if (scrollTop) {
                this.ephemeralStates[view.file.path] = { timestamp, scrollTop };
            }
        }

        this.discardOldStates();
    }

    private discardOldStates() {
        const entries = Object.entries(this.ephemeralStates);
        if (
            this.plugin.settings.restoreScrollLimit <= 0 ||
            entries.length <= this.plugin.settings.restoreScrollLimit
        )
            return;

        entries.sort(([, a], [, b]) => b.timestamp - a.timestamp);

        this.ephemeralStates = Object.fromEntries(
            entries.slice(0, this.plugin.settings.restoreScrollLimit),
        );
    }

    public countEphemeralStates(): number {
        return Object.keys(this.ephemeralStates).length;
    }

    public async renameStoreFile(newPath: string | null): Promise<string | undefined> {
        if (!this.plugin.settings.restoreScrollFileEnabled) return;

        if (newPath === null) {
            new Notice("Path unchanged.");
            return;
        }

        // Check empty/invalid paths before normalizing.
        if (!newPath || newPath.trim() === "" || newPath === "." || newPath === "..") {
            new Notice("Invalid file path!");
            return;
        }

        // Assuming this.plugin.settings.restoreScrollStoreFile is valid
        const newNormalizedPath = normalizePath(newPath);
        const oldNormalizedPath = normalizePath(this.plugin.settings.restoreScrollFilePath);

        if (!newNormalizedPath) {
            new Notice("Invalid file path!");
            return;
        }

        const adapter = this.plugin.app.vault.adapter;

        if (!(await this.directoryOfFileExists(newNormalizedPath))) {
            new Notice(`Directory of file does not exist.`);
            return;
        }

        if (await adapter.exists(newNormalizedPath)) {
            new Notice(`File already exists: ${newNormalizedPath}`);
            return;
        }

        if (oldNormalizedPath && (await adapter.exists(oldNormalizedPath))) {
            try {
                await adapter.rename(oldNormalizedPath, newNormalizedPath);
            } catch (e) {
                new Notice("Invalid file path!");
                return;
            }
        }

        new Notice(`Renamed storage file to: ${newNormalizedPath}`);
        return newNormalizedPath;
    }
}
