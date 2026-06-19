"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCategoryInput = normalizeCategoryInput;
function normalizeCategoryInput(input) {
    const name = String(input?.name || '').trim();
    if (!name) {
        throw new Error('分类名称不能为空');
    }
    const sortRaw = input?.sortOrder ?? input?.sort_order ?? 0;
    const sortOrder = Number.isFinite(Number(sortRaw)) ? Number(sortRaw) : 0;
    const activeRaw = input?.isActive ?? input?.is_active;
    return {
        name,
        sortOrder,
        isActive: activeRaw === undefined ? true : Boolean(activeRaw),
    };
}
//# sourceMappingURL=bookCategory.js.map