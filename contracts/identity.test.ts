import { expect, test } from "bun:test";
import { getBotName } from "./identity";

test("accepts an operator-selected name and rejects prompt markup", () => {
  expect(getBotName({ NTHUSA_BOT_NAME: " 清小會 " })).toBe("清小會");
  expect(getBotName({})).toBe("NTHUSA Bot");
  expect(() => getBotName({ NTHUSA_BOT_NAME: "<assistant>" })).toThrow();
});

test("the chosen name is shared by prompts and reply validation", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      `
    import { enforceFirstPersonIdentity } from './contracts/answer-contract.ts';
    import { buildAnswerDeveloperInstructions } from './worker/src/prompts/answer.ts';
    const text = enforceFirstPersonIdentity('我是 <self-introduction>清小會+</self-introduction>');
    const prompt = buildAnswerDeveloperInstructions({ purpose: 'answer', executionRoute: 'chat', request: 'hello', messages: [] });
    console.log(JSON.stringify({ text, custom: prompt.includes('You are 清小會+.'), old: prompt.includes('MiniSago') }));
  `,
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, NTHUSA_BOT_NAME: "清小會+" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const output = await new Response(child.stdout).text();
  expect(await child.exited).toBe(0);
  expect(JSON.parse(output)).toEqual({
    text: "我是 清小會+",
    custom: true,
    old: false,
  });
});
