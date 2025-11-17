import { clamp, lerp, getVimCursor } from "../src/core/util";

describe("clamp", () => {
    test("does not exceed maximum", () => {
        const result = clamp(10, 0, 5);
        expect(result).toBe(5);
    });

    test("does not exceed minimum", () => {
        const result = clamp(-10, 0, 5);
        expect(result).toBe(0);
    });

    test("returns value when within bounds", () => {
        const result = clamp(3, 0, 5);
        expect(result).toBe(3);
    });

    test("handles edge case at minimum boundary", () => {
        const result = clamp(0, 0, 5);
        expect(result).toBe(0);
    });

    test("handles edge case at maximum boundary", () => {
        const result = clamp(5, 0, 5);
        expect(result).toBe(5);
    });

    test("works with negative ranges", () => {
        const result = clamp(-3, -10, -1);
        expect(result).toBe(-3);
    });

    test("works with floating point numbers", () => {
        const result = clamp(3.7, 0.5, 5.5);
        expect(result).toBe(3.7);
    });
});

describe("lerp", () => {
    test("returns start value when t is 0", () => {
        const result = lerp(0, 100, 0);
        expect(result).toBe(0);
    });

    test("returns end value when t is 1", () => {
        const result = lerp(0, 100, 1);
        expect(result).toBe(100);
    });

    test("returns midpoint when t is 0.5", () => {
        const result = lerp(0, 100, 0.5);
        expect(result).toBe(50);
    });

    test("interpolates correctly for arbitrary t values", () => {
        const result = lerp(10, 20, 0.25);
        expect(result).toBe(12.5);
    });

    test("handles negative start and end values", () => {
        const result = lerp(-10, -5, 0.5);
        expect(result).toBe(-7.5);
    });

    test("handles extrapolation beyond 1", () => {
        const result = lerp(0, 10, 2);
        expect(result).toBe(20);
    });

    test("handles extrapolation below 0", () => {
        const result = lerp(10, 20, -0.5);
        expect(result).toBe(5);
    });

    test("works with floating point precision", () => {
        const result = lerp(0.1, 0.9, 0.5);
        expect(result).toBeCloseTo(0.5, 10);
    });
});

describe("getVimCursor", () => {
    let mockEditor: any;

    beforeEach(() => {
        // Create a mock editor with the expected structure
        mockEditor = {
            cm: {
                scrollDOM: {
                    getElementsByClassName: jest.fn()
                }
            }
        };
    });

    test("returns null when Vim cursor layer is not found", () => {
        mockEditor.cm.scrollDOM.getElementsByClassName.mockReturnValue([]);
        const result = getVimCursor(mockEditor);
        expect(result).toBeNull();
    });

    test("returns null when cursor layer exists but primary cursor is not found", () => {
        const mockCursorLayer = {
            getElementsByClassName: jest.fn().mockReturnValue([])
        };
        mockEditor.cm.scrollDOM.getElementsByClassName.mockReturnValue([mockCursorLayer]);
        
        const result = getVimCursor(mockEditor);
        expect(result).toBeNull();
    });

    test("returns cursor element when both layer and cursor are found", () => {
        const mockCursorElement = document.createElement("div");
        mockCursorElement.className = "cm-cursor-primary";
        
        const mockCursorLayer = {
            getElementsByClassName: jest.fn().mockReturnValue([mockCursorElement])
        };
        mockEditor.cm.scrollDOM.getElementsByClassName.mockReturnValue([mockCursorLayer]);
        
        const result = getVimCursor(mockEditor);
        expect(result).toBe(mockCursorElement);
    });

    test("queries for correct class names", () => {
        const mockCursorLayer = {
            getElementsByClassName: jest.fn().mockReturnValue([])
        };
        mockEditor.cm.scrollDOM.getElementsByClassName.mockReturnValue([mockCursorLayer]);
        
        getVimCursor(mockEditor);
        
        expect(mockEditor.cm.scrollDOM.getElementsByClassName).toHaveBeenCalledWith("cm-vimCursorLayer");
        expect(mockCursorLayer.getElementsByClassName).toHaveBeenCalledWith("cm-cursor-primary");
    });
});
