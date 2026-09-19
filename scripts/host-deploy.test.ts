import { expect, test } from "bun:test";
import { deploymentEnvironment, parseDeployRequest } from "./host-deploy";
const commit = "a".repeat(40);
test("deployment socket accepts only a full SHA and Discord destination", () => {
  expect(parseDeployRequest(`deploy ${commit} 123456789012345678\n`)).toEqual({
    commit,
    channelId: "123456789012345678",
  });
  for (const request of [
    `deploy main 123456789012345678\n`,
    `deploy ${commit} ../file\n`,
    `deploy ${commit} 123456789012345678\nexec id\n`,
  ])
    expect(parseDeployRequest(request)).toBeNull();
});
test("successful deployment persists an immutable image tag and preserves host settings", () => {
  expect(
    deploymentEnvironment(
      "NTHUSA_HTTP_PORT=3008\nNTHUSA_IMAGE_TAG=main\n",
      commit,
    ),
  ).toBe(`NTHUSA_HTTP_PORT=3008\nNTHUSA_IMAGE_TAG=sha-${commit}\n`);
  expect(() => deploymentEnvironment("", "main")).toThrow();
});
