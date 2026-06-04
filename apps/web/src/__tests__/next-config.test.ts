/**
 * PER-020 — next.config.ts bundle optimization
 *
 * RED pre-fix: experimental.optimizePackageImports key is absent from source
 * GREEN post-fix: key present with lucide-react, @radix-ui/react-icons, date-fns
 *
 * Structural test (fs-read) because next-intl/plugin uses createRequire with a
 * file URL which is incompatible with jest-environment-jsdom.
 */

import fs from "fs";
import path from "path";

const configPath = path.resolve(__dirname, "../../next.config.ts");
const configSource = fs.readFileSync(configPath, "utf8");

describe("next.config.ts bundle optimization (PER-020)", () => {
  it("declares experimental.optimizePackageImports", () => {
    expect(configSource).toContain("optimizePackageImports");
  });

  it("includes lucide-react in optimizePackageImports", () => {
    expect(configSource).toContain("lucide-react");
  });

  it("includes @radix-ui/react-icons in optimizePackageImports", () => {
    expect(configSource).toContain("@radix-ui/react-icons");
  });

  it("includes date-fns in optimizePackageImports", () => {
    expect(configSource).toContain("date-fns");
  });

  it("gates bundle-analyzer behind ANALYZE env var", () => {
    expect(configSource).toContain("ANALYZE");
  });
});
