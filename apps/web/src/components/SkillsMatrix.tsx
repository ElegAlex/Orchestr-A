"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { skillsService } from "@/services/skills.service";
import { SkillCategory, SkillLevel } from "@/types";
import toast from "react-hot-toast";

interface MatrixData {
  totalUsers: number;
  totalSkills: number;
  matrix: Array<{
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      departmentId?: string;
    };
    skills: Array<{
      skillId: string;
      skillName: string;
      skillCategory: SkillCategory;
      skillRequiredCount: number;
      level: SkillLevel | null;
    }>;
  }>;
}

const LEVEL_ORDER: Record<SkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  EXPERT: 3,
  MASTER: 4,
};

const LEVEL_COLORS: Record<SkillLevel, string> = {
  BEGINNER: "bg-orange-100 text-orange-700 border-orange-200",
  INTERMEDIATE: "bg-yellow-100 text-yellow-700 border-yellow-200",
  EXPERT: "bg-blue-100 text-blue-700 border-blue-200",
  MASTER: "bg-purple-100 text-purple-700 border-purple-200",
};

const LEVEL_COLORS_HOVER: Record<SkillLevel, string> = {
  BEGINNER: "hover:bg-orange-200",
  INTERMEDIATE: "hover:bg-yellow-200",
  EXPERT: "hover:bg-blue-200",
  MASTER: "hover:bg-purple-200",
};

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  TECHNICAL: "bg-blue-50 border-blue-200",
  METHODOLOGY: "bg-purple-50 border-purple-200",
  SOFT_SKILL: "bg-green-50 border-green-200",
  BUSINESS: "bg-orange-50 border-orange-200",
};

type SortOption = "name" | "coverage" | "skill";

interface LevelCellProps {
  level: SkillLevel | null;
  userId: string;
  skillId: string;
  skillName: string;
  isHighlighted: boolean;
  onEdit: (
    userId: string,
    skillId: string,
    newLevel: SkillLevel | null,
  ) => void;
}

function LevelCell({
  level,
  userId,
  skillId,
  skillName,
  isHighlighted,
  onEdit,
}: LevelCellProps) {
  const t = useTranslations("hr.skills");
  const tc = useTranslations("common");
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (newLevel: string) => {
    setIsUpdating(true);
    try {
      if (newLevel === "") {
        // Remove skill
        await skillsService.removeFromUser(userId, skillId);
        onEdit(userId, skillId, null);
        toast.success(t("skillGapCount", { count: 1 }));
      } else {
        // Assign or update skill
        await skillsService.assignToUser(userId, {
          skillId,
          level: newLevel as SkillLevel,
        });
        onEdit(userId, skillId, newLevel as SkillLevel);
        toast.success(tc("messages.updated"));
      }
    } catch (err) {
      toast.error(tc("errors.validationError"));
      console.error(err);
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <select
        autoFocus
        disabled={isUpdating}
        defaultValue={level || ""}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        className="w-16 h-8 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-</option>
        {(["BEGINNER", "INTERMEDIATE", "EXPERT", "MASTER"] as SkillLevel[]).map(
          (lvl) => (
            <option key={lvl} value={lvl}>
              {t(`levels.${lvl}`)}
            </option>
          ),
        )}
      </select>
    );
  }

  if (!level) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className={`w-10 h-8 rounded flex items-center justify-center text-xs transition-all cursor-pointer
          ${isHighlighted ? "bg-gray-100 text-gray-400" : "bg-gray-50 text-gray-300"}
          hover:bg-blue-50 hover:text-blue-400 hover:border hover:border-blue-300`}
        title={t("matrix.add", { name: skillName })}
      >
        +
      </button>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`w-10 h-8 rounded flex items-center justify-center text-xs font-medium transition-all cursor-pointer border
        ${LEVEL_COLORS[level]} ${LEVEL_COLORS_HOVER[level]}
        ${isHighlighted ? "ring-2 ring-blue-300" : ""}`}
      title={t("matrix.clickToModify", { level: t(`levels.${level}`) })}
    >
      {t(`levelShort.${level}`)}
    </button>
  );
}

function SkillGapIndicator({
  coverage,
  current,
  required,
}: {
  coverage: number;
  current: number;
  required: number;
}) {
  const t = useTranslations("hr.skills.matrix");

  const getColor = () => {
    if (coverage >= 100) return "bg-green-500";
    if (coverage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getLabel = () => {
    if (coverage >= 100) return t("completeCoverage", { current, required });
    if (coverage >= 50) return t("partialCoverage", { current, required });
    return t("skillGapCount", { count: required - current });
  };

  return (
    <div className="flex items-center gap-1" title={getLabel()}>
      <div className={`w-2 h-2 rounded-full ${getColor()}`} />
      <span className="text-[10px] text-gray-500">
        {current}/{required}
      </span>
    </div>
  );
}

function UserCoverageBar({ percentage }: { percentage: number }) {
  const getColor = () => {
    if (percentage >= 70) return "bg-green-500";
    if (percentage >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 w-8">{percentage}%</span>
    </div>
  );
}

function MatrixLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 w-40 bg-gray-100 rounded animate-pulse"
          />
        ))}
      </div>
      <div className="h-[400px] w-full bg-gray-100 rounded animate-pulse" />
    </div>
  );
}

export function SkillsMatrix() {
  const t = useTranslations("hr.skills");
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | "all">(
    "all",
  );
  const [minLevelFilter, setMinLevelFilter] = useState<SkillLevel | "all">(
    "all",
  );
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortSkillId, setSortSkillId] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<SkillCategory>
  >(new Set());

  useEffect(() => {
    fetchMatrix();
  }, []);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await skillsService.getMatrix();
      setData(result as unknown as MatrixData);
    } catch (err) {
      setError(t("matrix.loadingError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle cell edit
  const handleCellEdit = useCallback(
    (userId: string, skillId: string, newLevel: SkillLevel | null) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          matrix: prev.matrix.map((row) => {
            if (row.user.id !== userId) return row;
            return {
              ...row,
              skills: row.skills.map((s) =>
                s.skillId === skillId ? { ...s, level: newLevel } : s,
              ),
            };
          }),
        };
      });
    },
    [],
  );

  // Get unique skills from data
  const allSkills = useMemo(() => {
    if (!data || data.matrix.length === 0) return [];
    return data.matrix[0].skills.map((s) => ({
      id: s.skillId,
      name: s.skillName,
      category: s.skillCategory,
      requiredCount: s.skillRequiredCount || 1,
    }));
  }, [data]);

  // Filter skills by category
  const filteredSkills = useMemo(() => {
    if (categoryFilter === "all") return allSkills;
    return allSkills.filter((s) => s.category === categoryFilter);
  }, [allSkills, categoryFilter]);

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const groups: Record<SkillCategory, typeof filteredSkills> = {
      TECHNICAL: [],
      METHODOLOGY: [],
      SOFT_SKILL: [],
      BUSINESS: [],
    };
    filteredSkills.forEach((s) => {
      groups[s.category].push(s);
    });
    return groups;
  }, [filteredSkills]);

  // Calculate skill coverage (% of required resources covered)
  const skillCoverage = useMemo(() => {
    if (!data) return {};
    const coverage: Record<
      string,
      { percentage: number; current: number; required: number }
    > = {};

    allSkills.forEach((skill) => {
      const usersWithSkill = data.matrix.filter((row) =>
        row.skills.find((s) => s.skillId === skill.id && s.level !== null),
      ).length;
      // Couverture basée sur le nombre de ressources requises, plafonnée à 100%
      coverage[skill.id] = {
        percentage: Math.min(
          100,
          Math.round((usersWithSkill / skill.requiredCount) * 100),
        ),
        current: usersWithSkill,
        required: skill.requiredCount,
      };
    });

    return coverage;
  }, [data, allSkills]);

  // Calculate user coverage (% of skills they have)
  const userCoverage = useMemo(() => {
    if (!data) return {};
    const coverage: Record<string, number> = {};

    data.matrix.forEach((row) => {
      const skillsHad = row.skills.filter((s) => s.level !== null).length;
      coverage[row.user.id] = Math.round((skillsHad / allSkills.length) * 100);
    });

    return coverage;
  }, [data, allSkills]);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    if (!data) return [];

    let result = data.matrix;

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (row) =>
          row.user.firstName.toLowerCase().includes(term) ||
          row.user.lastName.toLowerCase().includes(term),
      );
    }

    // Filter by minimum level
    if (minLevelFilter !== "all") {
      const minOrder = LEVEL_ORDER[minLevelFilter];
      result = result.filter((row) =>
        row.skills.some((s) => s.level && LEVEL_ORDER[s.level] >= minOrder),
      );
    }

    // Sort
    if (sortBy === "name") {
      result = [...result].sort((a, b) =>
        a.user.lastName.localeCompare(b.user.lastName),
      );
    } else if (sortBy === "coverage") {
      result = [...result].sort(
        (a, b) =>
          (userCoverage[b.user.id] || 0) - (userCoverage[a.user.id] || 0),
      );
    } else if (sortBy === "skill" && sortSkillId) {
      result = [...result].sort((a, b) => {
        const aSkill = a.skills.find((s) => s.skillId === sortSkillId);
        const bSkill = b.skills.find((s) => s.skillId === sortSkillId);
        const aLevel = aSkill?.level ? LEVEL_ORDER[aSkill.level] : 0;
        const bLevel = bSkill?.level ? LEVEL_ORDER[bSkill.level] : 0;
        return bLevel - aLevel;
      });
    }

    return result;
  }, [data, searchTerm, minLevelFilter, sortBy, sortSkillId, userCoverage]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(allSkills.map((s) => s.category));
    return Array.from(cats).sort();
  }, [allSkills]);

  // Toggle category collapse
  const toggleCategory = (category: SkillCategory) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!data) return;

    const headers = [
      t("matrix.collaborator"),
      ...filteredSkills.map((s) => s.name),
    ];
    const rows = filteredUsers.map((row) => {
      const skillsMap = new Map(row.skills.map((s) => [s.skillId, s.level]));
      return [
        `${row.user.firstName} ${row.user.lastName}`,
        ...filteredSkills.map((s) => skillsMap.get(s.id) || "-"),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matrice-competences-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("matrix.exportSuccess"));
  };

  // Find skill gaps (skills with coverage < 100%)
  const skillGaps = useMemo(() => {
    return allSkills
      .filter((s) => (skillCoverage[s.id]?.percentage || 0) < 100)
      .sort(
        (a, b) =>
          (skillCoverage[a.id]?.percentage || 0) -
          (skillCoverage[b.id]?.percentage || 0),
      );
  }, [allSkills, skillCoverage]);

  if (loading) {
    return <MatrixLoadingSkeleton />;
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">{error}</div>;
  }

  if (!data || data.matrix.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {t("matrix.noData")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">
            {t("matrix.collaborators")}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data.matrix.length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">{t("matrix.skills")}</div>
          <div className="text-2xl font-bold text-gray-900">
            {allSkills.length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">
            {t("matrix.averageCoverage")}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {Math.round(
              Object.values(userCoverage).reduce((a, b) => a + b, 0) /
                Object.values(userCoverage).length,
            ) || 0}
            %
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">{t("matrix.skillGaps")}</div>
          <div className="text-2xl font-bold text-red-600">
            {skillGaps.length}
          </div>
          <div className="text-xs text-gray-400">
            {t("matrix.skillGapsToReinforce")}
          </div>
        </div>
      </div>

      {/* Skill Gaps Alert */}
      {skillGaps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            {t("matrix.skillGapsAlert")}
          </div>
          <div className="flex flex-wrap gap-2">
            {skillGaps.slice(0, 8).map((skill) => {
              const coverage = skillCoverage[skill.id];
              return (
                <span
                  key={skill.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white border border-red-200 text-red-700"
                >
                  {skill.name}
                  <span className="text-red-400">
                    ({coverage?.current || 0}/{coverage?.required || 1})
                  </span>
                </span>
              );
            })}
            {skillGaps.length > 8 && (
              <span className="text-xs text-red-500">
                +{skillGaps.length - 8} {t("matrix.others")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={t("matrix.search")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value as SkillCategory | "all")
          }
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">{t("matrix.allCategories")}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {t(`categories.${cat}`)}
            </option>
          ))}
        </select>

        <select
          value={minLevelFilter}
          onChange={(e) =>
            setMinLevelFilter(e.target.value as SkillLevel | "all")
          }
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">{t("matrix.allLevels")}</option>
          {(
            ["BEGINNER", "INTERMEDIATE", "EXPERT", "MASTER"] as SkillLevel[]
          ).map((lvl) => (
            <option key={lvl} value={lvl}>
              {t("levels.min")} {t(`levels.${lvl}`)}
            </option>
          ))}
        </select>

        <select
          value={sortBy === "skill" ? `skill:${sortSkillId}` : sortBy}
          onChange={(e) => {
            const val = e.target.value;
            if (val.startsWith("skill:")) {
              setSortBy("skill");
              setSortSkillId(val.replace("skill:", ""));
            } else {
              setSortBy(val as SortOption);
              setSortSkillId(null);
            }
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="name">{t("matrix.sortByName")}</option>
          <option value="coverage">{t("matrix.sortByCoverage")}</option>
          <optgroup label={t("matrix.sortBySkill")}>
            {filteredSkills.slice(0, 10).map((skill) => (
              <option key={skill.id} value={`skill:${skill.id}`}>
                {skill.name}
              </option>
            ))}
          </optgroup>
        </select>

        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {t("matrix.exportCSV")}
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-500 mr-2">
          {t("matrix.legend")}:
        </span>
        {(["BEGINNER", "INTERMEDIATE", "EXPERT", "MASTER"] as SkillLevel[]).map(
          (lvl) => (
            <span
              key={lvl}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${LEVEL_COLORS[lvl]}`}
            >
              {t(`levelShort.${lvl}`)} = {t(`levels.${lvl}`)}
            </span>
          ),
        )}
        <span className="text-xs text-gray-400 ml-4">
          {t("matrix.clickToEdit")}
        </span>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[220px] border-r border-gray-200">
                <div className="flex flex-col gap-1">
                  <span>{t("matrix.collaborator")}</span>
                  <span className="text-[10px] font-normal normal-case text-gray-400">
                    {t("matrix.coverage")}
                  </span>
                </div>
              </th>
              {Object.entries(skillsByCategory).map(([category, skills]) => {
                if (skills.length === 0) return null;
                const isCollapsed = collapsedCategories.has(
                  category as SkillCategory,
                );

                return (
                  <th
                    key={category}
                    colSpan={isCollapsed ? 1 : skills.length}
                    className={`px-2 py-2 text-center text-xs font-medium uppercase tracking-wider border-l-2 ${CATEGORY_COLORS[category as SkillCategory]}`}
                  >
                    <button
                      onClick={() => toggleCategory(category as SkillCategory)}
                      className="flex items-center gap-1 mx-auto hover:text-blue-600"
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                      {t(`categories.${category}`)}
                      <span className="text-gray-400">({skills.length})</span>
                    </button>
                  </th>
                );
              })}
            </tr>
            {!Object.values(collapsedCategories).every(Boolean) && (
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-20 bg-gray-50 border-r border-gray-200" />
                {Object.entries(skillsByCategory).map(([category, skills]) => {
                  if (skills.length === 0) return null;
                  const isCollapsed = collapsedCategories.has(
                    category as SkillCategory,
                  );

                  if (isCollapsed) {
                    return (
                      <th
                        key={`${category}-collapsed`}
                        className="px-2 py-1 border-l-2 border-gray-200"
                      >
                        <span className="text-xs text-gray-400">...</span>
                      </th>
                    );
                  }

                  return skills.map((skill) => (
                    <th
                      key={skill.id}
                      className={`px-2 py-2 text-center min-w-[80px] border-l border-gray-100
                        ${hoveredCol === skill.id ? "bg-blue-50" : ""}`}
                      onMouseEnter={() => setHoveredCol(skill.id)}
                      onMouseLeave={() => setHoveredCol(null)}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className="text-xs font-medium text-gray-700 truncate max-w-[70px]"
                          title={skill.name}
                        >
                          {skill.name}
                        </span>
                        <SkillGapIndicator
                          coverage={skillCoverage[skill.id]?.percentage || 0}
                          current={skillCoverage[skill.id]?.current || 0}
                          required={skillCoverage[skill.id]?.required || 1}
                        />
                      </div>
                    </th>
                  ));
                })}
              </tr>
            )}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((row) => {
              const initials =
                `${row.user.firstName[0]}${row.user.lastName[0]}`.toUpperCase();
              const skillsMap = new Map(
                row.skills.map((s) => [s.skillId, s.level]),
              );
              const isRowHighlighted = hoveredRow === row.user.id;

              return (
                <tr
                  key={row.user.id}
                  className={`transition-colors ${isRowHighlighted ? "bg-blue-50" : "hover:bg-gray-50"}`}
                  onMouseEnter={() => setHoveredRow(row.user.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td
                    className={`sticky left-0 z-10 px-4 py-3 whitespace-nowrap border-r border-gray-200
                    ${isRowHighlighted ? "bg-blue-50" : "bg-white"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {row.user.firstName} {row.user.lastName}
                        </p>
                        <UserCoverageBar
                          percentage={userCoverage[row.user.id] || 0}
                        />
                      </div>
                    </div>
                  </td>
                  {Object.entries(skillsByCategory).map(
                    ([category, skills]) => {
                      if (skills.length === 0) return null;
                      const isCollapsed = collapsedCategories.has(
                        category as SkillCategory,
                      );

                      if (isCollapsed) {
                        const count = skills.filter((s) =>
                          skillsMap.get(s.id),
                        ).length;
                        return (
                          <td
                            key={`${category}-collapsed`}
                            className="px-2 py-2 text-center border-l-2 border-gray-200"
                          >
                            <span className="text-xs text-gray-400">
                              {count}/{skills.length}
                            </span>
                          </td>
                        );
                      }

                      return skills.map((skill) => (
                        <td
                          key={skill.id}
                          className={`px-2 py-2 text-center border-l border-gray-100
                          ${hoveredCol === skill.id ? "bg-blue-50" : ""}`}
                        >
                          <div className="flex justify-center">
                            <LevelCell
                              level={skillsMap.get(skill.id) || null}
                              userId={row.user.id}
                              skillId={skill.id}
                              skillName={skill.name}
                              isHighlighted={
                                isRowHighlighted || hoveredCol === skill.id
                              }
                              onEdit={handleCellEdit}
                            />
                          </div>
                        </td>
                      ));
                    },
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <p className="text-sm text-gray-500">
        {t("matrix.statsFooter", {
          users: filteredUsers.length,
          usersPlural: filteredUsers.length > 1 ? "s" : "",
          skills: filteredSkills.length,
          skillsPlural: filteredSkills.length > 1 ? "s" : "",
        })}
      </p>
    </div>
  );
}
