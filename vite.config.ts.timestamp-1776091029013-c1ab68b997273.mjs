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
              model: "openai/gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: 'You are a fashion expert. Analyze the clothing image and return ONLY a JSON object with these exact fields: {"garment_type": "type like Kurta, T-shirt, Jeans, Sherwani, etc.", "style": "specific style description", "color": "main color(s) in the clothing", "design_details": "notable design elements"}. Return ONLY valid JSON, no other text.'
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Analyze this clothing image and describe it with JSON using keys: garment_type, style, color, design_details"
                    },
                    {
                      type: "image_url",
                      image_url: { url: dataUrl }
                    }
                  ]
                }
              ],
              temperature: 0.3
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
          let metadata;
          try {
            metadata = JSON.parse(content);
          } catch {
            metadata = {
              garment_type: "Unknown",
              style: "Unknown",
              color: "Unknown",
              design_details: content.slice(0, 100)
            };
          }
          console.log("[Wardrobe Detect] Detected:", metadata);
          res.json({ metadata, image: dataUrl });
        } catch (err) {
          console.error("[Wardrobe Detect] Exception:", err);
          res.status(500).json({ error: "Failed to detect clothing metadata" });
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidml0ZS1leHByZXNzLXBsdWdpbi50cyIsICJzZXJ2ZXIvbGliL2xvYWRFbnYudHMiLCAic2VydmVyL2xpYi9taXNzaW9uUGlwZWxpbmUudHMiLCAic2VydmVyL2xpYi9jYXRhbG9nLnRzIiwgInNlcnZlci9saWIvb3BlblJvdXRlci50cyIsICJzZXJ2ZXIvbGliL3dhcmRyb2JlQ2F0YWxvZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9YOi9jb2RleC9mYXNoaW9uX3NwaW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgZXhwcmVzc1BsdWdpbiB9IGZyb20gJy4vdml0ZS1leHByZXNzLXBsdWdpbidcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCksIGV4cHJlc3NQbHVnaW4oKV0sXG4gIHRlc3Q6IHtcbiAgICBlbnZpcm9ubWVudDogJ2pzZG9tJyxcbiAgICBzZXR1cEZpbGVzOiAnLi90ZXN0cy9zZXR1cC50cycsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgfSxcbn0pXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHZpdGUtZXhwcmVzcy1wbHVnaW4udHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1g6L2NvZGV4L2Zhc2hpb25fc3Bpbi92aXRlLWV4cHJlc3MtcGx1Z2luLnRzXCI7aW1wb3J0IHR5cGUgeyBWaXRlRGV2U2VydmVyIH0gZnJvbSAndml0ZSdcbmltcG9ydCBjb3JzIGZyb20gJ2NvcnMnXG5pbXBvcnQgZXhwcmVzcyBmcm9tICdleHByZXNzJ1xuaW1wb3J0IGZzIGZyb20gJ2ZzJ1xuaW1wb3J0IG11bHRlciBmcm9tICdtdWx0ZXInXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgbG9hZExvY2FsRW52IH0gZnJvbSAnLi9zZXJ2ZXIvbGliL2xvYWRFbnYnXG5pbXBvcnQgeyBydW5NaXNzaW9uUGlwZWxpbmUgfSBmcm9tICcuL3NlcnZlci9saWIvbWlzc2lvblBpcGVsaW5lJ1xuaW1wb3J0IHR5cGUgeyBNaXNzaW9uUmVzdWx0IH0gZnJvbSAnLi9zZXJ2ZXIvbGliL3R5cGVzJ1xuaW1wb3J0IHsgbG9hZFdhcmRyb2JlQ2F0YWxvZyB9IGZyb20gJy4vc2VydmVyL2xpYi93YXJkcm9iZUNhdGFsb2cnXG5cbmNvbnN0IHB1YmxpY1Jvb3QgPSBwYXRoLnJlc29sdmUoJ3B1YmxpYycpXG5jb25zdCB3YXJkcm9iZVJvb3QgPSBwYXRoLnJlc29sdmUoJ3dhcmRyb2JlJylcblxuZnMubWtkaXJTeW5jKHBhdGguam9pbihwdWJsaWNSb290LCAnZ2VuZXJhdGVkJyksIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG5cbmV4cG9ydCBmdW5jdGlvbiBleHByZXNzUGx1Z2luKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdleHByZXNzLXBsdWdpbicsXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcjogVml0ZURldlNlcnZlcikge1xuICAgICAgY29uc3QgYXBwID0gZXhwcmVzcygpXG4gICAgICBjb25zdCB1cGxvYWQgPSBtdWx0ZXIoeyBzdG9yYWdlOiBtdWx0ZXIubWVtb3J5U3RvcmFnZSgpIH0pXG4gICAgICBsb2FkTG9jYWxFbnYocHJvY2Vzcy5jd2QoKSlcblxuICAgICAgYXBwLnVzZShjb3JzKCkpXG4gICAgICBhcHAudXNlKGV4cHJlc3MuanNvbigpKVxuICAgICAgYXBwLnVzZSgnL2dlbmVyYXRlZCcsIGV4cHJlc3Muc3RhdGljKHBhdGguam9pbihwdWJsaWNSb290LCAnZ2VuZXJhdGVkJykpKVxuICAgICAgYXBwLnVzZSgnL3dhcmRyb2JlLWFzc2V0cycsIGV4cHJlc3Muc3RhdGljKHdhcmRyb2JlUm9vdCkpXG5cbiAgICAgIGNvbnN0IG1pc3Npb25zID0gbmV3IE1hcDxzdHJpbmcsIE1pc3Npb25SZXN1bHQ+KClcblxuICAgICAgZnVuY3Rpb24gZ2VuZXJhdGVJZCgpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMiwgMTApXG4gICAgICB9XG5cbiAgICAgIGFwcC5nZXQoJy9hcGkvd2FyZHJvYmUnLCAoX3JlcSwgcmVzKSA9PiB7XG4gICAgICAgIHJlcy5qc29uKGxvYWRXYXJkcm9iZUNhdGFsb2cod2FyZHJvYmVSb290KSlcbiAgICAgIH0pXG5cbiAgICAgIGFwcC5wb3N0KCcvYXBpL21pc3Npb25zJywgdXBsb2FkLnNpbmdsZSgnYXVkaW8nKSwgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGNvbnN0IG1pc3Npb25UZXh0ID1cbiAgICAgICAgICB0eXBlb2YgcmVxLmJvZHkudGV4dCA9PT0gJ3N0cmluZycgPyByZXEuYm9keS50ZXh0LnRyaW0oKSA6ICcnXG5cbiAgICAgICAgaWYgKCFtaXNzaW9uVGV4dCkge1xuICAgICAgICAgIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6ICdQcm92aWRlIHRleHQgdG8gc3RhcnQgdGhlIG1pc3Npb24uJyB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaWQgPSBnZW5lcmF0ZUlkKClcbiAgICAgICAgY29uc3QgbWlzc2lvbjogTWlzc2lvblJlc3VsdCA9IHtcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBzdGFnZTogJ2lkbGUnLFxuICAgICAgICAgIG1pc3Npb25UZXh0LFxuICAgICAgICAgIHNlbGVjdGVkSXRlbXM6IFtdLFxuICAgICAgICAgIGV4cGxhbmF0aW9uOiAnJyxcbiAgICAgICAgICBmaW5hbEltYWdlVXJsOiBudWxsLFxuICAgICAgICAgIGVycm9yOiBudWxsLFxuICAgICAgICAgIHN0YWdlVGltaW5nczoge30sXG4gICAgICAgIH1cblxuICAgICAgICBtaXNzaW9ucy5zZXQoaWQsIG1pc3Npb24pXG5cbiAgICAgICAgdm9pZCBydW5NaXNzaW9uUGlwZWxpbmUoe1xuICAgICAgICAgIG1pc3Npb24sXG4gICAgICAgICAgd2FyZHJvYmU6IGxvYWRXYXJkcm9iZUNhdGFsb2cod2FyZHJvYmVSb290KSxcbiAgICAgICAgICBwdWJsaWNSb290LFxuICAgICAgICAgIHdhcmRyb2JlUm9vdCxcbiAgICAgICAgfSlcblxuICAgICAgICByZXMuanNvbih7IGlkLCBzdGFnZTogJ3BsYW5uaW5nJyB9KVxuICAgICAgfSlcblxuICAgICAgYXBwLmdldCgnL2FwaS9taXNzaW9ucy86aWQnLCAocmVxLCByZXMpID0+IHtcbiAgICAgICAgY29uc3QgbWlzc2lvbiA9IG1pc3Npb25zLmdldChyZXEucGFyYW1zLmlkKVxuXG4gICAgICAgIGlmICghbWlzc2lvbikge1xuICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6ICdNaXNzaW9uIG5vdCBmb3VuZCcgfSlcbiAgICAgICAgICByZXR1cm5cbiAgICAgICAgfVxuXG4gICAgICAgIHJlcy5qc29uKG1pc3Npb24pXG4gICAgICB9KVxuXG4gICAgICBhcHAucG9zdCgnL2FwaS90cmFuc2NyaWJlJywgdXBsb2FkLnNpbmdsZSgnYXVkaW8nKSwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGNvbnN0IGF1ZGlvRmlsZSA9IHJlcS5maWxlXG4gICAgICAgIGlmICghYXVkaW9GaWxlKSB7XG4gICAgICAgICAgcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ05vIGF1ZGlvIGZpbGUgcHJvdmlkZWQnIH0pXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQSV9LRVlcbiAgICAgICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnT1BFTlJPVVRFUl9BUElfS0VZIG5vdCBjb25maWd1cmVkJyB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBhdWRpb0J1ZmZlciA9IGF1ZGlvRmlsZS5idWZmZXJcbiAgICAgICAgICBjb25zdCBhdWRpb0Jhc2U2NCA9IEJ1ZmZlci5mcm9tKGF1ZGlvQnVmZmVyKS50b1N0cmluZygnYmFzZTY0JylcblxuICAgICAgICAgIGNvbnNvbGUubG9nKCdbVHJhbnNjcmliZV0gU2VuZGluZyByZXF1ZXN0IHRvIE9wZW5Sb3V0ZXIsIGF1ZGlvIHNpemU6JywgYXVkaW9CdWZmZXIubGVuZ3RoKVxuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9vcGVucm91dGVyLmFpL2FwaS92MS9jaGF0L2NvbXBsZXRpb25zJywge1xuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHthcGlLZXl9YCxcbiAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgJ0hUVFAtUmVmZXJlcic6IHByb2Nlc3MuZW52Lk9QRU5ST1VURVJfU0lURV9VUkwgPz8gJ2h0dHA6Ly9sb2NhbGhvc3Q6NTE3MycsXG4gICAgICAgICAgICAgICdYLVRpdGxlJzogcHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9BUFBfTkFNRSA/PyAnRmFzaGlvblNwaW4nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgbW9kZWw6ICdvcGVuYWkvZ3B0LTRvLWF1ZGlvLXByZXZpZXcnLFxuICAgICAgICAgICAgICBtb2RhbGl0aWVzOiBbJ3RleHQnXSxcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICByb2xlOiAndXNlcicsXG4gICAgICAgICAgICAgICAgICBjb250ZW50OiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgICAgICAgICAgdGV4dDogJ1RyYW5zY3JpYmUgdGhpcyBhdWRpbyBleGFjdGx5IGFzIHNwb2tlbi4nLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2lucHV0X2F1ZGlvJyxcbiAgICAgICAgICAgICAgICAgICAgICBpbnB1dF9hdWRpbzoge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogYXVkaW9CYXNlNjQsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXQ6ICd3YXYnLFxuICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2VUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpXG4gICAgICAgICAgY29uc29sZS5sb2coJ1tUcmFuc2NyaWJlXSBSZXNwb25zZSBzdGF0dXM6JywgcmVzcG9uc2Uuc3RhdHVzKVxuXG4gICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1RyYW5zY3JpYmVdIE9wZW5Sb3V0ZXIgZXJyb3I6JywgcmVzcG9uc2VUZXh0KVxucmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogYEZhaWxlZCB0byB0cmFuc2NyaWJlIGF1ZGlvOiAke3Jlc3BvbnNlVGV4dC5zbGljZSgwLCAyMDApfWAgfSlcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCByZXN1bHRcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzdWx0ID0gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpXG4gICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbVHJhbnNjcmliZV0gSW52YWxpZCBKU09OOicsIHJlc3BvbnNlVGV4dClcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdJbnZhbGlkIHJlc3BvbnNlIGZyb20gdHJhbnNjcmlwdGlvbiBzZXJ2aWNlJyB9KVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGV0IHRleHQgPSAnJ1xuICAgICAgICAgIGNvbnN0IG1lc3NhZ2VDb250ZW50ID0gcmVzdWx0Py5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnRcbiAgICAgICAgICBpZiAodHlwZW9mIG1lc3NhZ2VDb250ZW50ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdGV4dCA9IG1lc3NhZ2VDb250ZW50XG4gICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KG1lc3NhZ2VDb250ZW50KSkge1xuICAgICAgICAgICAgdGV4dCA9IG1lc3NhZ2VDb250ZW50XG4gICAgICAgICAgICAgIC5maWx0ZXIoKGM6IHVua25vd24pID0+IHR5cGVvZiBjID09PSAnb2JqZWN0JyAmJiBjICE9PSBudWxsICYmICd0eXBlJyBpbiBjICYmIChjIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS50eXBlID09PSAndGV4dCcpXG4gICAgICAgICAgICAgIC5tYXAoKGM6IHVua25vd24pID0+IChjIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS50ZXh0IGFzIHN0cmluZylcbiAgICAgICAgICAgICAgLmpvaW4oJycpXG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnNvbGUubG9nKCdbVHJhbnNjcmliZV0gR290IHRleHQ6JywgdGV4dCB8fCAnKGVtcHR5KScpXG4gICAgICAgICAgcmVzLmpzb24oeyB0ZXh0IH0pXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tUcmFuc2NyaWJlXSBFeGNlcHRpb246JywgZXJyKVxuICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdGYWlsZWQgdG8gdHJhbnNjcmliZSBhdWRpbycgfSlcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgYXBwLnBvc3QoJy9hcGkvd2FyZHJvYmUvZGV0ZWN0JywgdXBsb2FkLnNpbmdsZSgnaW1hZ2UnKSwgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgIGNvbnN0IGltYWdlRmlsZSA9IHJlcS5maWxlXG4gICAgICAgIGlmICghaW1hZ2VGaWxlKSB7XG4gICAgICAgICAgcmVzLnN0YXR1cyg0MDApLmpzb24oeyBlcnJvcjogJ05vIGltYWdlIGZpbGUgcHJvdmlkZWQnIH0pXG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQSV9LRVlcbiAgICAgICAgaWYgKCFhcGlLZXkpIHtcbiAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnT1BFTlJPVVRFUl9BUElfS0VZIG5vdCBjb25maWd1cmVkJyB9KVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBpbWFnZUJ1ZmZlciA9IGltYWdlRmlsZS5idWZmZXJcbiAgICAgICAgICBjb25zdCBpbWFnZUJhc2U2NCA9IEJ1ZmZlci5mcm9tKGltYWdlQnVmZmVyKS50b1N0cmluZygnYmFzZTY0JylcbiAgICAgICAgICBjb25zdCBtaW1lVHlwZSA9IGltYWdlRmlsZS5taW1ldHlwZSB8fCAnaW1hZ2UvanBlZydcbiAgICAgICAgICBjb25zdCBkYXRhVXJsID0gYGRhdGE6JHttaW1lVHlwZX07YmFzZTY0LCR7aW1hZ2VCYXNlNjR9YFxuXG4gICAgICAgICAgY29uc29sZS5sb2coJ1tXYXJkcm9iZSBEZXRlY3RdIFNlbmRpbmcgaW1hZ2UgdG8gQUkgZm9yIGRldGVjdGlvbicpXG5cbiAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKCdodHRwczovL29wZW5yb3V0ZXIuYWkvYXBpL3YxL2NoYXQvY29tcGxldGlvbnMnLCB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke2FwaUtleX1gLFxuICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAnSFRUUC1SZWZlcmVyJzogcHJvY2Vzcy5lbnYuT1BFTlJPVVRFUl9TSVRFX1VSTCA/PyAnaHR0cDovL2xvY2FsaG9zdDo1MTczJyxcbiAgICAgICAgICAgICAgJ1gtVGl0bGUnOiBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQUF9OQU1FID8/ICdGYXNoaW9uU3BpbicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICBtb2RlbDogJ29wZW5haS9ncHQtNG8tbWluaScsXG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgcm9sZTogJ3N5c3RlbScsXG4gICAgICAgICAgICAgICAgICBjb250ZW50OiAnWW91IGFyZSBhIGZhc2hpb24gZXhwZXJ0LiBBbmFseXplIHRoZSBjbG90aGluZyBpbWFnZSBhbmQgcmV0dXJuIE9OTFkgYSBKU09OIG9iamVjdCB3aXRoIHRoZXNlIGV4YWN0IGZpZWxkczogJyArXG4gICAgICAgICAgICAgICAgICAgICd7XCJnYXJtZW50X3R5cGVcIjogXCJ0eXBlIGxpa2UgS3VydGEsIFQtc2hpcnQsIEplYW5zLCBTaGVyd2FuaSwgZXRjLlwiLCAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1wic3R5bGVcIjogXCJzcGVjaWZpYyBzdHlsZSBkZXNjcmlwdGlvblwiLCAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1wiY29sb3JcIjogXCJtYWluIGNvbG9yKHMpIGluIHRoZSBjbG90aGluZ1wiLCAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1wiZGVzaWduX2RldGFpbHNcIjogXCJub3RhYmxlIGRlc2lnbiBlbGVtZW50c1wifS4gJyArXG4gICAgICAgICAgICAgICAgICAgICdSZXR1cm4gT05MWSB2YWxpZCBKU09OLCBubyBvdGhlciB0ZXh0LicsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICByb2xlOiAndXNlcicsXG4gICAgICAgICAgICAgICAgICBjb250ZW50OiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICAgICAgICAgICAgdGV4dDogJ0FuYWx5emUgdGhpcyBjbG90aGluZyBpbWFnZSBhbmQgZGVzY3JpYmUgaXQgd2l0aCBKU09OIHVzaW5nIGtleXM6IGdhcm1lbnRfdHlwZSwgc3R5bGUsIGNvbG9yLCBkZXNpZ25fZGV0YWlscycsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2VfdXJsJyxcbiAgICAgICAgICAgICAgICAgICAgICBpbWFnZV91cmw6IHsgdXJsOiBkYXRhVXJsIH0sXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgY29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbV2FyZHJvYmUgRGV0ZWN0XSBPcGVuUm91dGVyIGVycm9yOicsIGVycm9yVGV4dClcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6ICdGYWlsZWQgdG8gZGV0ZWN0IGNsb3RoaW5nIG1ldGFkYXRhJyB9KVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgcmVzcG9uc2UuanNvbigpXG4gICAgICAgICAgY29uc3QgY29udGVudCA9IHJlc3VsdD8uY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50ID8/ICd7fSdcblxuICAgICAgICAgIGxldCBtZXRhZGF0YVxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBtZXRhZGF0YSA9IEpTT04ucGFyc2UoY29udGVudClcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIG1ldGFkYXRhID0ge1xuICAgICAgICAgICAgICBnYXJtZW50X3R5cGU6ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgc3R5bGU6ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgY29sb3I6ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgZGVzaWduX2RldGFpbHM6IGNvbnRlbnQuc2xpY2UoMCwgMTAwKSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zb2xlLmxvZygnW1dhcmRyb2JlIERldGVjdF0gRGV0ZWN0ZWQ6JywgbWV0YWRhdGEpXG4gICAgICAgICAgcmVzLmpzb24oeyBtZXRhZGF0YSwgaW1hZ2U6IGRhdGFVcmwgfSlcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignW1dhcmRyb2JlIERldGVjdF0gRXhjZXB0aW9uOicsIGVycilcbiAgICAgICAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiAnRmFpbGVkIHRvIGRldGVjdCBjbG90aGluZyBtZXRhZGF0YScgfSlcbiAgICAgICAgfVxuICAgICAgfSlcblxuICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhcHApXG4gICAgfSxcbiAgfVxufSIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHNlcnZlclxcXFxsaWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXFxcXGxvYWRFbnYudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1g6L2NvZGV4L2Zhc2hpb25fc3Bpbi9zZXJ2ZXIvbGliL2xvYWRFbnYudHNcIjtpbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuXG5mdW5jdGlvbiBhcHBseUVudkZpbGUoZmlsZVBhdGg6IHN0cmluZykge1xuICBpZiAoIWZzLmV4aXN0c1N5bmMoZmlsZVBhdGgpKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICBjb25zdCBsaW5lcyA9IGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0Zi04Jykuc3BsaXQoL1xccj9cXG4vKVxuICBmb3IgKGNvbnN0IHJhd0xpbmUgb2YgbGluZXMpIHtcbiAgICBjb25zdCBsaW5lID0gcmF3TGluZS50cmltKClcbiAgICBpZiAoIWxpbmUgfHwgbGluZS5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgY29uc3Qgc2VwYXJhdG9ySW5kZXggPSBsaW5lLmluZGV4T2YoJz0nKVxuICAgIGlmIChzZXBhcmF0b3JJbmRleCA9PT0gLTEpIHtcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgY29uc3Qga2V5ID0gbGluZS5zbGljZSgwLCBzZXBhcmF0b3JJbmRleCkudHJpbSgpXG4gICAgbGV0IHZhbHVlID0gbGluZS5zbGljZShzZXBhcmF0b3JJbmRleCArIDEpLnRyaW0oKVxuXG4gICAgaWYgKFxuICAgICAgKHZhbHVlLnN0YXJ0c1dpdGgoJ1wiJykgJiYgdmFsdWUuZW5kc1dpdGgoJ1wiJykpIHx8XG4gICAgICAodmFsdWUuc3RhcnRzV2l0aChcIidcIikgJiYgdmFsdWUuZW5kc1dpdGgoXCInXCIpKVxuICAgICkge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5zbGljZSgxLCAtMSlcbiAgICB9XG5cbiAgICBpZiAoIShrZXkgaW4gcHJvY2Vzcy5lbnYpKSB7XG4gICAgICBwcm9jZXNzLmVudltrZXldID0gdmFsdWVcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRMb2NhbEVudihwcm9qZWN0Um9vdDogc3RyaW5nKSB7XG4gIGFwcGx5RW52RmlsZShwYXRoLmpvaW4ocHJvamVjdFJvb3QsICcuZW52JykpXG4gIGFwcGx5RW52RmlsZShwYXRoLmpvaW4ocHJvamVjdFJvb3QsICcuZW52LmxvY2FsJykpXG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJYOlxcXFxjb2RleFxcXFxmYXNoaW9uX3NwaW5cXFxcc2VydmVyXFxcXGxpYlxcXFxtaXNzaW9uUGlwZWxpbmUudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1g6L2NvZGV4L2Zhc2hpb25fc3Bpbi9zZXJ2ZXIvbGliL21pc3Npb25QaXBlbGluZS50c1wiO2ltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgeyByZXNvbHZlV2FyZHJvYmVJdGVtcywgd3JpdGVJbWFnZURhdGFVcmwgfSBmcm9tICcuL2NhdGFsb2cnXG5pbXBvcnQgeyBnZW5lcmF0ZUxvb2tXaXRoT3BlblJvdXRlciwgc2VsZWN0T3V0Zml0V2l0aE9wZW5Sb3V0ZXIgfSBmcm9tICcuL29wZW5Sb3V0ZXInXG5pbXBvcnQgdHlwZSB7IE1pc3Npb25SZXN1bHQsIE1pc3Npb25TdGFnZSwgV2FyZHJvYmVJdGVtIH0gZnJvbSAnLi90eXBlcydcbmltcG9ydCB7IGdldEJhc2VJbWFnZVBhdGggfSBmcm9tICcuL3dhcmRyb2JlQ2F0YWxvZydcblxuaW50ZXJmYWNlIE1pc3Npb25BdWRpb0lucHV0IHtcbiAgYnVmZmVyOiBCdWZmZXJcbiAgbWltZVR5cGU6IHN0cmluZ1xuICBmaWxlTmFtZTogc3RyaW5nXG59XG5cbmludGVyZmFjZSBQaXBlbGluZUNvbnRleHQge1xuICBtaXNzaW9uOiBNaXNzaW9uUmVzdWx0XG4gIHdhcmRyb2JlOiBXYXJkcm9iZUl0ZW1bXVxuICBwdWJsaWNSb290OiBzdHJpbmdcbiAgd2FyZHJvYmVSb290OiBzdHJpbmdcbiAgYXVkaW8/OiBNaXNzaW9uQXVkaW9JbnB1dFxufVxuXG5mdW5jdGlvbiBzbGVlcChtczogbnVtYmVyKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpXG59XG5cbmZ1bmN0aW9uIHNldFN0YWdlKG1pc3Npb246IE1pc3Npb25SZXN1bHQsIHN0YWdlOiBNaXNzaW9uU3RhZ2UpIHtcbiAgbWlzc2lvbi5zdGFnZSA9IHN0YWdlXG4gIG1pc3Npb24uc3RhZ2VUaW1pbmdzW3N0YWdlXSA9IERhdGUubm93KClcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJ1bk1pc3Npb25QaXBlbGluZSh7XG4gIG1pc3Npb24sXG4gIHdhcmRyb2JlLFxuICBwdWJsaWNSb290LFxuICB3YXJkcm9iZVJvb3QsXG59OiBQaXBlbGluZUNvbnRleHQpIHtcbiAgdHJ5IHtcbiAgICBzZXRTdGFnZShtaXNzaW9uLCAncGxhbm5pbmcnKVxuICAgIGF3YWl0IHNsZWVwKDI1MClcblxuICAgIHNldFN0YWdlKG1pc3Npb24sICdzZWxlY3RpbmcnKVxuICAgIGNvbnN0IGRlY2lzaW9uID0gYXdhaXQgc2VsZWN0T3V0Zml0V2l0aE9wZW5Sb3V0ZXIobWlzc2lvbi5taXNzaW9uVGV4dCwgd2FyZHJvYmUpXG4gICAgbWlzc2lvbi5zZWxlY3RlZEl0ZW1zID0gZGVjaXNpb24uc2VsZWN0ZWRJdGVtc1xuICAgIG1pc3Npb24uZXhwbGFuYXRpb24gPSBkZWNpc2lvbi5leHBsYW5hdGlvblxuICAgIGF3YWl0IHNsZWVwKDI1MClcblxuICAgIHNldFN0YWdlKG1pc3Npb24sICdyZW5kZXJpbmcnKVxuICAgIGNvbnN0IHNlbGVjdGVkR2FybWVudHMgPSByZXNvbHZlV2FyZHJvYmVJdGVtcyhtaXNzaW9uLnNlbGVjdGVkSXRlbXMsIHdhcmRyb2JlKVxuICAgIGNvbnN0IHNlbGVjdGVkR2FybWVudCA9IHNlbGVjdGVkR2FybWVudHNbMF1cblxuICAgIGlmICghc2VsZWN0ZWRHYXJtZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIHdhcmRyb2JlIGl0ZW0gd2FzIHNlbGVjdGVkIGZvciBpbWFnZSBnZW5lcmF0aW9uLicpXG4gICAgfVxuXG4gICAgY29uc3QgZ2VuZXJhdGVkSW1hZ2UgPSBhd2FpdCBnZW5lcmF0ZUxvb2tXaXRoT3BlblJvdXRlcihcbiAgICAgIG1pc3Npb24ubWlzc2lvblRleHQsXG4gICAgICBzZWxlY3RlZEdhcm1lbnQsXG4gICAgICBkZWNpc2lvbi5nZW5lcmF0aW9uUHJvbXB0ID8/XG4gICAgICAgIGBEcmVzcyB0aGUgY2hhcmFjdGVyIGluICR7c2VsZWN0ZWRHYXJtZW50Lm5hbWV9LmAsXG4gICAgICBnZXRCYXNlSW1hZ2VQYXRoKHdhcmRyb2JlUm9vdClcbiAgICApXG5cbiAgICBpZiAoZ2VuZXJhdGVkSW1hZ2UpIHtcbiAgICAgIGNvbnN0IG91dHB1dFBhdGggPSBwYXRoLmpvaW4ocHVibGljUm9vdCwgJ2dlbmVyYXRlZCcsIGAke21pc3Npb24uaWR9LnBuZ2ApXG4gICAgICB3cml0ZUltYWdlRGF0YVVybChvdXRwdXRQYXRoLCBnZW5lcmF0ZWRJbWFnZSlcbiAgICAgIG1pc3Npb24uZmluYWxJbWFnZVVybCA9IGAvZ2VuZXJhdGVkLyR7bWlzc2lvbi5pZH0ucG5nYFxuICAgIH0gZWxzZSB7XG4gICAgICBtaXNzaW9uLmZpbmFsSW1hZ2VVcmwgPSAnL3dhcmRyb2JlLWFzc2V0cy9iYXNlX2ltZy5wbmcnXG4gICAgfVxuXG4gICAgc2V0U3RhZ2UobWlzc2lvbiwgJ2RvbmUnKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tNaXNzaW9uUGlwZWxpbmVdIEVycm9yOicsIGVycm9yKVxuICAgIG1pc3Npb24uc3RhZ2UgPSAnZXJyb3InXG4gICAgbWlzc2lvbi5lcnJvciA9XG4gICAgICBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdNaXNzaW9uIHBpcGVsaW5lIGZhaWxlZC4nXG4gIH1cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHNlcnZlclxcXFxsaWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXFxcXGNhdGFsb2cudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1g6L2NvZGV4L2Zhc2hpb25fc3Bpbi9zZXJ2ZXIvbGliL2NhdGFsb2cudHNcIjtpbXBvcnQgZnMgZnJvbSAnZnMnXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHR5cGUgeyBXYXJkcm9iZUl0ZW0gfSBmcm9tICcuL3R5cGVzJ1xuXG5leHBvcnQgZnVuY3Rpb24gbG9hZFdhcmRyb2JlTWFuaWZlc3QobWFuaWZlc3RQYXRoOiBzdHJpbmcpOiBXYXJkcm9iZUl0ZW1bXSB7XG4gIHJldHVybiBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhtYW5pZmVzdFBhdGgsICd1dGYtOCcpKSBhcyBXYXJkcm9iZUl0ZW1bXVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc3VtbWFyaXplV2FyZHJvYmUod2FyZHJvYmU6IFdhcmRyb2JlSXRlbVtdKSB7XG4gIHJldHVybiB3YXJkcm9iZS5tYXAoKGl0ZW0pID0+ICh7XG4gICAgaWQ6IGl0ZW0uaWQsXG4gICAgbmFtZTogaXRlbS5uYW1lLFxuICAgIGNhdGVnb3J5OiBpdGVtLmNhdGVnb3J5LFxuICAgIGNvbG9yczogaXRlbS5jb2xvcnMsXG4gICAgc3R5bGVUYWdzOiBpdGVtLnN0eWxlVGFncyxcbiAgICBsYXllclJvbGU6IGl0ZW0ubGF5ZXJSb2xlLFxuICB9KSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVXYXJkcm9iZUl0ZW1zKGlkczogc3RyaW5nW10sIHdhcmRyb2JlOiBXYXJkcm9iZUl0ZW1bXSkge1xuICByZXR1cm4gaWRzXG4gICAgLm1hcCgoaWQpID0+IHdhcmRyb2JlLmZpbmQoKGl0ZW0pID0+IGl0ZW0uaWQgPT09IGlkKSlcbiAgICAuZmlsdGVyKChpdGVtKTogaXRlbSBpcyBXYXJkcm9iZUl0ZW0gPT4gQm9vbGVhbihpdGVtKSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvRGF0YVVybEZyb21GaWxlKGZpbGVQYXRoOiBzdHJpbmcpIHtcbiAgY29uc3QgYnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoKVxuICBjb25zdCBleHRlbnNpb24gPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGgpLnNsaWNlKDEpIHx8ICdwbmcnXG4gIHJldHVybiBgZGF0YTppbWFnZS8ke2V4dGVuc2lvbn07YmFzZTY0LCR7YnVmZmVyLnRvU3RyaW5nKCdiYXNlNjQnKX1gXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b0RhdGFVcmxGcm9tSW1hZ2UocHVibGljUm9vdDogc3RyaW5nLCBpbWFnZVBhdGg6IHN0cmluZykge1xuICBjb25zdCBsb2NhbFBhdGggPSBwYXRoLmpvaW4ocHVibGljUm9vdCwgaW1hZ2VQYXRoLnJlcGxhY2UoL15cXC8vLCAnJykpXG4gIHJldHVybiB0b0RhdGFVcmxGcm9tRmlsZShsb2NhbFBhdGgpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB3cml0ZUltYWdlRGF0YVVybChvdXRwdXRQYXRoOiBzdHJpbmcsIGRhdGFVcmw6IHN0cmluZykge1xuICBjb25zdCBtYXRjaCA9IGRhdGFVcmwubWF0Y2goL15kYXRhOmltYWdlXFwvKFthLXpBLVowLTkrLi1dKyk7YmFzZTY0LCguKykkLylcbiAgaWYgKCFtYXRjaCkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgaW1hZ2UgcGF5bG9hZCByZWNlaXZlZCBmcm9tIGltYWdlIGdlbmVyYXRpb24gcHJvdmlkZXIuJylcbiAgfVxuXG4gIGZzLm1rZGlyU3luYyhwYXRoLmRpcm5hbWUob3V0cHV0UGF0aCksIHsgcmVjdXJzaXZlOiB0cnVlIH0pXG4gIGZzLndyaXRlRmlsZVN5bmMob3V0cHV0UGF0aCwgQnVmZmVyLmZyb20obWF0Y2hbMl0sICdiYXNlNjQnKSlcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiWDpcXFxcY29kZXhcXFxcZmFzaGlvbl9zcGluXFxcXHNlcnZlclxcXFxsaWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXFxcXG9wZW5Sb3V0ZXIudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1g6L2NvZGV4L2Zhc2hpb25fc3Bpbi9zZXJ2ZXIvbGliL29wZW5Sb3V0ZXIudHNcIjtpbXBvcnQgeyB0b0RhdGFVcmxGcm9tRmlsZSB9IGZyb20gJy4vY2F0YWxvZydcbmltcG9ydCB0eXBlIHsgT3V0Zml0RGVjaXNpb24sIFdhcmRyb2JlSXRlbSB9IGZyb20gJy4vdHlwZXMnXG5cbmludGVyZmFjZSBPcGVuUm91dGVyQ2hvaWNlIHtcbiAgbWVzc2FnZT86IHtcbiAgICBjb250ZW50Pzogc3RyaW5nXG4gICAgaW1hZ2VzPzogQXJyYXk8e1xuICAgICAgaW1hZ2VfdXJsPzoge1xuICAgICAgICB1cmw/OiBzdHJpbmdcbiAgICAgIH1cbiAgICB9PlxuICB9XG59XG5cbmludGVyZmFjZSBPcGVuUm91dGVyUmVzcG9uc2Uge1xuICBjaG9pY2VzPzogT3BlblJvdXRlckNob2ljZVtdXG59XG5cbmludGVyZmFjZSBTZWxlY3Rpb25SZXN1bHQge1xuICBzZWxlY3RlZEl0ZW1JZDogc3RyaW5nXG4gIGV4cGxhbmF0aW9uOiBzdHJpbmdcbiAgZ2VuZXJhdGlvblByb21wdDogc3RyaW5nXG59XG5cbmZ1bmN0aW9uIGdldE9wZW5Sb3V0ZXJIZWFkZXJzKCkge1xuICByZXR1cm4ge1xuICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHtwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQSV9LRVl9YCxcbiAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgIC4uLihwcm9jZXNzLmVudi5PUEVOUk9VVEVSX1NJVEVfVVJMXG4gICAgICA/IHsgJ0hUVFAtUmVmZXJlcic6IHByb2Nlc3MuZW52Lk9QRU5ST1VURVJfU0lURV9VUkwgfVxuICAgICAgOiB7fSksXG4gICAgLi4uKHByb2Nlc3MuZW52Lk9QRU5ST1VURVJfQVBQX05BTUVcbiAgICAgID8geyAnWC1UaXRsZSc6IHByb2Nlc3MuZW52Lk9QRU5ST1VURVJfQVBQX05BTUUgfVxuICAgICAgOiB7fSksXG4gIH1cbn1cblxuZnVuY3Rpb24gc3VtbWFyaXplV2FyZHJvYmUod2FyZHJvYmU6IFdhcmRyb2JlSXRlbVtdKSB7XG4gIHJldHVybiB3YXJkcm9iZS5tYXAoKGl0ZW0pID0+ICh7XG4gICAgaWQ6IGl0ZW0uaWQsXG4gICAgbmFtZTogaXRlbS5uYW1lLFxuICAgIGdhcm1lbnRUeXBlOiBpdGVtLmdhcm1lbnRUeXBlLFxuICAgIHN0eWxlOiBpdGVtLnN0eWxlLFxuICAgIGNvbG9yczogaXRlbS5jb2xvcnMsXG4gICAgZGVzaWduRGV0YWlsczogaXRlbS5kZXNpZ25EZXRhaWxzLFxuICAgIHNvdXJjZUltYWdlRmlsZTogaXRlbS5zb3VyY2VJbWFnZUZpbGUsXG4gIH0pKVxufVxuXG5mdW5jdGlvbiBmYWxsYmFja1NlbGVjdGlvbihtaXNzaW9uVGV4dDogc3RyaW5nLCB3YXJkcm9iZTogV2FyZHJvYmVJdGVtW10pOiBPdXRmaXREZWNpc2lvbiB7XG4gIGNvbnN0IHRleHQgPSBtaXNzaW9uVGV4dC50b0xvd2VyQ2FzZSgpXG5cbiAgY29uc3Qgc2VsZWN0ZWQgPVxuICAgIHdhcmRyb2JlLmZpbmQoXG4gICAgICAoaXRlbSkgPT5cbiAgICAgICAgL2RhdGV8ZGlubmVyfG5pZ2h0fGV2ZW5pbmcvLnRlc3QodGV4dCkgJiZcbiAgICAgICAgaXRlbS5jb2xvcnMuaW5jbHVkZXMoJ21hcm9vbicpXG4gICAgKSA/P1xuICAgIHdhcmRyb2JlLmZpbmQoXG4gICAgICAoaXRlbSkgPT4gL3NoYWFkaXx3ZWRkaW5nfGZlc3RpdmUvLnRlc3QodGV4dCkgJiYgaXRlbS5jb2xvcnMuaW5jbHVkZXMoJ211c3RhcmQnKVxuICAgICkgPz9cbiAgICB3YXJkcm9iZS5maW5kKFxuICAgICAgKGl0ZW0pID0+IC9jb2xsZWdlfGNhc3VhbHxkYXkvLnRlc3QodGV4dCkgJiYgaXRlbS5jb2xvcnMuaW5jbHVkZXMoJ2xpZ2h0JylcbiAgICApID8/XG4gICAgd2FyZHJvYmVbMF1cblxuICBpZiAoIXNlbGVjdGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdXYXJkcm9iZSBpcyBlbXB0eS4nKVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzZWxlY3RlZEl0ZW1zOiBbc2VsZWN0ZWQuaWRdLFxuICAgIGV4cGxhbmF0aW9uOiBgUGlja2VkICR7c2VsZWN0ZWQubmFtZX0gZnJvbSB0aGUgd2FyZHJvYmUgZm9yIFwiJHttaXNzaW9uVGV4dH1cIi5gLFxuICAgIGdlbmVyYXRpb25Qcm9tcHQ6XG4gICAgICBgRHJlc3MgdGhlIGJhc2UgY2hhcmFjdGVyIGluIHRoZSBleGFjdCBnYXJtZW50IHNob3duIGluIHRoZSByZWZlcmVuY2UgaW1hZ2UgZm9yICR7c2VsZWN0ZWQubmFtZX0uIGAgK1xuICAgICAgYEtlZXAgdGhlIGZhY2UsIHBvc2UsIGFuZCBib2R5IHByb3BvcnRpb25zIHVuY2hhbmdlZCwgYW5kIG1ha2UgdGhlIHJlc3VsdCBsb29rIGxpa2UgYSBwb2xpc2hlZCBmYXNoaW9uIHBvcnRyYWl0LmAsXG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VEZWNpc2lvbihjb250ZW50OiBzdHJpbmcsIHdhcmRyb2JlOiBXYXJkcm9iZUl0ZW1bXSkge1xuICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGNvbnRlbnQpIGFzIFNlbGVjdGlvblJlc3VsdFxuICBpZiAoXG4gICAgdHlwZW9mIHBhcnNlZC5zZWxlY3RlZEl0ZW1JZCAhPT0gJ3N0cmluZycgfHxcbiAgICB0eXBlb2YgcGFyc2VkLmV4cGxhbmF0aW9uICE9PSAnc3RyaW5nJyB8fFxuICAgIHR5cGVvZiBwYXJzZWQuZ2VuZXJhdGlvblByb21wdCAhPT0gJ3N0cmluZydcbiAgKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdPcGVuUm91dGVyIGRpZCBub3QgcmV0dXJuIHRoZSBleHBlY3RlZCBKU09OIHNoYXBlLicpXG4gIH1cblxuICBpZiAoIXdhcmRyb2JlLnNvbWUoKGl0ZW0pID0+IGl0ZW0uaWQgPT09IHBhcnNlZC5zZWxlY3RlZEl0ZW1JZCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ09wZW5Sb3V0ZXIgc2VsZWN0ZWQgYSBnYXJtZW50IGlkIG91dHNpZGUgdGhlIHdhcmRyb2JlLicpXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHNlbGVjdGVkSXRlbXM6IFtwYXJzZWQuc2VsZWN0ZWRJdGVtSWRdLFxuICAgIGV4cGxhbmF0aW9uOiBwYXJzZWQuZXhwbGFuYXRpb24sXG4gICAgZ2VuZXJhdGlvblByb21wdDogcGFyc2VkLmdlbmVyYXRpb25Qcm9tcHQsXG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbGVjdE91dGZpdFdpdGhPcGVuUm91dGVyKFxuICBtaXNzaW9uVGV4dDogc3RyaW5nLFxuICB3YXJkcm9iZTogV2FyZHJvYmVJdGVtW11cbik6IFByb21pc2U8T3V0Zml0RGVjaXNpb24+IHtcbiAgaWYgKCFwcm9jZXNzLmVudi5PUEVOUk9VVEVSX0FQSV9LRVkpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tPcGVuUm91dGVyXSBPUEVOUk9VVEVSX0FQSV9LRVkgbWlzc2luZzsgdXNpbmcgbG9jYWwgZmFsbGJhY2sgc2VsZWN0aW9uLicpXG4gICAgcmV0dXJuIGZhbGxiYWNrU2VsZWN0aW9uKG1pc3Npb25UZXh0LCB3YXJkcm9iZSlcbiAgfVxuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHBzOi8vb3BlbnJvdXRlci5haS9hcGkvdjEvY2hhdC9jb21wbGV0aW9ucycsIHtcbiAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICBoZWFkZXJzOiBnZXRPcGVuUm91dGVySGVhZGVycygpLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIG1vZGVsOiBwcm9jZXNzLmVudi5PUEVOUk9VVEVSX1NFTEVDVE9SX01PREVMID8/ICdvcGVuYWkvZ3B0LTRvLW1pbmknLFxuICAgICAgcmVzcG9uc2VfZm9ybWF0OiB7IHR5cGU6ICdqc29uX29iamVjdCcgfSxcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjIsXG4gICAgICBtZXNzYWdlczogW1xuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogJ3N5c3RlbScsXG4gICAgICAgICAgY29udGVudDpcbiAgICAgICAgICAgICdZb3UgYXJlIGEgZmFzaGlvbiBzdHlsaXN0IHNlbGVjdGluZyBvbmUgZXhhY3QgZ2FybWVudCBpbWFnZSBmcm9tIGEgbG9jYWwgd2FyZHJvYmUuICcgK1xuICAgICAgICAgICAgJ1JldHVybiBKU09OIG9ubHkgd2l0aCBrZXlzIHNlbGVjdGVkSXRlbUlkLCBleHBsYW5hdGlvbiwgYW5kIGdlbmVyYXRpb25Qcm9tcHQuICcgK1xuICAgICAgICAgICAgJ3NlbGVjdGVkSXRlbUlkIG11c3QgbWF0Y2ggb25lIGlkIGZyb20gdGhlIHdhcmRyb2JlIGxpc3QgZXhhY3RseS4nLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgcm9sZTogJ3VzZXInLFxuICAgICAgICAgIGNvbnRlbnQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIG1pc3Npb25UZXh0LFxuICAgICAgICAgICAgd2FyZHJvYmU6IHN1bW1hcml6ZVdhcmRyb2JlKHdhcmRyb2JlKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSksXG4gIH0pXG5cbiAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgIHJldHVybiBmYWxsYmFja1NlbGVjdGlvbihtaXNzaW9uVGV4dCwgd2FyZHJvYmUpXG4gIH1cblxuICBjb25zdCByZXN1bHQgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBPcGVuUm91dGVyUmVzcG9uc2VcbiAgY29uc3QgY29udGVudCA9IHJlc3VsdC5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnRcbiAgaWYgKCFjb250ZW50KSB7XG4gICAgcmV0dXJuIGZhbGxiYWNrU2VsZWN0aW9uKG1pc3Npb25UZXh0LCB3YXJkcm9iZSlcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIHBhcnNlRGVjaXNpb24oY29udGVudCwgd2FyZHJvYmUpXG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBmYWxsYmFja1NlbGVjdGlvbihtaXNzaW9uVGV4dCwgd2FyZHJvYmUpXG4gIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdlbmVyYXRlTG9va1dpdGhPcGVuUm91dGVyKFxuICBtaXNzaW9uVGV4dDogc3RyaW5nLFxuICBzZWxlY3RlZEl0ZW06IFdhcmRyb2JlSXRlbSxcbiAgZ2VuZXJhdGlvblByb21wdDogc3RyaW5nLFxuICBiYXNlSW1hZ2VQYXRoOiBzdHJpbmdcbikge1xuICBpZiAoIXByb2Nlc3MuZW52Lk9QRU5ST1VURVJfQVBJX0tFWSkge1xuICAgIGNvbnNvbGUud2FybignW09wZW5Sb3V0ZXJdIE9QRU5ST1VURVJfQVBJX0tFWSBtaXNzaW5nOyB1c2luZyBiYXNlIGltYWdlIGZhbGxiYWNrLicpXG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGlmICghc2VsZWN0ZWRJdGVtLmxvY2FsSW1hZ2VQYXRoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdTZWxlY3RlZCB3YXJkcm9iZSBpdGVtIGlzIG1pc3NpbmcgYSBsb2NhbCBpbWFnZSBwYXRoLicpXG4gIH1cblxuICBjb25zdCBtb2RlbCA9IHByb2Nlc3MuZW52Lk9QRU5ST1VURVJfSU1BR0VfTU9ERUwgPz8gJ2dvb2dsZS9nZW1pbmktMy4xLWZsYXNoLWltYWdlLXByZXZpZXcnXG5cbiAgY29uc3QgcmVxdWVzdEJvZHkgPSB7XG4gICAgbW9kZWwsXG4gICAgbW9kYWxpdGllczogWydpbWFnZScsICd0ZXh0J10sXG4gICAgaW1hZ2VfY29uZmlnOiB7XG4gICAgICBhc3BlY3RfcmF0aW86ICc5OjE2JyxcbiAgICB9LFxuICAgIG1lc3NhZ2VzOiBbXG4gICAgICB7XG4gICAgICAgIHJvbGU6ICd1c2VyJyxcbiAgICAgICAgY29udGVudDogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgIHRleHQ6XG4gICAgICAgICAgICAgIGAke2dlbmVyYXRpb25Qcm9tcHR9IE1hdGNoIHRoZSBtaXNzaW9uIFwiJHttaXNzaW9uVGV4dH1cIi4gYCArXG4gICAgICAgICAgICAgIGBQcmVzZXJ2ZSB0aGUgbW9kZWwgaWRlbnRpdHkgZnJvbSB0aGUgZmlyc3QgaW1hZ2UuIFVzZSB0aGUgc2Vjb25kIGltYWdlIGFzIHRoZSBjbG90aGluZyByZWZlcmVuY2Ugb25seS4gYCArXG4gICAgICAgICAgICAgIGBLZWVwIHJlYWxpc3RpYyBmYWJyaWMsIGZvbGRzLCBhbmQgb3V0Zml0IGZpdC4gUmV0dXJuIG9uZSBwb2xpc2hlZCBwb3J0cmFpdCBpbWFnZS5gLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ2ltYWdlX3VybCcsXG4gICAgICAgICAgICBpbWFnZV91cmw6IHtcbiAgICAgICAgICAgICAgdXJsOiB0b0RhdGFVcmxGcm9tRmlsZShiYXNlSW1hZ2VQYXRoKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2VfdXJsJyxcbiAgICAgICAgICAgIGltYWdlX3VybDoge1xuICAgICAgICAgICAgICB1cmw6IHRvRGF0YVVybEZyb21GaWxlKHNlbGVjdGVkSXRlbS5sb2NhbEltYWdlUGF0aCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIF0sXG4gIH1cblxuICBjb25zb2xlLmxvZyhgW09wZW5Sb3V0ZXJdIEdlbmVyYXRpbmcgaW1hZ2Ugd2l0aCBtb2RlbDogJHttb2RlbH1gKVxuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHBzOi8vb3BlbnJvdXRlci5haS9hcGkvdjEvY2hhdC9jb21wbGV0aW9ucycsIHtcbiAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICBoZWFkZXJzOiBnZXRPcGVuUm91dGVySGVhZGVycygpLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3RCb2R5KSxcbiAgfSlcblxuICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgY29uc3QgZXJyb3JUZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpXG4gICAgY29uc29sZS5lcnJvcihgW09wZW5Sb3V0ZXJdIEltYWdlIGdlbmVyYXRpb24gZmFpbGVkICgke3Jlc3BvbnNlLnN0YXR1c30pOiAke2Vycm9yVGV4dH1gKVxuICAgIHJldHVybiBudWxsXG4gIH1cblxuICBjb25zdCByZXN1bHQgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBPcGVuUm91dGVyUmVzcG9uc2VcbiAgcmV0dXJuIHJlc3VsdC5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmltYWdlcz8uWzBdPy5pbWFnZV91cmw/LnVybCA/PyBudWxsXG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIlg6XFxcXGNvZGV4XFxcXGZhc2hpb25fc3BpblxcXFxzZXJ2ZXJcXFxcbGliXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJYOlxcXFxjb2RleFxcXFxmYXNoaW9uX3NwaW5cXFxcc2VydmVyXFxcXGxpYlxcXFx3YXJkcm9iZUNhdGFsb2cudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1g6L2NvZGV4L2Zhc2hpb25fc3Bpbi9zZXJ2ZXIvbGliL3dhcmRyb2JlQ2F0YWxvZy50c1wiO2ltcG9ydCBmcyBmcm9tICdmcydcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXG5pbXBvcnQgdHlwZSB7IFdhcmRyb2JlSXRlbSB9IGZyb20gJy4vdHlwZXMnXG5cbmludGVyZmFjZSBDbG90aGluZ01ldGFkYXRhRW50cnkge1xuICBpbWFnZV9maWxlOiBzdHJpbmdcbiAgZ2FybWVudF90eXBlOiBzdHJpbmdcbiAgc3R5bGU6IHN0cmluZ1xuICBrdXJ0YV9jb2xvcjogc3RyaW5nXG4gIGJvdHRvbV9jb2xvcjogc3RyaW5nXG4gIGRlc2lnbl9kZXRhaWxzOiBzdHJpbmdcbn1cblxuaW50ZXJmYWNlIENsb3RoaW5nTWV0YWRhdGFEb2N1bWVudCB7XG4gIGNsb3RoaW5nX21ldGFkYXRhOiBDbG90aGluZ01ldGFkYXRhRW50cnlbXVxufVxuXG5jb25zdCBpbWFnZUV4dGVuc2lvbnMgPSBuZXcgU2V0KFsnLnBuZycsICcuanBnJywgJy5qcGVnJywgJy53ZWJwJ10pXG5jb25zdCBmb2xkZXJDYXRlZ29yeU1hcDogUmVjb3JkPHN0cmluZywgV2FyZHJvYmVJdGVtWydjYXRlZ29yeSddPiA9IHtcbiAga3VydGFzOiAndG9wJyxcbiAgdHNoaXJ0czogJ3RvcCcsXG4gIGJvdHRvbXM6ICdib3R0b20nLFxuICBzaG9lczogJ3Nob2VzJyxcbn1cblxuZnVuY3Rpb24gc2x1Z2lmeSh2YWx1ZTogc3RyaW5nKSB7XG4gIHJldHVybiB2YWx1ZVxuICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgLnJlcGxhY2UoL1teYS16MC05XSsvZywgJy0nKVxuICAgIC5yZXBsYWNlKC9eLSt8LSskL2csICcnKVxufVxuXG5mdW5jdGlvbiBzdHJpcEV4dGVuc2lvbihmaWxlTmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBwYXRoLnBhcnNlKGZpbGVOYW1lKS5uYW1lXG59XG5cbmZ1bmN0aW9uIHJlYWRNZXRhZGF0YSh3YXJkcm9iZVJvb3Q6IHN0cmluZykge1xuICBjb25zdCBtZXRhZGF0YVBhdGggPSBwYXRoLmpvaW4od2FyZHJvYmVSb290LCAnY2xvdGhpbmdfbWV0YWRhdGEuanNvbicpXG4gIGlmICghZnMuZXhpc3RzU3luYyhtZXRhZGF0YVBhdGgpKSB7XG4gICAgcmV0dXJuIG5ldyBNYXA8c3RyaW5nLCBDbG90aGluZ01ldGFkYXRhRW50cnk+KClcbiAgfVxuXG4gIGNvbnN0IGRvY3VtZW50ID0gSlNPTi5wYXJzZShcbiAgICBmcy5yZWFkRmlsZVN5bmMobWV0YWRhdGFQYXRoLCAndXRmLTgnKVxuICApIGFzIENsb3RoaW5nTWV0YWRhdGFEb2N1bWVudFxuXG4gIHJldHVybiBuZXcgTWFwKFxuICAgIGRvY3VtZW50LmNsb3RoaW5nX21ldGFkYXRhLm1hcCgoZW50cnkpID0+IFtcbiAgICAgIHN0cmlwRXh0ZW5zaW9uKGVudHJ5LmltYWdlX2ZpbGUpLFxuICAgICAgZW50cnksXG4gICAgXSlcbiAgKVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0V2FyZHJvYmVJbWFnZXMocm9vdDogc3RyaW5nKSB7XG4gIGNvbnN0IGltYWdlczogc3RyaW5nW10gPSBbXVxuXG4gIGZ1bmN0aW9uIHdhbGsoY3VycmVudFBhdGg6IHN0cmluZykge1xuICAgIGNvbnN0IGVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhjdXJyZW50UGF0aCwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pXG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihjdXJyZW50UGF0aCwgZW50cnkubmFtZSlcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIHdhbGsoZnVsbFBhdGgpXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICghaW1hZ2VFeHRlbnNpb25zLmhhcyhwYXRoLmV4dG5hbWUoZW50cnkubmFtZSkudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKHN0cmlwRXh0ZW5zaW9uKGVudHJ5Lm5hbWUpID09PSAnYmFzZV9pbWcnKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGltYWdlcy5wdXNoKGZ1bGxQYXRoKVxuICAgIH1cbiAgfVxuXG4gIHdhbGsocm9vdClcbiAgcmV0dXJuIGltYWdlc1xufVxuXG5mdW5jdGlvbiBwYXJzZUNvbG9yVG9rZW5zKHZhbHVlOiBzdHJpbmcpIHtcbiAgcmV0dXJuIEFycmF5LmZyb20oXG4gICAgbmV3IFNldChcbiAgICAgIHZhbHVlXG4gICAgICAgIC50b0xvd2VyQ2FzZSgpXG4gICAgICAgIC5yZXBsYWNlKC9bKCldL2csICcnKVxuICAgICAgICAuc3BsaXQoL1teYS16XSsvKVxuICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgKVxuICApXG59XG5cbmZ1bmN0aW9uIGluZmVyRGlzcGxheU5hbWUobWV0YWRhdGE6IENsb3RoaW5nTWV0YWRhdGFFbnRyeSB8IHVuZGVmaW5lZCwgZmlsZVN0ZW06IHN0cmluZykge1xuICBpZiAoIW1ldGFkYXRhKSB7XG4gICAgcmV0dXJuIGZpbGVTdGVtLnJlcGxhY2UoL1stX10rL2csICcgJylcbiAgfVxuXG4gIGlmIChtZXRhZGF0YS5nYXJtZW50X3R5cGUudG9Mb3dlckNhc2UoKSA9PT0gJ2t1cnRhIHNldCcpIHtcbiAgICBjb25zdCBwcmltYXJ5Q29sb3IgPSBtZXRhZGF0YS5rdXJ0YV9jb2xvci50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdtYXJvb24nKVxuICAgICAgPyAnQnJvd24nXG4gICAgICA6IG1ldGFkYXRhLmt1cnRhX2NvbG9yLnNwbGl0KC9bXFxzLChdLylbMF1cblxuICAgIHJldHVybiBgJHtwcmltYXJ5Q29sb3J9IEt1cnRhYFxuICB9XG5cbiAgcmV0dXJuIG1ldGFkYXRhLmdhcm1lbnRfdHlwZVxufVxuXG5mdW5jdGlvbiBidWlsZFN0eWxlVGFncyhcbiAgbWV0YWRhdGE6IENsb3RoaW5nTWV0YWRhdGFFbnRyeSB8IHVuZGVmaW5lZCxcbiAgZm9sZGVyTmFtZTogc3RyaW5nXG4pIHtcbiAgY29uc3QgdGFncyA9IFtmb2xkZXJOYW1lXVxuICBpZiAoIW1ldGFkYXRhKSB7XG4gICAgcmV0dXJuIHRhZ3NcbiAgfVxuXG4gIHRhZ3MucHVzaChzbHVnaWZ5KG1ldGFkYXRhLmdhcm1lbnRfdHlwZSkpXG4gIHRhZ3MucHVzaChzbHVnaWZ5KG1ldGFkYXRhLnN0eWxlKSlcbiAgcGFyc2VDb2xvclRva2VucyhtZXRhZGF0YS5rdXJ0YV9jb2xvcikuZm9yRWFjaCgodG9rZW4pID0+IHRhZ3MucHVzaCh0b2tlbikpXG4gIHBhcnNlQ29sb3JUb2tlbnMobWV0YWRhdGEuYm90dG9tX2NvbG9yKS5mb3JFYWNoKCh0b2tlbikgPT4gdGFncy5wdXNoKHRva2VuKSlcblxuICByZXR1cm4gQXJyYXkuZnJvbShuZXcgU2V0KHRhZ3MuZmlsdGVyKEJvb2xlYW4pKSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRXYXJkcm9iZUNhdGFsb2cod2FyZHJvYmVSb290OiBzdHJpbmcpOiBXYXJkcm9iZUl0ZW1bXSB7XG4gIGNvbnN0IG1ldGFkYXRhQnlTdGVtID0gcmVhZE1ldGFkYXRhKHdhcmRyb2JlUm9vdClcblxuICByZXR1cm4gY29sbGVjdFdhcmRyb2JlSW1hZ2VzKHdhcmRyb2JlUm9vdCkubWFwKChmdWxsUGF0aCkgPT4ge1xuICAgIGNvbnN0IHJlbGF0aXZlUGF0aCA9IHBhdGgucmVsYXRpdmUod2FyZHJvYmVSb290LCBmdWxsUGF0aCkucmVwbGFjZSgvXFxcXC9nLCAnLycpXG4gICAgY29uc3QgZm9sZGVyTmFtZSA9IHJlbGF0aXZlUGF0aC5zcGxpdCgnLycpWzBdID8/ICd3YXJkcm9iZSdcbiAgICBjb25zdCBmaWxlU3RlbSA9IHN0cmlwRXh0ZW5zaW9uKHBhdGguYmFzZW5hbWUoZnVsbFBhdGgpKVxuICAgIGNvbnN0IG1ldGFkYXRhID0gbWV0YWRhdGFCeVN0ZW0uZ2V0KGZpbGVTdGVtKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlkOiBmaWxlU3RlbSxcbiAgICAgIG5hbWU6IGluZmVyRGlzcGxheU5hbWUobWV0YWRhdGEsIGZpbGVTdGVtKSxcbiAgICAgIGNhdGVnb3J5OiBmb2xkZXJDYXRlZ29yeU1hcFtmb2xkZXJOYW1lXSA/PyAndG9wJyxcbiAgICAgIGltYWdlUGF0aDogYC93YXJkcm9iZS1hc3NldHMvJHtyZWxhdGl2ZVBhdGh9YCxcbiAgICAgIGxvY2FsSW1hZ2VQYXRoOiBmdWxsUGF0aCxcbiAgICAgIHNvdXJjZUltYWdlRmlsZTogcGF0aC5iYXNlbmFtZShmdWxsUGF0aCksXG4gICAgICBjb2xvcnM6IG1ldGFkYXRhXG4gICAgICAgID8gQXJyYXkuZnJvbShcbiAgICAgICAgICAgIG5ldyBTZXQoW1xuICAgICAgICAgICAgICAuLi5wYXJzZUNvbG9yVG9rZW5zKG1ldGFkYXRhLmt1cnRhX2NvbG9yKSxcbiAgICAgICAgICAgICAgLi4ucGFyc2VDb2xvclRva2VucyhtZXRhZGF0YS5ib3R0b21fY29sb3IpLFxuICAgICAgICAgICAgXSlcbiAgICAgICAgICApXG4gICAgICAgIDogW10sXG4gICAgICBzdHlsZVRhZ3M6IGJ1aWxkU3R5bGVUYWdzKG1ldGFkYXRhLCBmb2xkZXJOYW1lKSxcbiAgICAgIGxheWVyUm9sZTogJ2Jhc2UnLFxuICAgICAgZ2FybWVudFR5cGU6IG1ldGFkYXRhPy5nYXJtZW50X3R5cGUsXG4gICAgICBzdHlsZTogbWV0YWRhdGE/LnN0eWxlLFxuICAgICAgYm90dG9tQ29sb3I6IG1ldGFkYXRhPy5ib3R0b21fY29sb3IsXG4gICAgICBkZXNpZ25EZXRhaWxzOiBtZXRhZGF0YT8uZGVzaWduX2RldGFpbHMsXG4gICAgfVxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QmFzZUltYWdlUGF0aCh3YXJkcm9iZVJvb3Q6IHN0cmluZykge1xuICByZXR1cm4gcGF0aC5qb2luKHdhcmRyb2JlUm9vdCwgJ2Jhc2VfaW1nLnBuZycpXG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXVQLFNB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QUM5RCxnQkFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLLEVBQUUsT0FBTyxxQ0FBcUMsQ0FBQztBQUNwRTtBQUFBLFVBQ0Y7QUFFQSxnQkFBTSxTQUFTLE1BQU0sU0FBUyxLQUFLO0FBQ25DLGdCQUFNLFVBQVUsUUFBUSxVQUFVLENBQUMsR0FBRyxTQUFTLFdBQVc7QUFFMUQsY0FBSTtBQUNKLGNBQUk7QUFDRix1QkFBVyxLQUFLLE1BQU0sT0FBTztBQUFBLFVBQy9CLFFBQVE7QUFDTix1QkFBVztBQUFBLGNBQ1QsY0FBYztBQUFBLGNBQ2QsT0FBTztBQUFBLGNBQ1AsT0FBTztBQUFBLGNBQ1AsZ0JBQWdCLFFBQVEsTUFBTSxHQUFHLEdBQUc7QUFBQSxZQUN0QztBQUFBLFVBQ0Y7QUFFQSxrQkFBUSxJQUFJLCtCQUErQixRQUFRO0FBQ25ELGNBQUksS0FBSyxFQUFFLFVBQVUsT0FBTyxRQUFRLENBQUM7QUFBQSxRQUN2QyxTQUFTLEtBQUs7QUFDWixrQkFBUSxNQUFNLGdDQUFnQyxHQUFHO0FBQ2pELGNBQUksT0FBTyxHQUFHLEVBQUUsS0FBSyxFQUFFLE9BQU8scUNBQXFDLENBQUM7QUFBQSxRQUN0RTtBQUFBLE1BQ0YsQ0FBQztBQUVELGFBQU8sWUFBWSxJQUFJLEdBQUc7QUFBQSxJQUM1QjtBQUFBLEVBQ0Y7QUFDRjs7O0FEbFFBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDbEMsTUFBTTtBQUFBLElBQ0osYUFBYTtBQUFBLElBQ2IsWUFBWTtBQUFBLElBQ1osU0FBUztBQUFBLEVBQ1g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJmcyIsICJwYXRoIiwgInBhdGgiLCAiZnMiLCAicGF0aCIsICJmcyIsICJwYXRoIiwgImZzIiwgInBhdGgiLCAiZnMiLCAicGF0aCIsICJwYXRoIiwgIndhcmRyb2JlUm9vdCIsICJmcyIsICJwdWJsaWNSb290IiwgIndhcmRyb2JlUm9vdCIsICJwYXRoIiwgInBhdGgiLCAiZnMiXQp9Cg==
