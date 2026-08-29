import { expect, test } from "bun:test";
import { normalizeGitHubUrl } from "./site-config";

test("variable vacía, undefined o solo espacios no produce URL de GitHub", () => {
  expect(normalizeGitHubUrl(undefined)).toBeNull();
  expect(normalizeGitHubUrl(null)).toBeNull();
  expect(normalizeGitHubUrl("")).toBeNull();
  expect(normalizeGitHubUrl("   ")).toBeNull();
  expect(normalizeGitHubUrl("\n\t")).toBeNull();
});

test("URL HTTPS de github.com válida se acepta y se normaliza", () => {
  expect(normalizeGitHubUrl("https://github.com")).toBe("https://github.com");
  expect(normalizeGitHubUrl("https://github.com/")).toBe("https://github.com");
  expect(normalizeGitHubUrl("https://github.com/org/repo")).toBe("https://github.com/org/repo");
  expect(normalizeGitHubUrl("https://github.com/org/repo/")).toBe("https://github.com/org/repo");
  expect(normalizeGitHubUrl("  https://github.com/org/repo/  ")).toBe(
    "https://github.com/org/repo",
  );
});

test("rechaza esquemas, hosts y trampas que no son github.com por HTTPS", () => {
  expect(normalizeGitHubUrl("http://github.com/org/repo")).toBeNull();
  expect(normalizeGitHubUrl("https://gitlab.com/org/repo")).toBeNull();
  expect(normalizeGitHubUrl("https://evil.com/github.com/x")).toBeNull();
  expect(normalizeGitHubUrl("javascript:alert(1)")).toBeNull();
  expect(normalizeGitHubUrl("data:text/html,https://github.com")).toBeNull();
  expect(normalizeGitHubUrl("//github.com/org/repo")).toBeNull();
  expect(normalizeGitHubUrl("https://github.com.evil.com/x")).toBeNull();
  expect(normalizeGitHubUrl("github.com/org/repo")).toBeNull();
  expect(normalizeGitHubUrl("https://www.github.com/org/repo")).toBeNull();
});
