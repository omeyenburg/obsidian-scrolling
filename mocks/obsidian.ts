export class Editor {}
export class MarkdownView {}
export function debounce() {}

(HTMLElement.prototype as any).addClass = function (cls: string) {
    this.classList.add(...(Array.isArray(cls) ? cls : [cls]));
};
(HTMLElement.prototype as any).removeClass = function (cls: string) {
    this.classList.remove(...(Array.isArray(cls) ? cls : [cls]));
};
(HTMLElement.prototype as any).toggleClass = function (cls: string, force?: boolean) {
    this.classList.toggle(cls, force);
};
(HTMLElement.prototype as any).hasClass = function (cls: string) {
    return this.classList.contains(cls);
};
