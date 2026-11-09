import { SaveFormat, manipulateAsync } from "expo-image-manipulator";
import { Image } from "react-native";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

type ProfilePhoto = number | string;
const MAX_PROFILE_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"]);

function readLocalPhoto(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.responseType = "blob";
    request.onload = () => {
      const succeeded = request.status === 0 || (request.status >= 200 && request.status < 300);
      if (!succeeded || !request.response) {
        reject(new Error("Nie udało się odczytać wybranego zdjęcia."));
        return;
      }
      resolve(request.response);
    };
    request.onerror = () => reject(new Error("Nie udało się odczytać wybranego zdjęcia."));
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
    throw new Error("Zdjęcie jest za duże. Wybierz plik poniżej 8 MB.");
  }
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(fileType)) {
    throw new Error("Nieobsługiwany format zdjęcia. Wybierz JPEG, PNG, HEIC lub WebP.");
  }

  return { contentType: fileType, extension };
}

// Camera photos are 2-4 MB; every feed card downloads them. 1080 px JPEG is
// sharp on any phone and ~10x smaller (Storage egress, feed speed, memory).
const PROFILE_PHOTO_MAX_EDGE = 1440;
const PROFILE_PHOTO_WIDTH = 1080;

function imageSize(uri: string) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
  });
}

async function shrinkPhoto(uri: string) {
  try {
    const size = await imageSize(uri);
    const resize = !size
      ? [{ resize: { width: PROFILE_PHOTO_WIDTH } }]
      : size.width > PROFILE_PHOTO_WIDTH || size.height > PROFILE_PHOTO_MAX_EDGE
        ? [{ resize: size.width / size.height >= PROFILE_PHOTO_WIDTH / PROFILE_PHOTO_MAX_EDGE ? { width: PROFILE_PHOTO_WIDTH } : { height: PROFILE_PHOTO_MAX_EDGE } }]
        : [];
    const result = await manipulateAsync(uri, resize, { compress: 0.8, format: SaveFormat.JPEG });
    return result.uri;
  } catch {
    // Fall back to the original file; the 8 MB limit still applies.
    return uri;
  }
}

export async function uploadProfilePhotos(uid: string, photos: ProfilePhoto[]) {
  if (!storage) {
    throw new Error("Przesyłanie zdjęć jest chwilowo niedostępne. Spróbuj ponownie później.");
  }

  const currentStorage = storage;

  return Promise.all(
    photos.filter((photo): photo is string => typeof photo === "string").map(async (uri, index) => {
      if (/^https?:\/\//i.test(uri)) return uri;

      const blob = await readLocalPhoto(await shrinkPhoto(uri));
      const { contentType, extension } = getPhotoMetadata(blob);
      const photoRef = ref(currentStorage, `users/${uid}/profile/${index}-${Date.now()}.${extension}`);
      await uploadBytes(photoRef, blob, { contentType });
      return getDownloadURL(photoRef);
    })
  );
}
function getOwnedStoragePath(uid: string, value: ProfilePhoto) {
  if (typeof value !== "string") return null;
  const expectedPrefix = `users/${uid}/profile/`;

  try {
    if (value.startsWith("gs://")) {
      const path = value.replace(/^gs:\/\/[^/]+\//, "");
      return path.startsWith(expectedPrefix) ? path : null;
    }

    const url = new URL(value);
    const encodedPath = url.pathname.match(/\/o\/([^/]+)$/)?.[1];
    if (!encodedPath) return null;
    const path = decodeURIComponent(encodedPath);
    return path.startsWith(expectedPrefix) ? path : null;
  } catch {
    return null;
  }
}

export async function deleteProfilePhotos(uid: string, photos: ProfilePhoto[]) {
  const currentStorage = storage;
  if (!currentStorage) return;
  const paths = Array.from(new Set(photos.map((photo) => getOwnedStoragePath(uid, photo)).filter((path): path is string => Boolean(path))));
  await Promise.all(paths.map(async (path) => {
    try {
      await deleteObject(ref(currentStorage, path));
    } catch (error: any) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
  }));
}
