import { useWorkspace } from "./useWorkspace";

export function useIsAdmin() {
  const { roles } = useWorkspace();
  return roles.includes("admin" as any);
}
