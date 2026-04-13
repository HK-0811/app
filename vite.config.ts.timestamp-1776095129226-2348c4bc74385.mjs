// vite.config.ts
import { defineConfig } from "file:///X:/codex/fashion_spin/node_modules/vite/dist/node/index.js";
import react from "file:///X:/codex/fashion_spin/node_modules/@vitejs/plugin-react/dist/index.js";

// vite-express-plugin.ts
import cors from "file:///X:/codex/fashion_spin/node_modules/cors/lib/index.js";
import express from "file:///X:/codex/fashion_spin/node_modules/express/index.js";
import fs4 from "fs";
import multer from "file:///X:/codex/fashion_spin/node_modules/multer/index.js";
import path5 from "path";

// server/lib/loadEnv.ts
import fs from "fs";
import path from "path";
function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
function loadLocalEnv(projectRoot) {
  applyEnvFile(path.join(projectRoot, ".env"));
  applyEnvFile(path.join(projectRoot, ".env.local"));
}

// server/lib/missionPipeline.ts
import path4 from "path";

// server/lib/catalog.ts
import fs2 from "fs";
import path2 from "path";
function resolveWardrobeItems(ids, wardrobe) {
  return ids.map((id) => wardrobe.find((item) => item.id === id)).filter((item) => Boolean(item));
}
function toDataUrlFromFile(filePath) {
  const buffer = fs2.readFileSync(filePath);
  const extension = path2.extname(filePath).slice(1) || "png";
  return `data:image/${extension};base64,${buffer.toString("base64")}`;
}
function writeImageDataUrl(outputPath, dataUrl) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Unsupported image payload received from image generation provider.");
  }
  fs2.mkdirSync(path2.dirname(outputPath), { recursive: true });
  fs2.writeFileSync(outputPath, Buffer.from(match[2], "base64"));
}

// server/lib/openRouter.ts
function getOpenRouterHeaders() {
  return {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    ...process.env.OPENROUTER_SITE_URL ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL } : {},
    ...process.env.OPENROUTER_APP_NAME ? { "X-Title": process.env.OPENROUTER_APP_NAME } : {}
  };
}
function summarizeWardrobe(wardrobe) {
  return wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    garmentType: item.garmentType,
    style: item.style,
    colors: item.colors,
    designDetails: item.designDetails,
    sourceImageFile: item.sourceImageFile
  }));
}
function fallbackSelection(missionText, wardrobe) {
  const text = missionText.toLowerCase();
  const selected = wardrobe.find(
    (item) => /date|dinner|night|evening/.test(text) && item.colors.includes("maroon")
  ) ?? wardrobe.find(
    (item) => /shaadi|wedding|festive/.test(text) && item.colors.includes("mustard")
  ) ?? wardrobe.find(
    (item) => /college|casual|day/.test(text) && item.colors.includes("light")
  ) ?? wardrobe[0];
  if (!selected) {
    throw new Error("Wardrobe is empty.");
  }
  return {
    selectedItems: [selected.id],
    explanation: `Picked ${selected.name} from the wardrobe for "${missionText}".`,
    generationPrompt: `Dress the base character in the exact garment shown in the reference image for ${selected.name}. Keep the face, pose, and body proportions unchanged, and make the result look like a polished fashion portrait.`
  };
}
function parseDecision(content, wardrobe) {
  const parsed = JSON.parse(content);
  if (typeof parsed.selectedItemId !== "string" || typeof parsed.explanation !== "string" || typeof parsed.generationPrompt !== "string") {
    throw new Error("OpenRouter did not return the expected JSON shape.");
  }
  if (!wardrobe.some((item) => item.id === parsed.selectedItemId)) {
    throw new Error("OpenRouter selected a garment id outside the wardrobe.");
  }
  return {
    selectedItems: [parsed.selectedItemId],
    explanation: parsed.explanation,
    generationPrompt: parsed.generationPrompt
  };
}
async function selectOutfitWithOpenRouter(missionText, wardrobe) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("[OpenRouter] OPENROUTER_API_KEY missing; using local fallback selection.");
    return fallbackSelection(missionText, wardrobe);
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify({
      model: process.env.OPENROUTER_SELECTOR_MODEL ?? "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are a fashion stylist selecting one exact garment image from a local wardrobe. Return JSON only with keys selectedItemId, explanation, and generationPrompt. selectedItemId must match one id from the wardrobe list exactly."
        },
        {
          role: "user",
          content: JSON.stringify({
            missionText,
            wardrobe: summarizeWardrobe(wardrobe)
          })
        }
      ]
    })
  });
  if (!response.ok) {
    return fallbackSelection(missionText, wardrobe);
  }
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) {
    return fallbackSelection(missionText, wardrobe);
  }
  try {
    return parseDecision(content, wardrobe);
  } catch {
    return fallbackSelection(missionText, wardrobe);
  }
}
async function generateLookWithOpenRouter(missionText, selectedItem, generationPrompt, baseImagePath) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("[OpenRouter] OPENROUTER_API_KEY missing; using base image fallback.");
    return null;
  }
  if (!selectedItem.localImagePath) {
    throw new Error("Selected wardrobe item is missing a local image path.");
  }
  const model = process.env.OPENROUTER_IMAGE_MODEL ?? "google/gemini-3.1-flash-image-preview";
  const requestBody = {
    model,
    modalities: ["image", "text"],
    image_config: {
      aspect_ratio: "9:16"
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${generationPrompt} Match the mission "${missionText}". Preserve the model identity from the first image. Use the second image as the clothing reference only. Keep realistic fabric, folds, and outfit fit. Return one polished portrait image.`
          },
          {
            type: "image_url",
            image_url: {
              url: toDataUrlFromFile(baseImagePath)
            }
          },
          {
            type: "image_url",
            image_url: {
              url: toDataUrlFromFile(selectedItem.localImagePath)
            }
          }
        ]
      }
    ]
  };
  console.log(`[OpenRouter] Generating image with model: ${model}`);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: getOpenRouterHeaders(),
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OpenRouter] Image generation failed (${response.status}): ${errorText}`);
    return null;
  }
  const result = await response.json();
  return result.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
}

// server/lib/wardrobeCatalog.ts
import fs3 from "fs";
import path3 from "path";
var imageExtensions = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".webp"]);
var folderCategoryMap = {
  kurtas: "top",
  tshirts: "top",
  bottoms: "bottom",
  shoes: "shoes"
};
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function stripExtension(fileName) {
  return path3.parse(fileName).name;
}
function readMetadata(wardrobeRoot2) {
  const metadataPath = path3.join(wardrobeRoot2, "clothing_metadata.json");
  if (!fs3.existsSync(metadataPath)) {
    return /* @__PURE__ */ new Map();
  }
  const document = JSON.parse(
    fs3.readFileSync(metadataPath, "utf-8")
  );
  return new Map(
    document.clothing_metadata.map((entry) => [
      stripExtension(entry.image_file),
      entry
    ])
  );
}
function collectWardrobeImages(root) {
  const images = [];
  function walk(currentPath) {
    const entries = fs3.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path3.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!imageExtensions.has(path3.extname(entry.name).toLowerCase())) {
        continue;
      }
      if (stripExtension(entry.name) === "base_img") {
        continue;
      }
      images.push(fullPath);
    }
  }
  walk(root);
  return images;
}
function parseColorTokens(value) {
  return Array.from(
    new Set(
      value.toLowerCase().replace(/[()]/g, "").split(/[^a-z]+/).filter(Boolean)
    )
  );
}
function inferDisplayName(metadata, fileStem) {
  if (!metadata) {
    return fileStem.replace(/[-_]+/g, " ");
  }
  if (metadata.garment_type.toLowerCase() === "kurta set") {
    const primaryColor = metadata.kurta_color.toLowerCase().includes("maroon") ? "Brown" : metadata.kurta_color.split(/[\s,(]/)[0];
    return `${primaryColor} Kurta`;
  }
  return metadata.garment_type;
}
function buildStyleTags(metadata, folderName) {
  const tags = [folderName];
  if (!metadata) {
    return tags;
  }
  tags.push(slugify(metadata.garment_type));
  tags.push(slugify(metadata.style));
  parseColorTokens(metadata.kurta_color).forEach((token) => tags.push(token));
  parseColorTokens(metadata.bottom_color).forEach((token) => tags.push(token));
  return Array.from(new Set(tags.filter(Boolean)));
}
function loadWardrobeCatalog(wardrobeRoot2) {
  const metadataByStem = readMetadata(wardrobeRoot2);
  return collectWardrobeImages(wardrobeRoot2).map((fullPath) => {
    const relativePath = path3.relative(wardrobeRoot2, fullPath).replace(/\\/g, "/");
    const folderName = relativePath.split("/")[0] ?? "wardrobe";
    const fileStem = stripExtension(path3.basename(fullPath));
    const metadata = metadataByStem.get(fileStem);
    return {
      id: fileStem,
      name: inferDisplayName(metadata, fileStem),
      category: folderCategoryMap[folderName] ?? "top",
      imagePath: `/wardrobe-assets/${relativePath}`,
      localImagePath: fullPath,
      sourceImageFile: path3.basename(fullPath),
      colors: metadata ? Array.from(
        /* @__PURE__ */ new Set([
          ...parseColorTokens(metadata.kurta_color),
          ...parseColorTokens(metadata.bottom_color)
        ])
      ) : [],
      styleTags: buildStyleTags(metadata, folderName),
      layerRole: "base",
      garmentType: metadata?.garment_type,
      style: metadata?.style,
      bottomColor: metadata?.bottom_color,
      designDetails: metadata?.design_details
    };
  });
}
function getBaseImagePath(wardrobeRoot2) {
  return path3.join(wardrobeRoot2, "base_img.png");
}

// server/lib/missionPipeline.ts
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function setStage(mission, stage) {
  mission.stage = stage;
  mission.stageTimings[stage] = Date.now();
}
async function runMissionPipeline({
  mission,
  wardrobe,
  publicRoot: publicRoot2,
  wardrobeRoot: wardrobeRoot2
}) {
  try {
    setStage(mission, "planning");
    await sleep(250);
    setStage(mission, "selecting");
    const decision = await selectOutfitWithOpenRouter(mission.missionText, wardrobe);
    mission.selectedItems = decision.selectedItems;
    mission.explanation = decision.explanation;
    await sleep(250);
    setStage(mission, "rendering");
    const selectedGarments = resolveWardrobeItems(mission.selectedItems, wardrobe);
    const selectedGarment = selectedGarments[0];
    if (!selectedGarment) {
      throw new Error("No wardrobe item was selected for image generation.");
    }
    const generatedImage = await generateLookWithOpenRouter(
      mission.missionText,
      selectedGarment,
      decision.generationPrompt ?? `Dress the character in ${selectedGarment.name}.`,
      getBaseImagePath(wardrobeRoot2)
    );
    if (generatedImage) {
      const outputPath = path4.join(publicRoot2, "generated", `${mission.id}.png`);
      writeImageDataUrl(outputPath, generatedImage);
      mission.finalImageUrl = `/generated/${mission.id}.png`;
    } else {
      mission.finalImageUrl = "/wardrobe-assets/base_img.png";
    }
    setStage(mission, "done");
  } catch (error) {
    console.error("[MissionPipeline] Error:", error);
    mission.stage = "error";
    mission.error = error instanceof Error ? error.message : "Mission pipeline failed.";
  }
}

// vite-express-plugin.ts
var publicRoot = path5.resolve("public");
var wardrobeRoot = path5.resolve("wardrobe");
fs4.mkdirSync(path5.join(publicRoot, "generated"), { recursive: true });
function expressPlugin() {
  return {
    name: "express-plugin",
    configureServer(server) {
      const app = express();
      const upload = multer({ storage: multer.memoryStorage() });
      loadLocalEnv(process.cwd());
      app.use(cors());
      app.use(express.json());
      app.use("/generated", express.static(path5.join(publicRoot, "generated")));
      app.use("/wardrobe-assets", express.static(wardrobeRoot));
      const missions = /* @__PURE__ */ new Map();
      function generateId() {
        return Math.random().toString(36).slice(2, 10);
      }
      app.get("/api/wardrobe", (_req, res) => {
        res.json(loadWardrobeCatalog(wardrobeRoot));
      });
      app.post("/api/missions", upload.single("audio"), (req, res) => {
        const missionText = typeof req.body.text === "string" ? req.body.text.trim() : "";
        if (!missionText) {
          res.status(400).json({ error: "Provide text to start the mission." });
          return;
        }
        const id = generateId();
        const mission = {
          id,
          stage: "idle",
          missionText,
          selectedItems: [],
          explanation: "",
          finalImageUrl: null,
          error: null,
          stageTimings: {}
        };
        missions.set(id, mission);
        void runMissionPipeline({
          mission,
          wardrobe: loadWardrobeCatalog(wardrobeRoot),
          publicRoot,
          wardrobeRoot
        });
        res.json({ id, stage: "planning" });
      });
      app.get("/api/missions/:id", (req, res) => {
        const mission = missions.get(req.params.id);
        if (!mission) {
          res.status(404).json({ error: "Mission not found" });
          return;
        }
        res.json(mission);
      });
      app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
        const audioFile = req.file;
        if (!audioFile) {
          res.status(400).json({ error: "No audio file provided" });
          return;
        }
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
          return;
        }
        try {
          const audioBuffer = audioFile.buffer;
          const audioBase64 = Buffer.from(audioBuffer).toString("base64");
          console.log("[Transcribe] Sending request to OpenRouter, audio size:", audioBuffer.length);
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:5173",
              "X-Title": process.env.OPENROUTER_APP_NAME ?? "FashionSpin"
            },
            body: JSON.stringify({
              model: "openai/gpt-4o-audio-preview",
              modalities: ["text"],
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Transcribe this audio exactly as spoken."
                    },
                    {
                      type: "input_audio",
                      input_audio: {
                        data: audioBase64,
                        format: "wav"
                      }
                    }
                  ]
                }
              ]
            })
          });
          const responseText = await response.text();
          console.log("[Transcribe] Response status:", response.status);
          if (!response.ok) {
            console.error("[Transcribe] OpenRouter error:", responseText);
            res.status(500).json({ error: `Failed to transcribe audio: ${responseText.slice(0, 200)}` });
            return;
          }
          let result;
          try {
            result = JSON.parse(responseText);
          } catch {
            console.error("[Transcribe] Invalid JSON:", responseText);
            res.status(500).json({ error: "Invalid response from transcription service" });
            return;
          }
          let text = "";
          const messageContent = result?.choices?.[0]?.message?.content;
          if (typeof messageContent === "string") {
            text = messageContent;
          } else if (Array.isArray(messageContent)) {
            text = messageContent.filter((c) => typeof c === "object" && c !== null && "type" in c && c.type === "text").map((c) => c.text).join("");
          }
          console.log("[Transcribe] Got text:", text || "(empty)");
          res.json({ text });
        } catch (err) {
          console.error("[Transcribe] Exception:", err);
          res.status(500).json({ error: "Failed to transcribe audio" });
        }
      });
      app.post("/api/wardrobe/detect", upload.single("image"), async (req, res) => {
        const imageFile = req.file;
        if (!imageFile) {
          res.status(400).json({ error: "No image file provided" });
          return;
        }
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
          return;
        }
        try {
          const imageBuffer = imageFile.buffer;
          const imageBase64 = Buffer.from(imageBuffer).toString("base64");
          const mimeType = imageFile.mimetype || "image/jpeg";
          const dataUrl = `data:${mimeType};base64,${imageBase64}`;
          console.log("[Wardrobe Detect] Sending image to AI for detection");
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:5173",
              "X-Title": process.env.OPENROUTER_APP_NAME ?? "FashionSpin"
            },
            body: JSON.stringify({
              model: "openai/gpt-4o",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: "You are a fashion expert. Analyze the clothing image and return a JSON object with exactly these fields: garment_type (like Kurta, T-shirt, Jeans, Sherwani), style (specific style description), color (main color(s)), design_details (notable design elements). Return ONLY valid JSON, no markdown."
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyze this clothing image and describe it with JSON with keys: garment_type, style, color, design_details. Return ONLY valid JSON, no markdown or code blocks."
                    },
                    {
                      type: "image_url",
                      image_url: { url: dataUrl }
                    }
                  ]
                }
              ],
              temperature: 0.2
            })
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error("[Wardrobe Detect] OpenRouter error:", errorText);
            res.status(500).json({ error: "Failed to detect clothing metadata" });
            return;
          }
          const result = await response.json();
          const content = result?.choices?.[0]?.message?.content ?? "{}";
          let cleanContent = content.trim();
          if (cleanContent.startsWith("```")) {
            const jsonMatch = cleanContent.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
              cleanContent = jsonMatch[1].trim();
            } else {
              cleanContent = cleanContent.replace(/```[\s\S]*?```/, "").trim();
            }
          }
          let metadata;
          try {
            metadata = JSON.parse(cleanContent);
          } catch {
            console.error("[Wardrobe Detect] Parse failed, content:", cleanContent.slice(0, 200));
            metadata = {
              garment_type: "Unknown",
              style: "Unknown",
              color: "Unknown",
              design_details: cleanContent.slice(0, 100)
            };
          }
          console.log("[Wardrobe Detect] Detected:", metadata);
          res.json({ metadata, image: dataUrl });
        } catch (err) {
          console.error("[Wardrobe Detect] Exception:", err);
          res.status(500).json({ error: "Failed to detect clothing metadata" });
        }
      });
      app.post("/api/wardrobe/save", async (req, res) => {
        const { metadata, fileName } = req.body;
        if (!metadata) {
          res.status(400).json({ error: "Missing metadata" });
          return;
        }
        try {
          const metadataPath = path5.join(wardrobeRoot, "clothing_metadata.json");
          let existingData = { clothing_metadata: [] };
          if (fs4.existsSync(metadataPath)) {
            existingData = JSON.parse(fs4.readFileSync(metadataPath, "utf-8"));
          }
          const baseFileName = typeof fileName === "string" && fileName ? fileName.replace(/\.[^/.]+$/, "") : `user_${Date.now()}`;
          const newEntry = {
            image_file: `${baseFileName}.jpg`,
            garment_type: metadata.garment_type || "Unknown",
            style: metadata.style || "Unknown",
            kurta_color: metadata.color || "Unknown",
            bottom_color: "Unknown",
            design_details: metadata.design_details || ""
          };
          existingData.clothing_metadata.push(newEntry);
          fs4.writeFileSync(metadataPath, JSON.stringify(existingData, null, 2));
          console.log("[Wardrobe Save] Added:", newEntry);
          res.json({ success: true, entry: newEntry });
        } catch (err) {
          console.error("[Wardrobe Save] Error:", err);
          res.status(500).json({ error: "Failed to save metadata" });
        }
      });
      server.middlewares.use(app);
    }
  };
}

// vite.config.ts
var vite_config_default = defineConfig({
  plugins: [react(), expressPlugin()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    globals: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidml0ZS1leHByZXNzLXBsdWdpbi50cyIsICJzZXJ2ZXIvbGliL2xvYWRFbnYudHMiLCAic2VydmVyL2xpYi9taXNzaW9uUGlwZWxpbmUudHMiLCAic2VydmVyL2xpYi9jYXRhbG9nLnRzIiwgInNlcnZlci9saWIvb3BlblJvdXRlci50cyIsICJzZXJ2ZXIvbGliL3dhcmRyb2JlQ2F0YWxvZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9YOi9jb2RleC9mYXNoaW9uX3NwaW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgZXhwcmVzc1BsdWdpbiB9IGZyb20gJy4vdml0ZS1leHByZXNzLXBsdWdpbidcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIGV4cHJlc3NQbHVnaW4oKV0sXG4gIHRlc3Q6IHtcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBzZXR1cEZpbGVzOiAnLi90ZXN0cy9zZXR1cC50cycsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgfSxcbn0pXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHZpdGUtZXhwcmVzcy1wbHVnaW4udHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1g6L2NvZGV4L2Zhc2hpb25fc3Bpbi92aXRlLWV4cHJlc3MtcGx1Z2luLnRzXCI7aW1wb3J0IHR5cGUgeyBWaXRlRGV2U2VydmVyIH0gZnJvbSAndml0ZSdcbmltcG9ydCBjb3JzIGZyb20gJ2NvcnMnXG5pbXBvcnQgZXhwcmVzcyBmcm9tICdleHByZXNzJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IG11bHRlciBmcm9tICdtdWx0ZXInXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgbG9hZExvY2FsRW52IH0gZnJvbSAnLi9zZXJ2ZXIvbGliL2xvYWRFbnYnXG5pbXBvcnQgeyBydW5NaXNzaW9uUGlwZWxpbmUgfSBmcm9tICcuL3NlcnZlci9saWIvbWlzc2lvblBpcGVsaW5lJ1xuaW1wb3J0IHR5cGUgeyBNaXNzaW9uUmVzdWx0IH0gZnJvbSAnLi9zZXJ2ZXIvbGliL3R5cGVzJ1xuaW1wb3J0IHsgbG9hZFdhcmRyb2JlQ2F0YWxvZyB9IGZyb20gJy4vc2VydmVyL2xpYi93YXJkcm9iZUNhdGFsb2cnXG5cbmNvbnN0IHB1YmxpY1Jvb3QgPSBwYXRoLnJlc29sdmUoJ3B1YmxpYycpXG5jb25zdCB3YXJkcm9iZVJvb3QgPSBwYXRoLnJlc29sdmUoJ3dhcmRyb2JlJylcblxuZnMubWtkaXJTeW5jKHBhdGguam9pbihwdWJsaWNSb290LCAnZ2VuZXJhdGVkJyksIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG5cbmV4cG9ydCBmdW5jdGlvbiBleHByZXNzUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdleHByZXNzLXBsdWdpbicsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcjogVml0ZURldlNlcnZlcikge1xuICAgICAgY29uc3QgYXBwID0gZXhwcmVzcygpXG4gICAgICBjb25zdCB1cGxvYWQgPSBtdWx0ZXIoeyBzdG9yYWdlOiBtdWx0ZXIubWVtb3J5U3RvcmFnZSgpIH0pXG4gICAgICBsb2FkTG9jYWxFbnYocHJvY2Vzcy5jd2QoKSlcblxuICAgICAgYXBwLnVzZShjb3JzKCkpXG4gICAgICBhcHAudXNlKGV4cHJlc3MuanNvbigpKVxuICAgICAgYXBwLnVzZSgnL2dlbmVyYXRlZCcsIGV4cHJlc3Muc3RhdGljKHBhdGguam9pbihwdWJsaWNSb290LCAnZ2VuZXJhdGVkJykpKVxuICAgICAgYXBwLnVzZSgnL3dhcmRyb2JlLWFzc2V0cycsIGV4cHJlc3Muc3RhdGljKHdhcmRyb2JlUm9vdCkpXG5cbiAgICAgIGNvbnN0IG1pc3Npb25zID0gbmV3IE1hcDxzdHJpbmcsIE1pc3Npb25SZXN1bHQ+KClcblxuICAgICAgZnVuY3Rpb24gZ2VuZXJhdGVJZCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgMTApXG4gICAgICB9XG5cbiAgICAgIGFwcC5nZXQoJy9hcGkvd2FyZHJvYmUnLCAoX3JlcSwgcmVzKSA9PiB7XG4gICAgICAgIHJlcy5qc29uKGxvYWRXYXJkcm9iZUNhdGFsb2cod2FyZHJvYmVSb290KSlcbiAgICAgIH0pXG5cbiAgICAgIGFwcC5wb3N0KCcvYXBpL21pc3Npb25zJywgdXBsb2FkLnNpbmdsZSgnYXVkaW8nKSwgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGNvbnN0IG1pc3Npb25UZXh0ID1cbiAgICAgICAgICB0eXBlb2YgcmVxLmJvZHkudGV4dCA9PT0gJ3N0cmluZycgPyByZXEuYm9keS50ZXh0LnRyaW0oKSA6ICcnXG5cbiAgICAgICAgaWYgKCFtaXNzaW9uVGV4dCkge1xuICAgICAgICAgIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdQcm92aWRlIHRleHQgdG8gc3RhcnQgdGhlIG1pc3Npb24uJyB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKClcbiAgICAgICAgY29uc3QgbWlzc2lvbjogTWlzc2lvblJlc3VsdCA9IHtcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBzdGFnZTogJ2lkbGUnLFxuICAgICAgICAgIG1pc3Npb25UZXh0LFxuICAgICAgICAgIHNlbGVjdGVkSXRlbXM6IFtdLFxuICAgICAgICAgIGV4cGxhbmF0aW9uOiAnJyxcbiAgICAgICAgICBmaW5hbEltYWdlVXJsOiBudWxsLFxuICAgICAgICAgIGVycm9yOiBudWxsLFxuICAgICAgICAgIHN0YWdlVGltaW5nczoge30sXG4gICAgICAgIH1cblxuICAgICAgICBtaXNzaW9ucy5zZXQoaWQsIG1pc3Npb24pXG5cbiAgICAgICAgdm9pZCBydW5NaXNzaW9uUGlwZWxpbmUoe1xuICAgICAgICAgIG1pc3Npb24sXG4gICAgICAgICAgd2FyZHJvYmU6IGxvYWRXYXJkcm9iZUNhdGFsb2cod2FyZHJvYmVSb290KSxcbiAgICAgICAgICBwdWJsaWNSb290LFxuICAgICAgICAgIHdhcmRyb2JlUm9vdCxcbiAgICAgICAgfSlcblxuICAgICAgICByZXMuanNvbih7IGlkLCBzdGFnZTogJ3BsYW5uaW5nJyB9KVxuICAgICAgfSlcblxuICAgICAgYXBwLmdldCgnL2FwaS9taXNzaW9ucy86aWQnLCAocmVxLCByZXMpID0+IHtcbiAgICAgICAgY29uc3QgbWlzc2lvbiA9IG1pc3Npb25zLmdldChyZXEucGFyYW1zLmlkKVxuXG4gICAgICAgIGlmICghbWlzc2lvbikge1xuICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdNaXNzaW9uIG5vdCBmb3VuZCcgfSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHJlcy5qc29uKG1pc3Npb24pXG4gICAgICB9KVxuXG4gICAgICBhcHAucG9zdCgnL2FwaS90cmFuc2NyaWJlJywgdXBsb2FkLnNpbmdsZSgnYXVkaW8nKSwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGNvbnN0IGF1ZGlvRmlsZSA9IHJlcS5maWxlXG4gICAgICAgIGlmICghYXVkaW9GaWxlKSB7XG4gICAgICAgICAgcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ05vIGF1ZGlvIGZpbGUgcHJvdmlkZWQnIH0pXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQSV9LRVlcbiAgICAgICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnT1BFTlJPVVRFUl9BUElfS0VZIG5vdCBjb25maWd1cmVkJyB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBhdWRpb0J1ZmZlciA9IGF1ZGlvRmlsZS5idWZmZXJcbiAgICAgICAgICBjb25zdCBhdWRpb0Jhc2U2NCA9IEJ1ZmZlci5mcm9tKGF1ZGlvQnVmZmVyKS50b1N0cmluZygnYmFzZTY0JylcblxuICAgICAgICAgIGNvbnNvbGUubG9nKCdbVHJhbnNjcmliZV0gU2VuZGluZyByZXF1ZXN0IHRvIE9wZW5Sb3V0ZXIsIGF1ZGlvIHNpemU6JywgYXVkaW9CdWZmZXIubGVuZ3RoKVxuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9vcGVucm91dGVyLmFpL2FwaS92MS9jaGF0L2NvbXBsZXRpb25zJywge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHthcGlLZXl9YCxcbiAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ0hUVFAtUmVmZXJlcic6IHByb2Nlc3MuZW52Lk9QRU5ST1VURVJfU0lURV9VUkwgPz8gJ2h0dHA6Ly9sb2NhbGhvc3Q6NTE3MycsXG4gICAgICAgICAgICAgICdYLVRpdGxlJzogcHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9BUFBfTkFNRSA/PyAnRmFzaGlvblNwaW4nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgbW9kZWw6ICdvcGVuYWkvZ3B0LTRvLWF1ZGlvLXByZXZpZXcnLFxuICAgICAgICAgICAgICBtb2RhbGl0aWVzOiBbJ3RleHQnXSxcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICByb2xlOiAndXNlcicsXG4gICAgICAgICAgICAgICAgICBjb250ZW50OiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgICAgICAgICAgdGV4dDogJ1RyYW5zY3JpYmUgdGhpcyBhdWRpbyBleGFjdGx5IGFzIHNwb2tlbi4nLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2lucHV0X2F1ZGlvJyxcbiAgICAgICAgICAgICAgICAgICAgICBpbnB1dF9hdWRpbzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYXVkaW9CYXNlNjQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXQ6ICd3YXYnLFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2VUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpXG4gICAgICAgICAgY29uc29sZS5sb2coJ1tUcmFuc2NyaWJlXSBSZXNwb25zZSBzdGF0dXM6JywgcmVzcG9uc2Uuc3RhdHVzKVxuXG4gICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1RyYW5zY3JpYmVdIE9wZW5Sb3V0ZXIgZXJyb3I6JywgcmVzcG9uc2VUZXh0KVxucmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogYEZhaWxlZCB0byB0cmFuc2NyaWJlIGF1ZGlvOiAke3Jlc3BvbnNlVGV4dC5zbGljZSgwLCAyMDApfWAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCByZXN1bHRcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzdWx0ID0gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpXG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbVHJhbnNjcmliZV0gSW52YWxpZCBKU09OOicsIHJlc3BvbnNlVGV4dClcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdJbnZhbGlkIHJlc3BvbnNlIGZyb20gdHJhbnNjcmlwdGlvbiBzZXJ2aWNlJyB9KVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IHRleHQgPSAnJ1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2VDb250ZW50ID0gcmVzdWx0Py5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnRcbiAgICAgICAgICBpZiAodHlwZW9mIG1lc3NhZ2VDb250ZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdGV4dCA9IG1lc3NhZ2VDb250ZW50XG4gICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2VDb250ZW50KSkge1xuICAgICAgICAgICAgdGV4dCA9IG1lc3NhZ2VDb250ZW50XG4gICAgICAgICAgICAgIC5maWx0ZXIoKGM6IHVua25vd24pID0+IHR5cGVvZiBjID09PSAnb2JqZWN0JyAmJiBjICE9PSBudWxsICYmICd0eXBlJyBpbiBjICYmIChjIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS50eXBlID09PSAndGV4dCcpXG4gICAgICAgICAgICAgIC5tYXAoKGM6IHVua25vd24pID0+IChjIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS50ZXh0IGFzIHN0cmluZylcbiAgICAgICAgICAgICAgLmpvaW4oJycpXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnNvbGUubG9nKCdbVHJhbnNjcmliZV0gR290IHRleHQ6JywgdGV4dCB8fCAnKGVtcHR5KScpXG4gICAgICAgICAgcmVzLmpzb24oeyB0ZXh0IH0pXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUcmFuc2NyaWJlXSBFeGNlcHRpb246JywgZXJyKVxuICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdGYWlsZWQgdG8gdHJhbnNjcmliZSBhdWRpbycgfSlcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgYXBwLnBvc3QoJy9hcGkvd2FyZHJvYmUvZGV0ZWN0JywgdXBsb2FkLnNpbmdsZSgnaW1hZ2UnKSwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGNvbnN0IGltYWdlRmlsZSA9IHJlcS5maWxlXG4gICAgICAgIGlmICghaW1hZ2VGaWxlKSB7XG4gICAgICAgICAgcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ05vIGltYWdlIGZpbGUgcHJvdmlkZWQnIH0pXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQSV9LRVlcbiAgICAgICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnT1BFTlJPVVRFUl9BUElfS0VZIG5vdCBjb25maWd1cmVkJyB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBpbWFnZUJ1ZmZlciA9IGltYWdlRmlsZS5idWZmZXJcbiAgICAgICAgICBjb25zdCBpbWFnZUJhc2U2NCA9IEJ1ZmZlci5mcm9tKGltYWdlQnVmZmVyKS50b1N0cmluZygnYmFzZTY0JylcbiAgICAgICAgICBjb25zdCBtaW1lVHlwZSA9IGltYWdlRmlsZS5taW1ldHlwZSB8fCAnaW1hZ2UvanBlZydcbiAgICAgICAgICBjb25zdCBkYXRhVXJsID0gYGRhdGE6JHttaW1lVHlwZX07YmFzZTY0LCR7aW1hZ2VCYXNlNjR9YFxuXG4gICAgICAgICAgY29uc29sZS5sb2coJ1tXYXJkcm9iZSBEZXRlY3RdIFNlbmRpbmcgaW1hZ2UgdG8gQUkgZm9yIGRldGVjdGlvbicpXG5cbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwczovL29wZW5yb3V0ZXIuYWkvYXBpL3YxL2NoYXQvY29tcGxldGlvbnMnLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAnSFRUUC1SZWZlcmVyJzogcHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9TSVRFX1VSTCA/PyAnaHR0cDovL2xvY2FsaG9zdDo1MTczJyxcbiAgICAgICAgICAgICAgJ1gtVGl0bGUnOiBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQUF9OQU1FID8/ICdGYXNoaW9uU3BpbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBtb2RlbDogJ29wZW5haS9ncHQtNG8nLFxuICAgICAgICAgICAgICByZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogJ2pzb25fb2JqZWN0JyB9LFxuICAgICAgICAgICAgICBtZXNzYWdlczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHJvbGU6ICdzeXN0ZW0nLFxuICAgICAgICAgICAgICAgICAgY29udGVudDogJ1lvdSBhcmUgYSBmYXNoaW9uIGV4cGVydC4gQW5hbHl6ZSB0aGUgY2xvdGhpbmcgaW1hZ2UgYW5kIHJldHVybiBhIEpTT04gb2JqZWN0IHdpdGggZXhhY3RseSB0aGVzZSBmaWVsZHM6ICcgK1xuICAgICAgICAgICAgICAgICAgICAnZ2FybWVudF90eXBlIChsaWtlIEt1cnRhLCBULXNoaXJ0LCBKZWFucywgU2hlcndhbmkpLCAnICtcbiAgICAgICAgICAgICAgICAgICAgJ3N0eWxlIChzcGVjaWZpYyBzdHlsZSBkZXNjcmlwdGlvbiksICcgK1xuICAgICAgICAgICAgICAgICAgICAnY29sb3IgKG1haW4gY29sb3IocykpLCAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2Rlc2lnbl9kZXRhaWxzIChub3RhYmxlIGRlc2lnbiBlbGVtZW50cykuICcgK1xuICAgICAgICAgICAgICAgICAgICAnUmV0dXJuIE9OTFkgdmFsaWQgSlNPTiwgbm8gbWFya2Rvd24uJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHJvbGU6ICd1c2VyJyxcbiAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgICAgICAgICAgICB0ZXh0OiAnQW5hbHl6ZSB0aGlzIGNsb3RoaW5nIGltYWdlIGFuZCBkZXNjcmliZSBpdCB3aXRoIEpTT04gd2l0aCBrZXlzOiBnYXJtZW50X3R5cGUsIHN0eWxlLCBjb2xvciwgZGVzaWduX2RldGFpbHMuIFJldHVybiBPTkxZIHZhbGlkIEpTT04sIG5vIG1hcmtkb3duIG9yIGNvZGUgYmxvY2tzLicsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2VfdXJsJyxcbiAgICAgICAgICAgICAgICAgICAgICBpbWFnZV91cmw6IHsgdXJsOiBkYXRhVXJsIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjIsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgY29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbV2FyZHJvYmUgRGV0ZWN0XSBPcGVuUm91dGVyIGVycm9yOicsIGVycm9yVGV4dClcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdGYWlsZWQgdG8gZGV0ZWN0IGNsb3RoaW5nIG1ldGFkYXRhJyB9KVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpXG4gICAgICAgICAgY29uc3QgY29udGVudCA9IHJlc3VsdD8uY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50ID8/ICd7fSdcblxuICAgICAgICAgIGxldCBjbGVhbkNvbnRlbnQgPSBjb250ZW50LnRyaW0oKVxuICAgICAgICAgIGlmIChjbGVhbkNvbnRlbnQuc3RhcnRzV2l0aCgnYGBgJykpIHtcbiAgICAgICAgICAgIGNvbnN0IGpzb25NYXRjaCA9IGNsZWFuQ29udGVudC5tYXRjaCgvYGBgKD86anNvbik/XFxzKihbXFxzXFxTXSo/KWBgYC8pXG4gICAgICAgICAgICBpZiAoanNvbk1hdGNoKSB7XG4gICAgICAgICAgICAgIGNsZWFuQ29udGVudCA9IGpzb25NYXRjaFsxXS50cmltKClcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGNsZWFuQ29udGVudCA9IGNsZWFuQ29udGVudC5yZXBsYWNlKC9gYGBbXFxzXFxTXSo/YGBgLywgJycpLnRyaW0oKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBtZXRhZGF0YVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBtZXRhZGF0YSA9IEpTT04ucGFyc2UoY2xlYW5Db250ZW50KVxuICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1dhcmRyb2JlIERldGVjdF0gUGFyc2UgZmFpbGVkLCBjb250ZW50OicsIGNsZWFuQ29udGVudC5zbGljZSgwLCAyMDApKVxuICAgICAgICAgICAgbWV0YWRhdGEgPSB7XG4gICAgICAgICAgICAgIGdhcm1lbnRfdHlwZTogJ1Vua25vd24nLFxuICAgICAgICAgICAgICBzdHlsZTogJ1Vua25vd24nLFxuICAgICAgICAgICAgICBjb2xvcjogJ1Vua25vd24nLFxuICAgICAgICAgICAgICBkZXNpZ25fZGV0YWlsczogY2xlYW5Db250ZW50LnNsaWNlKDAsIDEwMCksXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc29sZS5sb2coJ1tXYXJkcm9iZSBEZXRlY3RdIERldGVjdGVkOicsIG1ldGFkYXRhKVxuICAgICAgICAgIHJlcy5qc29uKHsgbWV0YWRhdGEsIGltYWdlOiBkYXRhVXJsIH0pXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tXYXJkcm9iZSBEZXRlY3RdIEV4Y2VwdGlvbjonLCBlcnIpXG4gICAgICAgICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogJ0ZhaWxlZCB0byBkZXRlY3QgY2xvdGhpbmcgbWV0YWRhdGEnIH0pXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIGFwcC5wb3N0KCcvYXBpL3dhcmRyb2JlL3NhdmUnLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgY29uc3QgeyBtZXRhZGF0YSwgZmlsZU5hbWUgfSA9IHJlcS5ib2R5XG5cbiAgICAgICAgaWYgKCFtZXRhZGF0YSkge1xuICAgICAgICAgIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdNaXNzaW5nIG1ldGFkYXRhJyB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBtZXRhZGF0YVBhdGggPSBwYXRoLmpvaW4od2FyZHJvYmVSb290LCAnY2xvdGhpbmdfbWV0YWRhdGEuanNvbicpXG4gICAgICAgICAgbGV0IGV4aXN0aW5nRGF0YTogeyBjbG90aGluZ19tZXRhZGF0YTogdW5rbm93bltdIH0gPSB7IGNsb3RoaW5nX21ldGFkYXRhOiBbXSB9XG5cbiAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhtZXRhZGF0YVBhdGgpKSB7XG4gICAgICAgICAgICBleGlzdGluZ0RhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtZXRhZGF0YVBhdGgsICd1dGYtOCcpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGJhc2VGaWxlTmFtZSA9IHR5cGVvZiBmaWxlTmFtZSA9PT0gJ3N0cmluZycgJiYgZmlsZU5hbWUgXG4gICAgICAgICAgICA/IGZpbGVOYW1lLnJlcGxhY2UoL1xcLlteLy5dKyQvLCAnJylcbiAgICAgICAgICAgIDogYHVzZXJfJHtEYXRlLm5vdygpfWBcblxuICAgICAgICAgIGNvbnN0IG5ld0VudHJ5ID0ge1xuICAgICAgICAgICAgaW1hZ2VfZmlsZTogYCR7YmFzZUZpbGVOYW1lfS5qcGdgLFxuICAgICAgICAgICAgZ2FybWVudF90eXBlOiBtZXRhZGF0YS5nYXJtZW50X3R5cGUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgc3R5bGU6IG1ldGFkYXRhLnN0eWxlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgIGt1cnRhX2NvbG9yOiBtZXRhZGF0YS5jb2xvciB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICBib3R0b21fY29sb3I6ICdVbmtub3duJyxcbiAgICAgICAgICAgIGRlc2lnbl9kZXRhaWxzOiBtZXRhZGF0YS5kZXNpZ25fZGV0YWlscyB8fCAnJyxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBleGlzdGluZ0RhdGEuY2xvdGhpbmdfbWV0YWRhdGEucHVzaChuZXdFbnRyeSlcbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKG1ldGFkYXRhUGF0aCwgSlNPTi5zdHJpbmdpZnkoZXhpc3RpbmdEYXRhLCBudWxsLCAyKSlcblxuICAgICAgICAgIGNvbnNvbGUubG9nKCdbV2FyZHJvYmUgU2F2ZV0gQWRkZWQ6JywgbmV3RW50cnkpXG4gICAgICAgICAgcmVzLmpzb24oeyBzdWNjZXNzOiB0cnVlLCBlbnRyeTogbmV3RW50cnkgfSlcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignW1dhcmRyb2JlIFNhdmVdIEVycm9yOicsIGVycilcbiAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRmFpbGVkIHRvIHNhdmUgbWV0YWRhdGEnIH0pXG4gICAgICAgIH1cbiAgICAgIH0pXG5cbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoYXBwKVxuICAgIH0sXG4gIH1cbn0iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJYOlxcXFxjb2RleFxcXFxmYXNoaW9uX3NwaW5cXFxcc2VydmVyXFxcXGxpYlxcXFxsb2FkRW52LnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9YOi9jb2RleC9mYXNoaW9uX3NwaW4vc2VydmVyL2xpYi9sb2FkRW52LnRzXCI7aW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcblxuZnVuY3Rpb24gYXBwbHlFbnZGaWxlKGZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVQYXRoKSkge1xuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3QgbGluZXMgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGYtOCcpLnNwbGl0KC9cXHI/XFxuLylcbiAgZm9yIChjb25zdCByYXdMaW5lIG9mIGxpbmVzKSB7XG4gICAgY29uc3QgbGluZSA9IHJhd0xpbmUudHJpbSgpXG4gICAgaWYgKCFsaW5lIHx8IGxpbmUuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGNvbnN0IHNlcGFyYXRvckluZGV4ID0gbGluZS5pbmRleE9mKCc9JylcbiAgICBpZiAoc2VwYXJhdG9ySW5kZXggPT09IC0xKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGNvbnN0IGtleSA9IGxpbmUuc2xpY2UoMCwgc2VwYXJhdG9ySW5kZXgpLnRyaW0oKVxuICAgIGxldCB2YWx1ZSA9IGxpbmUuc2xpY2Uoc2VwYXJhdG9ySW5kZXggKyAxKS50cmltKClcblxuICAgIGlmIChcbiAgICAgICh2YWx1ZS5zdGFydHNXaXRoKCdcIicpICYmIHZhbHVlLmVuZHNXaXRoKCdcIicpKSB8fFxuICAgICAgKHZhbHVlLnN0YXJ0c1dpdGgoXCInXCIpICYmIHZhbHVlLmVuZHNXaXRoKFwiJ1wiKSlcbiAgICApIHtcbiAgICAgIHZhbHVlID0gdmFsdWUuc2xpY2UoMSwgLTEpXG4gICAgfVxuXG4gICAgaWYgKCEoa2V5IGluIHByb2Nlc3MuZW52KSkge1xuICAgICAgcHJvY2Vzcy5lbnZba2V5XSA9IHZhbHVlXG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkTG9jYWxFbnYocHJvamVjdFJvb3Q6IHN0cmluZykge1xuICBhcHBseUVudkZpbGUocGF0aC5qb2luKHByb2plY3RSb290LCAnLmVudicpKVxuICBhcHBseUVudkZpbGUocGF0aC5qb2luKHByb2plY3RSb290LCAnLmVudi5sb2NhbCcpKVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJYOlxcXFxjb2RleFxcXFxmYXNoaW9uX3NwaW5cXFxcc2VydmVyXFxcXGxpYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHNlcnZlclxcXFxsaWJcXFxcbWlzc2lvblBpcGVsaW5lLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9YOi9jb2RleC9mYXNoaW9uX3NwaW4vc2VydmVyL2xpYi9taXNzaW9uUGlwZWxpbmUudHNcIjtpbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgcmVzb2x2ZVdhcmRyb2JlSXRlbXMsIHdyaXRlSW1hZ2VEYXRhVXJsIH0gZnJvbSAnLi9jYXRhbG9nJ1xuaW1wb3J0IHsgZ2VuZXJhdGVMb29rV2l0aE9wZW5Sb3V0ZXIsIHNlbGVjdE91dGZpdFdpdGhPcGVuUm91dGVyIH0gZnJvbSAnLi9vcGVuUm91dGVyJ1xuaW1wb3J0IHR5cGUgeyBNaXNzaW9uUmVzdWx0LCBNaXNzaW9uU3RhZ2UsIFdhcmRyb2JlSXRlbSB9IGZyb20gJy4vdHlwZXMnXG5pbXBvcnQgeyBnZXRCYXNlSW1hZ2VQYXRoIH0gZnJvbSAnLi93YXJkcm9iZUNhdGFsb2cnXG5cbmludGVyZmFjZSBNaXNzaW9uQXVkaW9JbnB1dCB7XG4gIGJ1ZmZlcjogQnVmZmVyXG4gIG1pbWVUeXBlOiBzdHJpbmdcbiAgZmlsZU5hbWU6IHN0cmluZ1xufVxuXG5pbnRlcmZhY2UgUGlwZWxpbmVDb250ZXh0IHtcbiAgbWlzc2lvbjogTWlzc2lvblJlc3VsdFxuICB3YXJkcm9iZTogV2FyZHJvYmVJdGVtW11cbiAgcHVibGljUm9vdDogc3RyaW5nXG4gIHdhcmRyb2JlUm9vdDogc3RyaW5nXG4gIGF1ZGlvPzogTWlzc2lvbkF1ZGlvSW5wdXRcbn1cblxuZnVuY3Rpb24gc2xlZXAobXM6IG51bWJlcikge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKVxufVxuXG5mdW5jdGlvbiBzZXRTdGFnZShtaXNzaW9uOiBNaXNzaW9uUmVzdWx0LCBzdGFnZTogTWlzc2lvblN0YWdlKSB7XG4gIG1pc3Npb24uc3RhZ2UgPSBzdGFnZVxuICBtaXNzaW9uLnN0YWdlVGltaW5nc1tzdGFnZV0gPSBEYXRlLm5vdygpXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBydW5NaXNzaW9uUGlwZWxpbmUoe1xuICBtaXNzaW9uLFxuICB3YXJkcm9iZSxcbiAgcHVibGljUm9vdCxcbiAgd2FyZHJvYmVSb290LFxufTogUGlwZWxpbmVDb250ZXh0KSB7XG4gIHRyeSB7XG4gICAgc2V0U3RhZ2UobWlzc2lvbiwgJ3BsYW5uaW5nJylcbiAgICBhd2FpdCBzbGVlcCgyNTApXG5cbiAgICBzZXRTdGFnZShtaXNzaW9uLCAnc2VsZWN0aW5nJylcbiAgICBjb25zdCBkZWNpc2lvbiA9IGF3YWl0IHNlbGVjdE91dGZpdFdpdGhPcGVuUm91dGVyKG1pc3Npb24ubWlzc2lvblRleHQsIHdhcmRyb2JlKVxuICAgIG1pc3Npb24uc2VsZWN0ZWRJdGVtcyA9IGRlY2lzaW9uLnNlbGVjdGVkSXRlbXNcbiAgICBtaXNzaW9uLmV4cGxhbmF0aW9uID0gZGVjaXNpb24uZXhwbGFuYXRpb25cbiAgICBhd2FpdCBzbGVlcCgyNTApXG5cbiAgICBzZXRTdGFnZShtaXNzaW9uLCAncmVuZGVyaW5nJylcbiAgICBjb25zdCBzZWxlY3RlZEdhcm1lbnRzID0gcmVzb2x2ZVdhcmRyb2JlSXRlbXMobWlzc2lvbi5zZWxlY3RlZEl0ZW1zLCB3YXJkcm9iZSlcbiAgICBjb25zdCBzZWxlY3RlZEdhcm1lbnQgPSBzZWxlY3RlZEdhcm1lbnRzWzBdXG5cbiAgICBpZiAoIXNlbGVjdGVkR2FybWVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyB3YXJkcm9iZSBpdGVtIHdhcyBzZWxlY3RlZCBmb3IgaW1hZ2UgZ2VuZXJhdGlvbi4nKVxuICAgIH1cblxuICAgIGNvbnN0IGdlbmVyYXRlZEltYWdlID0gYXdhaXQgZ2VuZXJhdGVMb29rV2l0aE9wZW5Sb3V0ZXIoXG4gICAgICBtaXNzaW9uLm1pc3Npb25UZXh0LFxuICAgICAgc2VsZWN0ZWRHYXJtZW50LFxuICAgICAgZGVjaXNpb24uZ2VuZXJhdGlvblByb21wdCA/P1xuICAgICAgICBgRHJlc3MgdGhlIGNoYXJhY3RlciBpbiAke3NlbGVjdGVkR2FybWVudC5uYW1lfS5gLFxuICAgICAgZ2V0QmFzZUltYWdlUGF0aCh3YXJkcm9iZVJvb3QpXG4gICAgKVxuXG4gICAgaWYgKGdlbmVyYXRlZEltYWdlKSB7XG4gICAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5qb2luKHB1YmxpY1Jvb3QsICdnZW5lcmF0ZWQnLCBgJHttaXNzaW9uLmlkfS5wbmdgKVxuICAgICAgd3JpdGVJbWFnZURhdGFVcmwob3V0cHV0UGF0aCwgZ2VuZXJhdGVkSW1hZ2UpXG4gICAgICBtaXNzaW9uLmZpbmFsSW1hZ2VVcmwgPSBgL2dlbmVyYXRlZC8ke21pc3Npb24uaWR9LnBuZ2BcbiAgICB9IGVsc2Uge1xuICAgICAgbWlzc2lvbi5maW5hbEltYWdlVXJsID0gJy93YXJkcm9iZS1hc3NldHMvYmFzZV9pbWcucG5nJ1xuICAgIH1cblxuICAgIHNldFN0YWdlKG1pc3Npb24sICdkb25lJylcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbTWlzc2lvblBpcGVsaW5lXSBFcnJvcjonLCBlcnJvcilcbiAgICBtaXNzaW9uLnN0YWdlID0gJ2Vycm9yJ1xuICAgIG1pc3Npb24uZXJyb3IgPVxuICAgICAgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnTWlzc2lvbiBwaXBlbGluZSBmYWlsZWQuJ1xuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJYOlxcXFxjb2RleFxcXFxmYXNoaW9uX3NwaW5cXFxcc2VydmVyXFxcXGxpYlxcXFxjYXRhbG9nLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9YOi9jb2RleC9mYXNoaW9uX3NwaW4vc2VydmVyL2xpYi9jYXRhbG9nLnRzXCI7aW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB0eXBlIHsgV2FyZHJvYmVJdGVtIH0gZnJvbSAnLi90eXBlcydcblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRXYXJkcm9iZU1hbmlmZXN0KG1hbmlmZXN0UGF0aDogc3RyaW5nKTogV2FyZHJvYmVJdGVtW10ge1xuICByZXR1cm4gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMobWFuaWZlc3RQYXRoLCAndXRmLTgnKSkgYXMgV2FyZHJvYmVJdGVtW11cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN1bW1hcml6ZVdhcmRyb2JlKHdhcmRyb2JlOiBXYXJkcm9iZUl0ZW1bXSkge1xuICByZXR1cm4gd2FyZHJvYmUubWFwKChpdGVtKSA9PiAoe1xuICAgIGlkOiBpdGVtLmlkLFxuICAgIG5hbWU6IGl0ZW0ubmFtZSxcbiAgICBjYXRlZ29yeTogaXRlbS5jYXRlZ29yeSxcbiAgICBjb2xvcnM6IGl0ZW0uY29sb3JzLFxuICAgIHN0eWxlVGFnczogaXRlbS5zdHlsZVRhZ3MsXG4gICAgbGF5ZXJSb2xlOiBpdGVtLmxheWVyUm9sZSxcbiAgfSkpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlV2FyZHJvYmVJdGVtcyhpZHM6IHN0cmluZ1tdLCB3YXJkcm9iZTogV2FyZHJvYmVJdGVtW10pIHtcbiAgcmV0dXJuIGlkc1xuICAgIC5tYXAoKGlkKSA9PiB3YXJkcm9iZS5maW5kKChpdGVtKSA9PiBpdGVtLmlkID09PSBpZCkpXG4gICAgLmZpbHRlcigoaXRlbSk6IGl0ZW0gaXMgV2FyZHJvYmVJdGVtID0+IEJvb2xlYW4oaXRlbSkpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b0RhdGFVcmxGcm9tRmlsZShmaWxlUGF0aDogc3RyaW5nKSB7XG4gIGNvbnN0IGJ1ZmZlciA9IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aClcbiAgY29uc3QgZXh0ZW5zaW9uID0gcGF0aC5leHRuYW1lKGZpbGVQYXRoKS5zbGljZSgxKSB8fCAncG5nJ1xuICByZXR1cm4gYGRhdGE6aW1hZ2UvJHtleHRlbnNpb259O2Jhc2U2NCwke2J1ZmZlci50b1N0cmluZygnYmFzZTY0Jyl9YFxufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9EYXRhVXJsRnJvbUltYWdlKHB1YmxpY1Jvb3Q6IHN0cmluZywgaW1hZ2VQYXRoOiBzdHJpbmcpIHtcbiAgY29uc3QgbG9jYWxQYXRoID0gcGF0aC5qb2luKHB1YmxpY1Jvb3QsIGltYWdlUGF0aC5yZXBsYWNlKC9eXFwvLywgJycpKVxuICByZXR1cm4gdG9EYXRhVXJsRnJvbUZpbGUobG9jYWxQYXRoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVJbWFnZURhdGFVcmwob3V0cHV0UGF0aDogc3RyaW5nLCBkYXRhVXJsOiBzdHJpbmcpIHtcbiAgY29uc3QgbWF0Y2ggPSBkYXRhVXJsLm1hdGNoKC9eZGF0YTppbWFnZVxcLyhbYS16QS1aMC05Ky4tXSspO2Jhc2U2NCwoLispJC8pXG4gIGlmICghbWF0Y2gpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vuc3VwcG9ydGVkIGltYWdlIHBheWxvYWQgcmVjZWl2ZWQgZnJvbSBpbWFnZSBnZW5lcmF0aW9uIHByb3ZpZGVyLicpXG4gIH1cblxuICBmcy5ta2RpclN5bmMocGF0aC5kaXJuYW1lKG91dHB1dFBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KVxuICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIEJ1ZmZlci5mcm9tKG1hdGNoWzJdLCAnYmFzZTY0JykpXG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJYOlxcXFxjb2RleFxcXFxmYXNoaW9uX3NwaW5cXFxcc2VydmVyXFxcXGxpYlxcXFxvcGVuUm91dGVyLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9YOi9jb2RleC9mYXNoaW9uX3NwaW4vc2VydmVyL2xpYi9vcGVuUm91dGVyLnRzXCI7aW1wb3J0IHsgdG9EYXRhVXJsRnJvbUZpbGUgfSBmcm9tICcuL2NhdGFsb2cnXG5pbXBvcnQgdHlwZSB7IE91dGZpdERlY2lzaW9uLCBXYXJkcm9iZUl0ZW0gfSBmcm9tICcuL3R5cGVzJ1xuXG5pbnRlcmZhY2UgT3BlblJvdXRlckNob2ljZSB7XG4gIG1lc3NhZ2U/OiB7XG4gICAgY29udGVudD86IHN0cmluZ1xuICAgIGltYWdlcz86IEFycmF5PHtcbiAgICAgIGltYWdlX3VybD86IHtcbiAgICAgICAgdXJsPzogc3RyaW5nXG4gICAgICB9XG4gICAgfT5cbiAgfVxufVxuXG5pbnRlcmZhY2UgT3BlblJvdXRlclJlc3BvbnNlIHtcbiAgY2hvaWNlcz86IE9wZW5Sb3V0ZXJDaG9pY2VbXVxufVxuXG5pbnRlcmZhY2UgU2VsZWN0aW9uUmVzdWx0IHtcbiAgc2VsZWN0ZWRJdGVtSWQ6IHN0cmluZ1xuICBleHBsYW5hdGlvbjogc3RyaW5nXG4gIGdlbmVyYXRpb25Qcm9tcHQ6IHN0cmluZ1xufVxuXG5mdW5jdGlvbiBnZXRPcGVuUm91dGVySGVhZGVycygpIHtcbiAgcmV0dXJuIHtcbiAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7cHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9BUElfS0VZfWAsXG4gICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAuLi4ocHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9TSVRFX1VSTFxuICAgICAgPyB7ICdIVFRQLVJlZmVyZXInOiBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX1NJVEVfVVJMIH1cbiAgICAgIDoge30pLFxuICAgIC4uLihwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQUF9OQU1FXG4gICAgICA/IHsgJ1gtVGl0bGUnOiBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQUF9OQU1FIH1cbiAgICAgIDoge30pLFxuICB9XG59XG5cbmZ1bmN0aW9uIHN1bW1hcml6ZVdhcmRyb2JlKHdhcmRyb2JlOiBXYXJkcm9iZUl0ZW1bXSkge1xuICByZXR1cm4gd2FyZHJvYmUubWFwKChpdGVtKSA9PiAoe1xuICAgIGlkOiBpdGVtLmlkLFxuICAgIG5hbWU6IGl0ZW0ubmFtZSxcbiAgICBnYXJtZW50VHlwZTogaXRlbS5nYXJtZW50VHlwZSxcbiAgICBzdHlsZTogaXRlbS5zdHlsZSxcbiAgICBjb2xvcnM6IGl0ZW0uY29sb3JzLFxuICAgIGRlc2lnbkRldGFpbHM6IGl0ZW0uZGVzaWduRGV0YWlscyxcbiAgICBzb3VyY2VJbWFnZUZpbGU6IGl0ZW0uc291cmNlSW1hZ2VGaWxlLFxuICB9KSlcbn1cblxuZnVuY3Rpb24gZmFsbGJhY2tTZWxlY3Rpb24obWlzc2lvblRleHQ6IHN0cmluZywgd2FyZHJvYmU6IFdhcmRyb2JlSXRlbVtdKTogT3V0Zml0RGVjaXNpb24ge1xuICBjb25zdCB0ZXh0ID0gbWlzc2lvblRleHQudG9Mb3dlckNhc2UoKVxuXG4gIGNvbnN0IHNlbGVjdGVkID1cbiAgICB3YXJkcm9iZS5maW5kKFxuICAgICAgKGl0ZW0pID0+XG4gICAgICAgIC9kYXRlfGRpbm5lcnxuaWdodHxldmVuaW5nLy50ZXN0KHRleHQpICYmXG4gICAgICAgIGl0ZW0uY29sb3JzLmluY2x1ZGVzKCdtYXJvb24nKVxuICAgICkgPz9cbiAgICB3YXJkcm9iZS5maW5kKFxuICAgICAgKGl0ZW0pID0+IC9zaGFhZGl8d2VkZGluZ3xmZXN0aXZlLy50ZXN0KHRleHQpICYmIGl0ZW0uY29sb3JzLmluY2x1ZGVzKCdtdXN0YXJkJylcbiAgICApID8/XG4gICAgd2FyZHJvYmUuZmluZChcbiAgICAgIChpdGVtKSA9PiAvY29sbGVnZXxjYXN1YWx8ZGF5Ly50ZXN0KHRleHQpICYmIGl0ZW0uY29sb3JzLmluY2x1ZGVzKCdsaWdodCcpXG4gICAgKSA/P1xuICAgIHdhcmRyb2JlWzBdXG5cbiAgaWYgKCFzZWxlY3RlZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignV2FyZHJvYmUgaXMgZW1wdHkuJylcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc2VsZWN0ZWRJdGVtczogW3NlbGVjdGVkLmlkXSxcbiAgICBleHBsYW5hdGlvbjogYFBpY2tlZCAke3NlbGVjdGVkLm5hbWV9IGZyb20gdGhlIHdhcmRyb2JlIGZvciBcIiR7bWlzc2lvblRleHR9XCIuYCxcbiAgICBnZW5lcmF0aW9uUHJvbXB0OlxuICAgICAgYERyZXNzIHRoZSBiYXNlIGNoYXJhY3RlciBpbiB0aGUgZXhhY3QgZ2FybWVudCBzaG93biBpbiB0aGUgcmVmZXJlbmNlIGltYWdlIGZvciAke3NlbGVjdGVkLm5hbWV9LiBgICtcbiAgICAgIGBLZWVwIHRoZSBmYWNlLCBwb3NlLCBhbmQgYm9keSBwcm9wb3J0aW9ucyB1bmNoYW5nZWQsIGFuZCBtYWtlIHRoZSByZXN1bHQgbG9vayBsaWtlIGEgcG9saXNoZWQgZmFzaGlvbiBwb3J0cmFpdC5gLFxuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlRGVjaXNpb24oY29udGVudDogc3RyaW5nLCB3YXJkcm9iZTogV2FyZHJvYmVJdGVtW10pIHtcbiAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShjb250ZW50KSBhcyBTZWxlY3Rpb25SZXN1bHRcbiAgaWYgKFxuICAgIHR5cGVvZiBwYXJzZWQuc2VsZWN0ZWRJdGVtSWQgIT09ICdzdHJpbmcnIHx8XG4gICAgdHlwZW9mIHBhcnNlZC5leHBsYW5hdGlvbiAhPT0gJ3N0cmluZycgfHxcbiAgICB0eXBlb2YgcGFyc2VkLmdlbmVyYXRpb25Qcm9tcHQgIT09ICdzdHJpbmcnXG4gICkge1xuICAgIHRocm93IG5ldyBFcnJvcignT3BlblJvdXRlciBkaWQgbm90IHJldHVybiB0aGUgZXhwZWN0ZWQgSlNPTiBzaGFwZS4nKVxuICB9XG5cbiAgaWYgKCF3YXJkcm9iZS5zb21lKChpdGVtKSA9PiBpdGVtLmlkID09PSBwYXJzZWQuc2VsZWN0ZWRJdGVtSWQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPcGVuUm91dGVyIHNlbGVjdGVkIGEgZ2FybWVudCBpZCBvdXRzaWRlIHRoZSB3YXJkcm9iZS4nKVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzZWxlY3RlZEl0ZW1zOiBbcGFyc2VkLnNlbGVjdGVkSXRlbUlkXSxcbiAgICBleHBsYW5hdGlvbjogcGFyc2VkLmV4cGxhbmF0aW9uLFxuICAgIGdlbmVyYXRpb25Qcm9tcHQ6IHBhcnNlZC5nZW5lcmF0aW9uUHJvbXB0LFxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZWxlY3RPdXRmaXRXaXRoT3BlblJvdXRlcihcbiAgbWlzc2lvblRleHQ6IHN0cmluZyxcbiAgd2FyZHJvYmU6IFdhcmRyb2JlSXRlbVtdXG4pOiBQcm9taXNlPE91dGZpdERlY2lzaW9uPiB7XG4gIGlmICghcHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9BUElfS0VZKSB7XG4gICAgY29uc29sZS53YXJuKCdbT3BlblJvdXRlcl0gT1BFTlJPVVRFUl9BUElfS0VZIG1pc3Npbmc7IHVzaW5nIGxvY2FsIGZhbGxiYWNrIHNlbGVjdGlvbi4nKVxuICAgIHJldHVybiBmYWxsYmFja1NlbGVjdGlvbihtaXNzaW9uVGV4dCwgd2FyZHJvYmUpXG4gIH1cblxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwczovL29wZW5yb3V0ZXIuYWkvYXBpL3YxL2NoYXQvY29tcGxldGlvbnMnLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgaGVhZGVyczogZ2V0T3BlblJvdXRlckhlYWRlcnMoKSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBtb2RlbDogcHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9TRUxFQ1RPUl9NT0RFTCA/PyAnb3BlbmFpL2dwdC00by1taW5pJyxcbiAgICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiAnanNvbl9vYmplY3QnIH0sXG4gICAgICB0ZW1wZXJhdHVyZTogMC4yLFxuICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6ICdzeXN0ZW0nLFxuICAgICAgICAgIGNvbnRlbnQ6XG4gICAgICAgICAgICAnWW91IGFyZSBhIGZhc2hpb24gc3R5bGlzdCBzZWxlY3Rpbmcgb25lIGV4YWN0IGdhcm1lbnQgaW1hZ2UgZnJvbSBhIGxvY2FsIHdhcmRyb2JlLiAnICtcbiAgICAgICAgICAgICdSZXR1cm4gSlNPTiBvbmx5IHdpdGgga2V5cyBzZWxlY3RlZEl0ZW1JZCwgZXhwbGFuYXRpb24sIGFuZCBnZW5lcmF0aW9uUHJvbXB0LiAnICtcbiAgICAgICAgICAgICdzZWxlY3RlZEl0ZW1JZCBtdXN0IG1hdGNoIG9uZSBpZCBmcm9tIHRoZSB3YXJkcm9iZSBsaXN0IGV4YWN0bHkuJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHJvbGU6ICd1c2VyJyxcbiAgICAgICAgICBjb250ZW50OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBtaXNzaW9uVGV4dCxcbiAgICAgICAgICAgIHdhcmRyb2JlOiBzdW1tYXJpemVXYXJkcm9iZSh3YXJkcm9iZSksXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pLFxuICB9KVxuXG4gIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICByZXR1cm4gZmFsbGJhY2tTZWxlY3Rpb24obWlzc2lvblRleHQsIHdhcmRyb2JlKVxuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgT3BlblJvdXRlclJlc3BvbnNlXG4gIGNvbnN0IGNvbnRlbnQgPSByZXN1bHQuY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50XG4gIGlmICghY29udGVudCkge1xuICAgIHJldHVybiBmYWxsYmFja1NlbGVjdGlvbihtaXNzaW9uVGV4dCwgd2FyZHJvYmUpXG4gIH1cblxuICB0cnkge1xuICAgIHJldHVybiBwYXJzZURlY2lzaW9uKGNvbnRlbnQsIHdhcmRyb2JlKVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gZmFsbGJhY2tTZWxlY3Rpb24obWlzc2lvblRleHQsIHdhcmRyb2JlKVxuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUxvb2tXaXRoT3BlblJvdXRlcihcbiAgbWlzc2lvblRleHQ6IHN0cmluZyxcbiAgc2VsZWN0ZWRJdGVtOiBXYXJkcm9iZUl0ZW0sXG4gIGdlbmVyYXRpb25Qcm9tcHQ6IHN0cmluZyxcbiAgYmFzZUltYWdlUGF0aDogc3RyaW5nXG4pIHtcbiAgaWYgKCFwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQSV9LRVkpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tPcGVuUm91dGVyXSBPUEVOUk9VVEVSX0FQSV9LRVkgbWlzc2luZzsgdXNpbmcgYmFzZSBpbWFnZSBmYWxsYmFjay4nKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBpZiAoIXNlbGVjdGVkSXRlbS5sb2NhbEltYWdlUGF0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcignU2VsZWN0ZWQgd2FyZHJvYmUgaXRlbSBpcyBtaXNzaW5nIGEgbG9jYWwgaW1hZ2UgcGF0aC4nKVxuICB9XG5cbiAgY29uc3QgbW9kZWwgPSBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0lNQUdFX01PREVMID8/ICdnb29nbGUvZ2VtaW5pLTMuMS1mbGFzaC1pbWFnZS1wcmV2aWV3J1xuXG4gIGNvbnN0IHJlcXVlc3RCb2R5ID0ge1xuICAgIG1vZGVsLFxuICAgIG1vZGFsaXRpZXM6IFsnaW1hZ2UnLCAndGV4dCddLFxuICAgIGltYWdlX2NvbmZpZzoge1xuICAgICAgYXNwZWN0X3JhdGlvOiAnOToxNicsXG4gICAgfSxcbiAgICBtZXNzYWdlczogW1xuICAgICAge1xuICAgICAgICByb2xlOiAndXNlcicsXG4gICAgICAgIGNvbnRlbnQ6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICB0ZXh0OlxuICAgICAgICAgICAgICBgJHtnZW5lcmF0aW9uUHJvbXB0fSBNYXRjaCB0aGUgbWlzc2lvbiBcIiR7bWlzc2lvblRleHR9XCIuIGAgK1xuICAgICAgICAgICAgICBgUHJlc2VydmUgdGhlIG1vZGVsIGlkZW50aXR5IGZyb20gdGhlIGZpcnN0IGltYWdlLiBVc2UgdGhlIHNlY29uZCBpbWFnZSBhcyB0aGUgY2xvdGhpbmcgcmVmZXJlbmNlIG9ubHkuIGAgK1xuICAgICAgICAgICAgICBgS2VlcCByZWFsaXN0aWMgZmFicmljLCBmb2xkcywgYW5kIG91dGZpdCBmaXQuIFJldHVybiBvbmUgcG9saXNoZWQgcG9ydHJhaXQgaW1hZ2UuYCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZV91cmwnLFxuICAgICAgICAgICAgaW1hZ2VfdXJsOiB7XG4gICAgICAgICAgICAgIHVybDogdG9EYXRhVXJsRnJvbUZpbGUoYmFzZUltYWdlUGF0aCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2ltYWdlX3VybCcsXG4gICAgICAgICAgICBpbWFnZV91cmw6IHtcbiAgICAgICAgICAgICAgdXJsOiB0b0RhdGFVcmxGcm9tRmlsZShzZWxlY3RlZEl0ZW0ubG9jYWxJbWFnZVBhdGgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICBdLFxuICB9XG5cbiAgY29uc29sZS5sb2coYFtPcGVuUm91dGVyXSBHZW5lcmF0aW5nIGltYWdlIHdpdGggbW9kZWw6ICR7bW9kZWx9YClcblxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwczovL29wZW5yb3V0ZXIuYWkvYXBpL3YxL2NoYXQvY29tcGxldGlvbnMnLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgaGVhZGVyczogZ2V0T3BlblJvdXRlckhlYWRlcnMoKSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShyZXF1ZXN0Qm9keSksXG4gIH0pXG5cbiAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKVxuICAgIGNvbnNvbGUuZXJyb3IoYFtPcGVuUm91dGVyXSBJbWFnZSBnZW5lcmF0aW9uIGZhaWxlZCAoJHtyZXNwb25zZS5zdGF0dXN9KTogJHtlcnJvclRleHR9YClcbiAgICByZXR1cm4gbnVsbFxuICB9XG5cbiAgY29uc3QgcmVzdWx0ID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgT3BlblJvdXRlclJlc3BvbnNlXG4gIHJldHVybiByZXN1bHQuY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5pbWFnZXM/LlswXT8uaW1hZ2VfdXJsPy51cmwgPz8gbnVsbFxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJYOlxcXFxjb2RleFxcXFxmYXNoaW9uX3NwaW5cXFxcc2VydmVyXFxcXGxpYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHNlcnZlclxcXFxsaWJcXFxcd2FyZHJvYmVDYXRhbG9nLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9YOi9jb2RleC9mYXNoaW9uX3NwaW4vc2VydmVyL2xpYi93YXJkcm9iZUNhdGFsb2cudHNcIjtpbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHR5cGUgeyBXYXJkcm9iZUl0ZW0gfSBmcm9tICcuL3R5cGVzJ1xuXG5pbnRlcmZhY2UgQ2xvdGhpbmdNZXRhZGF0YUVudHJ5IHtcbiAgaW1hZ2VfZmlsZTogc3RyaW5nXG4gIGdhcm1lbnRfdHlwZTogc3RyaW5nXG4gIHN0eWxlOiBzdHJpbmdcbiAga3VydGFfY29sb3I6IHN0cmluZ1xuICBib3R0b21fY29sb3I6IHN0cmluZ1xuICBkZXNpZ25fZGV0YWlsczogc3RyaW5nXG59XG5cbmludGVyZmFjZSBDbG90aGluZ01ldGFkYXRhRG9jdW1lbnQge1xuICBjbG90aGluZ19tZXRhZGF0YTogQ2xvdGhpbmdNZXRhZGF0YUVudHJ5W11cbn1cblxuY29uc3QgaW1hZ2VFeHRlbnNpb25zID0gbmV3IFNldChbJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcud2VicCddKVxuY29uc3QgZm9sZGVyQ2F0ZWdvcnlNYXA6IFJlY29yZDxzdHJpbmcsIFdhcmRyb2JlSXRlbVsnY2F0ZWdvcnknXT4gPSB7XG4gIGt1cnRhczogJ3RvcCcsXG4gIHRzaGlydHM6ICd0b3AnLFxuICBib3R0b21zOiAnYm90dG9tJyxcbiAgc2hvZXM6ICdzaG9lcycsXG59XG5cbmZ1bmN0aW9uIHNsdWdpZnkodmFsdWU6IHN0cmluZykge1xuICByZXR1cm4gdmFsdWVcbiAgICAudG9Mb3dlckNhc2UoKVxuICAgIC5yZXBsYWNlKC9bXmEtejAtOV0rL2csICctJylcbiAgICAucmVwbGFjZSgvXi0rfC0rJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gc3RyaXBFeHRlbnNpb24oZmlsZU5hbWU6IHN0cmluZykge1xuICByZXR1cm4gcGF0aC5wYXJzZShmaWxlTmFtZSkubmFtZVxufVxuXG5mdW5jdGlvbiByZWFkTWV0YWRhdGEod2FyZHJvYmVSb290OiBzdHJpbmcpIHtcbiAgY29uc3QgbWV0YWRhdGFQYXRoID0gcGF0aC5qb2luKHdhcmRyb2JlUm9vdCwgJ2Nsb3RoaW5nX21ldGFkYXRhLmpzb24nKVxuICBpZiAoIWZzLmV4aXN0c1N5bmMobWV0YWRhdGFQYXRoKSkge1xuICAgIHJldHVybiBuZXcgTWFwPHN0cmluZywgQ2xvdGhpbmdNZXRhZGF0YUVudHJ5PigpXG4gIH1cblxuICBjb25zdCBkb2N1bWVudCA9IEpTT04ucGFyc2UoXG4gICAgZnMucmVhZEZpbGVTeW5jKG1ldGFkYXRhUGF0aCwgJ3V0Zi04JylcbiAgKSBhcyBDbG90aGluZ01ldGFkYXRhRG9jdW1lbnRcblxuICByZXR1cm4gbmV3IE1hcChcbiAgICBkb2N1bWVudC5jbG90aGluZ19tZXRhZGF0YS5tYXAoKGVudHJ5KSA9PiBbXG4gICAgICBzdHJpcEV4dGVuc2lvbihlbnRyeS5pbWFnZV9maWxlKSxcbiAgICAgIGVudHJ5LFxuICAgIF0pXG4gIClcbn1cblxuZnVuY3Rpb24gY29sbGVjdFdhcmRyb2JlSW1hZ2VzKHJvb3Q6IHN0cmluZykge1xuICBjb25zdCBpbWFnZXM6IHN0cmluZ1tdID0gW11cblxuICBmdW5jdGlvbiB3YWxrKGN1cnJlbnRQYXRoOiBzdHJpbmcpIHtcbiAgICBjb25zdCBlbnRyaWVzID0gZnMucmVhZGRpclN5bmMoY3VycmVudFBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KVxuICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oY3VycmVudFBhdGgsIGVudHJ5Lm5hbWUpXG4gICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICB3YWxrKGZ1bGxQYXRoKVxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICBpZiAoIWltYWdlRXh0ZW5zaW9ucy5oYXMocGF0aC5leHRuYW1lKGVudHJ5Lm5hbWUpLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmIChzdHJpcEV4dGVuc2lvbihlbnRyeS5uYW1lKSA9PT0gJ2Jhc2VfaW1nJykge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICBpbWFnZXMucHVzaChmdWxsUGF0aClcbiAgICB9XG4gIH1cblxuICB3YWxrKHJvb3QpXG4gIHJldHVybiBpbWFnZXNcbn1cblxuZnVuY3Rpb24gcGFyc2VDb2xvclRva2Vucyh2YWx1ZTogc3RyaW5nKSB7XG4gIHJldHVybiBBcnJheS5mcm9tKFxuICAgIG5ldyBTZXQoXG4gICAgICB2YWx1ZVxuICAgICAgICAudG9Mb3dlckNhc2UoKVxuICAgICAgICAucmVwbGFjZSgvWygpXS9nLCAnJylcbiAgICAgICAgLnNwbGl0KC9bXmEtel0rLylcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKVxuICAgIClcbiAgKVxufVxuXG5mdW5jdGlvbiBpbmZlckRpc3BsYXlOYW1lKG1ldGFkYXRhOiBDbG90aGluZ01ldGFkYXRhRW50cnkgfCB1bmRlZmluZWQsIGZpbGVTdGVtOiBzdHJpbmcpIHtcbiAgaWYgKCFtZXRhZGF0YSkge1xuICAgIHJldHVybiBmaWxlU3RlbS5yZXBsYWNlKC9bLV9dKy9nLCAnICcpXG4gIH1cblxuICBpZiAobWV0YWRhdGEuZ2FybWVudF90eXBlLnRvTG93ZXJDYXNlKCkgPT09ICdrdXJ0YSBzZXQnKSB7XG4gICAgY29uc3QgcHJpbWFyeUNvbG9yID0gbWV0YWRhdGEua3VydGFfY29sb3IudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbWFyb29uJylcbiAgICAgID8gJ0Jyb3duJ1xuICAgICAgOiBtZXRhZGF0YS5rdXJ0YV9jb2xvci5zcGxpdCgvW1xccywoXS8pWzBdXG5cbiAgICByZXR1cm4gYCR7cHJpbWFyeUNvbG9yfSBLdXJ0YWBcbiAgfVxuXG4gIHJldHVybiBtZXRhZGF0YS5nYXJtZW50X3R5cGVcbn1cblxuZnVuY3Rpb24gYnVpbGRTdHlsZVRhZ3MoXG4gIG1ldGFkYXRhOiBDbG90aGluZ01ldGFkYXRhRW50cnkgfCB1bmRlZmluZWQsXG4gIGZvbGRlck5hbWU6IHN0cmluZ1xuKSB7XG4gIGNvbnN0IHRhZ3MgPSBbZm9sZGVyTmFtZV1cbiAgaWYgKCFtZXRhZGF0YSkge1xuICAgIHJldHVybiB0YWdzXG4gIH1cblxuICB0YWdzLnB1c2goc2x1Z2lmeShtZXRhZGF0YS5nYXJtZW50X3R5cGUpKVxuICB0YWdzLnB1c2goc2x1Z2lmeShtZXRhZGF0YS5zdHlsZSkpXG4gIHBhcnNlQ29sb3JUb2tlbnMobWV0YWRhdGEua3VydGFfY29sb3IpLmZvckVhY2goKHRva2VuKSA9PiB0YWdzLnB1c2godG9rZW4pKVxuICBwYXJzZUNvbG9yVG9rZW5zKG1ldGFkYXRhLmJvdHRvbV9jb2xvcikuZm9yRWFjaCgodG9rZW4pID0+IHRhZ3MucHVzaCh0b2tlbikpXG5cbiAgcmV0dXJuIEFycmF5LmZyb20obmV3IFNldCh0YWdzLmZpbHRlcihCb29sZWFuKSkpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkV2FyZHJvYmVDYXRhbG9nKHdhcmRyb2JlUm9vdDogc3RyaW5nKTogV2FyZHJvYmVJdGVtW10ge1xuICBjb25zdCBtZXRhZGF0YUJ5U3RlbSA9IHJlYWRNZXRhZGF0YSh3YXJkcm9iZVJvb3QpXG5cbiAgcmV0dXJuIGNvbGxlY3RXYXJkcm9iZUltYWdlcyh3YXJkcm9iZVJvb3QpLm1hcCgoZnVsbFBhdGgpID0+IHtcbiAgICBjb25zdCByZWxhdGl2ZVBhdGggPSBwYXRoLnJlbGF0aXZlKHdhcmRyb2JlUm9vdCwgZnVsbFBhdGgpLnJlcGxhY2UoL1xcXFwvZywgJy8nKVxuICAgIGNvbnN0IGZvbGRlck5hbWUgPSByZWxhdGl2ZVBhdGguc3BsaXQoJy8nKVswXSA/PyAnd2FyZHJvYmUnXG4gICAgY29uc3QgZmlsZVN0ZW0gPSBzdHJpcEV4dGVuc2lvbihwYXRoLmJhc2VuYW1lKGZ1bGxQYXRoKSlcbiAgICBjb25zdCBtZXRhZGF0YSA9IG1ldGFkYXRhQnlTdGVtLmdldChmaWxlU3RlbSlcblxuICAgIHJldHVybiB7XG4gICAgICBpZDogZmlsZVN0ZW0sXG4gICAgICBuYW1lOiBpbmZlckRpc3BsYXlOYW1lKG1ldGFkYXRhLCBmaWxlU3RlbSksXG4gICAgICBjYXRlZ29yeTogZm9sZGVyQ2F0ZWdvcnlNYXBbZm9sZGVyTmFtZV0gPz8gJ3RvcCcsXG4gICAgICBpbWFnZVBhdGg6IGAvd2FyZHJvYmUtYXNzZXRzLyR7cmVsYXRpdmVQYXRofWAsXG4gICAgICBsb2NhbEltYWdlUGF0aDogZnVsbFBhdGgsXG4gICAgICBzb3VyY2VJbWFnZUZpbGU6IHBhdGguYmFzZW5hbWUoZnVsbFBhdGgpLFxuICAgICAgY29sb3JzOiBtZXRhZGF0YVxuICAgICAgICA/IEFycmF5LmZyb20oXG4gICAgICAgICAgICBuZXcgU2V0KFtcbiAgICAgICAgICAgICAgLi4ucGFyc2VDb2xvclRva2VucyhtZXRhZGF0YS5rdXJ0YV9jb2xvciksXG4gICAgICAgICAgICAgIC4uLnBhcnNlQ29sb3JUb2tlbnMobWV0YWRhdGEuYm90dG9tX2NvbG9yKSxcbiAgICAgICAgICAgIF0pXG4gICAgICAgICAgKVxuICAgICAgICA6IFtdLFxuICAgICAgc3R5bGVUYWdzOiBidWlsZFN0eWxlVGFncyhtZXRhZGF0YSwgZm9sZGVyTmFtZSksXG4gICAgICBsYXllclJvbGU6ICdiYXNlJyxcbiAgICAgIGdhcm1lbnRUeXBlOiBtZXRhZGF0YT8uZ2FybWVudF90eXBlLFxuICAgICAgc3R5bGU6IG1ldGFkYXRhPy5zdHlsZSxcbiAgICAgIGJvdHRvbUNvbG9yOiBtZXRhZGF0YT8uYm90dG9tX2NvbG9yLFxuICAgICAgZGVzaWduRGV0YWlsczogbWV0YWRhdGE/LmRlc2lnbl9kZXRhaWxzLFxuICAgIH1cbiAgfSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEJhc2VJbWFnZVBhdGgod2FyZHJvYmVSb290OiBzdHJpbmcpIHtcbiAgcmV0dXJuIHBhdGguam9pbih3YXJkcm9iZVJvb3QsICdiYXNlX2ltZy5wbmcnKVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1UCxTQUFTLG9CQUFvQjtBQUNwUixPQUFPLFdBQVc7OztBQ0FsQixPQUFPLFVBQVU7QUFDakIsT0FBTyxhQUFhO0FBQ3BCLE9BQU9BLFNBQVE7QUFDZixPQUFPLFlBQVk7QUFDbkIsT0FBT0MsV0FBVTs7O0FDTG1RLE9BQU8sUUFBUTtBQUNuUyxPQUFPLFVBQVU7QUFFakIsU0FBUyxhQUFhLFVBQWtCO0FBQ3RDLE1BQUksQ0FBQyxHQUFHLFdBQVcsUUFBUSxHQUFHO0FBQzVCO0FBQUEsRUFDRjtBQUVBLFFBQU0sUUFBUSxHQUFHLGFBQWEsVUFBVSxPQUFPLEVBQUUsTUFBTSxPQUFPO0FBQzlELGFBQVcsV0FBVyxPQUFPO0FBQzNCLFVBQU0sT0FBTyxRQUFRLEtBQUs7QUFDMUIsUUFBSSxDQUFDLFFBQVEsS0FBSyxXQUFXLEdBQUcsR0FBRztBQUNqQztBQUFBLElBQ0Y7QUFFQSxVQUFNLGlCQUFpQixLQUFLLFFBQVEsR0FBRztBQUN2QyxRQUFJLG1CQUFtQixJQUFJO0FBQ3pCO0FBQUEsSUFDRjtBQUVBLFVBQU0sTUFBTSxLQUFLLE1BQU0sR0FBRyxjQUFjLEVBQUUsS0FBSztBQUMvQyxRQUFJLFFBQVEsS0FBSyxNQUFNLGlCQUFpQixDQUFDLEVBQUUsS0FBSztBQUVoRCxRQUNHLE1BQU0sV0FBVyxHQUFHLEtBQUssTUFBTSxTQUFTLEdBQUcsS0FDM0MsTUFBTSxXQUFXLEdBQUcsS0FBSyxNQUFNLFNBQVMsR0FBRyxHQUM1QztBQUNBLGNBQVEsTUFBTSxNQUFN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LEtBQUssRUFBRSxTQUFTLE1BQU0sT0FBTyxTQUFTLENBQUM7QUFBQSxRQUM3QyxTQUFTLEtBQUs7QUFDWixrQkFBUSxNQUFNLDBCQUEwQixHQUFHO0FBQzNDLGNBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLE9BQU8sMEJBQTBCLENBQUM7QUFBQSxRQUMzRDtBQUFBLE1BQ0YsQ0FBQztBQUVELGFBQU8sWUFBWSxJQUFJLEdBQUc7QUFBQSxJQUM1QjtBQUFBLEVBQ0Y7QUFDRjs7O0FEdFRBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDbEMsTUFBTTtBQUFBLElBQ0osYUFBYTtBQUFBLElBQ2IsWUFBWTtBQUFBLElBQ1osU0FBUztBQUFBLEVBQ1g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJmcyIsICJwYXRoIiwgInBhdGgiLCAiZnMiLCAicGF0aCIsICJmcyIsICJwYXRoIiwgImZzIiwgInBhdGgiLCAiZnMiLCAicGF0aCIsICJwYXRoIiwgIndhcmRyb2JlUm9vdCIsICJmcyIsICJwdWJsaWNSb290IiwgIndhcmRyb2JlUm9vdCIsICJwYXRoIiwgInBhdGgiLCAiZnMiXQp9Cg==
