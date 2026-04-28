export interface SubnanoPostPayload {
  title: string;
  description: string;
  paidContentMarkdown: string;
  enablePaywall: boolean;
  priceRaw?: string;
  primaryCategoryId: number;
  language: string;
  commentsEnabled: boolean;
}

export async function createSubnanoDraft(apiKey: string, payload: SubnanoPostPayload) {
  const res = await fetch("https://subnano.me/api/v1/posts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to create draft");
  }
  return res.json(); // returns the post object, hopefully contains { id: "..." }
}

export async function uploadSubnanoImage(apiKey: string, postId: string, base64DataUrl: string, intent: 'content' | 'og' = 'content') {
  // Convert Data URL to Blob
  const byteString = atob(base64DataUrl.split(',')[1]);
  const mimeString = base64DataUrl.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeString });
  
  const formData = new FormData();
  formData.append('file', blob, 'image.png');

  const res = await fetch(`https://subnano.me/api/v1/posts/${postId}/images?intent=${intent}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      // Do not set Content-Type, fetch sets it with boundary for FormData
    },
    body: formData
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to upload image");
  }
  return res.json(); // should return the image metadata / url
}

export async function patchSubnanoPost(apiKey: string, postId: string, patchPayload: Partial<SubnanoPostPayload> & { ogImage?: string, freeContentMarkdown?: string }) {
  const res = await fetch(`https://subnano.me/api/v1/posts/${postId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(patchPayload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to patch draft");
  }
  return res.json();
}

export async function publishSubnanoPost(apiKey: string, postId: string, idempotencyKey: string) {
  const res = await fetch(`https://subnano.me/api/v1/posts/${postId}/publish`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Idempotency-Key": idempotencyKey
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || "Failed to publish post");
  }
  return res.json();
}
