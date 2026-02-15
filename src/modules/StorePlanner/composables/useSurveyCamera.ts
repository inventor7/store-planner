import { ref } from "vue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Capacitor } from "@capacitor/core";

export function useSurveyCamera() {
  const isAvailable = ref(false);

  // Basic check
  isAvailable.value =
    Capacitor.isNativePlatform() ||
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  const takePhoto = async (): Promise<{
    path?: string;
    webPath?: string;
  } | null> => {
    if (!Capacitor.isNativePlatform()) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (event: any) => {
          const file = event.target.files?.[0];
          if (file) {
            resolve({
              webPath: URL.createObjectURL(file),
            });
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    }

    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      return {
        path: photo.path,
        webPath: photo.webPath,
      };
    } catch (e) {
      console.warn("User cancelled photo or error", e);
      return null;
    }
  };

  const savePhoto = async (nativePath: string): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = new Date().getTime() + ".jpeg";
        const savedFile = await Filesystem.copy({
          from: nativePath,
          to: fileName,
          toDirectory: Directory.Data,
        });
        return savedFile.uri;
      } catch (e) {
        console.error("Error saving photo", e);
        throw e;
      }
    }

    return nativePath;
  };

  return {
    isAvailable,
    takePhoto,
    savePhoto,
  };
}
