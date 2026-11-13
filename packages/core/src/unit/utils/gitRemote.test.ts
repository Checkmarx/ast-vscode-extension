/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from "chai";
import { mock } from "../mocks/vscode-mock";
import { getRepositoryRemoteUrl, sanitizeRemoteUrl } from "../../utils/gitRemote";

describe("gitRemote", () => {
  describe("sanitizeRemoteUrl", () => {
    const cases: Array<[string | undefined, string]> = [
      ["https://github.com/org/repo.git", "https://github.com/org/repo"],
      ["https://github.com/org/repo", "https://github.com/org/repo"],
      ["https://user:ghp_secretToken123@github.com/org/repo.git", "https://github.com/org/repo"],
      ["https://oauth2:token@gitlab.com/group/sub/repo.git", "https://gitlab.com/group/sub/repo"],
      ["http://host.local/org/repo/", "https://host.local/org/repo"],
      ["https://github.com/org/repo.git?x=1#frag", "https://github.com/org/repo"],
      ["git@github.com:org/repo.git", "https://github.com/org/repo"],
      ["github.com:org/repo.git", "https://github.com/org/repo"],
      ["ssh://git@host.com:2222/org/repo.git", "https://host.com/org/repo"],
      ["git@ssh.dev.azure.com:v3/org/project/repo", "https://ssh.dev.azure.com/v3/org/project/repo"],
      ["  https://github.com/org/repo.git  ", "https://github.com/org/repo"],
      ["file:///home/user/repo", ""],
      ["/local/path/repo", ""],
      ["not a url", ""],
      ["https://github.com/", ""],
      ["", ""],
      [undefined, ""],
    ];

    for (const [input, expected] of cases) {
      it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
        expect(sanitizeRemoteUrl(input)).to.equal(expected);
      });
    }

    it("never returns credentials", () => {
      expect(sanitizeRemoteUrl("https://me:supersecret@github.com/org/repo")).to.not.contain("supersecret");
    });
  });

  describe("getRepositoryRemoteUrl", () => {
    const originalGetExtension = (mock as any).extensions.getExtension;

    afterEach(() => {
      (mock as any).extensions.getExtension = originalGetExtension;
    });

    function setGit(extension: unknown) {
      (mock as any).extensions.getExtension = (id: string) => (id === "vscode.git" ? extension : undefined);
    }

    function repo(remotes: Array<{ name: string; fetchUrl?: string; pushUrl?: string }>) {
      return { state: { remotes } };
    }

    function gitApi(repositories: unknown[], byPath?: unknown) {
      return {
        isActive: true,
        exports: {
          enabled: true,
          getAPI: () => ({
            repositories,
            getRepository: () => byPath ?? null,
          }),
        },
      };
    }

    it("returns empty when the git extension is missing", () => {
      setGit(undefined);
      expect(getRepositoryRemoteUrl("/repo/file.ts")).to.equal("");
    });

    it("returns empty and activates git when it isn't active yet", () => {
      let activated = false;
      setGit({ isActive: false, activate: () => { activated = true; return Promise.resolve(); } });
      expect(getRepositoryRemoteUrl("/repo/file.ts")).to.equal("");
      expect(activated).to.equal(true);
    });

    it("returns empty when git is disabled", () => {
      setGit({ isActive: true, exports: { enabled: false, getAPI: () => { throw new Error("disabled"); } } });
      expect(getRepositoryRemoteUrl("/repo/file.ts")).to.equal("");
    });

    it("returns empty when there is no repository", () => {
      setGit(gitApi([]));
      expect(getRepositoryRemoteUrl("/repo/file.ts")).to.equal("");
    });

    it("prefers the repository that contains the file", () => {
      const first = repo([{ name: "origin", fetchUrl: "https://github.com/org/first.git" }]);
      const owning = repo([{ name: "origin", fetchUrl: "git@github.com:org/owning.git" }]);
      setGit(gitApi([first, owning], owning));
      expect(getRepositoryRemoteUrl("/owning/file.ts")).to.equal("https://github.com/org/owning");
    });

    it("falls back to the first repository", () => {
      setGit(gitApi([repo([{ name: "origin", fetchUrl: "https://github.com/org/first.git" }])]));
      expect(getRepositoryRemoteUrl()).to.equal("https://github.com/org/first");
    });

    it("prefers the origin remote", () => {
      setGit(gitApi([repo([
        { name: "upstream", fetchUrl: "https://github.com/up/repo.git" },
        { name: "origin", fetchUrl: "https://github.com/me/repo.git" },
      ])]));
      expect(getRepositoryRemoteUrl()).to.equal("https://github.com/me/repo");
    });

    it("uses the first remote when there is no origin", () => {
      setGit(gitApi([repo([{ name: "upstream", pushUrl: "https://github.com/up/repo.git" }])]));
      expect(getRepositoryRemoteUrl()).to.equal("https://github.com/up/repo");
    });

    it("strips credentials", () => {
      setGit(gitApi([repo([{ name: "origin", fetchUrl: "https://user:token@github.com/org/repo.git" }])]));
      expect(getRepositoryRemoteUrl()).to.equal("https://github.com/org/repo");
    });

    it("never throws", () => {
      setGit({ get isActive() { throw new Error("boom"); } });
      expect(getRepositoryRemoteUrl()).to.equal("");
    });
  });
});
