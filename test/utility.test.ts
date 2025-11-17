import { clamp, lerp, getVimCursor, isFiniteNumber, safeParseFloat } from "../src/core/util";

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

describe("isFiniteNumber", () => {
    test("returns true for positive integers", () => {
        expect(isFiniteNumber(42)).toBe(true);
    });

    test("returns true for negative integers", () => {
        expect(isFiniteNumber(-42)).toBe(true);
    });

    test("returns true for zero", () => {
        expect(isFiniteNumber(0)).toBe(true);
    });

    test("returns true for positive floating point numbers", () => {
        expect(isFiniteNumber(3.14)).toBe(true);
    });

    test("returns true for negative floating point numbers", () => {
        expect(isFiniteNumber(-2.718)).toBe(true);
    });

    test("returns false for NaN", () => {
        expect(isFiniteNumber(NaN)).toBe(false);
    });

    test("returns false for positive Infinity", () => {
        expect(isFiniteNumber(Infinity)).toBe(false);
    });

    test("returns false for negative Infinity", () => {
        expect(isFiniteNumber(-Infinity)).toBe(false);
    });

    test("returns false for division by zero (NaN)", () => {
        expect(isFiniteNumber(0 / 0)).toBe(false);
    });

    test("returns false for positive division by zero (Infinity)", () => {
        expect(isFiniteNumber(1 / 0)).toBe(false);
    });
});

describe("safeParseFloat", () => {
    test("parses valid positive numbers", () => {
        expect(safeParseFloat("42.5", 0)).toBe(42.5);
    });

    test("parses valid negative numbers", () => {
        expect(safeParseFloat("-10.25", 0)).toBe(-10.25);
    });

    test("parses integers", () => {
        expect(safeParseFloat("100", 0)).toBe(100);
    });

    test("parses zero", () => {
        expect(safeParseFloat("0", 99)).toBe(0);
    });

    test("returns default for invalid strings", () => {
        expect(safeParseFloat("invalid", 10)).toBe(10);
    });

    test("returns default for empty string", () => {
        expect(safeParseFloat("", 5)).toBe(5);
    });

    test("returns default for null", () => {
        expect(safeParseFloat(null, 7)).toBe(7);
    });

    test("returns default for undefined", () => {
        expect(safeParseFloat(undefined, 3)).toBe(3);
    });

    test("returns default for Infinity string", () => {
        expect(safeParseFloat("Infinity", 0)).toBe(0);
    });

    test("returns default for -Infinity string", () => {
        expect(safeParseFloat("-Infinity", 1)).toBe(1);
    });

    test("returns default for NaN string", () => {
        expect(safeParseFloat("NaN", 2)).toBe(2);
    });

    test("parses numbers with leading whitespace", () => {
        expect(safeParseFloat("  42", 0)).toBe(42);
    });

    test("parses numbers in scientific notation", () => {
        expect(safeParseFloat("1.5e2", 0)).toBe(150);
    });

    test("handles partial parsing and stops at first invalid character", () => {
        expect(safeParseFloat("42abc", 0)).toBe(42);
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
