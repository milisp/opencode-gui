import { create } from "zustand"

interface ProjectStoreState {
  directory?: string
  setDirectory: (dir?: string) => void
  clearDirectory: () => void
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  directory: undefined,
  setDirectory: (dir) => set({ directory: dir }),
  clearDirectory: () => set({ directory: undefined }),
}))

export default useProjectStore
