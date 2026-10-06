export async function onRequestPost(context) {
    const { request, env } = context;

    // Verify Admin Token
    const authHeader = request.headers.get('Authorization');
    if (!env.ADMIN_SECRET_TOKEN || authHeader !== `Bearer ${env.ADMIN_SECRET_TOKEN}`) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { prompt } = body;

        if (!prompt) {
            return Response.json({ success: false, error: "Prompt is required." });
        }

        if (!env.GITHUB_TOKEN) {
            return Response.json({ success: false, error: "GITHUB_TOKEN is not configured in Cloudflare Environment Variables." });
        }

        // Call GitHub Models API (using gpt-4o-mini for speed and cost efficiency)
        const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.GITHUB_TOKEN}`
            },
            body: JSON.stringify({
                messages: [
                    { 
                        role: "system", 
                        content: "You are an expert e-commerce copywriter. Write a persuasive, SEO-friendly, and engaging product description based on the user's prompt. Write in Bengali (or English if requested). Format the output beautifully using HTML tags like <b>, <ul>, <li>, <br>. Do NOT include markdown blocks like ```html. Return only the raw HTML content." 
                    },
                    { 
                        role: "user", 
                        content: prompt 
                    }
                ],
                model: "gpt-4o-mini",
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return Response.json({ success: true, result: data.choices[0].message.content });
        } else {
            return Response.json({ success: false, error: "AI failed to generate response.", details: data });
        }

    } catch (e) {
        return Response.json({ success: false, error: e.message });
    }
}
