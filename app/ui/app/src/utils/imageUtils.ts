export function isImageFile(filename: string): boolean {
  const extension = filename.toLowerCase().split(".").pop();
  return ["png", "jpg", "jpeg", "gif", "webp"].includes(extension || "");
}

export function isAudioFile(filename: string): boolean {
  const extension = filename.toLowerCase().split(".").pop();
  return ["wav", "mp3", "ogg"].includes(extension || "");
}
