/**
 * Fixed, mode-specific concept prompts.
 * Only a filtered visitor note is appended. Street View pixels are never accepted.
 */
import { filterNote } from "./policy.js";

const KEEP = "Keep the camera, perspective, lighting, surroundings, and every element that was not selected for change. Do not add people, logos, or text. Produce one concept image. It is not a design, bid, or permit document.";

function line(label, value) {
  return value ? `${label}: ${value}` : "";
}

export function buildPrompt(mode, options = {}, userNote = "") {
  const note = filterNote(userNote, mode === "addition" ? 140 : 140);
  const parts = [KEEP];
  if (mode === "addition") {
    parts.push("Change only the exterior massing of this house photo.");
    parts.push(line("Addition", options.additionType));
    parts.push(line("Style", options.additionStyle));
    parts.push(line("Roof", options.roof));
  } else if (mode === "kitchen") {
    parts.push("Change only the kitchen finishes and, if selected, the layout described below. Keep the camera.");
    parts.push(line("Scope", options.kitchenScope));
    parts.push(line("Style", options.kitchenStyle));
    parts.push(line("Color direction", options.color));
    if (options.kitchenScope === "layout-change") {
      parts.push("The layout change may involve structure, plumbing, electrical, and permits. Show a concept only.");
    }
  } else if (mode === "bathroom") {
    parts.push("Change only the bathroom as described. Keep the camera and the room shell except where the scope requires it.");
    parts.push(line("Scope", options.bathScope));
    parts.push(line("Style", options.bathStyle));
    parts.push(line("Color direction", options.color));
  } else {
    parts.push("Refuse this request. The mode is not one of addition, kitchen, or bathroom.");
  }
  if (note.ok && note.text) parts.push("Visitor note: " + note.text);
  return {
    prompt: parts.filter(Boolean).join("\n"),
    noteRefused: Boolean(note.refused),
  };
}

/**
 * Provider request body. The only image part is the visitor upload.
 * A streetView field on options is ignored and must not appear in the body.
 */
export function buildModelRequest(selection, prompt, imageBytes) {
  const image = { mimeType: "image/jpeg", byteLength: imageBytes?.byteLength || imageBytes?.length || 0 };
  if (selection.provider === "openai") {
    return {
      provider: "openai",
      url: "https://api.openai.com/v1/images/edits",
      model: selection.model,
      prompt,
      images: [image],
    };
  }
  return {
    provider: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/models/" + selection.model + ":generateContent",
    model: selection.model,
    body: {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: image },
          ],
        },
      ],
    },
  };
}
