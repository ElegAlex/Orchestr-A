import {
  getServiceStyle,
  getGroupColors,
  getPriorityColor,
  getStatusIcon,
  getRoleLabel,
  getLeaveTypeLabel,
} from "../planning-utils";
import { Priority, TaskStatus, Role, LeaveType } from "@/types";

describe("planning-utils", () => {
  describe("getServiceStyle", () => {
    it("should return blue for development-related services", () => {
      expect(getServiceStyle("Développement")).toEqual({
        icon: "",
        color: "blue",
      });
      expect(getServiceStyle("Dev Team")).toEqual({ icon: "", color: "blue" });
      expect(getServiceStyle("Informatique")).toEqual({
        icon: "",
        color: "blue",
      });
      expect(getServiceStyle("Technique")).toEqual({ icon: "", color: "blue" });
    });

    it("should return emerald for admin/finance services", () => {
      expect(getServiceStyle("Administration")).toEqual({
        icon: "",
        color: "emerald",
      });
      expect(getServiceStyle("Gestion")).toEqual({
        icon: "",
        color: "emerald",
      });
      expect(getServiceStyle("Finance")).toEqual({
        icon: "",
        color: "emerald",
      });
    });

    it("should return purple for communication/marketing services", () => {
      expect(getServiceStyle("Communication")).toEqual({
        icon: "",
        color: "purple",
      });
      expect(getServiceStyle("Marketing")).toEqual({
        icon: "",
        color: "purple",
      });
    });

    it("should return pink for HR services", () => {
      expect(getServiceStyle("RH")).toEqual({ icon: "", color: "pink" });
      expect(getServiceStyle("Ressources Humaines")).toEqual({
        icon: "",
        color: "pink",
      });
    });

    it("should return slate for legal services", () => {
      expect(getServiceStyle("Juridique")).toEqual({
        icon: "",
        color: "slate",
      });
      expect(getServiceStyle("Legal")).toEqual({ icon: "", color: "slate" });
    });

    it("should return cyan for support services", () => {
      expect(getServiceStyle("Support")).toEqual({ icon: "", color: "cyan" });
      expect(getServiceStyle("Assistance")).toEqual({
        icon: "",
        color: "cyan",
      });
    });

    it("should return indigo for project services", () => {
      expect(getServiceStyle("Projet")).toEqual({ icon: "", color: "indigo" });
      expect(getServiceStyle("PMO")).toEqual({ icon: "", color: "indigo" });
    });

    it("should return gray for unknown services", () => {
      expect(getServiceStyle("Unknown")).toEqual({ icon: "", color: "gray" });
      expect(getServiceStyle("Random Service")).toEqual({
        icon: "",
        color: "gray",
      });
    });

    it("should be case-insensitive", () => {
      expect(getServiceStyle("DÉVELOPPEMENT")).toEqual({
        icon: "",
        color: "blue",
      });
      expect(getServiceStyle("dev")).toEqual({ icon: "", color: "blue" });
      expect(getServiceStyle("DEV")).toEqual({ icon: "", color: "blue" });
    });
  });

  describe("getGroupColors", () => {
    it("should return amber colors for management", () => {
      const result = getGroupColors("blue", true);
      expect(result.header).toContain("amber");
      expect(result.text).toContain("amber");
      expect(result.badge).toContain("amber");
      expect(result.border).toContain("amber");
      expect(result.avatar).toContain("amber");
    });

    it("should return blue colors when isManagement is false and color is blue", () => {
      const result = getGroupColors("blue", false);
      expect(result.header).toContain("blue");
      expect(result.text).toBe("text-blue-900");
      expect(result.badge).toBe("bg-blue-500");
      expect(result.border).toContain("blue");
      expect(result.avatar).toBe("bg-blue-600");
    });

    it("should return emerald colors", () => {
      const result = getGroupColors("emerald", false);
      expect(result.header).toContain("emerald");
      expect(result.text).toBe("text-emerald-900");
      expect(result.badge).toBe("bg-emerald-500");
    });

    it("should return purple colors", () => {
      const result = getGroupColors("purple", false);
      expect(result.header).toContain("purple");
      expect(result.text).toBe("text-purple-900");
      expect(result.badge).toBe("bg-purple-500");
    });

    it("should return pink colors", () => {
      const result = getGroupColors("pink", false);
      expect(result.header).toContain("pink");
      expect(result.text).toBe("text-pink-900");
    });

    it("should return slate colors", () => {
      const result = getGroupColors("slate", false);
      expect(result.header).toContain("slate");
      expect(result.text).toBe("text-slate-900");
    });

    it("should return cyan colors", () => {
      const result = getGroupColors("cyan", false);
      expect(result.header).toContain("cyan");
      expect(result.text).toBe("text-cyan-900");
    });

    it("should return indigo colors", () => {
      const result = getGroupColors("indigo", false);
      expect(result.header).toContain("indigo");
      expect(result.text).toBe("text-indigo-900");
    });

    it("should return gray colors for gray input", () => {
      const result = getGroupColors("gray", false);
      expect(result.header).toContain("gray");
      expect(result.text).toBe("text-gray-900");
    });

    it("should return gray colors for unknown color", () => {
      const result = getGroupColors("unknown", false);
      expect(result.header).toContain("gray");
      expect(result.text).toBe("text-gray-900");
      expect(result.badge).toBe("bg-gray-500");
    });

    it("should return complete object structure", () => {
      const result = getGroupColors("blue", false);
      expect(result).toHaveProperty("header");
      expect(result).toHaveProperty("text");
      expect(result).toHaveProperty("badge");
      expect(result).toHaveProperty("border");
      expect(result).toHaveProperty("avatar");
    });
  });

  describe("getPriorityColor", () => {
    it("should return red classes for CRITICAL priority", () => {
      const result = getPriorityColor(Priority.CRITICAL);
      expect(result).toContain("red");
      expect(result).toBe("bg-red-100 text-red-800 border-red-300");
    });

    it("should return orange classes for HIGH priority", () => {
      const result = getPriorityColor(Priority.HIGH);
      expect(result).toContain("orange");
      expect(result).toBe("bg-orange-100 text-orange-800 border-orange-300");
    });

    it("should return blue classes for NORMAL priority", () => {
      const result = getPriorityColor(Priority.NORMAL);
      expect(result).toContain("blue");
      expect(result).toBe("bg-blue-100 text-blue-800 border-blue-300");
    });

    it("should return gray classes for LOW priority", () => {
      const result = getPriorityColor(Priority.LOW);
      expect(result).toContain("gray");
      expect(result).toBe("bg-gray-100 text-gray-800 border-gray-300");
    });
  });

  describe("getStatusIcon", () => {
    it("should return empty circle for TODO status", () => {
      expect(getStatusIcon(TaskStatus.TODO)).toBe("○");
    });

    it("should return half-filled circle for IN_PROGRESS status", () => {
      expect(getStatusIcon(TaskStatus.IN_PROGRESS)).toBe("◐");
    });

    it("should return mostly-filled circle for IN_REVIEW status", () => {
      expect(getStatusIcon(TaskStatus.IN_REVIEW)).toBe("◕");
    });

    it("should return filled circle for DONE status", () => {
      expect(getStatusIcon(TaskStatus.DONE)).toBe("●");
    });

    it("should return crossed circle for BLOCKED status", () => {
      expect(getStatusIcon(TaskStatus.BLOCKED)).toBe("⊗");
    });
  });

  describe("getRoleLabel", () => {
    it('should return "Admin" for ADMIN role', () => {
      expect(getRoleLabel(Role.ADMIN)).toBe("Admin");
    });

    it('should return "Responsable" for RESPONSABLE role', () => {
      expect(getRoleLabel(Role.RESPONSABLE)).toBe("Responsable");
    });

    it('should return "Manager" for MANAGER role', () => {
      expect(getRoleLabel(Role.MANAGER)).toBe("Manager");
    });

    it('should return "Réf. Tech." for REFERENT_TECHNIQUE role', () => {
      expect(getRoleLabel(Role.REFERENT_TECHNIQUE)).toBe("Réf. Tech.");
    });

    it('should return "Contributeur" for CONTRIBUTEUR role', () => {
      expect(getRoleLabel(Role.CONTRIBUTEUR)).toBe("Contributeur");
    });

    it('should return "Observateur" for OBSERVATEUR role', () => {
      expect(getRoleLabel(Role.OBSERVATEUR)).toBe("Observateur");
    });

    it("should return the role itself for unknown role", () => {
      expect(getRoleLabel("UNKNOWN_ROLE" as Role)).toBe("UNKNOWN_ROLE");
    });
  });

  describe("getLeaveTypeLabel", () => {
    it('should return "Congés payés" for CP type', () => {
      expect(getLeaveTypeLabel(LeaveType.CP)).toBe("Congés payés");
    });

    it('should return "RTT" for RTT type', () => {
      expect(getLeaveTypeLabel(LeaveType.RTT)).toBe("RTT");
    });

    it('should return "Maladie" for SICK_LEAVE type', () => {
      expect(getLeaveTypeLabel(LeaveType.SICK_LEAVE)).toBe("Maladie");
    });

    it('should return "Sans solde" for UNPAID type', () => {
      expect(getLeaveTypeLabel(LeaveType.UNPAID)).toBe("Sans solde");
    });

    it('should return "Autre" for OTHER type', () => {
      expect(getLeaveTypeLabel(LeaveType.OTHER)).toBe("Autre");
    });

    it("should return the type itself for unknown type", () => {
      expect(getLeaveTypeLabel("UNKNOWN_TYPE" as LeaveType)).toBe(
        "UNKNOWN_TYPE",
      );
    });
  });
});
