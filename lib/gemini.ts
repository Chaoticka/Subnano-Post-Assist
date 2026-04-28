export async function generateArticleContent(sourceMaterial: string, apiKey?: string) {
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: `Write a high-quality, engaging article based on the following source material:\n\n${sourceMaterial}\n\nThe article should be well-structured with an introduction, detailed body paragraphs with subheadings, and a conclusion. 
Use Markdown format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "An engaging title for the abstract."
          },
          description: {
            type: Type.STRING,
            description: "A short 1-2 sentence description summarizing the article."
          },
          markdownContent: {
            type: Type.STRING,
            description: "The full article content in standard Markdown format."
          }
        },
        required: ["title", "description", "markdownContent"]
      }
    }
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    throw new Error('Failed to parse AI response');
  }
}

export async function generateBanneri2i(sourceMaterial: string, baseImageBase64: string, apiKey?: string) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.NEXT_PUBLIC_GEMINI_API_KEY });
  
  // Extract MIME type from base64 data url
  const mimeType = baseImageBase64.split(',')[0].split(':')[1].split(';')[0];
  const data = baseImageBase64.split(',')[1];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: data,
            mimeType: mimeType,
          },
        },
        {
          text: `Persona: 'i2i' - Image-to-Image Style Transfer and Conceptual Variation Generator.

Your task is to generate an ENTIRELY NEW image that acts as a banner for an article. 

INSTRUCTIONS:
1. Analyze the provided image template to deeply understand its ARTISTIC STYLE, COLOR PALETTE, MOOD, and CHARACTER DESIGN (if a character is present).
2. DO NOT copy the exact scene, composition, or character pose from the template image.
3. Create a completely new scene and composition that conceptualizes the following source material: "${sourceMaterial.substring(0, 1000)}".
4. Adapt the character (if one exists in the template) into this new setting and pose, ensuring they are interacting with the new theme context.
5. The final output MUST preserve the visual identity (style, rendering, color grading) of the template, but present a unique scenario illustrating the article's theme.
6. Ensure it functions well as a wide-format 16:9 digital article banner.
7. CRITICAL: DO NOT include any text, words, typography, or lettering in the generated image to prevent cut-off, garbled, or nonsensical text. Keep the image purely visual.`,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/jpeg;base64,${part.inlineData.data}`;
    }
  }

  throw new Error('No image was returned from the model.');
}
