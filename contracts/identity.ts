/** Set the same operator-selected display name on the core and worker. */
export function getBotName(environment: NodeJS.ProcessEnv = process.env) {
  const name = environment.NTHUSA_BOT_NAME?.trim() || "NTHUSA Bot";
  if (name.length > 32 || /[<>\x00-\x1f\x7f]/u.test(name)) {
    throw new Error(
      "NTHUSA_BOT_NAME must be at most 32 characters without markup or control characters.",
    );
  }
  return name;
}

export const BOT_NAME = getBotName();
export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
