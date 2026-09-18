import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const workflow = fs.readFileSync(".github/workflows/verify-enchev-web.yml", "utf8");

test("package exposes the four foundation CI gates", () => {
  for (const name of ["lint", "typecheck", "test", "build"]) {
    assert.equal(typeof packageJson.scripts?.[name], "string", `missing npm script: ${name}`);
    assert.ok(packageJson.scripts[name].trim().length > 0, `empty npm script: ${name}`);
  }
});

test("GitHub Actions executes lint, typecheck, test, build in order", () => {
  const commands = ["npm run lint", "npm run typecheck", "npm test", "npm run build"];
  const positions = commands.map((command) => workflow.indexOf(command));

  positions.forEach((position, index) => {
    assert.notEqual(position, -1, `workflow is missing: ${commands[index]}`);
  });

  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(
      positions[index - 1] < positions[index],
      `CI gate order is invalid: ${commands[index - 1]} must run before ${commands[index]}`,
    );
  }
});

test("ESLint baseline configuration is committed", () => {
  assert.ok(fs.existsSync("eslint.config.mjs"), "eslint.config.mjs is missing");
});
