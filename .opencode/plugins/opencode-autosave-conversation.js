import { mkdir, writeFile, rename, unlink } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { homedir } from 'os';

// src/types.ts
var DEFAULT_CONFIG = {
  saveDirectory: "./conversations",
  maxTopicLength: 30,
  debounceMs: 2e3
};
var INVALID_FILENAME_CHARS = /[/\\:*?"<>|]/g;
var MULTIPLE_HYPHENS = /-+/g;
var LEADING_TRAILING_HYPHENS = /^-+|-+$/g;
async function ensureDirectory(baseDir, config) {
  const dir = join(baseDir, config.saveDirectory);
  try {
    await mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`[autosave] Failed to create directory ${dir}:`, error);
  }
  return dir;
}
function generateFilename(topic, createdAt, config) {
  const dateStr = formatDateForFilename(createdAt);
  const sanitized = sanitizeTopic(topic, config.maxTopicLength);
  return `${dateStr}-${sanitized}.md`;
}
function formatDateForFilename(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}-${hours}-${minutes}-${seconds}`;
}
function sanitizeTopic(topic, maxLength) {
  let sanitized = topic.replace(INVALID_FILENAME_CHARS, "-").replace(/\s+/g, "-").replace(MULTIPLE_HYPHENS, "-").replace(LEADING_TRAILING_HYPHENS, "");
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
    sanitized = sanitized.replace(LEADING_TRAILING_HYPHENS, "");
  }
  return sanitized || "untitled";
}
async function writeSessionFile(filePath, content) {
  const tempPath = `${filePath}.tmp`;
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(tempPath, content, "utf-8");
    await rename(tempPath, filePath);
    return true;
  } catch (error) {
    console.error(`[autosave] Failed to write file ${filePath}:`, error);
    try {
      await unlink(tempPath);
    } catch {
    }
    return false;
  }
}
var BASE64_DATA_URL_REGEX = /^data:image\/([a-zA-Z]+);base64,(.+)$/;
function isBase64ImageUrl(url) {
  return BASE64_DATA_URL_REGEX.test(url);
}
function extractBase64Data(url) {
  const match = url.match(BASE64_DATA_URL_REGEX);
  if (!match) return null;
  return { format: match[1], data: match[2] };
}
async function saveImageFromBase64(base64Url, mdFilePath, sessionTitle, createdAt, imageIndex) {
  const extracted = extractBase64Data(base64Url);
  if (!extracted) return null;
  const mdDir = dirname(mdFilePath);
  const imagesDir = join(mdDir, "images");
  const dateStr = formatDateForFilename(createdAt);
  const sanitizedTitle = sanitizeTopic(sessionTitle, 50);
  try {
    await mkdir(imagesDir, { recursive: true });
    const ext = extracted.format === "jpeg" ? "jpg" : extracted.format;
    const imageFilename = `${dateStr}-${sanitizedTitle}-${imageIndex}.${ext}`;
    const imagePath = join(imagesDir, imageFilename);
    const buffer = Buffer.from(extracted.data, "base64");
    await writeFile(imagePath, buffer);
    return `images/${imageFilename}`;
  } catch (error) {
    console.error("[autosave] Failed to save image:", error);
    return null;
  }
}
function getGlobalSaveDirectory(projectDir) {
  try {
    const home = homedir();
    if (!home) {
      return null;
    }
    const projectName = basename(projectDir);
    const sanitizedProjectName = sanitizeTopic(projectName, 50);
    return join(home, ".conversations", sanitizedProjectName);
  } catch {
    return null;
  }
}
async function ensureGlobalDirectory(globalSaveDir) {
  try {
    await mkdir(globalSaveDir, { recursive: true });
    return globalSaveDir;
  } catch (error) {
    console.error(
      `[autosave] Failed to create global directory ${globalSaveDir}:`,
      error
    );
    return null;
  }
}
async function writeToSecondaryLocation(primaryFilePath, globalSaveDir, content) {
  try {
    const filename = basename(primaryFilePath);
    const secondaryPath = join(globalSaveDir, filename);
    await writeSessionFile(secondaryPath, content);
  } catch (error) {
    console.error(`[autosave] Failed to write to secondary location:`, error);
  }
}
async function saveImageToSecondaryLocation(base64Url, globalSaveDir, sessionTitle, createdAt, imageIndex) {
  const extracted = extractBase64Data(base64Url);
  if (!extracted) return;
  const imagesDir = join(globalSaveDir, "images");
  const dateStr = formatDateForFilename(createdAt);
  const sanitizedTitle = sanitizeTopic(sessionTitle, 50);
  try {
    await mkdir(imagesDir, { recursive: true });
    const ext = extracted.format === "jpeg" ? "jpg" : extracted.format;
    const imageFilename = `${dateStr}-${sanitizedTitle}-${imageIndex}.${ext}`;
    const imagePath = join(imagesDir, imageFilename);
    const buffer = Buffer.from(extracted.data, "base64");
    await writeFile(imagePath, buffer);
  } catch (error) {
    console.error("[autosave] Failed to save image to secondary location:", error);
  }
}

// src/session-tracker.ts
var sessions = /* @__PURE__ */ new Map();
var pendingChildren = /* @__PURE__ */ new Map();
function createSession(id, title, filePath, parentID) {
  const session = {
    id,
    parentID,
    title,
    filePath,
    createdAt: /* @__PURE__ */ new Date(),
    childSessionIDs: []
  };
  sessions.set(id, session);
  if (parentID) {
    const parent = sessions.get(parentID);
    if (parent) {
      parent.childSessionIDs.push(id);
    } else {
      const pending = pendingChildren.get(parentID) || [];
      pending.push(id);
      pendingChildren.set(parentID, pending);
    }
  } else {
    const pending = pendingChildren.get(id);
    if (pending) {
      session.childSessionIDs.push(...pending);
      pendingChildren.delete(id);
    }
  }
  return session;
}
function getSession(id) {
  return sessions.get(id);
}
function deleteSession(id) {
  sessions.delete(id);
}
function getChildSessions(parentID) {
  const parent = sessions.get(parentID);
  if (!parent) {
    return [];
  }
  return parent.childSessionIDs.map((childID) => sessions.get(childID)).filter((session) => session !== void 0);
}
function updateSessionTitle(id, title) {
  const session = sessions.get(id);
  if (session) {
    session.title = title;
  }
}

// src/formatter.ts
function formatSession(title, createdAt, messages, childSessions) {
  const lines = [];
  lines.push(`# Session: ${title}`);
  lines.push("");
  lines.push(`**Created:** ${formatTimestamp(createdAt)}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Conversation");
  lines.push("");
  for (const message of messages) {
    lines.push(formatMessage(message));
    lines.push("");
  }
  if (childSessions.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Child Sessions");
    lines.push("");
    for (const child of childSessions) {
      lines.push(formatChildSession(child));
      lines.push("");
    }
  }
  return lines.join("\n");
}
function formatMessage(message) {
  const lines = [];
  const roleEmoji = message.role === "user" ? "\u{1F464}" : "\u{1F916}";
  const roleLabel = message.role === "user" ? "User" : "Assistant";
  lines.push(`### ${roleEmoji} ${roleLabel}`);
  lines.push(`*${formatTimestamp(new Date(message.createdAt))}*`);
  lines.push("");
  for (const part of message.parts) {
    const formattedPart = formatPart(part);
    if (formattedPart) {
      lines.push(formattedPart);
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}
function formatPart(part) {
  if (part.type === "text" && "text" in part) {
    return formatTextPart(part);
  }
  if (part.type === "tool" && "tool" in part && "state" in part) {
    return formatToolPart(part);
  }
  if (part.type === "file" && "url" in part && "mime" in part) {
    return formatFilePart(part);
  }
  if (part.type === "reasoning" && "text" in part) {
    return formatReasoningPart(part);
  }
  return `*[${part.type} part]*`;
}
function formatTextPart(part) {
  return part.text;
}
function formatToolPart(part) {
  const lines = [];
  const { tool, state } = part;
  lines.push(`#### \u{1F527} Tool: ${tool}`);
  lines.push(`**Status:** ${state.status}`);
  if (state.title) {
    lines.push(`**Title:** ${state.title}`);
  }
  if (state.input && Object.keys(state.input).length > 0) {
    lines.push("");
    lines.push("**Input:**");
    lines.push("```json");
    lines.push(JSON.stringify(state.input, null, 2));
    lines.push("```");
  }
  if (state.output) {
    lines.push("");
    lines.push("**Output:**");
    lines.push("```");
    lines.push(state.output);
    lines.push("```");
  }
  if (state.error) {
    lines.push("");
    lines.push("**Error:**");
    lines.push("```");
    lines.push(state.error);
    lines.push("```");
  }
  return lines.join("\n");
}
function formatFilePart(part) {
  const filename = part.filename || "unnamed";
  if (part.localPath && part.mime.startsWith("image/")) {
    return `![${filename}](${part.localPath})`;
  }
  const lines = [];
  lines.push(`\u{1F4C1} **File:** ${filename}`);
  lines.push(`- MIME: ${part.mime}`);
  if (!part.url.startsWith("data:")) {
    lines.push(`- URL: ${part.url}`);
  }
  return lines.join("\n");
}
function formatReasoningPart(part) {
  const lines = [];
  lines.push("\u{1F4AD} **Reasoning:**");
  lines.push("");
  lines.push("<details>");
  lines.push("<summary>Click to expand reasoning</summary>");
  lines.push("");
  lines.push(part.text);
  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}
function formatChildSession(child) {
  const lines = [];
  lines.push(`### \u{1F4E6} Subagent: ${child.title}`);
  lines.push(`*Started: ${formatTimestamp(child.createdAt)}*`);
  lines.push("");
  for (const message of child.messages) {
    const roleEmoji = message.role === "user" ? "\u{1F464}" : "\u{1F916}";
    const roleLabel = message.role === "user" ? "User" : "Assistant";
    lines.push(`#### ${roleEmoji} ${roleLabel}`);
    lines.push(`*${formatTimestamp(new Date(message.createdAt))}*`);
    lines.push("");
    for (const part of message.parts) {
      const formattedPart = formatPart(part);
      if (formattedPart) {
        lines.push(formattedPart);
        lines.push("");
      }
    }
  }
  return lines.join("\n").trim();
}
function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function extractTopicFromMessage(messageText, maxLength) {
  const cleaned = messageText.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned || "untitled";
  }
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) {
    return truncated.substring(0, lastSpace);
  }
  return truncated;
}

// src/index.ts
var debounceTimers = /* @__PURE__ */ new Map();
var plugin = async (input) => {
  try {
    const { client, directory } = input;
    const typedClient = client;
    const saveDir = await ensureDirectory(directory, DEFAULT_CONFIG);
    let globalSaveDir = null;
    const globalPath = getGlobalSaveDirectory(directory);
    if (globalPath) {
      globalSaveDir = await ensureGlobalDirectory(globalPath);
    }
    const hooks = {
      event: async ({ event }) => {
        try {
          await handleEvent(event, typedClient, directory, saveDir, globalSaveDir);
        } catch {
        }
      }
    };
    return hooks;
  } catch {
    return {};
  }
};
async function handleEvent(event, client, directory, saveDir, globalSaveDir) {
  switch (event.type) {
    case "session.created":
      handleSessionCreated(event);
      break;
    case "session.updated":
      handleSessionUpdated(event);
      break;
    case "session.idle":
      handleSessionIdle(event, client, directory, saveDir, globalSaveDir);
      break;
    case "session.deleted":
      await handleSessionDeleted(
        event,
        client,
        directory,
        saveDir,
        globalSaveDir
      );
      break;
  }
}
function handleSessionCreated(event) {
  const { info } = event.properties;
  if (!info?.id) return;
  if (!info.parentID) {
    createSession(info.id, info.title || "", "");
  } else {
    createSession(info.id, info.title || "Subagent", "", info.parentID);
  }
}
function handleSessionUpdated(event) {
  const { info } = event.properties;
  if (!info?.id) return;
  if (info.title) {
    updateSessionTitle(info.id, info.title);
  }
}
function handleSessionIdle(event, client, directory, saveDir, globalSaveDir) {
  const { sessionID } = event.properties;
  if (!sessionID) return;
  const existing = debounceTimers.get(sessionID);
  if (existing) {
    clearTimeout(existing);
  }
  debounceTimers.set(
    sessionID,
    setTimeout(() => {
      void saveSessionToFile(sessionID, client, directory, saveDir, globalSaveDir);
      debounceTimers.delete(sessionID);
    }, DEFAULT_CONFIG.debounceMs)
  );
}
async function handleSessionDeleted(event, client, directory, saveDir, globalSaveDir) {
  const { info } = event.properties;
  if (!info?.id) return;
  const timer = debounceTimers.get(info.id);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(info.id);
  }
  await saveSessionToFile(info.id, client, directory, saveDir, globalSaveDir);
  deleteSession(info.id);
}
async function saveSessionToFile(sessionID, client, directory, saveDir, globalSaveDir) {
  try {
    const session = getSession(sessionID);
    if (!session) return;
    if (session.parentID) {
      const parent = getSession(session.parentID);
      if (parent) {
        await saveSessionToFile(session.parentID, client, directory, saveDir, globalSaveDir);
      }
      return;
    }
    const response = await client.session.messages({
      path: { id: sessionID },
      query: { directory }
    });
    const rawMessages = response.data || [];
    const messages = await convertMessages(rawMessages);
    if (messages.length === 0) {
      return;
    }
    let title = session.title;
    if (!title || title.startsWith("New-session-") || title.startsWith("New session")) {
      const firstUserMessage = messages.find((m) => m.role === "user");
      if (firstUserMessage) {
        const firstTextPart = firstUserMessage.parts.find(
          (p) => p.type === "text" && "text" in p
        );
        if (firstTextPart) {
          title = extractTopicFromMessage(
            firstTextPart.text,
            DEFAULT_CONFIG.maxTopicLength
          );
          updateSessionTitle(sessionID, title);
        }
      }
    }
    if (!session.filePath) {
      const filename = generateFilename(title || "untitled", session.createdAt, DEFAULT_CONFIG);
      session.filePath = join(saveDir, filename);
    }
    const children = getChildSessions(sessionID);
    const childData = await Promise.all(
      children.map(async (child) => {
        const childResponse = await client.session.messages({
          path: { id: child.id },
          query: { directory }
        });
        const childMessages = await convertMessages(childResponse.data || []);
        return {
          title: child.title,
          createdAt: child.createdAt,
          messages: childMessages
        };
      })
    );
    await processImagesInMessages(messages, session.filePath, title, session.createdAt, globalSaveDir);
    for (const child of childData) {
      await processImagesInMessages(child.messages, session.filePath, title, session.createdAt, globalSaveDir);
    }
    const content = formatSession(
      title,
      session.createdAt,
      messages,
      childData
    );
    await writeSessionFile(session.filePath, content);
    if (globalSaveDir) {
      await writeToSecondaryLocation(session.filePath, globalSaveDir, content);
    }
  } catch (error) {
    console.error(`[autosave] Error saving session ${sessionID}:`, error);
  }
}
async function convertMessages(rawMessages) {
  return rawMessages.map((msg) => {
    const rawParts = msg.parts || [];
    return {
      id: msg.id,
      role: msg.role,
      parts: rawParts.map(convertPart),
      createdAt: msg.time?.created || Date.now()
    };
  });
}
async function processImagesInMessages(messages, mdFilePath, sessionTitle, createdAt, globalSaveDir) {
  let imageIndex = 0;
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "file" && "url" in part && "mime" in part) {
        const filePart = part;
        if (filePart.mime.startsWith("image/") && isBase64ImageUrl(filePart.url)) {
          const localPath = await saveImageFromBase64(filePart.url, mdFilePath, sessionTitle, createdAt, imageIndex);
          if (localPath) {
            filePart.localPath = localPath;
            if (globalSaveDir) {
              await saveImageToSecondaryLocation(filePart.url, globalSaveDir, sessionTitle, createdAt, imageIndex);
            }
            imageIndex++;
          }
        }
      }
    }
  }
}
function convertPart(raw) {
  switch (raw.type) {
    case "text":
      return { type: "text", text: raw.text || "" };
    case "tool":
      return {
        type: "tool",
        tool: raw.tool || "unknown",
        state: {
          status: raw.state?.status || "unknown",
          input: raw.state?.input,
          output: raw.state?.output,
          title: raw.state?.title,
          error: raw.state?.error
        }
      };
    case "file":
      return {
        type: "file",
        filename: raw.filename,
        url: raw.url || "",
        mime: raw.mime || "application/octet-stream"
      };
    case "reasoning":
      return { type: "reasoning", text: raw.text || "" };
    default:
      return { type: raw.type };
  }
}
var index_default = plugin;

export { index_default as default };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map