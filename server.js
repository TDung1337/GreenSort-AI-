app.post("/analyze", async (req, res) => {
  try {
    const { image, mime, lang = 'vi' } = req.body;

    if (!image) return res.status(400).json({ error: "No image provided" });
    if (!API_KEY) return res.status(500).json({ error: "API_KEY missing" });

    // Sử dụng endpoint v1 ổn định để tránh lỗi 404
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: buildPrompt(lang) },
            {
              inline_data: { // Sửa thành inline_data (gạch dưới)
                mime_type: mime || "image/jpeg",
                data: image
              }
            }
          ]
        }],
        generation_config: { // Sửa thành generation_config (gạch dưới)
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

    // Xử lý loại bỏ markdown để JSON.parse không lỗi
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
