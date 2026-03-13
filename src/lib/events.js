export function normalizeEventPayload(payload) {
  const type = payload?.type || payload?.event || "unknown";
  const properties = payload?.properties || payload || {};
  const sessionId =
    properties.sessionID || properties.sessionId || properties.info?.sessionID || properties.info?.sessionId || properties.part?.sessionID || properties.permission?.sessionID || null;

  return {
    type,
    sessionId,
    payload,
    properties,
  };
}

export function extractInteractionFromEvent(normalized) {
  const { type, properties, sessionId } = normalized;

  if (type === "permission.updated") {
    return {
      kind: "permission",
      sessionId: properties.sessionID,
      id: properties.id,
      title: properties.title || "Permission request",
      body: buildPermissionBody(properties),
      createdAt: properties.time?.created,
      options: [
        { id: "allow", label: "Allow" },
        { id: "deny", label: "Deny" },
      ],
      raw: properties,
    };
  }

  if (type.includes("question") || hasQuestionShape(properties)) {
    const choices = properties.options || properties.choices || properties.buttons || [];
    return {
      kind: "question",
      sessionId,
      id: properties.id || properties.questionID || properties.questionId,
      title: properties.title || properties.label || "Question",
      body: properties.message || properties.prompt || properties.description || "OpenCode is waiting for a choice.",
      createdAt: properties.time?.created,
      options: choices.map(normalizeChoice),
      raw: properties,
    };
  }

  if (type.includes("action") || hasActionShape(properties)) {
    const actions = properties.actions || properties.buttons || [];
    return {
      kind: "action",
      sessionId,
      id: properties.id || properties.actionID || properties.actionId,
      title: properties.title || "Action required",
      body: properties.message || properties.description || "Choose the next action.",
      createdAt: properties.time?.created,
      options: actions.map(normalizeChoice),
      raw: properties,
    };
  }

  return null;
}

function normalizeChoice(choice, index) {
  if (typeof choice === "string") {
    return { id: choice, label: choice };
  }

  return {
    id: choice.id || choice.value || choice.label || `choice-${index}`,
    label: choice.label || choice.title || choice.value || `Choice ${index + 1}`,
    value: choice.value,
  };
}

function hasQuestionShape(properties) {
  return !!(properties?.prompt && (properties?.options || properties?.choices));
}

function hasActionShape(properties) {
  return !!(properties?.actions || properties?.buttons);
}

function buildPermissionBody(permission) {
  const meta = permission.metadata || {};
  const details = [meta.command, meta.path, meta.tool, meta.pattern].filter(Boolean).join("\n");
  return details ? `${permission.title}\n\n${details}` : permission.title;
}
