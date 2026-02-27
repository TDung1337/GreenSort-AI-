import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.use(cors());
app.use(express.json({ limit: "15mb" }));

/* ===== TRANG CHỦ KIỂM TRA ===== */
app.get("/", (req, res) => {
  res.json({ 
    status: "online", 
    message: "GreenSort AI Server is running 🌱",
    author: "Trần Quang Dũng" 
  });
});

/* ===== HÀM TẠO PROMPT ===== */
const buildPrompt = (lang) => {
  const isVi = lang === 'vi';
  const categories = isVi 
    ? '"Chất thải hữu cơ", "Chất thải tái chế", "Chất thải nguy hại", "Chất thải khó phân hủy", "Không phải rác"'
    : '"Organic Waste", "Recyclable Waste", "Hazardous Waste", "General Waste", "Not Waste"';

  return `Analyze this image and return ONLY a valid JSON object.
The response language MUST BE in ${isVi ? 'Vietnamese' : 'English'}.

Required JSON Structure:
{
 "object": "Name of the detected item",
 "material": "Main material (e.g., Plastic, Paper, Metal)",
 "category": "MUST BE EXACTLY ONE OF THESE: ${categories}",
 "instruction": "Short, clear disposal instruction",
 "tip": "Short environmental tip related to this item",
 "confidence": <integer between 70 and 99>
}`;
};

/* ===== ROUTE PHÂN TÍCH AI ===== */
app.post("/analyze", async (req, res) => {
  try {
    const { image, mime, lang = 'vi' } = req.body;

    if (!image) return res.status(400).json({ error: "No image provided" });
    if (!API_KEY) return res.status(500).json({ error: "API_KEY missing" });

    // SỬA LỖI 404: Sử dụng endpoint v1 và model chuẩn ổn định
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: buildPrompt(lang) },
            {
              inline_data: { // Sửa lỗi 400: Dùng snake_case cho REST API
                mime_type: mime || "image/jpeg",
                data: image
              }
            }
          ]
        }],
        generation_config: { // Sửa lỗi 400: Loại bỏ responseMimeType gây xung đột
          temperature: 0.1,
          max_output_tokens: 1024
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Gemini API Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "API Error");
    }

    let textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) throw new Error("Empty AI response");

    // Làm sạch JSON để tránh lỗi parse khi AI trả về markdown
    const cleanJson = textResponse.replace(/```json|```/g, "").trim();
    res.json(JSON.parse(cleanJson));

  } catch (err) {
    console.error("❌ SERVER ERROR:", err.message);
    const isVi = req.body.lang === 'vi';
    res.status(500).json({
      object: isVi ? "Lỗi phân tích" : "Analysis Error",
      category: isVi ? "Chất thải khó phân hủy" : "General Waste",
      instruction: "Vui lòng thử lại sau.",
      tip: err.message,
      confidence: 0
    });
  }
});

/* ===== KHỞI CHẠY ===== */
app.listen(PORT, () => {
  console.log(`🚀 GreenSort Server Live! Port: ${PORT}`);
});
