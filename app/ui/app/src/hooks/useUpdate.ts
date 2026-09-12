import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface UpdateInfo {
    Version: string;
    DownloadURL: string;
    InstalledVersion: string;
    AvailableVersion: string;
}

async function getUpdateInfo(): Promise<UpdateInfo> {
    const r = await fetch("/api/v1/update");
    return r.json();
}

async function checkForUpdate(): Promise<UpdateInfo> {
    const r = await fetch("/api/v1/update/check", { method: "POST" });
    return r.json();
}

export function useUpdateInfo() {
    return useQuery({ queryKey: ["update"], queryFn: getUpdateInfo });
}

export function useCheckForUpdate() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: checkForUpdate,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["update"] }),
    });
}
