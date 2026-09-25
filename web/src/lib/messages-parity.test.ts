import { describe, expect, it } from "vitest";
import cs from "../../messages/cs.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

function keys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("translation catalog parity", () => {
  it("keeps English and Russian catalogs complete against Czech", () => {
    const expected = keys(cs).sort();
    expect(keys(en).sort()).toEqual(expected);
    expect(keys(ru).sort()).toEqual(expected);
  });
});
