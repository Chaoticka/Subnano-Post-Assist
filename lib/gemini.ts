"use server";

export async function generateArticleContent(sourceMaterial: string, apiKey?: string) {
  const { GoogleGenAI, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY });
  
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
  const ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY });
  
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
          text: `In our continuous effort to bridge the gap between human creativity and AI execution, this Universal Style & Character Continuity Template was forged as a strict logical architecture. Its primary purpose is not just to generate images, but to act as a *cognitive buffer*—a specialized layer of instruction that forces the underlying generation model to separate its constants (the character’s identity and specific illustrative style) from its variables (the environment and action).

### The Prime Directive: Strategic Separation
The core function of this template is to resolve a critical friction point: "Structural Anchoring." In many models, requesting a continuous character often results in the model repeating the entire composition or setting of the reference image. Our architecture explicitly countermands this by commanding the model to *conceptually disintegrate* the original scene while retaining the essence of the protagonist. This creates the "Blank Slate"—the digital canvas required for true creative breakout.

### Universal Behaviors and Protocol
The Universal Template follows a non-negotiable protocol for every generation request:
 1. **Strict Adherence:** When the 'locked' parameters are identified from the input reference, the system locks onto them with complete fidelity. The character in the new environment *must* be instantly recognizable as the same individual.
 2. **Scene-Specific Adaptation:** It translates the input narrative into relevant environmental details and poses. It doesn't copy layouts; it builds new ones from scratch.
 3. **The Zero-Tolerance Protocol:** The template enforces a rigorous standard of *zero tolerance for errors* in generated text. Titles direct quotes are scrutinized for perfect spelling, clear fonts, and specific context, ensuring typos never degrade the technical precision of the final creative workflow.
 4. **Operational Efficiency:** The AI agent is commanded to be direct, professional, and technical, focusing entirely on operational fidelity.

### Final Concluding Summary (per the collaborative journey)
This architecture is the solution to the challenge of creative continuity. When the user provides the raw input—the reference and the text—the system analyzes it, locks the constants, breaks the structural anchors, and executes the transformation. The resulting image (such as the character manipulating latent code within a digital matrix) is the tangible validation that this system works. It transforms the latent space from an unpredictable void of random probabilities into a precision-engineered vector for specialized, continuous creativity. We have successfully engineered a solution for true human-AI collaboration.

### Universal Style & Character Continuity Template
**[Acknowledge Attachment]:** I have attached a reference image.
**[Style & Character Lock]:** Use this attached image ONLY as a strict reference for the visual art style and the core character design.
**[CRITICAL Composition Abandonment]:** **CRITICAL:** Do not recreate the background, the layout, the specific pose, or any auxiliary objects from the attached image. Completely abandon the old composition.
**[New Scene Instruction]:** Instead, place this same character into a completely new scene and environment, performing a new action, generated from the following article text:
**[The Article Text/Prompt]:** ${sourceMaterial.substring(0, 3000)}`,
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
