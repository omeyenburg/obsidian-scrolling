import { FollowCursor } from "../src/followcursor";

// Mock the ScrollingPlugin
const mockPlugin = {
    settings: {
        followCursorDynamicAnimation: false,
        followCursorSmoothness: 0,
        followCursorRadius: 0,
    },
    register: jest.fn(),
};

// Mock performance.now
jest.useFakeTimers();

describe("MouseScroll", () => {
    let followcursor: FollowCursor;

    beforeEach(() => {
        followcursor = new FollowCursor(mockPlugin as any);
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
    });

    describe("calculateSteps", () => {
        test("returns at least 1 step", () => {
            mockPlugin.settings.followCursorSmoothness = 0;
            mockPlugin.settings.followCursorDynamicAnimation = false;

            const result = followcursor["calculateSteps"](100, 100, false);
            expect(result).toBeGreaterThanOrEqual(1);
        });

        test("returns more steps for large distance", () => {
            mockPlugin.settings.followCursorSmoothness = 100;
            mockPlugin.settings.followCursorDynamicAnimation = false;

            const fewSteps = followcursor["calculateSteps"](10, 100, false);
            const manySteps = followcursor["calculateSteps"](100, 100, false);

            expect(manySteps).toBeGreaterThan(fewSteps);
        });

        test("reduces steps when intensity is high or goal exceeds scrollerHeight", () => {
            mockPlugin.settings.followCursorSmoothness = 100;
            mockPlugin.settings.followCursorDynamicAnimation = false;

            // Simulate high intensity manually
            followcursor["scrollIntensity"] = 1000;

            const result = followcursor["calculateSteps"](100, 10, false);
            const expectedReduction = Math.ceil(
                Math.sqrt(Math.max(1, Math.ceil(2 * (100 / 100) * Math.sqrt(100)))),
            );
            expect(result).toBe(expectedReduction);
        });
    });

    describe("calculateScrollIntensity", () => {
        test("increases scroll intensity with low delta", () => {
            const t0 = performance.now();
            followcursor["scrollLastEvent"] = t0;
            followcursor["scrollIntensity"] = 2;

            jest.advanceTimersByTime(10);
            followcursor["calculateScrollIntensity"]();

            expect(followcursor["scrollIntensity"]).toBeGreaterThan(2);
            expect(followcursor["scrollLastEvent"]).toBeGreaterThan(t0);
        });

        test("decreases scroll intensity with high delta", () => {
            const t0 = performance.now();
            followcursor["scrollLastEvent"] = t0;
            followcursor["scrollIntensity"] = 2;

            jest.advanceTimersByTime(500);
            followcursor["calculateScrollIntensity"]();

            expect(followcursor["scrollIntensity"]).toBeLessThan(2);
            expect(followcursor["scrollLastEvent"]).toBeGreaterThan(t0);
        });
    });
});
