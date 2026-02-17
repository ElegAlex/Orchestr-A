"use client";

import { useState } from "react";
import { Task, TaskStatus } from "@/types";
import { tasksService } from "@/services/tasks.service";
import { getPriorityColor } from "@/lib/planning-utils";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import toast from "react-hot-toast";

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export const TaskModal = ({
  task,
  isOpen,
  onClose,
  onRefresh,
}: TaskModalProps) => {
  const t = useTranslations("planning.taskModal");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !task) return null;

  const handleEdit = () => {
    onClose();
    router.push(`/${locale}/tasks/${task.id}`);
  };

  const handleDelete = async () => {
    if (!confirm(t("confirmDelete"))) return;
    try {
      setDeleting(true);
      await tasksService.delete(task.id);
      toast.success(t("deleteSuccess"));
      onClose();
      if (onRefresh) onRefresh();
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          {task.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {t("description")}
              </h3>
              <p className="text-gray-700">{task.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {t("status")}
              </h3>
              <span
                className={`inline-block px-3 py-1 rounded text-sm ${
                  task.status === TaskStatus.DONE
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {tCommon(`taskStatus.${task.status}`)}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {t("priority")}
              </h3>
              <span
                className={`inline-block px-3 py-1 rounded text-sm ${getPriorityColor(task.priority)}`}
              >
                {tCommon(`priority.${task.priority}`)}
              </span>
            </div>
            {task.estimatedHours && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("estimation")}
                </h3>
                <p className="text-gray-700">{task.estimatedHours}h</p>
              </div>
            )}
            {(task.startTime || task.endTime) && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("schedule")}
                </h3>
                <p className="text-gray-700">
                  {task.startTime || "--:--"} - {task.endTime || "--:--"}
                </p>
              </div>
            )}
            {task.progress !== undefined && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {t("progress")}
                </h3>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">
                    {task.progress}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
          >
            {tCommon("actions.delete")}
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              {tCommon("actions.close")}
            </button>
            <button
              onClick={handleEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {tCommon("actions.edit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
