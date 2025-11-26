import { ServiceGroup } from '@/hooks/usePlanningData';
import { getGroupColors } from '@/lib/planning-utils';

interface GroupHeaderProps {
  group: ServiceGroup;
  taskCount: number;
  colSpan: number;
}

export const GroupHeader = ({ group, taskCount, colSpan }: GroupHeaderProps) => {
  const colors = getGroupColors(group.color, group.isManagement);

  return (
    <tr className="sticky top-[48px] z-20">
      <td colSpan={colSpan} className={`px-4 py-3 font-semibold ${colors.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {group.icon && <span className="text-2xl mr-3">{group.icon}</span>}
            <div>
              <span className={`text-base font-bold ${colors.text}`}>{group.name}</span>
              <span className={`ml-3 text-xs font-normal ${colors.text} opacity-75`}>
                {group.users.length} {group.users.length > 1 ? 'personnes' : 'personne'}
              </span>
            </div>
          </div>
          {taskCount > 0 && (
            <div className={`${colors.badge} text-white text-xs font-bold px-2 py-1 rounded-full`}>
              {taskCount} tâche{taskCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};
