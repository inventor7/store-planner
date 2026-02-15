import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { fixtureTemplates } from "@/modules/StorePlanner/data/fixtureTemplates";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Define the schema for the output
const layoutSchema = {
  type: SchemaType.OBJECT,
  properties: {
    width: { type: SchemaType.NUMBER, description: "Width of the room in cm" },
    height: {
      type: SchemaType.NUMBER,
      description: "Height of the room in cm",
    },
    nodes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          id: { type: SchemaType.STRING },
          x: { type: SchemaType.NUMBER },
          y: { type: SchemaType.NUMBER },
        },
        required: ["id", "x", "y"],
      },
    },
    walls: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          startNodeId: { type: SchemaType.STRING },
          endNodeId: { type: SchemaType.STRING },
          thickness: { type: SchemaType.NUMBER },
          type: { type: SchemaType.STRING, enum: ["wall", "window", "door"] },
        },
        required: ["startNodeId", "endNodeId", "type"],
      },
    },
    fixtures: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING,
            enum: ["shelf", "fridge", "counter", "table", "structure", "zone", "furniture"],
            description: "The general type of fixture",
          },
          templateId: {
            type: SchemaType.STRING,
            description:
              "The EXACT ID of the matching template from the provided catalog (e.g., 'fridge-upright-large')",
          },
          x: { type: SchemaType.NUMBER },
          y: { type: SchemaType.NUMBER },
          width: { type: SchemaType.NUMBER },
          height: { type: SchemaType.NUMBER },
          rotation: { type: SchemaType.NUMBER },
          label: {
            type: SchemaType.STRING,
            description: "The label found on the drawing (e.g. 'F3', 'Z')",
          },
        },
        required: ["type", "x", "y", "width", "height"],
      },
    },
  },
  required: ["width", "height", "nodes", "walls", "fixtures"],
} as any; // Cast as any because SchemaType enums might mismatch with expected JSONSchema types in SDK

export class FloorPlanAIService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    if (!API_KEY) {
      console.warn("VITE_GEMINI_API_KEY is missing. AI features will fail.");
    }
    this.genAI = new GoogleGenerativeAI(API_KEY || "");
  }

  async convertSketchToLayout(imageFile: File | Blob): Promise<any> {
    const candidates = ["gemini-2.0-flash-exp", "gemini-1.5-flash"];

    try {
      if (!API_KEY) throw new Error("Missing API Key");
      const imageBase64 = await this.fileToGenerativePart(imageFile);

      // Create a catalog string for the AI
      const catalog = fixtureTemplates
        .map(
          (t) =>
            `- [${t.id}] ${t.name} (${t.width}x${t.height}cm, cat: ${t.category}) - ${t.description}`,
        )
        .join("\n");

      const prompt = `
          Analyze this hand-drawn floor plan sketch.
          Extract the layout structure into a coordinate system.

          1. **Coordinate System**:
             - Assume the top-left is (0,0).
             - Measure in centimeters (cm).
             - Scale roughly to 500cm x 500cm if no scale provided.

          2. **Architectural Precision**:
             - **STRAIGHT WALLS**: Walls must be perfectly horizontal (0, 180) or vertical (90, 270) unless clearly drawn at an angle.
             - **SNAP ANGLES**: Snap near-rectilinear lines to exactly 90 degrees.

          3. **Nodes & Walls**:
             - Connect corners ('nodes') with 'walls'.
             - 'doors' and 'windows' are types of walls.

          4. **Fixtures & LETTER LEGEND**:
             - Identify fixtures by their labels (e.g., "C" -> Checkout, "F3" -> 3-Door Fridge).
             - **MATCHING CATALOG**: Try to match each detected fixture to an item in the catalog below based on Label, Shape, or common sense (e.g., "F3" likely means 3 doors -> 'fridge-upright-large').
             - If a match is found, put the ID in the 'templateId' field.

          *** AVAILABLE CATALOG ***
          ${catalog}
          *************************

          5. **REALITY CONSTRAINTS**:
             - **MUST BE INSIDE**: All fixtures must be located 99% INSIDE the room walls.

          Return valid JSON matching the schema.
        `;

      let lastError = null;

      for (const modelName of candidates) {
        try {
          console.log(`Attempting with model: ${modelName}`);
          const currentModel = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: layoutSchema,
            },
          });

          const result = await currentModel.generateContent([prompt, imageBase64]);
          console.log(`Success with ${modelName}`);
          return JSON.parse(result.response.text());
        } catch (e: any) {
          console.warn(`Failed with ${modelName}:`, e.message);
          lastError = e;
          if (e.message.includes("404") || e.message.includes("not found")) continue;
        }
      }

      throw lastError || new Error("All model candidates failed.");
    } catch (error) {
      console.error("FloorPlanAIService Error:", error);
      throw error;
    }
  }

  private async fileToGenerativePart(
    file: File | Blob,
  ): Promise<{ inlineData: { data: string; mimeType: string } }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string)?.split(",")[1];
        resolve({
          inlineData: {
            data: base64String || "",
            mimeType: file.type,
          },
        });
      };
      reader.readAsDataURL(file);
    });
  }
}

export const floorPlanAIService = new FloorPlanAIService();
