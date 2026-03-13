export function formatRelativeTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < hour) {
    return formatter.format(Math.round(diff / minute), "minute");
  }

  if (abs < day) {
    return formatter.format(Math.round(diff / hour), "hour");
  }

  return formatter.format(Math.round(diff / day), "day");
}

export function truncateMiddle(value, start = 20, end = 14) {
  if (!value || value.length <= start + end + 3) {
    return value || "";
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function flattenModels(payload) {
  const providers = payload?.providers || payload?.all || [];
  const models = [];

  providers.forEach((provider) => {
    const providerId = provider?.id || provider?.providerID || provider?.name;
    const providerName = provider?.name || providerId;
    const sourceModels = Array.isArray(provider?.models)
      ? provider.models
      : Object.entries(provider?.models || {}).map(([id, value]) => ({ id, ...value }));

    sourceModels.forEach((model) => {
      const modelId = model?.id || model?.modelID || model?.name;

      if (!providerId || !modelId) {
        return;
      }

      models.push({
        key: `${providerId}/${modelId}`,
        providerId,
        providerName,
        modelId,
        label: model?.name || modelId,
        description: model?.description || model?.id || null,
      });
    });
  });

  return models.sort((a, b) => a.key.localeCompare(b.key));
}

export function sessionTitle(session) {
  return session?.title || session?.name || session?.id || "Untitled session";
}

export function sessionStatusLabel(status) {
  if (!status) {
    return "Idle";
  }

  if (typeof status === "string") {
    return status;
  }

  if (status.running) {
    return "Running";
  }

  if (status.pending) {
    return "Pending";
  }

  if (status.idle) {
    return "Idle";
  }

  if (status.type) {
    if (status.type === "busy") {
      return "Busy";
    }

    if (status.type === "retry") {
      return "Retrying";
    }

    if (status.type === "idle") {
      return "Idle";
    }
  }

  return status.state || status.status || "Idle";
}

export function extractMessageText(parts = []) {
  return parts
    .map((part) => renderPartText(part))
    .filter(Boolean)
    .join("\n\n");
}

export function renderPartText(part) {
  if (!part) {
    return "";
  }

  if (typeof part === "string") {
    return part;
  }

  if (part.type === "text") {
    return part.text || "";
  }

  if (part.type === "tool" || part.type === "tool_call") {
    const name = part.tool || part.name || part.toolName || "tool";
    const content = compactJson(part.arguments || part.input || part.output || part.result);
    return `$ ${name}${content ? `\n${content}` : ""}`;
  }

  if (part.type === "bash") {
    return `$ ${part.command || "bash"}`;
  }

  if (part.type === "file" || part.type === "diff") {
    return compactJson(part);
  }

  if (part.text) {
    return part.text;
  }

  return compactJson(part);
}

export function compactJson(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function matchSessionToProject(session, projectPath) {
  if (!projectPath) {
    return true;
  }

  const candidates = [
    session?.path,
    session?.directory,
    session?.cwd,
    session?.projectPath,
    session?.project?.path,
    session?.project?.directory,
  ].filter(Boolean);

  if (!candidates.length) {
    return true;
  }

  return candidates.some((candidate) => candidate === projectPath);
}

export function normalizeProject(project) {
  const path = project?.path || project?.directory || project?.worktree || project?.id || "";
  return {
    id: project?.id || path || Math.random().toString(36),
    path,
    name: project?.name || guessNameFromPath(path || "Project"),
    raw: project,
  };
}

function guessNameFromPath(path) {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}
