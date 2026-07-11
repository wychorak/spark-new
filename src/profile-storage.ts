import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

type ProfilePhoto = number | string;
const MAX_PROFILE_PHOTO_BYTES = 8 * 1024 * 1024;

function readLocalPhoto(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.responseType = "blob";
    request.onload = () => {
      const succeeded = request.status === 0 || (request.status >= 200 && request.status < 300);
      if (!succeeded || !request.response) {
        reject(new Error("Nie udalo sie odczytac wybranego zdjecia."));
        return;
      }
      resolve(request.response);
    };
    request.onerror = () => reject(new Error("Nie udalo sie odczytac wybranego zdjecia."));
    request.open("GET", uri, true);
    request.send();
  });
}

function getPhotoMetadata(blob: Blob) {
  const detectedType = blob.type.toLowerCase();
  const fileType = detectedType.startsWith("image/") ? detectedType : "image/jpeg";
  const subtype = fileType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
  const extension = subtype === "jpeg" ? "jpg" : subtype;

  if (blob.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("Zdjecie jest za duze. Wybierz plik ponizej 8 MB.");
  }

  return { contentType: fileType, extension };
}

export async function uploadProfilePhotos(uid: string, photos: ProfilePhoto[]) {
  if (!storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  const currentStorage = storage;

  return Promise.all(
    photos.filter((photo): photo is string => typeof photo === "string").map(async (uri, index) => {
      if (/^https?:\/\//i.test(uri)) return uri;

      const blob = await readLocalPhoto(uri);
      const { contentType, extension } = getPhotoMetadata(blob);
      const photoRef = ref(currentStorage, `users/${uid}/profile/${index}-${Date.now()}.${extension}`);
      await uploadBytes(photoRef, blob, { contentType });
      return getDownloadURL(photoRef);
    })
  );
}
