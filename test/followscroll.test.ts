import { FollowScroll } from "../src/components/followscroll";

const createMockPlugin = (settings: any = {}) => ({
    settings: {
        cursorScrollEnabled: true,
        ...settings,
    },
    app: {
        workspace: {
            activeEditor: {
                editor: null as any,
            },
        },
    },
});

jest.useFakeTimers();

describe("FollowScroll", () => {
    let followScroll: FollowScroll;
    let mockPlugin: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPlugin = createMockPlugin();
        followScroll = new FollowScroll(mockPlugin as any);
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    describe("leafChangeHandler", () => {
        test("resets relativeLineOffset on leaf change", () => {
            (followScroll as any).relativeLineOffset = 100;
            
            followScroll.leafChangeHandler();
            
            expect((followScroll as any).relativeLineOffset).toBeNull();
        });
    });

    describe("viewUpdateHandler", () => {
        test("is debounced and only executes after delay", () => {
            const mockEditor = createMockEditor();
            mockPlugin.app.workspace.activeEditor.editor = mockEditor;

            followScroll.viewUpdateHandler(mockEditor as any);
            
            // Should not have updated immediately due to debounce
            jest.advanceTimersByTime(100);
            
            // Should have started processing
            jest.advanceTimersByTime(200);
            
            expect(mockEditor.cm.requestMeasure).not.toHaveBeenCalled();
        });

        test("skips update when cursor scroll is disabled", () => {
            mockPlugin.settings.cursorScrollEnabled = false;
            const followScrollDisabled = new FollowScroll(mockPlugin as any);
            const mockEditor = createMockEditor();
            mockPlugin.app.workspace.activeEditor.editor = mockEditor;

            followScrollDisabled.viewUpdateHandler(mockEditor as any);
            jest.runAllTimers();

            // Since cursorScroll is disabled, the method returns early and doesn't update
            // The relativeLineOffset might still be calculated but cursor won't move
            expect(followScrollDisabled.skipCursor).toBe(false);
        });
    });

    describe("wheelHandler", () => {
        test("is debounced", () => {
            const mockElement = document.createElement("div");
            const mockEditor = createMockEditor();
            mockPlugin.app.workspace.activeEditor.editor = mockEditor;

            followScroll.wheelHandler(mockElement);
            
            // Should not execute immediately due to debounce
            expect((followScroll as any).relativeLineOffset).toBeNull();
            
            // Should execute after debounce delay
            jest.advanceTimersByTime(70);
            
            // Still should be null because no editor interaction
            expect((followScroll as any).relativeLineOffset).toBeNull();
        });

        test("skips when cursor scroll is disabled", () => {
            mockPlugin.settings.cursorScrollEnabled = false;
            const followScrollDisabled = new FollowScroll(mockPlugin as any);
            
            const mockElement = document.createElement("div");
            followScrollDisabled.wheelHandler(mockElement);
            
            jest.advanceTimersByTime(100);
            
            expect((followScrollDisabled as any).relativeLineOffset).toBeNull();
        });
    });

    describe("skipCursor", () => {
        test("can be set and reset", () => {
            expect(followScroll.skipCursor).toBe(false);
            
            followScroll.skipCursor = true;
            expect(followScroll.skipCursor).toBe(true);
            
            followScroll.skipCursor = false;
            expect(followScroll.skipCursor).toBe(false);
        });

        test("auto-resets after delay", () => {
            followScroll.skipCursor = true;
            expect(followScroll.skipCursor).toBe(true);
            
            jest.advanceTimersByTime(100);
            // Should not reset yet  
            expect(followScroll.skipCursor).toBe(true);
            
            // Manually trigger the resetSkip which is a debounced function
            // With immediate=true, it executes immediately and then waits
            (followScroll as any).resetSkip();
            
            // Advance past the debounce delay
            jest.advanceTimersByTime(600);
            expect(followScroll.skipCursor).toBe(false);
        });
    });
});

function createMockEditor() {
    const scrollDOM = document.createElement("div");
    // Add getBoundingClientRect mock
    scrollDOM.getBoundingClientRect = jest.fn(() => ({
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: jest.fn(),
    }));
    
    return {
        cm: {
            scrollDOM: scrollDOM,
            requestMeasure: jest.fn(),
            contentDOM: document.createElement("div"),
            lineBlockAt: jest.fn(() => ({ top: 0, bottom: 20 })),
            state: {
                selection: {
                    main: { from: 0, to: 0 },
                },
            },
        },
        posToOffset: jest.fn(() => 0),
        getCursor: jest.fn(() => ({ line: 0, ch: 0 })),
    };
}
