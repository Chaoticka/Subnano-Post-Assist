import { get, set } from 'idb-keyval';

export async function saveTemplateImage(fileOrBase64: string | Blob) {
  if (fileOrBase64 instanceof Blob) {
    const reader = new FileReader();
    return new Promise<void>((resolve, reject) => {
      reader.onloadend = async () => {
        await set('subnano-template-image', reader.result as string);
        resolve();
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrBase64);
    });
  } else {
    await set('subnano-template-image', fileOrBase64);
  }
}

export async function getTemplateImage(): Promise<string | undefined> {
  return await get('subnano-template-image');
}
