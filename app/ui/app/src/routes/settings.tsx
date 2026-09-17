import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/components/Settings";
import { SidebarLayout } from "@/components/layout/layout";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <SidebarLayout title="Settings" sidebar={<AppSidebar current="settings" />}>
      <Settings />
    </SidebarLayout>
  );
}