function optionalValue<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function optionalBoolean(value: unknown): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}

function optionalJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function buildSourceUpdateParams(data: any, id: string | number): any[] {
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
