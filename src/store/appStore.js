import { create } from "zustand";

import { deleteHostSecret, loadPersistedState, saveHostSecret, savePersistedState } from "../lib/storage";

const initialState = {
  hydrated: false,
  hosts: [],
  selectedHostId: null,
  selectedProjectByHost: {},
  selectedSessionByScope: {},
  runProfileByScope: {},
  pendingInteractionsBySession: {},
};

const defaultRunProfile = {
  agent: "build",
  modelKey: null,
  reasoning: "default",
};

function projectScope(hostId, projectPath) {
  return `${hostId || "unknown"}::${projectPath || "default"}`;
}

async function persist(get) {
  const state = get();
  await savePersistedState({
    hosts: state.hosts,
    selectedHostId: state.selectedHostId,
    selectedProjectByHost: state.selectedProjectByHost,
    selectedSessionByScope: state.selectedSessionByScope,
    runProfileByScope: state.runProfileByScope,
  });
}

export const useAppStore = create((set, get) => ({
  ...initialState,

  hydrate: async () => {
    const persisted = await loadPersistedState();
    set({
      ...initialState,
      ...persisted,
      hydrated: true,
      pendingInteractionsBySession: {},
    });
  },

  addOrUpdateHost: async (hostMeta, secret) => {
    const hosts = [...get().hosts];
    const index = hosts.findIndex((item) => item.id === hostMeta.id);

    if (index >= 0) {
      hosts[index] = hostMeta;
    } else {
      hosts.unshift(hostMeta);
    }

    set({ hosts, selectedHostId: hostMeta.id });
    await saveHostSecret(hostMeta.id, secret);
    await persist(get);
  },

  removeHost: async (hostId) => {
    const nextHosts = get().hosts.filter((item) => item.id !== hostId);
    const nextSelectedHostId = get().selectedHostId === hostId ? nextHosts[0]?.id || null : get().selectedHostId;
    set({ hosts: nextHosts, selectedHostId: nextSelectedHostId });
    await deleteHostSecret(hostId);
    await persist(get);
  },

  selectHost: async (hostId) => {
    set({ selectedHostId: hostId });
    await persist(get);
  },

  selectProject: async (hostId, projectPath) => {
    set((state) => ({
      selectedProjectByHost: {
        ...state.selectedProjectByHost,
        [hostId]: projectPath,
      },
    }));
    await persist(get);
  },

  selectSession: async (hostId, projectPath, sessionId) => {
    set((state) => ({
      selectedSessionByScope: {
        ...state.selectedSessionByScope,
        [projectScope(hostId, projectPath)]: sessionId,
      },
    }));
    await persist(get);
  },

  updateRunProfile: async (hostId, projectPath, patch) => {
    set((state) => ({
      runProfileByScope: {
        ...state.runProfileByScope,
        [projectScope(hostId, projectPath)]: {
          ...defaultRunProfile,
          ...(state.runProfileByScope[projectScope(hostId, projectPath)] || {}),
          ...patch,
        },
      },
    }));
    await persist(get);
  },

  upsertInteraction: (sessionId, interaction) => {
    set((state) => {
      const current = state.pendingInteractionsBySession[sessionId] || [];
      const index = current.findIndex((item) => item.id === interaction.id && item.kind === interaction.kind);
      const next = [...current];

      if (index >= 0) {
        next[index] = { ...next[index], ...interaction };
      } else {
        next.unshift(interaction);
      }

      return {
        pendingInteractionsBySession: {
          ...state.pendingInteractionsBySession,
          [sessionId]: next,
        },
      };
    });
  },

  resolveInteraction: (sessionId, interactionId) => {
    set((state) => ({
      pendingInteractionsBySession: {
        ...state.pendingInteractionsBySession,
        [sessionId]: (state.pendingInteractionsBySession[sessionId] || []).filter((item) => item.id !== interactionId),
      },
    }));
  },

  clearSessionInteractions: (sessionId) => {
    set((state) => ({
      pendingInteractionsBySession: {
        ...state.pendingInteractionsBySession,
        [sessionId]: [],
      },
    }));
  },
}));

export function getProjectScope(hostId, projectPath) {
  return projectScope(hostId, projectPath);
}

export function getRunProfile(state, hostId, projectPath) {
  return state.runProfileByScope[projectScope(hostId, projectPath)] || defaultRunProfile;
}
