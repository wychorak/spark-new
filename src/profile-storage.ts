import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

type ProfilePhoto = number | string;

export async function uploadProfilePhotos(uid: string, photos: ProfilePhoto[]) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  const currentStorage = storage;

  return Promise.all(
    photos.filter((photo): photo is string => typeof photo === "string").map(async (uri, index) => {
      if (/^https?:\/\//i.test(uri)) return uri;

      const response = await fetch(uri);
      if (!response.ok) throw new Error("Nie udalo sie odczytac wybranego zdjecia.");

      const blob = await response.blob();
      const extension = blob.type.includes("png") ? "png" : "jpg";
      const photoRef = ref(currentStorage, `users/${uid}/profile/${index}-${Date.now()}.${extension}`);
      await uploadBytes(photoRef, blob, { contentType: blob.type || "image/jpeg" });
      return getDownloadURL(photoRef);
    })
  );
}
