import {
    Debouncer,
    Editor,
    EditorRange,
    FileView,
    MarkdownView,
    Notice,
    OpenViewState,
    Platform,
    TAbstractFile,
    TFile,
    Workspace,
    WorkspaceLeaf,
    debounce,
    normalizePath,
} from "obsidian";
import { around } from "monkey-around";

import { default as ScrollingPlugin } from "@core/main";

interface EphemeralState {
    timestamp: number;
    scroll?: number;
    scrollTop?: number;
    cursor?: EditorRange;
}

class FileLeaf extends WorkspaceLeaf {
    view: FileView;
}

export class RestoreScroll {
    private readonly plugin: ScrollingPlugin;

    private ephemeralStates: Record<string, EphemeralState> = {};

    // Number of files that are currently opening.
    // If atleast one file is opening, no file states will be saved.
    private numOpeningFiles = 0;

    private readonly storeStateDebounced: Debouncer<[HTMLElement?, Event?], void>;
    private readonly writeStatesFileDebounced: Debouncer<[], void>;

    private linkUsed = false;

    private workspaceInitialized: boolean;

    // Prime numbers :)
    private readonly STORE_INTERVAL = 97;
    private readonly FILE_WRITE_INTERVAL = 293;

    public static readonly DEFAULT_FILE_PATH =
        ".obsidian/plugins/scrolling/scrolling-positions.json";
    public static readonly FALLBACK_FILE_PATH =
        ".obsidian/plugins/obsidian-scrolling/scrolling-positions.json";

    constructor(plugin: ScrollingPlugin) {
        this.plugin = plugin;

        // True when plugin is reloaded.
        this.workspaceInitialized = this.plugin.app.workspace.layoutReady;

        this.storeStateDebounced = debounce(
            this.storeFileState.bind(this),
            this.STORE_INTERVAL,
            false,
        );

        this.writeStatesFileDebounced = debounce(
            this.writeStatesFile.bind(this),
            this.FILE_WRITE_INTERVAL,
            true,
        );

        // Monkey-patch the OpenLinkText function
        // to mark interaction as link use.
        const self = this;
        plugin.register(
            around(Workspace.prototype, {
                openLinkText(oldOpenLinkText) {
                    return async function (
                        linktext: string,
                        sourcePath: string,
                        newLeaf?: boolean,
                        openViewState?: OpenViewState,
                    ) {
                        self.linkUsed = true;

                        const args = [linktext, sourcePath, newLeaf, openViewState];
                        const result = await oldOpenLinkText.apply(this, args);

                        self.linkUsed = false;

                        return result;
                    };
                },
            }),
        );

        plugin.events.onScroll(this.scrollHandler.bind(this));
        plugin.events.onMouseUp(this.mouseUpHandler.bind(this));
        plugin.events.onFileOpen(this.fileOpenHandler.bind(this));
        plugin.events.onFileDelete(this.fileDeleteHandler.bind(this));
        plugin.events.onFileRename(this.fileRenameHandler.bind(this));
        plugin.events.onLayoutReady(this.layoutReadyHandler.bind(this));
        plugin.events.onLayoutReady(this.cursorUpdateHandler.bind(this));
    }

    /**
     * Returns the number of stored file states.
     * Used in the settings menu to display the status.
     */
    public getNumEphemeralStates(): number {
        return Object.keys(this.ephemeralStates).length;
    }

    /**
     * Updates the state file path.
     * Loads the state file on disk asynchronously.
     */
    public async loadStatesFile(): Promise<void> {
        const exists = await this.checkStatesFileLoadPath();
        if (!exists) return;
        const filePath = this.plugin.settings.restoreScrollFilePath;

        try {
            const data = await this.plugin.app.vault.adapter.read(filePath);
            if (data) {
                this.ephemeralStates = JSON.parse(data);
            } else {
                this.ephemeralStates = {};
            }
        } catch (error) {
            console.error("Failed to load scroll positions file:", error);
            this.ephemeralStates = {};
        }
    }

    /**
     * Returns the valid normalized path or nothing.
     * Emits notices to the user on success or failure.
     * Used in the settings menu.
     * Do not confuse with renameFileHandler.
     */
    public async renameStatesFile(newPath: string | null): Promise<string | undefined> {
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

    /**
     * On scroll event.
     * Requests to save the file scroll state & store it in a file.
     */
    private scrollHandler(event: Event): void {
        if (!this.workspaceInitialized || this.numOpeningFiles > 0) return;

        this.plugin.restoreScroll.storeStateDebounced(event.target as HTMLElement);
        this.plugin.restoreScroll.writeStatesFileDebounced();
    }

    /**
     * On mouse up event.
     */
    private mouseUpHandler(event: MouseEvent) {
        this.storeStateDebounced(event.target as HTMLElement);
    }

    /**
     * On cursor update.
     */
    private cursorUpdateHandler(_editor: Editor, _docChanged: boolean, vimModeChanged: boolean) {
        if (vimModeChanged) return;
        this.storeStateDebounced();
    }

    /**
     * On file open.
     * Restores file state of the opened file.
     * Does not restore on initial load.
     * Does not restore if the same file is opened in the same split already.
     * Does not restore if heading link is used or links are disabled and any link is used.
     * Might break if the same file is opened twice in different tabs simultaneously .
     */
    private fileOpenHandler(file: TFile): void {
        // Do not restore on initial load. Responsiblity of layoutReadyHandler.
        if (!this.workspaceInitialized) return;
        if (this.plugin.settings.restoreScrollInitialOnly) return;

        // Do not restore if heading link is used.
        const headingLinkUsed =
            this.plugin.app.workspace.containerEl.querySelector("span.is-flashing");
        if (headingLinkUsed) return;

        // Do not restore if any link was used and links are disabled.
        if (this.linkUsed && !this.plugin.settings.restoreScrollFileLink) return;

        // Mode top means feature is disabled.
        if (this.plugin.settings.restoreScrollMode === "top") return;

        // DEPRECATED
        // Find the matching leaf for that file.
        // Leaf must be flagged as working. If leaf.working turns out not to be reliable,
        // just store the leaf IDs of opened leaves on layoutReady and fileOpen.
        // this.plugin.app.workspace.iterateRootLeaves((leaf) => {
        //     if (
        //         leaf.working &&
        //         leaf.view instanceof FileView &&
        //         leaf.view.file.path === file.path
        //     ) {
        //         fileLeaf = leaf as FileLeaf;
        //     }
        // });

        let fileLeaf: FileLeaf | null = null;

        this.plugin.app.workspace.iterateRootLeaves((leaf) => {
            if (leaf.view == this.plugin.app.workspace.getActiveFileView()) {
                fileLeaf = leaf as FileLeaf;
            }
        });

        if (fileLeaf === null) return;

        // Check whether the same file is already opened in other tab of the same split.
        if (this.isFileOpenedInSplit(fileLeaf)) return;

        // Must be reset in iter!
        this.numOpeningFiles += 1;

        // Restore state as soon as file finished loading.
        let numFrames = 0;
        const MAX_ATTEMPTS = 100;
        const iter = () => {
            if (fileLeaf && fileLeaf.working && numFrames++ < MAX_ATTEMPTS) {
                window.requestAnimationFrame(iter);
            } else {
                this.restoreFileState(fileLeaf.view);

                // File is opened and does not prohibit state saving anymore.
                // Maybe add some edge case handling.
                this.numOpeningFiles -= 1;
            }
        };
        iter();

        this.writeStatesFileDebounced();
    }

    /**
     * On Obsidian layout ready or plugin reload.
     * Restores visible leaves across all splits.
     */
    private layoutReadyHandler() {
        // Skip if plugin is reloaded.
        if (this.workspaceInitialized) return;

        this.plugin.app.workspace.iterateRootLeaves((leaf) => {
            if (leaf.view instanceof FileView) {
                this.restoreFileState(leaf.view);
            }
        });

        // Mark as initialized, because Workspace.layoutReady is set to true too early.
        this.workspaceInitialized = true;
    }

    /**
     * On file deletion.
     * Updates file cache.
     */
    private fileDeleteHandler(file: TAbstractFile): void {
        delete this.ephemeralStates[file.path];
    }

    /**
     * On file rename.
     * Updates file cache.
     * Marks file as not to be restored.
     * Do not confuse with renameStatesFile.
     */
    private fileRenameHandler(file: TAbstractFile, old: string): void {
        this.ephemeralStates[file.path] = this.ephemeralStates[old];
        delete this.ephemeralStates[old];
    }

    /**
     * Checks whether the file of the specified leaf is already opened in a different tab of the same split.
     */
    private isFileOpenedInSplit(leaf: WorkspaceLeaf): boolean {
        if (!(leaf.view instanceof FileView)) return false;

        for (let sibling of leaf.parentSplit.children) {
            if (sibling.view === leaf.view || !(sibling.view instanceof FileView)) continue;
            if (leaf.view.file.path == sibling.view.file.path) return true;
        }

        return false;
    }

    /**
     * Restores the file state without extra checks.
     * Whether the state should be restored must be decided in advance.
     */
    private restoreFileState(view: FileView): void {
        // Mode top means feature is disabled.
        if (this.plugin.settings.restoreScrollMode === "top") return;

        let cursor: EditorRange, scroll: number, scrollTop: number;
        if (this.plugin.settings.restoreScrollMode === "bottom") {
            // For bottom mode use same logic as for scroll mode.
            scroll = Infinity;
            scrollTop = Infinity;
        } else {
            // Read state of file with split id.
            const fileId = this.getFileId(view);
            const ephemeralState = this.ephemeralStates[fileId];
            if (!ephemeralState) return;
            ({ cursor, scroll, scrollTop } = ephemeralState);
        }

        if (view instanceof MarkdownView && view.getMode() === "source" && (scroll || cursor)) {
            if (cursor && this.plugin.settings.restoreScrollMode === "cursor") {
                view.editor.setCursor(cursor.from);
                view.setEphemeralState({ cursor, scroll, focus: true });
                view.editor.scrollIntoView(cursor, true);
                window.setTimeout(() => {
                    view.setEphemeralState({ cursor, focus: true });
                    view.editor.scrollIntoView(cursor, true);
                }, this.plugin.settings.restoreScrollDelay);
            } else {
                view.setEphemeralState({ scroll });
                window.setTimeout(() => {
                    view.setEphemeralState({ scroll });
                }, this.plugin.settings.restoreScrollDelay);
            }
        } else if (scrollTop) {
            const scroller = this.getScroller(view);
            if (!scroller) return;

            // Bases content loads in late.
            let numFrames = 0;
            const MAX_ATTEMPTS = 100;
            const iter = () => {
                scroller.scrollTop = scrollTop;

                if (scroller.scrollTop !== scrollTop && numFrames++ < MAX_ATTEMPTS) {
                    window.requestAnimationFrame(iter);
                }
            };
            iter();
        }
    }

    /**
     * Returns the scroller Element for pdf files, bases and markdown previews.
     * Markdown source must be checked and handled separately.
     * Pdf is only enabled on mobile.
     */
    private getScroller(view: FileView): HTMLElement | null {
        switch (view.getViewType()) {
            case "markdown":
                return view.containerEl.querySelector(".markdown-preview-view");
            case "pdf":
                if (!Platform.isMobile || !this.plugin.settings.restoreScrollPdf) return null;
                return view.containerEl.querySelector(".pdf-viewer-container");
            case "bases":
                if (!this.plugin.settings.restoreScrollBases) return null;
                return view.containerEl.querySelector(".bases-view");
            default:
                return null;
        }
    }

    /**
     * Checks asynchronously whether the directory of a file path exists.
     */
    private async directoryOfFileExists(filePath: string): Promise<boolean> {
        const lastSlashIndex = filePath.lastIndexOf("/");
        if (lastSlashIndex === -1) {
            return true;
        }
        const dirPath = filePath.substring(0, lastSlashIndex);
        return await this.plugin.app.vault.adapter.exists(dirPath);
    }

    /**
     * Validates or updates the path to the storage file on disk for writing (not reading).
     * Attempts "scrolling" and "obsidian-scrolling" as fallback directory names of this plugin.
     */
    private async checkStatesFileWritePath(): Promise<void> {
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

    /**
     * Updates the state file path.
     * Writes the state file on disk asynchronously.
     *  TODO: should write to a temporary file to avoid interrupt corruptions.
     */
    private async writeStatesFile(): Promise<void> {
        if (!this.plugin.settings.restoreScrollFileEnabled) return;

        await this.checkStatesFileWritePath();
        const filePath = this.plugin.settings.restoreScrollFilePath;

        try {
            const data = JSON.stringify(this.ephemeralStates);
            await this.plugin.app.vault.adapter.write(filePath, data);
        } catch (error) {
            new Notice("Failed to write scroll positions file. Disabling disk storage.");
            console.error("Failed to write scroll positions file:", error);
            this.plugin.settings.restoreScrollFileEnabled = false;
        }
    }

    /**
     * Validates or updates the path to the storage file on disk for reading (not writing).
     * Attempts "scrolling" and "obsidian-scrolling" as fallback directory names of this plugin.
     */
    private async checkStatesFileLoadPath(): Promise<boolean> {
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

    /**
     * Get id of the split that contains a given leaf.
     * Returns a string with the nested split indices concatinated with -.
     * Returns an empty string for the zero indexed leaf.
     * Example: '1-0-2'
     */
    private getSplitIdOfLeaf(leaf: WorkspaceLeaf): string {
        /*
         * Example hierarchy:
         *
         * [container leaf]
         *   [container leaf]
         *     [tab leaf]
         *     [tab leaf]
         *   [container leaf]
         *     [container leaf]
         *       [tab leaf]
         *       [tab leaf]
         *     [container leaf]
         *       [tab leaf]
         *       [tab leaf]
         *
         * We expect the input leaf to be a tab. The parent of the leaf is a container.
         */

        if (!leaf?.parentSplit?.parentSplit) return "";

        const path: number[] = [];
        let current = leaf.parentSplit;

        while (current.parentSplit) {
            path.unshift(current.parentSplit.children.indexOf(current));
            current = current.parentSplit;
        }

        if (path.every((index) => index === 0)) return "";

        return path.join("-");
    }

    /**
     * Returns the file id based on the file path and split id.
     */
    private getFileId(view: FileView): string {
        const splitId = this.getSplitIdOfLeaf(view.leaf);
        if (splitId === "") {
            return view.file.path;
        } else {
            return view.file.path + "#" + splitId;
        }
    }

    /**
     * Checks and saves current scroll & cursor position in state cache.
     * Discards old states if number of stored states is limited.
     */
    private storeFileState(el?: Element, _event?: Event): void {
        const mode = this.plugin.settings.restoreScrollMode;
        if (mode === "top" || mode === "bottom") return;

        if (!this.workspaceInitialized || this.numOpeningFiles > 0) return;

        // If element is provided, find matching view. Otherwise use active view.
        // Not active leaves can be scrolled.
        // Blocked while loading (leaf.working) or not rendered (leaf.width is zero).
        let view: FileView = null;
        if (el) {
            this.plugin.app.workspace.iterateRootLeaves((leaf) => {
                if (
                    !leaf.working &&
                    leaf.width &&
                    leaf.view instanceof FileView &&
                    leaf.view.containerEl.contains(el)
                ) {
                    view = leaf.view;
                }
            });
        } else {
            view = this.plugin.app.workspace.getActiveViewOfType(FileView);
        }
        if (!view) return;

        const fileId = this.getFileId(view);

        const timestamp = Date.now();

        if (view instanceof MarkdownView && view.getMode() == "source") {
            const scrollTop = view.editor.getScrollInfo().top;
            const { cursor, scroll } = view.getEphemeralState() as {
                cursor?: EditorRange;
                scroll?: number;
            };

            // This function is also invoked on file load when using the file tree.
            // Simple to filter out by checking for undefined.
            if (cursor === undefined || scroll === undefined) return;

            this.ephemeralStates[fileId] = {
                timestamp,
                cursor,
                scroll,
                scrollTop,
            };
        } else {
            const scrollTop = this.getScroller(view)?.scrollTop;
            if (scrollTop) this.ephemeralStates[fileId] = { timestamp, scrollTop };
        }

        this.discardOldStates();
    }

    /**
     * Limits the number of stored file states by timestamp and discards the oldest.
     */
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
}
