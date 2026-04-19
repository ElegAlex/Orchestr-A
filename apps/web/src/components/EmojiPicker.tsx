"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Smile, Search } from "lucide-react";
import { useTranslations } from "next-intl";

type EmojiEntry = { char: string; keywords: string };

type Category = {
  key: string;
  emojis: EmojiEntry[];
};

const CATEGORIES: Category[] = [
  {
    key: "management",
    emojis: [
      { char: "📋", keywords: "clipboard presse-papier tâches liste gestion" },
      { char: "📊", keywords: "graphique barres stats kpi pilotage" },
      { char: "📈", keywords: "courbe hausse croissance progression" },
      { char: "🎯", keywords: "cible objectif but target" },
      { char: "🗂️", keywords: "dossiers classeur archive" },
      { char: "📌", keywords: "punaise épingle" },
      { char: "📍", keywords: "localisation lieu pin" },
      { char: "🗓️", keywords: "calendrier planning agenda" },
      { char: "📅", keywords: "calendrier date échéance" },
      { char: "🏁", keywords: "drapeau arrivée livraison fin" },
      { char: "📝", keywords: "note mémo rédaction" },
      { char: "🧭", keywords: "boussole stratégie orientation" },
    ],
  },
  {
    key: "digital",
    emojis: [
      { char: "💻", keywords: "ordinateur portable laptop informatique dsi" },
      { char: "🖥️", keywords: "ordinateur poste bureau it" },
      { char: "📱", keywords: "mobile smartphone application app" },
      { char: "🌐", keywords: "web internet site portail" },
      { char: "🛰️", keywords: "satellite réseau télécom" },
      { char: "📡", keywords: "antenne télécom infrastructure" },
      { char: "☁️", keywords: "cloud nuage saas hébergement" },
      { char: "🗄️", keywords: "archive base de données dossiers" },
      { char: "🔌", keywords: "connexion intégration api prise" },
      { char: "💾", keywords: "sauvegarde disquette data" },
      { char: "⚙️", keywords: "paramètres configuration engrenage" },
      { char: "🧩", keywords: "module extension plugin" },
    ],
  },
  {
    key: "finance",
    emojis: [
      { char: "💰", keywords: "argent budget finances" },
      { char: "💶", keywords: "euro billet monnaie" },
      { char: "💳", keywords: "carte paiement achat" },
      { char: "🏦", keywords: "banque trésorerie" },
      { char: "📉", keywords: "baisse courbe réduction économie" },
      { char: "🧾", keywords: "facture reçu comptabilité" },
      { char: "🪙", keywords: "pièce monnaie recette" },
      { char: "💹", keywords: "finance marché graphique" },
    ],
  },
  {
    key: "hr",
    emojis: [
      { char: "👥", keywords: "équipe personnes groupe rh" },
      { char: "🧑‍💼", keywords: "agent cadre manager bureau" },
      { char: "👔", keywords: "cravate cadre direction" },
      { char: "📇", keywords: "annuaire répertoire contacts" },
      { char: "🗣️", keywords: "communication concertation dialogue" },
      { char: "🤝", keywords: "partenariat collaboration accord" },
      { char: "🎓", keywords: "formation diplôme compétence" },
      { char: "🏅", keywords: "reconnaissance récompense mérite" },
    ],
  },
  {
    key: "territory",
    emojis: [
      { char: "🏛️", keywords: "mairie collectivité institution administration" },
      { char: "🏢", keywords: "bâtiment immeuble bureau administratif" },
      { char: "🏗️", keywords: "chantier construction travaux" },
      { char: "🏘️", keywords: "habitat logement quartier" },
      { char: "🏫", keywords: "école établissement scolaire" },
      { char: "🏥", keywords: "hôpital santé urgences" },
      { char: "🗺️", keywords: "territoire carte plan zonage" },
      { char: "🛣️", keywords: "voirie route infrastructure" },
      { char: "🚧", keywords: "travaux chantier signalisation" },
      { char: "🌉", keywords: "pont infrastructure ouvrage" },
      { char: "⛲", keywords: "espace public place fontaine" },
    ],
  },
  {
    key: "social",
    emojis: [
      { char: "🩺", keywords: "santé ccas médical" },
      { char: "💊", keywords: "santé pharmacie médicament" },
      { char: "❤️‍🩹", keywords: "solidarité aide soutien" },
      { char: "🧑‍⚕️", keywords: "soignant santé médecin" },
      { char: "🤲", keywords: "entraide solidarité don" },
      { char: "🧑‍🦽", keywords: "handicap accessibilité pmr" },
      { char: "👶", keywords: "petite enfance crèche" },
      { char: "👴", keywords: "séniors âgé ehpad" },
      { char: "🏠", keywords: "logement habitat domicile" },
    ],
  },
  {
    key: "culture",
    emojis: [
      { char: "🎭", keywords: "culture théâtre spectacle" },
      { char: "🎨", keywords: "art culture création" },
      { char: "🎼", keywords: "musique conservatoire" },
      { char: "📚", keywords: "bibliothèque médiathèque livres" },
      { char: "📖", keywords: "lecture livre ouvrage" },
      { char: "🎬", keywords: "cinéma audiovisuel" },
      { char: "🎪", keywords: "événement festival animation" },
      { char: "🏟️", keywords: "stade sport équipement" },
      { char: "⚽", keywords: "sport football équipement sportif" },
    ],
  },
  {
    key: "security",
    emojis: [
      { char: "🚨", keywords: "alerte urgence crise" },
      { char: "🚒", keywords: "pompiers secours incendie" },
      { char: "🚓", keywords: "police municipale sécurité" },
      { char: "🚑", keywords: "ambulance samu secours" },
      { char: "🧯", keywords: "extincteur prévention incendie" },
      { char: "⚠️", keywords: "risque attention alerte" },
      { char: "⛑️", keywords: "sécurité protection civile" },
      { char: "🛡️", keywords: "cybersécurité protection bouclier" },
      { char: "🔐", keywords: "sécurité accès confidentialité" },
    ],
  },
  {
    key: "environment",
    emojis: [
      { char: "🌱", keywords: "écologie développement durable plante" },
      { char: "🌳", keywords: "arbre espaces verts parc" },
      { char: "♻️", keywords: "recyclage déchets tri économie circulaire" },
      { char: "🌍", keywords: "environnement planète climat" },
      { char: "💧", keywords: "eau assainissement hydraulique" },
      { char: "🌞", keywords: "énergie solaire renouvelable" },
      { char: "⚡", keywords: "énergie électricité réseau" },
      { char: "🔋", keywords: "énergie batterie stockage" },
      { char: "🌊", keywords: "littoral eau inondation" },
    ],
  },
  {
    key: "legal",
    emojis: [
      { char: "⚖️", keywords: "justice droit conformité rgpd" },
      { char: "📜", keywords: "arrêté délibération texte" },
      { char: "🖋️", keywords: "signature acte officiel" },
      { char: "📰", keywords: "communication presse publication" },
      { char: "🕊️", keywords: "paix citoyenneté valeurs" },
    ],
  },
];

interface EmojiPickerProps {
  value?: string | null;
  onChange: (emoji: string | null) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const t = useTranslations("projects");
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(
    CATEGORIES[0].key,
  );
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setActiveCategory(CATEGORIES[0].key);
    }
  }, [isOpen]);

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query) {
      const seen = new Set<string>();
      const matches: EmojiEntry[] = [];
      for (const cat of CATEGORIES) {
        for (const e of cat.emojis) {
          if (seen.has(e.char)) continue;
          if (e.keywords.toLowerCase().includes(query)) {
            matches.push(e);
            seen.add(e.char);
          }
        }
      }
      return matches;
    }
    return (
      CATEGORIES.find((c) => c.key === activeCategory)?.emojis ?? []
    );
  }, [search, activeCategory]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 transition-colors"
      >
        {value ? (
          <span className="text-lg leading-none">{value}</span>
        ) : (
          <>
            <Smile size={16} className="text-gray-400" />
            <span className="text-gray-500">
              {t("projectEditModal.chooseIcon")}
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          {/* Search */}
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("projectEditModal.searchIcon")}
              className="w-full rounded-md border border-gray-200 pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Category tabs */}
          {!search && (
            <div className="mb-2 flex flex-wrap gap-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat.key
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {t(`projectEditModal.iconCategories.${cat.key}`)}
                </button>
              ))}
            </div>
          )}

          {/* Emoji grid */}
          <div className="max-h-56 overflow-y-auto">
            {displayed.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">
                {t("projectEditModal.noIconFound")}
              </p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {displayed.map((e) => (
                  <button
                    key={e.char}
                    type="button"
                    onClick={() => {
                      onChange(e.char);
                      setIsOpen(false);
                    }}
                    title={e.keywords.split(" ").slice(0, 2).join(" ")}
                    className={`flex h-9 w-9 items-center justify-center rounded-md text-lg hover:bg-gray-100 transition-colors ${
                      value === e.char ? "bg-blue-50 ring-1 ring-blue-400" : ""
                    }`}
                  >
                    {e.char}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {t("projectEditModal.noIcon")}
          </button>
        </div>
      )}
    </div>
  );
}
