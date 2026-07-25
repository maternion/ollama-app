import { Display } from "./ui/display";
import { useUpdateInfo, useDownloadUpdate, useInstallUpdate, useDismissUpdate } from "../hooks/useUpdate";

export function UpdateBanner() {
  const { data: info, isLoading } = useUpdateInfo();
  const download = useDownloadUpdate();
  const install = useInstallUpdate();
  const dismiss = useDismissUpdate();

  if (isLoading || !info) return null;

  if (info.downloading) {
    return (
      <Display
        message={`Downloading Ollama ${info.version}...`}
        variant="blue"
      />
    );
  }

  if (info.downloaded) {
    return (
      <Display
        message={`Ollama ${info.version} downloaded and ready to install`}
        variant="green"
        action={{
          label: install.isPending ? "Installing..." : "Install & Restart",
          loading: install.isPending,
          disabled: install.isPending,
          onClick: () => install.mutate(),
        }}
      />
    );
  }

  if (info.version) {
    return (
      <Display
        message={`Update available: Ollama ${info.version}`}
        variant="amber"
        action={{
          label: download.isPending ? "Downloading..." : "Download",
          loading: download.isPending,
          disabled: download.isPending,
          onClick: () => download.mutate(),
        }}
        onDismiss={() => dismiss.mutate()}
      />
    );
  }

  return null;
}