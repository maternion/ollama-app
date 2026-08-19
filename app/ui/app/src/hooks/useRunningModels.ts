import { useQuery } from "@tanstack/react-query";

export interface RunningModel {
  name: string;
  model: string;
  digest: string;
  expiresAt: Date;
  sizeVRAM: number;
  contextLength: number;
}

export function useRunningModels() {
  return useQuery({
    queryKey: ["runningModels"],
    queryFn: async () => {
      const response = await fetch("/api/ps");
      if (!response.ok) return { models: [] as RunningModel[] };
      const data = await response.json();
      return {
        models: (data.models || []).map((m: any) => ({
          name: m.name,
          model: m.model,
          digest: m.digest,
          expiresAt: new Date(m.expires_at),
          sizeVRAM: m.size_vram,
          contextLength: m.context_length,
        })),
      };
    },
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 3000, // Consider data stale after 3 seconds
  });
}

export function useIsModelLoaded(modelName?: string) {
  const { data } = useRunningModels();
  if (!modelName) return false;
  return (data?.models || []).some((m: RunningModel) => m.name === modelName || m.model === modelName);
}
