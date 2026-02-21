import { ServiceGroup } from "@/hooks/usePlanningData";
import { getGroupColors } from "@/lib/planning-utils";
import { usePlanningViewStore } from "@/stores/planningView.store";
import { useTranslations } from "next-intl";

interface GroupHeaderProps {
  group: ServiceGroup;
  taskCount: number;
  colSpan: number;
}

export const GroupHeader = ({
  group,
  taskCount,
  colSpan,
}: GroupHeaderProps) => {
  const t = useTranslations("planning");
  const colors = getGroupColors(group.color, group.isManagement);
  const { collapsedServices, toggleService } = usePlanningViewStore();
  const isCollapsed = collapsedServices[group.id] ?? false;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleService(group.id);
  };

  // If the service has a custom hex color, use inline styles; otherwise use Tailwind classes
  const hex = group.hexColor;
  const headerStyle = hex
    ? {
        background: `linear-gradient(to right, ${hex}22, ${hex}11)`,
        borderLeft: `4px solid ${hex}`,
      }
    : undefined;
  const headerClass = hex
    ? "px-4 py-3 font-semibold"
    : `px-4 py-3 font-semibold ${colors.header}`;
  const textClass = hex ? "text-gray-900" : colors.text;
  const badgeStyle = hex ? { backgroundColor: hex } : undefined;
  const badgeClass = hex
    ? "text-white text-xs font-bold px-2 py-1 rounded-full"
    : `${colors.badge} text-white text-xs font-bold px-2 py-1 rounded-full`;

  return (
    <tr className="sticky top-[48px] z-20">
      <td
        colSpan={colSpan}
        className={headerClass}
        style={headerStyle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Bouton collapse/expand */}
            <button
              onClick={handleToggle}
              className={`mr-2 p-1 rounded hover:bg-black/10 transition-transform duration-200 ${
                isCollapsed ? "" : "rotate-90"
              }`}
              aria-label={
                isCollapsed ? t("actions.expand") : t("actions.collapse")
              }
              title={
                isCollapsed
                  ? t("actions.expandService")
                  : t("actions.collapseService")
              }
            >
              <svg
                className={`w-4 h-4 ${textClass}`}
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
            </button>

            {group.icon && <span className="text-2xl mr-3">{group.icon}</span>}
            <div>
              <span className={`text-base font-bold ${textClass}`}>
                {group.name}
              </span>
              <span
                className={`ml-3 text-xs font-normal ${textClass} opacity-75`}
              >
                {group.users.length}{" "}
                {group.users.length > 1 ? t("group.people") : t("group.person")}
              </span>
              {isCollapsed && (
                <span className={`ml-2 text-xs ${textClass} opacity-60`}>
                  {t("group.collapsed")}
                </span>
              )}
            </div>
          </div>
          {taskCount > 0 && (
            <div className={badgeClass} style={badgeStyle}>
              {taskCount} {taskCount > 1 ? t("group.tasks") : t("group.task")}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};
