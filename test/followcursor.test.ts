import { FollowCursor } from "../src/components/followcursor";

// More realistic mock that captures actual behavior
const createMockPlugin = (settings: any = {}) => ({
    settings: {
        followCursorEnabled: true,
        followCursorRadius: 50,
        followCursorSmoothness: 100,
        followCursorEnableMouse: false,
        followCursorEnableSelection: false,
        followCursorInstantEditScroll: false,
        ...settings,
    },
    register: jest.fn(),
});

jest.useFakeTimers();

describe("FollowCursor", () => {
    let followcursor: FollowCursor;
    let mockPlugin: any;

    beforeEach(() => {
        mockPlugin = createMockPlugin();
        followcursor = new FollowCursor(mockPlugin as any);
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    describe("calculateGoalDistance", () => {
        test("returns 0 when cursor is within radius", () => {
            mockPlugin.settings.followCursorRadius = 50;
            const scrollInfo = { top: 0, height: 100, left: 0 };
            const cursorY = 50; // exactly center

            const result = followcursor["calculateGoalDistance"](cursorY, scrollInfo);
            expect(result).toBe(0);
        });

        test("returns negative distance when cursor is above radius", () => {
            mockPlugin.settings.followCursorRadius = 50;
            const scrollInfo = { top: 0, height: 100, left: 0 };
            const cursorY = 10;

            const result = followcursor["calculateGoalDistance"](cursorY, scrollInfo);
            expect(result).toBeLessThan(0);
        });

        test("returns positive distance when cursor is below radius", () => {
            mockPlugin.settings.followCursorRadius = 50;
            const scrollInfo = { top: 0, height: 100, left: 0 };
            const cursorY = 90;

            const result = followcursor["calculateGoalDistance"](cursorY, scrollInfo);
            expect(result).toBeGreaterThan(0);
        });

        test("returns 0 when signed goal distance is < 1", () => {
            mockPlugin.settings.followCursorRadius = 0;
            const scrollInfo = { top: 0, height: 100, left: 0 };
            const cursorY = 50.4; // tiny offset

            const result = followcursor["calculateGoalDistance"](cursorY, scrollInfo);
            expect(result).toBe(0);
        });

        test("handles different radius percentages correctly", () => {
            mockPlugin.settings.followCursorRadius = 100; // full height
            const scrollInfo = { top: 0, height: 100, left: 0 };
            const cursorY = 0; // top

            const result = followcursor["calculateGoalDistance"](cursorY, scrollInfo);
            // Should return 0 because cursor is within the full height radius
            expect(result).toBe(0);
        });
    });

    describe("calculateSteps", () => {
        test("returns at least 1 step", () => {
            mockPlugin.settings.followCursorSmoothness = 100;

            const result1 = followcursor["calculateSteps"](0, 100, false);
            const result2 = followcursor["calculateSteps"](10, 100, false);
            const result3 = followcursor["calculateSteps"](100, 100, false);
            const result4 = followcursor["calculateSteps"](-10, 100, false);
            const result5 = followcursor["calculateSteps"](-100, 100, false);

            expect(result1).toBeGreaterThanOrEqual(1);
            expect(result2).toBeGreaterThanOrEqual(1);
            expect(result3).toBeGreaterThanOrEqual(1);
            expect(result4).toBeGreaterThanOrEqual(1);
            expect(result5).toBeGreaterThanOrEqual(1);
        });

        test("reduces steps when goal exceeds scrollerHeight", () => {
            mockPlugin.settings.followCursorSmoothness = 100;

            const resultSmallScroller = followcursor["calculateSteps"](100, 10, false);
            const resultLargeScroller = followcursor["calculateSteps"](100, 200, false);
            expect(resultSmallScroller).toBeLessThan(resultLargeScroller);
        });

        test("returns 1 step for instant edit scroll", () => {
            mockPlugin.settings.followCursorInstantEditScroll = true;
            mockPlugin.settings.followCursorSmoothness = 100;

            const result = followcursor["calculateSteps"](50, 100, true);
            expect(result).toBe(1);
        });

        test("uses smoothness setting for animation duration", () => {
            mockPlugin.settings.followCursorSmoothness = 200;
            const result = followcursor["calculateSteps"](50, 100, false);
            expect(result).toBeGreaterThan(1);
        });
    });

    describe("keyDownHandler and mouseUpHandler", () => {
        test("keyDownHandler resets recentMouseUp flag", () => {
            followcursor.mouseUpHandler();
            expect(followcursor["recentMouseUp"]).toBe(true);
            
            followcursor.keyDownHandler();
            expect(followcursor["recentMouseUp"]).toBe(false);
        });

        test("mouseUpHandler sets recentMouseUp flag", () => {
            followcursor.mouseUpHandler();
            expect(followcursor["recentMouseUp"]).toBe(true);
            
            // After timeout, flag should reset
            jest.advanceTimersByTime(150);
            expect(followcursor["recentMouseUp"]).toBe(false);
        });

        test("mouseUpHandler timeout auto-resets after delay", () => {
            followcursor.mouseUpHandler();
            expect(followcursor["recentMouseUp"]).toBe(true);
            
            // Advance timers by the MOUSE_UP_TIMEOUT
            jest.advanceTimersByTime(100);
            expect(followcursor["recentMouseUp"]).toBe(false);
        });
    });
});
