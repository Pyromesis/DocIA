import {
  LayoutDashboard,
  Upload,
  FileText,
  FolderOpen,
  Settings,
  BarChart3,
  Layers,
  Clock,
  ShieldCheck,
  Sparkles,
  GraduationCap,
  LifeBuoy,
} from "lucide-react";
import type { NavItem } from "@/types/navigation";

export const PRIMARY_NAV: NavItem[] = [
  { id: "dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { id: "upload", label: "nav.upload", icon: Upload, badge: "badges.new" },
  { id: "documents", label: "nav.documents", icon: FileText },
  { id: "templates", label: "nav.templates", icon: Layers },
  { id: "training", label: "nav.training", icon: GraduationCap, badge: "badges.ai" },
  { id: "enhance", label: "nav.enhance", icon: Sparkles, badge: "badges.ai" },
  { id: "projects", label: "nav.projects", icon: FolderOpen },
  { id: "analytics", label: "nav.analytics", icon: BarChart3 },
  { id: "history", label: "nav.history", icon: Clock },
  { id: "data-vault", label: "nav.dataVault", icon: ShieldCheck, badge: "badges.local" },
  { id: "help", label: "Help & Support", icon: LifeBuoy },
];

export const SECONDARY_NAV: NavItem[] = [
  { id: "settings", label: "nav.settings", icon: Settings },
];
