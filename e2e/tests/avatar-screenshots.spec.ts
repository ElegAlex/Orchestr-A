import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT = '.claude-screenshots/avatar-unification';
fs.mkdirSync(OUT, { recursive: true });

const ZONES: { name: string; url: string }[] = [
  { name: 'planning', url: '/fr/planning' },
  { name: 'users', url: '/fr/users' },
  { name: 'dashboard', url: '/fr/dashboard' },
  { name: 'projects', url: '/fr/projects' },
  { name: 'tasks', url: '/fr/tasks' },
  { name: 'events', url: '/fr/events' },
  { name: 'skills', url: '/fr/skills' },
  { name: 'milestones', url: '/fr/milestones' },
];

for (const zone of ZONES) {
  test(`@avatar-screenshot ${zone.name}`, async ({ page }) => {
    await page.goto(zone.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // let avatars render
    await page.screenshot({
      path: path.join(OUT, `${zone.name}-after.png`),
      fullPage: true,
    });
  });
}
