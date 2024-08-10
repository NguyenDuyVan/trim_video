// env.d.ts
interface Environment {
  SEGMENT_LONGTIME: string;
  SEGMENT_NUMBER: string;
  FFMPEG_PATH: string;
  FFPROBE_PATH: string;
  ROOT_DIR_VIDEO: string;
  VIDEO_FILE_PATH: string;
}

// Ensure that `process.env` has the correct types
declare namespace NodeJS {
  interface ProcessEnv extends Environment {}
}
