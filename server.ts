import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Use higher JSON body limit for base64 image uploads
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Initialize GoogleGenAI SDK once
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// OCR endpoint
app.get("/api/config", (req, res) => {
  res.json({
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || "",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ""
  });
});

app.post("/api/ocr-receipt", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "영수증 이미지 데이터가 제공되지 않았습니다." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "서버에 GEMINI_API_KEY 설정이 되어있지 않습니다." });
    }

    const imagePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: base64Data,
      },
    };

    const textPart = {
      text: "This is an image of a Korean fuel (주유소) or highway toll (고속도로 통행료) receipt. " +
            "Please read the receipt image carefully. Exclude any change, subtotal, pre-tax value, or card authorization codes unless they represent the final total price. " +
            "Look for keywords like '결제금액', '합계', '받을금액', '금액', '영수증 금액', '납부금액' and extract the final total payment amount. " +
            "If it's a toll receipt, it might have '통행료' or '납부금액' with the exact fee. " +
            "Return the final extracted amount as an integer and provide the other fields if confidently found. If a field cannot be found, return empty string.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: {
              type: Type.INTEGER,
              description: "The final total payment amount from the receipt in Korean Won (KRW). Provide as raw integer like 50000. Set to 0 if not found.",
            },
            type: {
              type: Type.STRING,
              description: "The type of the receipt, either 'fuel' or 'toll' or 'unknown'.",
            },
            merchantName: {
              type: Type.STRING,
              description: "The name of the merchant (주유소명, 톨게이트명, 영업소명).",
            },
            date: {
              type: Type.STRING,
              description: "The transaction date in YYYY-MM-DD format.",
            }
          },
          required: ["amount"],
        }
      }
    });

    const resultText = response.text?.trim() || "";
    let data;
    try {
      data = JSON.parse(resultText);
    } catch (e) {
      data = { amount: 0, type: "unknown", merchantName: "", date: "" };
    }

    res.json(data);
  } catch (error: any) {
    console.error("OCR API error:", error);
    res.status(500).json({ error: error.message || "영수증 분석 중 오류가 발생했습니다." });
  }
});

// Vite middleware setup
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
