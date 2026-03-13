function encodeBasicAuth(username, password) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const input = `${username || "opencode"}:${password || ""}`;
  let output = "";
  let block;
  let charCode;
  let idx = 0;
  let map = chars;

  while (input.charAt(idx | 0) || ((map = "="), idx % 1)) {
    charCode = input.charCodeAt((idx += 3 / 4));

    if (charCode > 255) {
      throw new Error("Basic auth only supports latin1 credentials.");
    }

    block = (block << 8) | charCode;
    output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)));
  }

  return output;
}

export function normalizeBaseUrl(value) {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  return withProtocol.replace(/\/+$/, "");
}

export function createAuthHeaders(host, projectPath) {
  const headers = {
    Accept: "application/json",
  };

  if (host?.password) {
    headers.Authorization = `Basic ${encodeBasicAuth(host.username || "opencode", host.password)}`;
  }

  if (projectPath) {
    headers["x-opencode-directory"] = projectPath;
  }

  return headers;
}

async function request(host, path, options = {}, projectPath) {
  const response = await fetch(`${host.baseUrl}${path}`, {
    ...options,
    headers: {
      ...createAuthHeaders(host, projectPath),
      ...(options.body ? { "Content-Type": "application/json" } : null),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return response.text();
  }

  return response.json();
}

export const opencodeApi = {
  health(host) {
    return request(host, "/global/health");
  },
  listProjects(host, projectPath) {
    return request(host, "/project", {}, projectPath);
  },
  currentProject(host, projectPath) {
    return request(host, "/project/current", {}, projectPath);
  },
  getPath(host, projectPath) {
    return request(host, "/path", {}, projectPath);
  },
  getVcs(host, projectPath) {
    return request(host, "/vcs", {}, projectPath);
  },
  searchFiles(host, query, projectPath, type, limit = 50) {
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("limit", String(limit));
    if (type) {
      params.set("type", type);
    }
    return request(host, `/find/file?${params.toString()}`, {}, projectPath);
  },
  searchText(host, query, projectPath) {
    return request(host, `/find?pattern=${encodeURIComponent(query)}`, {}, projectPath);
  },
  readFile(host, filePath, projectPath) {
    return request(host, `/file/content?path=${encodeURIComponent(filePath)}`, {}, projectPath);
  },
  getFileStatus(host, projectPath) {
    return request(host, "/file/status", {}, projectPath);
  },
  listSessions(host, projectPath) {
    return request(host, "/session", {}, projectPath);
  },
  listSessionStatus(host, projectPath) {
    return request(host, "/session/status", {}, projectPath);
  },
  createSession(host, body, projectPath) {
    return request(host, "/session", { method: "POST", body: JSON.stringify(body || {}) }, projectPath);
  },
  getSession(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}`, {}, projectPath);
  },
  renameSession(host, sessionId, title, projectPath) {
    return request(host, `/session/${sessionId}`, { method: "PATCH", body: JSON.stringify({ title }) }, projectPath);
  },
  deleteSession(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}`, { method: "DELETE" }, projectPath);
  },
  listSessionChildren(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}/children`, {}, projectPath);
  },
  forkSession(host, sessionId, messageID, projectPath) {
    return request(
      host,
      `/session/${sessionId}/fork`,
      { method: "POST", body: JSON.stringify(messageID ? { messageID } : {}) },
      projectPath,
    );
  },
  abortSession(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}/abort`, { method: "POST" }, projectPath);
  },
  summarizeSession(host, sessionId, model, projectPath) {
    return request(
      host,
      `/session/${sessionId}/summarize`,
      { method: "POST", body: JSON.stringify(model || {}) },
      projectPath,
    );
  },
  revertSession(host, sessionId, body, projectPath) {
    return request(host, `/session/${sessionId}/revert`, { method: "POST", body: JSON.stringify(body) }, projectPath);
  },
  unrevertSession(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}/unrevert`, { method: "POST" }, projectPath);
  },
  getSessionDiff(host, sessionId, projectPath, messageID) {
    const query = messageID ? `?messageID=${encodeURIComponent(messageID)}` : "";
    return request(host, `/session/${sessionId}/diff${query}`, {}, projectPath);
  },
  listMessages(host, sessionId, projectPath, limit = 100) {
    return request(host, `/session/${sessionId}/message?limit=${limit}`, {}, projectPath);
  },
  sendPrompt(host, sessionId, body, projectPath) {
    return request(host, `/session/${sessionId}/message`, { method: "POST", body: JSON.stringify(body) }, projectPath);
  },
  runCommand(host, sessionId, body, projectPath) {
    return request(host, `/session/${sessionId}/command`, { method: "POST", body: JSON.stringify(body) }, projectPath);
  },
  listTodos(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}/todo`, {}, projectPath);
  },
  listCommands(host, projectPath) {
    return request(host, "/command", {}, projectPath);
  },
  listAgents(host, projectPath) {
    return request(host, "/agent", {}, projectPath);
  },
  getProviders(host, projectPath) {
    return request(host, "/provider", {}, projectPath);
  },
  getProviderAuth(host, projectPath) {
    return request(host, "/provider/auth", {}, projectPath);
  },
  setAuth(host, providerId, body, projectPath) {
    return request(host, `/auth/${providerId}`, { method: "PUT", body: JSON.stringify(body) }, projectPath);
  },
  getConfigProviders(host, projectPath) {
    return request(host, "/config/providers", {}, projectPath);
  },
  getConfig(host, projectPath) {
    return request(host, "/config", {}, projectPath);
  },
  updateConfig(host, body, projectPath) {
    return request(host, "/config", { method: "PATCH", body: JSON.stringify(body) }, projectPath);
  },
  answerPermission(host, sessionId, permissionId, response, remember, projectPath) {
    return request(
      host,
      `/session/${sessionId}/permissions/${permissionId}`,
      { method: "POST", body: JSON.stringify({ response, remember }) },
      projectPath,
    );
  },
  answerQuestion(host, sessionId, questionId, answer, projectPath) {
    return request(
      host,
      `/session/${sessionId}/question/${questionId}`,
      { method: "POST", body: JSON.stringify({ answer }) },
      projectPath,
    );
  },
  shareSession(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}/share`, { method: "POST" }, projectPath);
  },
  unshareSession(host, sessionId, projectPath) {
    return request(host, `/session/${sessionId}/share`, { method: "DELETE" }, projectPath);
  },
};

export function parseSlashCommand(input) {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const withoutSlash = trimmed.slice(1).trim();

  if (!withoutSlash) {
    return null;
  }

  const [command, ...rest] = withoutSlash.split(/\s+/);

  return {
    command,
    arguments: rest.join(" "),
  };
}

export function toModelPayload(modelKey) {
  if (!modelKey || !modelKey.includes("/")) {
    return undefined;
  }

  const [providerID, ...rest] = modelKey.split("/");

  return {
    providerID,
    modelID: rest.join("/"),
  };
}
