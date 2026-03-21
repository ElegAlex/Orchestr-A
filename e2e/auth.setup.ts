import * as fs from "fs";
import * as path from "path";
import { test as setup } from "@playwright/test";
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

// Sérialiser les logins pour éviter le rate limiter
setup.describe.configure({ mode: "serial" });

for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ request, baseURL }) => {
    setup.setTimeout(300_000);
    const base = baseURL ?? "http://localhost:4001";
    const login = ROLE_LOGINS[role];

    // Petit délai entre les logins
    await new Promise((r) => setTimeout(r, 1500));

    // 1. Login API avec retry sur 429
    let response = await request.post(`${base}/api/auth/login`, {
      data: { login, password: ROLE_PASSWORD },
    });

    // Login endpoint has strict throttle: 5 req/60s, 15 req/15min
    // If 429, wait full minute for reset
    for (let retry = 0; retry < 3 && response.status() === 429; retry++) {
      console.log(`⏳ Rate limited for ${role}, waiting 60s (retry ${retry + 1}/3)...`);
      await new Promise((r) => setTimeout(r, 60_000));
      response = await request.post(`${base}/api/auth/login`, {
        data: { login, password: ROLE_PASSWORD },
      });
    }

    if (!response.ok()) {
      const errorBody = await response.text();
      throw new Error(
        `Login failed for role "${role}" (${login}): HTTP ${response.status()} — ${errorBody}`,
      );
    }

    const body = await response.json();
    const token: string = body.access_token;
    const user = body.user;

    if (!token) throw new Error(`No access_token for role "${role}"`);

    // 2. Construire le storage state manuellement (sans page.goto pour éviter le throttler)
    //    Le frontend stocke le JWT dans localStorage sous "access_token" et "user"
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: base,
          localStorage: [
            { name: "access_token", value: token },
            { name: "user", value: JSON.stringify(user) },
          ],
        },
      ],
    };

    const storagePath = ROLE_STORAGE_PATHS[role as Role];
    fs.writeFileSync(storagePath, JSON.stringify(storageState, null, 2));

    console.log(
      `✅ Auth storage state saved for role: ${role} → ${storagePath}`,
    );
  });
}
