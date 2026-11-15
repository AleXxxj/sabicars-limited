import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Next's usePathname() says "/index" for the homepage when Vercel draws the copy it keeps (lib/site-pathname.ts).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/site-pathname.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/navigation",
              importNames: ["usePathname"],
              message: 'Use useSitePathname() from "@/lib/site-pathname": Next says "/index" for the homepage when Vercel draws the copy it keeps.',
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
