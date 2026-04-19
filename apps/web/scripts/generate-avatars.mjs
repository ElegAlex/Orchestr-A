#!/usr/bin/env node
import { createAvatar } from "@dicebear/core";
import { personas } from "@dicebear/collection";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "avatars");
mkdirSync(OUT_DIR, { recursive: true });

const SEEDS = [
  "Claire", "Thomas", "Sophie", "Julien", "Amélie", "Karim",
  "Élodie", "Nicolas", "Fatou", "Mathieu", "Léa", "Antoine",
  "Chloé", "Mehdi", "Camille", "Lucas", "Inès", "Paul",
  "Nadia", "Hugo", "Sarah", "Martin", "Yasmine", "Olivier",
  "Manon", "Romain", "Aïcha", "Gabriel", "Louise", "Maxime",
  "Leïla", "Simon", "Juliette", "Arthur", "Rania", "Alexis",
  "Emma", "Victor", "Amira", "Raphaël", "Jade", "Benjamin",
  "Zoé", "Nathan", "Salma", "Adam", "Margaux", "Tristan",
];

for (let i = 0; i < SEEDS.length; i++) {
  const svg = createAvatar(personas, {
    seed: SEEDS[i],
    backgroundColor: [
      "b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf",
      "transparent",
    ],
    backgroundType: ["solid"],
  }).toString();
  const name = `persona_${String(i + 1).padStart(2, "0")}.svg`;
  writeFileSync(join(OUT_DIR, name), svg);
  console.log(`Generated ${name} (seed: ${SEEDS[i]})`);
}

console.log(`\nDone. ${SEEDS.length} avatars written to ${OUT_DIR}`);
