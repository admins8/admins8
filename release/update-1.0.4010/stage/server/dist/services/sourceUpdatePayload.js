"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSourceUpdateParams = buildSourceUpdateParams;
function optionalValue(value) {
    return value === undefined ? null : value;
}
function optionalBoolean(value) {
    if (value === undefined)
        return null;
    return value ? 1 : 0;
}
function optionalJson(value) {
    if (value === undefined || value === null)
        return null;
    return JSON.stringify(value);
}
function buildSourceUpdateParams(data, id) {
    return [
        optionalValue(data.bookSourceName),
        optionalValue(data.bookSourceGroup),
        optionalValue(data.bookSourceType),
        optionalBoolean(data.enabled),
        optionalBoolean(data.enabledExplore),
        optionalValue(data.customOrder),
        optionalValue(data.searchUrl),
        optionalValue(data.exploreUrl),
        optionalValue(data.header),
        optionalValue(data.jsLib),
        optionalValue(data.bookSourceComment),
        optionalJson(data.ruleSearch),
        optionalJson(data.ruleBookInfo),
        optionalJson(data.ruleToc),
        optionalJson(data.ruleContent),
        id,
    ];
}
//# sourceMappingURL=sourceUpdatePayload.js.map