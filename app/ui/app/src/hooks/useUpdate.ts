import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getJSON, postJSON } from "../api";
import type { UpdateInfo } from "@/gotypes";

async function getUpdateInfo(): Promise<UpdateInfo> {
  return getJSON("/api/v1/update");
}

async function checkForUpdate(): Promise<UpdateInfo> {
  return postJSON("/api/v1/update/check");
}

async function dismissUpdate(): Promise<{ dismissed: boolean }> {
  return postJSON("/api/v1/update/dismiss");
}

async function downloadUpdate(): Promise<{ downloading: boolean }> {
  return postJSON("/api/v1/update/download");
}

async function installUpdate(): Promise<{ installing: boolean }> {
  return postJSON("/api/v1/update/install");
}

export function useUpdateInfo() {
  return useQuery({
    queryKey: ["updateInfo"],
    queryFn: getUpdateInfo,
    refetchInterval: 5000,
  });
}

export function useCheckForUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkForUpdate,
    onSuccess: (data) => {
      queryClient.setQueryData(["updateInfo"], data);
    },
  });
}

export function useDismissUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissUpdate,
    onSuccess: () => {
      queryClient.setQueryData(["updateInfo"], {
        version: "",
        downloadUrl: "",
        downloading: false,
        downloaded: false,
        downloadBytes: 0,
      });
    },
  });
}

export function useDownloadUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: downloadUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["updateInfo"] });
    },
  });
}

export function useInstallUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: installUpdate,
    onSuccess: () => {
      queryClient.setQueryData(["updateInfo"], {
        version: "",
        downloadUrl: "",
        downloading: false,
        downloaded: false,
        downloadBytes: 0,
      });
    },
  });
}