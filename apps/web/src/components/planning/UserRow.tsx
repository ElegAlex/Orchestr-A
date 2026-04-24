import { User, Task } from "@/types";
import { Event } from "@/services/events.service";
import { PredefinedTaskAssignment } from "@/services/predefined-tasks.service";
import { ServiceGroup, DayCell as DayCellData } from "@/hooks/usePlanningData";
import { DayCell } from "./DayCell";
import { getGroupColors } from "@/lib/planning-utils";
import { UserAvatar } from "@/components/UserAvatar";

interface UserRowProps {
  user: User;
  group: ServiceGroup;
  displayDays: Date[];
  viewMode: "week" | "month";
  gridTemplateColumns: string;
  currentUserId: string;
  canManageOthersTelework: boolean;
  canAssignPredefinedTask: boolean;
  lateThresholdDays: number;
  getDayCell: (userId: string, date: Date) => DayCellData;
  onTeleworkToggle: (userId: string, date: Date) => void;
  onDragStart: (task: Task, sourceUserId: string) => void;
  onDragEnd: () => void;
  onDrop: (userId: string, date: Date) => void;
  onTaskClick: (task: Task) => void;
  onEventClick: (event: Event) => void;
  onPredefinedTaskClick: (
    assignment: PredefinedTaskAssignment,
    date: Date,
  ) => void;
  onAddPredefinedTask: (userId: string, date: Date) => void;
}

export const UserRow = ({
  user,
  group,
  displayDays,
  viewMode,
  gridTemplateColumns,
  currentUserId,
  canManageOthersTelework,
  canAssignPredefinedTask,
  lateThresholdDays,
  getDayCell,
  onTeleworkToggle,
  onDragStart,
  onDragEnd,
  onDrop,
  onTaskClick,
  onEventClick,
  onPredefinedTaskClick,
  onAddPredefinedTask,
}: UserRowProps) => {
  const colors = getGroupColors(group.color, group.isManagement);

  return (
    <div
      className={`hover:bg-gray-50 ${colors.border} border-b border-gray-200`}
      style={{ display: "grid", gridTemplateColumns }}
    >
      <div className="sticky left-0 bg-white z-10 px-3 py-3 border-r border-gray-200">
        <div className="flex items-center space-x-2 pl-1 min-w-0">
          <div className="relative shrink-0">
            <UserAvatar
              user={user}
              size="md"
              badge={
                group.isManagement ? (
                  <span className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                    <span className="text-[8px]">⭐</span>
                  </span>
                ) : undefined
              }
            />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-gray-900 truncate">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-[10px] text-gray-500 truncate">
              {user.role?.label ?? "—"}
            </div>
          </div>
        </div>
      </div>
      {displayDays.map((day, dayIndex) => {
        const cell = getDayCell(user.id, day);
        return (
          <DayCell
            key={day.toISOString()}
            cell={cell}
            userId={user.id}
            viewMode={viewMode}
            dayIndex={dayIndex}
            canToggleTelework={
              user.id === currentUserId || canManageOthersTelework
            }
            canAssignPredefinedTask={canAssignPredefinedTask}
            lateThresholdDays={lateThresholdDays}
            onTeleworkToggle={onTeleworkToggle}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDrop={onDrop}
            onTaskClick={onTaskClick}
            onEventClick={onEventClick}
            onPredefinedTaskClick={onPredefinedTaskClick}
            onAddPredefinedTask={onAddPredefinedTask}
          />
        );
      })}
    </div>
  );
};
