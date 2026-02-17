import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

export type ActivePage = string | "help";
