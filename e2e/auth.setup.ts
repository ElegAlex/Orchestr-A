import * as fs from "fs";
import * as path from "path";
import { test as setup, expect } from "@playwright/test";
import {
  ROLES,
  ROLE_LOGINS,
  ROLE_PASSWORD,
  ROLE_STORAGE_PATHS,
  type Role,
} from "./fixtures/roles";

// S'assurer que le répertoire playwright/.auth/ existe
const authDir = path.join("playwright", ".auth");
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page, baseURL }) => {
    const base = baseURL ?? "http://localhost:4001";
    const login = ROLE_LOGINS[role];

    // 1. Appel API direct : POST /api/auth/login
    const response = await page.request.post(`${base}/api/auth/login`, {
      data: { login, password: ROLE_PASSWORD },
      headers: { "Content-Type": "application/json" },
    });

    expect(response.ok(), `Login failed for role "${role}" (${login})`).toBeTruthy();

    const body = await response.json();
    const token: string = body.access_token;
    const user = body.user;

    expect(token, `No access_token for role "${role}"`).toBeTruthy();

    // 2. Naviguer vers la baseURL pour pouvoir écrire dans localStorage
    await page.goto(base, { waitUntil: "domcontentloaded" });

    // 3. Injecter le token dans localStorage (clés utilisées par le frontend)
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem("access_token", token);
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
        }
      },
      { token, user },
    );

    // 4. Sauvegarder le storage state
    const storagePath = ROLE_STORAGE_PATHS[role as Role];
    await page.context().storageState({ path: storagePath });

    console.log(`✅ Auth storage state saved for role: ${role} → ${storagePath}`);
  });
}
