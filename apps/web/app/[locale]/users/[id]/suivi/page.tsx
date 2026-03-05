"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { MainLayout } from "@/components/MainLayout";
import { usersService } from "@/services/users.service";
import { tasksService } from "@/services/tasks.service";
import { leavesService } from "@/services/leaves.service";
import { teleworkService } from "@/services/telework.service";
import { timeTrackingService } from "@/services/time-tracking.service";
import { skillsService } from "@/services/skills.service";
import { projectsService } from "@/services/projects.service";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/stores/auth.store";
import {
  User,
  Role,
  Task,
  Leave,
  TeleworkSchedule,
  UserSkill,
  TaskStatus,
  Project,
} from "@/types";
import toast from "react-hot-toast";

type TabType = "overview" | "tasks" | "leaves" | "telework" | "time" | "skills";
type TaskFilter = "all" | "active" | "completed" | "blocked";
type PeriodFilter = "week" | "month" | "quarter" | "year" | "all";

interface LeaveBalance {
  paid: number;
  unpaid: number;
  sick: number;
  remaining: number;
  used: number;
}

interface TimeStats {
  totalHours: number;
  entriesCount: number;
  byProject?: Record<string, number>;
  byTask?: Record<string, number>;
}

export default function SuiviPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("suivi");
  const tCommon = useTranslations("common");
  const { hasPermission } = usePermissions();
  const currentUser = useAuthStore((state) => state.user);
  const userId = params.id as string;

  // Data states
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [teleworkDays, setTeleworkDays] = useState<TeleworkSchedule[]>([]);
  const [timeStats, setTimeStats] = useState<TimeStats | null>(null);
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("year");
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Access control:
  // - ADMIN: all users
  // - RESPONSABLE/MANAGER: users in their managed services only
  // - Other: only themselves
  const checkAccess = (targetUser: User): boolean => {
    if (!currentUser) return false;
    // Self access always allowed
    if (currentUser.id === userId) return true;
    // Admin sees everyone
    if (currentUser.role === Role.ADMIN) return true;
    // Responsable/Manager: check managed services overlap
    if (
      currentUser.role === Role.RESPONSABLE ||
      currentUser.role === Role.MANAGER
    ) {
      const managedServiceIds = (currentUser.managedServices || []).map(
        (ms) => ms.id,
      );
      // Also check same department for Responsable
      if (
        currentUser.role === Role.RESPONSABLE &&
        currentUser.departmentId &&
        targetUser.departmentId === currentUser.departmentId
      ) {
        return true;
      }
      // Check if target user belongs to one of the managed services
      const targetServiceIds = (targetUser.userServices || []).map(
        (us) => us.service?.id,
      );
      return targetServiceIds.some(
        (id) => id && managedServiceIds.includes(id),
      );
    }
    return false;
  };

  // Period date calculation
  const periodDates = useMemo(() => {
    const now = new Date();
    const end = now.toISOString().split("T")[0];
    let start: string;
    switch (period) {
      case "week": {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        start = d.toISOString().split("T")[0];
        break;
      }
      case "month": {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        start = d.toISOString().split("T")[0];
        break;
      }
      case "quarter": {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 3);
        start = d.toISOString().split("T")[0];
        break;
      }
      case "year": {
        start = `${now.getFullYear()}-01-01`;
        break;
      }
      case "all":
        start = "2020-01-01";
        break;
    }
    return { start, end };
  }, [period]);

  // Fetch user data
  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      setAccessDenied(false);

      // Fetch target user first
      let userData: User;
      try {
        userData = await usersService.getById(userId);
        setUser(userData);
      } catch {
        toast.error(t("messages.userNotFound"));
        router.push(`/${locale}/users`);
        return;
      }

      // Check access
      if (!checkAccess(userData)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      // Fetch accessible users for the dropdown (scoped to access)
      try {
        const usersData = await usersService.getAll();
        const usersList: User[] = Array.isArray(usersData)
          ? usersData
          : (usersData as { data: User[] }).data || [];
        // Filter to only users the current user can access
        setAllUsers(
          usersList.filter((u: User) => u.isActive && checkAccess(u)),
        );
      } catch {
        // Non-blocking: dropdown just won't work
      }

      // Fetch all related data in parallel
      const { start, end } = periodDates;
      try {
        const results = await Promise.allSettled([
          tasksService.getByAssignee(userId),
          leavesService.getAll(1, 100, userId),
          leavesService.getBalance(userId),
          teleworkService.getByDateRange(start, end, userId),
          timeTrackingService.getStats(userId, start, end),
          skillsService.getUserSkills(userId),
          projectsService.getByUser(userId),
        ]);

        const [
          tasksData,
          leavesData,
          balanceData,
          teleworkData,
          timeData,
          skillsData,
          projectsData,
        ] = results;

        if (tasksData.status === "fulfilled") {
          const val = tasksData.value;
          setTasks(Array.isArray(val) ? val : []);
        }
        if (leavesData.status === "fulfilled") {
          const val = leavesData.value;
          setLeaves(
            Array.isArray(val) ? val : (val as { data: Leave[] })?.data || [],
          );
        }
        if (balanceData.status === "fulfilled") {
          setLeaveBalance(balanceData.value as LeaveBalance);
        }
        if (teleworkData.status === "fulfilled") {
          const val = teleworkData.value;
          setTeleworkDays(Array.isArray(val) ? val : []);
        }
        if (timeData.status === "fulfilled") {
          setTimeStats(timeData.value as TimeStats);
        }
        if (skillsData.status === "fulfilled") {
          const val = skillsData.value;
          setSkills(
            Array.isArray(val)
              ? val
              : (val as { skills?: UserSkill[] })?.skills || [],
          );
        }
        if (projectsData.status === "fulfilled") {
          const val = projectsData.value;
          setProjects(Array.isArray(val) ? val : []);
        }
      } catch {
        toast.error(t("messages.loadError"));
      }

      setLoading(false);
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, currentUser?.id, periodDates, router, locale]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    switch (taskFilter) {
      case "active":
        return tasks.filter((task) =>
          [
            TaskStatus.TODO,
            TaskStatus.STARTED,
            TaskStatus.IN_PROGRESS,
            TaskStatus.IN_REVIEW,
          ].includes(task.status),
        );
      case "completed":
        return tasks.filter((task) => task.status === TaskStatus.DONE);
      case "blocked":
        return tasks.filter((task) => task.status === TaskStatus.BLOCKED);
      default:
        return tasks;
    }
  }, [tasks, taskFilter]);

  // Filtered users for dropdown
  const filteredUsers = useMemo(() => {
    if (!userSearch) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    );
  }, [allUsers, userSearch]);

  // Stats for overview
  const overviewStats = useMemo(() => {
    const activeTasks = tasks.filter((task) =>
      [
        TaskStatus.TODO,
        TaskStatus.STARTED,
        TaskStatus.IN_PROGRESS,
        TaskStatus.IN_REVIEW,
      ].includes(task.status),
    ).length;
    const completedTasks = tasks.filter(
      (task) => task.status === TaskStatus.DONE,
    ).length;
    const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
    const twDays = teleworkDays.filter((td) => td.isTelework).length;
    const totalHours = timeStats?.totalHours || 0;

    return {
      activeTasks,
      completedTasks,
      activeProjects,
      twDays,
      totalHours,
      leaveBalance: leaveBalance?.remaining ?? 0,
    };
  }, [tasks, projects, teleworkDays, timeStats, leaveBalance]);

  if (accessDenied) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-700">
              {t("accessRestricted.title")}
            </h2>
            <p className="text-gray-500 mt-2">
              {t("accessRestricted.message")}
            </p>
            <button
              onClick={() => router.push(`/${locale}/users`)}
              className="mt-4 text-purple-600 hover:text-purple-800 text-sm"
            >
              &larr; {t("backToUsers")}
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const navigateToUser = (targetUserId: string) => {
    setShowUserDropdown(false);
    setUserSearch("");
    router.push(`/${locale}/users/${targetUserId}/suivi`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === "fr" ? "fr-FR" : "en-US",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      TODO: "bg-gray-100 text-gray-800",
      STARTED: "bg-blue-100 text-blue-800",
      IN_PROGRESS: "bg-yellow-100 text-yellow-800",
      IN_REVIEW: "bg-purple-100 text-purple-800",
      DONE: "bg-green-100 text-green-800",
      BLOCKED: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
      CANCELLED: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: "bg-blue-100 text-blue-700",
      NORMAL: "bg-gray-100 text-gray-700",
      HIGH: "bg-orange-100 text-orange-700",
      CRITICAL: "bg-red-100 text-red-700",
    };
    return colors[priority] || "bg-gray-100 text-gray-700";
  };

  const getSkillLevelWidth = (level: string) => {
    const widths: Record<string, string> = {
      BEGINNER: "25%",
      INTERMEDIATE: "50%",
      EXPERT: "75%",
      MASTER: "100%",
    };
    return widths[level] || "0%";
  };

  const getSkillLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      BEGINNER: "bg-blue-400",
      INTERMEDIATE: "bg-green-400",
      EXPERT: "bg-purple-500",
      MASTER: "bg-yellow-500",
    };
    return colors[level] || "bg-gray-400";
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: "overview", label: t("tabs.overview") },
    { key: "tasks", label: `${t("tabs.tasks")} (${tasks.length})` },
    { key: "leaves", label: t("tabs.leaves") },
    { key: "telework", label: t("tabs.telework") },
    { key: "time", label: t("tabs.time") },
    { key: "skills", label: `${t("tabs.skills")} (${skills.length})` },
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header with user selector */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/${locale}/users`)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-flex items-center"
          >
            &larr; {t("backToUsers")}
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              {user && (
                <>
                  <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center text-lg font-semibold">
                    {user.firstName?.[0]}
                    {user.lastName?.[0]}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {user.firstName} {user.lastName}
                    </h1>
                    <p className="text-sm text-gray-500">
                      {tCommon(`roles.${user.role}`, {
                        defaultValue: user.role,
                      })}
                      {user.department && ` — ${user.department.name}`}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* User selector dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
              >
                {t("selectEmployee")} &#9662;
              </button>
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
                  <div className="p-3 border-b">
                    <input
                      type="text"
                      placeholder={t("searchPlaceholder")}
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-72">
                    {filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => navigateToUser(u.id)}
                        className={`w-full text-left px-4 py-3 hover:bg-purple-50 flex items-center space-x-3 ${
                          u.id === userId ? "bg-purple-50 font-medium" : ""
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {u.firstName?.[0]}
                          {u.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {u.firstName} {u.lastName}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {tCommon(`roles.${u.role}`, {
                              defaultValue: u.role,
                            })}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-500">
                        {tCommon("common.noUserFound")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Period selector */}
          <div className="mt-4 flex items-center space-x-2">
            <span className="text-sm text-gray-500">{t("period")} :</span>
            {(
              ["week", "month", "quarter", "year", "all"] as PeriodFilter[]
            ).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-full ${
                  period === p
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t(`periodOptions.${p}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
            <span className="ml-3 text-gray-500">{t("loading")}</span>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    {
                      label: t("overview.activeTasks"),
                      value: overviewStats.activeTasks,
                      color: "text-blue-600",
                      bg: "bg-blue-50",
                    },
                    {
                      label: t("overview.completedTasks"),
                      value: overviewStats.completedTasks,
                      color: "text-green-600",
                      bg: "bg-green-50",
                    },
                    {
                      label: t("overview.activeProjects"),
                      value: overviewStats.activeProjects,
                      color: "text-purple-600",
                      bg: "bg-purple-50",
                    },
                    {
                      label: t("overview.leaveBalance"),
                      value: `${overviewStats.leaveBalance}j`,
                      color: "text-orange-600",
                      bg: "bg-orange-50",
                    },
                    {
                      label: t("overview.teleworkDays"),
                      value: overviewStats.twDays,
                      color: "text-teal-600",
                      bg: "bg-teal-50",
                    },
                    {
                      label: t("overview.hoursLogged"),
                      value: `${overviewStats.totalHours}h`,
                      color: "text-indigo-600",
                      bg: "bg-indigo-50",
                    },
                  ].map((stat, i) => (
                    <div
                      key={i}
                      className={`${stat.bg} rounded-lg p-4 text-center`}
                    >
                      <p className={`text-2xl font-bold ${stat.color}`}>
                        {stat.value}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* User info + Recent tasks */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Info card */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {t("overview.info")}
                    </h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">
                          {t("overview.role")}
                        </dt>
                        <dd className="text-sm font-medium">
                          {tCommon(`roles.${user?.role}`, {
                            defaultValue: user?.role || "",
                          })}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">
                          {t("overview.email")}
                        </dt>
                        <dd className="text-sm font-medium">{user?.email}</dd>
                      </div>
                      {user?.department && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">
                            {t("overview.department")}
                          </dt>
                          <dd className="text-sm font-medium">
                            {user.department.name}
                          </dd>
                        </div>
                      )}
                      {user?.userServices && user.userServices.length > 0 && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">
                            {t("overview.services")}
                          </dt>
                          <dd className="text-sm font-medium">
                            {user.userServices
                              .map((us) => us.service?.name)
                              .join(", ")}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">
                          {t("overview.memberSince")}
                        </dt>
                        <dd className="text-sm font-medium">
                          {user?.createdAt && formatDate(user.createdAt)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">
                          {t("overview.status")}
                        </dt>
                        <dd>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                              user?.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {user?.isActive
                              ? t("overview.active")
                              : t("overview.inactive")}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* Recent activity */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {t("overview.recentActivity")}
                    </h3>
                    {tasks.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t("overview.noRecentActivity")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {tasks
                          .sort(
                            (a, b) =>
                              new Date(b.updatedAt).getTime() -
                              new Date(a.updatedAt).getTime(),
                          )
                          .slice(0, 8)
                          .map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {task.title}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {task.project?.name || t("tasks.noProject")}
                                </p>
                              </div>
                              <span
                                className={`ml-2 inline-flex px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${getStatusColor(
                                  task.status,
                                )}`}
                              >
                                {tCommon(`taskStatus.${task.status}`, {
                                  defaultValue: task.status,
                                })}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === "tasks" && (
              <div>
                <div className="flex items-center space-x-2 mb-4">
                  {(
                    ["all", "active", "completed", "blocked"] as TaskFilter[]
                  ).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTaskFilter(f)}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        taskFilter === f
                          ? "bg-purple-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {t(`tasks.filters.${f}`)}
                    </button>
                  ))}
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t("tasks.noTasks")}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {tCommon("form.title")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("tasks.project")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("tasks.status")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("tasks.priority")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("tasks.progress")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("tasks.dueDate")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredTasks.map((task) => (
                          <tr
                            key={task.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              router.push(
                                task.projectId
                                  ? `/${locale}/projects/${task.projectId}`
                                  : `/${locale}/tasks`,
                              )
                            }
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {task.title}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {task.project?.name || (
                                <span className="italic">
                                  {t("tasks.noProject")}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(
                                  task.status,
                                )}`}
                              >
                                {tCommon(`taskStatus.${task.status}`, {
                                  defaultValue: task.status,
                                })}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getPriorityColor(
                                  task.priority,
                                )}`}
                              >
                                {tCommon(`priority.${task.priority}`, {
                                  defaultValue: task.priority,
                                })}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-purple-600 h-2 rounded-full"
                                    style={{
                                      width: `${task.progress || 0}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">
                                  {task.progress || 0}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {task.endDate ? formatDate(task.endDate) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Leaves Tab */}
            {activeTab === "leaves" && (
              <div className="space-y-6">
                {/* Leave balance */}
                {leaveBalance && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: t("leaves.types.CP"),
                        value: `${leaveBalance.paid}j`,
                        bg: "bg-blue-50",
                        color: "text-blue-600",
                      },
                      {
                        label: t("leaves.used"),
                        value: `${leaveBalance.used}j`,
                        bg: "bg-orange-50",
                        color: "text-orange-600",
                      },
                      {
                        label: t("leaves.available"),
                        value: `${leaveBalance.remaining}j`,
                        bg: "bg-green-50",
                        color: "text-green-600",
                      },
                      {
                        label: t("leaves.types.SICK_LEAVE"),
                        value: `${leaveBalance.sick}j`,
                        bg: "bg-yellow-50",
                        color: "text-yellow-600",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`${item.bg} rounded-lg p-4 text-center`}
                      >
                        <p className={`text-2xl font-bold ${item.color}`}>
                          {item.value}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Leave history */}
                {leaves.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t("leaves.noLeaves")}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("leaves.type")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("leaves.dates")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("leaves.days")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("leaves.status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {leaves
                          .sort(
                            (a, b) =>
                              new Date(b.startDate).getTime() -
                              new Date(a.startDate).getTime(),
                          )
                          .map((leave) => (
                            <tr key={leave.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                {t(`leaves.types.${leave.type}`, {
                                  defaultValue: leave.type,
                                })}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {formatDate(leave.startDate)} &rarr;{" "}
                                {formatDate(leave.endDate)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {leave.days}j
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(
                                    leave.status,
                                  )}`}
                                >
                                  {t(`leaves.statuses.${leave.status}`, {
                                    defaultValue: leave.status,
                                  })}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Telework Tab */}
            {activeTab === "telework" && (
              <div className="space-y-6">
                {/* Telework stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-teal-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-teal-600">
                      {teleworkDays.filter((td) => td.isTelework).length}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t("telework.totalDays")}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {
                        teleworkDays.filter((td) => {
                          const d = new Date(td.date);
                          const now = new Date();
                          return (
                            td.isTelework &&
                            d.getMonth() === now.getMonth() &&
                            d.getFullYear() === now.getFullYear()
                          );
                        }).length
                      }
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t("telework.thisMonth")}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {(() => {
                        const twCount = teleworkDays.filter(
                          (td) => td.isTelework,
                        ).length;
                        const months = new Set(
                          teleworkDays
                            .filter((td) => td.isTelework)
                            .map((td) => {
                              const d = new Date(td.date);
                              return `${d.getFullYear()}-${d.getMonth()}`;
                            }),
                        ).size;
                        return months > 0 ? (twCount / months).toFixed(1) : "0";
                      })()}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t("telework.monthlyAvg")}
                    </p>
                  </div>
                </div>

                {/* Telework calendar list */}
                {teleworkDays.filter((td) => td.isTelework).length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t("telework.noTelework")}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      {t("telework.calendar")}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {teleworkDays
                        .filter((td) => td.isTelework)
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime(),
                        )
                        .map((td) => (
                          <div
                            key={td.id}
                            className="bg-teal-50 border border-teal-200 rounded-md px-3 py-2 text-center"
                          >
                            <p className="text-sm font-medium text-teal-700">
                              {formatDate(td.date)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Time Tab */}
            {activeTab === "time" && (
              <div className="space-y-6">
                {!timeStats || timeStats.totalHours === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t("time.noEntries")}
                  </div>
                ) : (
                  <>
                    {/* Time summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-indigo-50 rounded-lg p-6 text-center">
                        <p className="text-4xl font-bold text-indigo-600">
                          {timeStats.totalHours}h
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t("time.totalHours")}
                        </p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-6 text-center">
                        <p className="text-4xl font-bold text-purple-600">
                          {timeStats.entriesCount}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {t("time.noEntries") === t("time.noEntries")
                            ? "Saisies"
                            : "Entries"}
                        </p>
                      </div>
                    </div>

                    {/* By project */}
                    {timeStats.byProject &&
                      Object.keys(timeStats.byProject).length > 0 && (
                        <div className="bg-white rounded-lg shadow p-6">
                          <h3 className="text-lg font-semibold mb-4">
                            {t("time.byProject")}
                          </h3>
                          <div className="space-y-3">
                            {Object.entries(timeStats.byProject).map(
                              ([name, hours], i) => (
                                <div key={i}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700">
                                      {name || t("tasks.noProject")}
                                    </span>
                                    <span className="font-medium">
                                      {hours}h
                                    </span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-indigo-500 h-2 rounded-full"
                                      style={{
                                        width: `${
                                          (hours / timeStats.totalHours) * 100
                                        }%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </>
                )}
              </div>
            )}

            {/* Skills Tab */}
            {activeTab === "skills" && (
              <div>
                {skills.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {t("skills.noSkills")}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("skills.skill")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("skills.category")}
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {t("skills.level")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {skills.map((us, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {us.skill?.name || "—"}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {us.skill?.category
                                ? t(`skills.categories.${us.skill.category}`, {
                                    defaultValue: us.skill.category,
                                  })
                                : "—"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-24 bg-gray-200 rounded-full h-2.5">
                                  <div
                                    className={`h-2.5 rounded-full ${getSkillLevelColor(us.level)}`}
                                    style={{
                                      width: getSkillLevelWidth(us.level),
                                    }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-gray-600">
                                  {t(`skills.levels.${us.level}`, {
                                    defaultValue: us.level,
                                  })}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Click outside handler for dropdown */}
      {showUserDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserDropdown(false)}
        />
      )}
    </MainLayout>
  );
}
