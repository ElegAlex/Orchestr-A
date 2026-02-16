import { User, Task, Role } from "@/types";
import { Event } from "@/services/events.service";
import { ServiceGroup, DayCell as DayCellData } from "@/hooks/usePlanningData";
import { DayCell } from "./DayCell";
import { getGroupColors } from "@/lib/planning-utils";
import { useTranslations } from "next-intl";

interface UserRowProps {
  user: User;
  group: ServiceGroup;
  displayDays: Date[];
  viewMode: "week" | "month";
  getDayCell: (userId: string, date: Date) => DayCellData;
  onTeleworkToggle: (userId: string, date: Date) => void;
  onDragStart: (task: Task, sourceUserId: string) => void;
  onDragEnd: () => void;
  onDrop: (userId: string, date: Date) => void;
  onTaskClick: (task: Task) => void;
  onEventClick: (event: Event) => void;
}

export const UserRow = ({
  user,
  group,
  displayDays,
  viewMode,
  getDayCell,
  onTeleworkToggle,
  onDragStart,
  onDragEnd,
  onDrop,
  onTaskClick,
  onEventClick,
}: UserRowProps) => {
  const tCommon = useTranslations("common");
  const tPlanning = useTranslations("planning");
  const colors = getGroupColors(group.color, group.isManagement);

  return (
    <tr className={`hover:bg-gray-50 ${colors.border}`}>
      <td className="sticky left-0 bg-white z-10 px-4 py-4 border-r border-gray-200">
        <div className="flex items-center space-x-3 pl-2">
          <div className="relative">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${colors.avatar} text-white`}
            >
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            {group.isManagement && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                <span className="text-[8px]">⭐</span>
              </div>
            )}
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-xs text-gray-500">
              {user.role === Role.REFERENT_TECHNIQUE
                ? tPlanning("roles.REFERENT_TECHNIQUE_SHORT")
                : tCommon(`roles.${user.role}`)}
            </div>
          </div>
        </div>
      </td>
      {displayDays.map((day, dayIndex) => {
        const cell = getDayCell(user.id, day);
        return (
          <DayCell
            key={day.toISOString()}
            cell={cell}
            userId={user.id}
            viewMode={viewMode}
            dayIndex={dayIndex}
            onTeleworkToggle={onTeleworkToggle}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onTaskClick={onTaskClick}
            onEventClick={onEventClick}
          />
        );
      })}
    </tr>
  );
};
