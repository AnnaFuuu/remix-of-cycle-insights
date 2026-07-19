import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, LayoutDashboard, LineChart, FlaskConical, Settings, HeartPulse, TestTube, Watch, Dna, ShieldAlert } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n";
import { useResearcherMode } from "@/lib/researcher-mode";

const groups = [
  {
    label: "nav.group.overview",
    items: [
      { key: "nav.dashboard", url: "/", icon: LayoutDashboard },
    ],
  },
  {
    label: "nav.group.personalData",
    items: [
      { key: "nav.labs", url: "/labs", icon: TestTube },
      { key: "nav.wearables", url: "/wearables", icon: Watch },
      { key: "nav.biomarkers", url: "/biomarkers", icon: Dna },
      { key: "nav.telemetry", url: "/telemetry", icon: Activity },
    ],
  },
  {
    label: "nav.group.modelTraining",
    items: [
      { key: "nav.quality", url: "/quality", icon: ShieldAlert },
      { key: "nav.analytics", url: "/analytics", icon: LineChart },
    ],
  },
  {
    label: "nav.group.research",
    items: [
      { key: "nav.research", url: "/research", icon: FlaskConical },
      { key: "nav.settings", url: "/settings", icon: Settings },
    ],
  },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { t } = useI18n();
  
  const { isResearcher } = useResearcherMode();
  const visibleGroups = groups.filter((g) => g.label !== "nav.group.modelTraining" || isResearcher);
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold tracking-tight">Cycloscope</div>
            <div className="truncate text-xs text-muted-foreground">{t("app.brand.sub")}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {visibleGroups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{t(g.label)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = item.url === "/" ? path === "/" : path.startsWith(item.url);
                  const label = t(item.key);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={active} tooltip={label}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-3 text-[10px] leading-relaxed text-muted-foreground group-data-[collapsible=icon]:hidden">
          {t("app.footer")}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}