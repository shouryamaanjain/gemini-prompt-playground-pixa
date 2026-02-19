import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = "lustrous-center-443807-e0-audio-pipeline";
const PREFIX = "siphon_v2_r2/good_chunks";

let storage: Storage;

function getStorage() {
  if (!storage) {
    storage = new Storage();
  }
  return storage;
}

export function getGCSPath(videoId: string, segmentFile: string) {
  return `${PREFIX}/${videoId}/${segmentFile}`;
}

export async function downloadBuffer(videoId: string, segmentFile: string): Promise<Buffer> {
  const gcsPath = getGCSPath(videoId, segmentFile);
  const [buffer] = await getStorage()
    .bucket(BUCKET_NAME)
    .file(gcsPath)
    .download();
  return buffer;
}

export async function streamFile(videoId: string, segmentFile: string) {
  const gcsPath = getGCSPath(videoId, segmentFile);
  return getStorage()
    .bucket(BUCKET_NAME)
    .file(gcsPath)
    .createReadStream();
}
