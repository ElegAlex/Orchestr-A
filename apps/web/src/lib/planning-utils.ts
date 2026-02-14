import { Priority, TaskStatus, Role, LeaveType } from "@/types";

export const getServiceStyle = (
  serviceName: string,
): { icon: string; color: string } => {
  const name = serviceName.toLowerCase();
  if (
    name.includes("développement") ||
    name.includes("dev") ||
    name.includes("informatique") ||
    name.includes("technique")
  )
    return { icon: "", color: "blue" };
  if (
    name.includes("admin") ||
    name.includes("gestion") ||
    name.includes("finance")
  )
    return { icon: "", color: "emerald" };
  if (name.includes("communication") || name.includes("marketing"))
    return { icon: "", color: "purple" };
  if (name.includes("rh") || name.includes("ressources humaines"))
    return { icon: "", color: "pink" };
  if (name.includes("juridique") || name.includes("legal"))
    return { icon: "", color: "slate" };
  if (name.includes("support") || name.includes("assistance"))
    return { icon: "", color: "cyan" };
  if (name.includes("projet") || name.includes("pmo"))
    return { icon: "", color: "indigo" };
  return { icon: "", color: "gray" };
};

export const getGroupColors = (color: string, isManagement: boolean) => {
  if (isManagement) {
    return {
      header:
        "bg-gradient-to-r from-amber-100 to-amber-50 border-l-4 border-amber-500",
      text: "text-amber-900",
      badge: "bg-amber-500",
      border: "border-l-4 border-amber-300",
      avatar: "bg-amber-600",
    };
  }

  const colorMap: Record<
    string,
    {
      header: string;
      text: string;
      badge: string;
      border: string;
      avatar: string;
    }
  > = {
    blue: {
      header:
        "bg-gradient-to-r from-blue-100 to-blue-50 border-l-4 border-blue-500",
      text: "text-blue-900",
      badge: "bg-blue-500",
      border: "border-l-4 border-blue-300",
      avatar: "bg-blue-600",
    },
    emerald: {
      header:
        "bg-gradient-to-r from-emerald-100 to-emerald-50 border-l-4 border-emerald-500",
      text: "text-emerald-900",
      badge: "bg-emerald-500",
      border: "border-l-4 border-emerald-300",
      avatar: "bg-emerald-600",
    },
    purple: {
      header:
        "bg-gradient-to-r from-purple-100 to-purple-50 border-l-4 border-purple-500",
      text: "text-purple-900",
      badge: "bg-purple-500",
      border: "border-l-4 border-purple-300",
      avatar: "bg-purple-600",
    },
    pink: {
      header:
        "bg-gradient-to-r from-pink-100 to-pink-50 border-l-4 border-pink-500",
      text: "text-pink-900",
      badge: "bg-pink-500",
      border: "border-l-4 border-pink-300",
      avatar: "bg-pink-600",
    },
    slate: {
      header:
        "bg-gradient-to-r from-slate-100 to-slate-50 border-l-4 border-slate-500",
      text: "text-slate-900",
      badge: "bg-slate-500",
      border: "border-l-4 border-slate-300",
      avatar: "bg-slate-600",
    },
    cyan: {
      header:
        "bg-gradient-to-r from-cyan-100 to-cyan-50 border-l-4 border-cyan-500",
      text: "text-cyan-900",
      badge: "bg-cyan-500",
      border: "border-l-4 border-cyan-300",
      avatar: "bg-cyan-600",
    },
    indigo: {
      header:
        "bg-gradient-to-r from-indigo-100 to-indigo-50 border-l-4 border-indigo-500",
      text: "text-indigo-900",
      badge: "bg-indigo-500",
      border: "border-l-4 border-indigo-300",
      avatar: "bg-indigo-600",
    },
    gray: {
      header:
        "bg-gradient-to-r from-gray-100 to-gray-50 border-l-4 border-gray-500",
      text: "text-gray-900",
      badge: "bg-gray-500",
      border: "border-l-4 border-gray-300",
      avatar: "bg-gray-600",
    },
  };

  return colorMap[color] || colorMap.gray;
};

export const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case Priority.CRITICAL:
      return "bg-red-100 text-red-800 border-red-300";
    case Priority.HIGH:
      return "bg-orange-100 text-orange-800 border-orange-300";
    case Priority.NORMAL:
      return "bg-blue-100 text-blue-800 border-blue-300";
    case Priority.LOW:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

export const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case TaskStatus.TODO:
      return "○";
    case TaskStatus.IN_PROGRESS:
      return "◐";
    case TaskStatus.IN_REVIEW:
      return "◕";
    case TaskStatus.DONE:
      return "●";
    case TaskStatus.BLOCKED:
      return "⊗";
  }
};

// Note: getRoleLabel and getLeaveTypeLabel are kept for backward compatibility
// with other pages (leaves, users, profile). Planning components use i18n directly.
export const getRoleLabel = (role: Role): string => {
  switch (role) {
    case Role.ADMIN:
      return "Admin";
    case Role.RESPONSABLE:
      return "Responsable";
    case Role.MANAGER:
      return "Manager";
    case Role.REFERENT_TECHNIQUE:
      return "Réf. Tech.";
    case Role.CONTRIBUTEUR:
      return "Contributeur";
    case Role.OBSERVATEUR:
      return "Observateur";
    default:
      return role;
  }
};

export const getLeaveTypeLabel = (type: LeaveType): string => {
  switch (type) {
    case LeaveType.CP:
      return "Congés payés";
    case LeaveType.RTT:
      return "RTT";
    case LeaveType.SICK_LEAVE:
      return "Maladie";
    case LeaveType.UNPAID:
      return "Sans solde";
    case LeaveType.OTHER:
      return "Autre";
    default:
      return type;
  }
};
