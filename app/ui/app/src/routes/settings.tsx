import { AppSidebar } from "@/components/AppSidebar";
import { SidebarLayout } from "@/components/layout/layout";
import { createFileRoute } from "@tanstack/react-router";
import Settings from "@/components/Settings";
import { SidebarLayout } from "@/components/layout/layout";
import { ChatSidebar } from "@/components/ChatSidebar";

export const Route = createFileRoute("/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
<<<<<<< HEAD
    <SidebarLayout sidebar={<ChatSidebar />}>
      <Settings />
    </SidebarLayout>
  );
}
=======
    <SidebarLayout title="Settings" sidebar={<AppSidebar current="settings" />}>
      <Settings />
    </SidebarLayout>
  );
}
>>>>>>> v0.34.0
