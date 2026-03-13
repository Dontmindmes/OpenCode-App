export const primaryAgentOrder = ["build", "plan"];

export const reasoningProfiles = [
  {
    key: "default",
    label: "Default",
    description: "Use the host or model defaults.",
  },
  {
    key: "fast",
    label: "Fast",
    description: "Bias toward lighter reasoning and faster responses.",
  },
  {
    key: "balanced",
    label: "Balanced",
    description: "Keep a moderate reasoning budget for day-to-day coding.",
  },
  {
    key: "deep",
    label: "Deep",
    description: "Bias toward more deliberate reasoning for harder tasks.",
  },
];

export function primaryAgentsFirst(agents) {
  const items = Array.isArray(agents) ? agents : [];
  return [...items].sort((a, b) => {
    const aIndex = primaryAgentOrder.indexOf(a.name);
    const bIndex = primaryAgentOrder.indexOf(b.name);

    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    }

    if (a.mode !== b.mode) {
      return a.mode === "primary" ? -1 : 1;
    }

    return a.name.localeCompare(b.name);
  });
}

export function getAgentLabel(agentName) {
  if (!agentName) {
    return "Build";
  }

  if (agentName === "build") {
    return "Build";
  }

  if (agentName === "plan") {
    return "Plan";
  }

  return agentName;
}

export function getAgentTone(agentName) {
  return agentName === "plan" ? "cool" : "default";
}

export function getReasoningProfile(profileKey) {
  return reasoningProfiles.find((item) => item.key === profileKey) || reasoningProfiles[0];
}

export function buildReasoningSystemPrompt(profileKey, agentName) {
  if (!profileKey || profileKey === "default") {
    return undefined;
  }

  const base = {
    fast: "Prefer a quick pass. Keep reasoning compact, avoid overthinking, and move directly to the most likely next action.",
    balanced: "Use a balanced amount of reasoning. Think enough to avoid mistakes, but keep momentum high.",
    deep: "Use deeper reasoning than usual. Spend more effort checking tradeoffs, edge cases, and implementation risks before acting.",
  }[profileKey];

  if (!base) {
    return undefined;
  }

  if (agentName === "plan") {
    return `${base} Since you are in plan mode, focus on analysis, options, and concrete next steps without making unsafe assumptions.`;
  }

  return base;
}

export function buildReasoningConfigPatch(agentName, profileKey, modelKey) {
  if (!agentName || !profileKey || profileKey === "default" || !modelKey) {
    return null;
  }

  const [providerID, ...rest] = modelKey.split("/");
  const modelID = rest.join("/");

  if (!providerID || !modelID) {
    return null;
  }

  const agentPatch = { model: modelKey };
  const providerPatch = {
    [providerID]: {
      models: {
        [modelID]: {
          options: buildProviderOptions(providerID, profileKey),
        },
      },
    },
  };

  if (!providerPatch[providerID].models[modelID].options) {
    return {
      agent: {
        [agentName]: agentPatch,
      },
    };
  }

  return {
    agent: {
      [agentName]: agentPatch,
    },
    provider: providerPatch,
  };
}

function buildProviderOptions(providerID, profileKey) {
  if (["openai", "opencode", "azure-openai"].includes(providerID)) {
    return {
      reasoningEffort:
        profileKey === "fast"
          ? "low"
          : profileKey === "balanced"
            ? "medium"
            : "high",
      textVerbosity: "low",
      reasoningSummary: "auto",
    };
  }

  if (["anthropic", "gitlab"].includes(providerID)) {
    return {
      thinking:
        profileKey === "fast"
          ? { type: "enabled", budgetTokens: 2048 }
          : profileKey === "balanced"
            ? { type: "enabled", budgetTokens: 8192 }
            : { type: "enabled", budgetTokens: 16000 },
    };
  }

  if (["google", "vertex", "google-vertex-ai"].includes(providerID)) {
    return {
      thinkingBudget: profileKey === "fast" ? 1024 : profileKey === "balanced" ? 4096 : 8192,
    };
  }

  return null;
}
