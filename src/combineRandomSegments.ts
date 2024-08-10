import ffmpeg, { ffprobe, setFfmpegPath, setFfprobePath } from 'fluent-ffmpeg';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';
import async from 'async';
import { config } from 'dotenv';
config();

const rootDirVideo = process.env.ROOT_DIR_VIDEO;
const ffmpegPath = process.env.FFMPEG_PATH;
const ffprobePath = process.env.FFPROBE_PATH;

setFfmpegPath(ffmpegPath);
setFfprobePath(ffprobePath);

const segmentDir = join('output_segments');
const combinedVideoFolder = join('C:', 'Users', 'Van', 'Desktop', 'Source');

const generateOutputFilePath = (
  fileName: string = 'combined_video_{sufix}.mp4',
): string => {
  return join(
    combinedVideoFolder,
    fileName.replace('{sufix}', new Date().getTime().toString()),
  );
};

const combineVideoFileName = 'combine_list_video.txt';

interface Segment {
  startTime: number;
  segmentDuration: number;
  outputPath: string;
}

const generateRandomNumbers = (
  total: number,
  segments: number = 60,
): number[] => {
  const segmentLength = total / segments;
  return Array.from({ length: segments }, (_, i) => {
    const startSegment = i * segmentLength;
    const endSegment = (i + 1) * segmentLength;
    const min = startSegment;
    const max = endSegment - 3;
    const randomNum = Math.random() * (max - min) + min;
    return Math.round(randomNum * 100) / 100;
  });
};

const getVideoDuration = (inputVideoPath: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    ffprobe(inputVideoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      resolve(metadata.format.duration || 0);
    });
  });
};

const initializeFolders = () => {
  if (!existsSync(segmentDir)) mkdirSync(segmentDir);
  if (!existsSync(combinedVideoFolder)) mkdirSync(combinedVideoFolder);
};

const createVideoSegment = (
  inputVideoPath: string,
  segment: Segment,
  callback: (err?: Error) => any,
) => {
  const { startTime, outputPath, segmentDuration } = segment;
  ffmpeg(inputVideoPath)
    .setStartTime(startTime)
    .setDuration(segmentDuration)
    .videoCodec('h264_amf')
    .output(outputPath)
    .on('end', () => {
      console.log(`Segment created successfully: ${outputPath}`);
      callback();
    })
    .on('error', (err) => {
      console.error('Error occurred:', err);
      callback(err);
    })
    .run();
};

const processSegmentsQueue = (
  inputVideoPath: string,
  segments: Segment[],
  callback: (err?: Error) => string,
) => {
  const maxConcurrentProcesses = 5; // Adjust based on your system's capability
  const queue = async.queue(
    (segment: Segment, cb: (err?: Error) => any) =>
      createVideoSegment(inputVideoPath, segment, cb),
    maxConcurrentProcesses,
  );

  queue.drain(callback);
  segments.forEach((segment, i) =>
    queue.push({ ...segment }, (err) => {
      if (err) console.error(`Failed to process segment ${i}:`, err);
    }),
  );
};

const combineSegments = (segmentPaths: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    const concatList = segmentPaths
      .map((segment) => `file '${segment}'`)
      .join('\n');
    writeFileSync(combineVideoFileName, concatList);

    const draftFileName = generateOutputFilePath('draft_video_{sufix}.mp4');

    ffmpeg()
      .input(combineVideoFileName)
      .inputOptions(['-f concat', '-safe 0'])
      .videoFilters(['crop=in_h*4/3:in_h', 'hflip'])
      .videoCodec('h264_amf')
      .output(draftFileName)
      .on('end', () => {
        console.log('Combined video to 4:3 ratio');
        unlinkSync(combineVideoFileName);
        rmSync(segmentDir, { recursive: true, force: true });
        resolve(draftFileName);
      })
      .on('error', (err) => {
        console.error('Error occurred:', err);
        unlinkSync(combineVideoFileName);
        reject(err);
      })
      .run();
  });
};

const convertToFinalAspectRatio = (draftFileName: string): Promise<string> => {
  const finalFileName = generateOutputFilePath();
  return new Promise((resolve, reject) => {
    ffmpeg(draftFileName)
      .videoCodec('h264_amf')
      .outputOptions(['-vf', 'pad=iw:ih*9/4:0:(oh-ih)/2'])
      .output(finalFileName)
      .on('end', () => {
        unlinkSync(draftFileName);
        console.log('Final video created successfully');
        resolve(finalFileName);
      })
      .on('error', (err) => {
        console.error('Error during conversion:', err);
        unlinkSync(draftFileName);
        reject(err);
      })
      .run();
  });
};

export type BreakVideoToSegmentsData = {
  segmentDuration: number;
  segmentNumber: number;
  videoName: string;
};

export const breakVideoToSegments = async (
  data: BreakVideoToSegmentsData,
): Promise<string | undefined> => {
  try {
    const { segmentDuration, segmentNumber, videoName } = data;
    console.log('rootDirVideo', rootDirVideo);
    
    const inputVideoPath = join(rootDirVideo, videoName);
    const videoDuration = await getVideoDuration(inputVideoPath);
    initializeFolders();
    const randomNumbers = generateRandomNumbers(videoDuration, segmentNumber);

    const segments: Segment[] = randomNumbers.map((startTime, i) => ({
      startTime,
      outputPath: join(segmentDir, `segment_${i}.mp4`),
      segmentDuration,
    }));

    await new Promise<string>((resolve, reject) =>
      processSegmentsQueue(inputVideoPath, segments, (err) => {
        if (err) reject(err);
        resolve('done');
        return '';
      }),
    );

    const selectedSegments = segments.map((segment) => segment.outputPath);
    const draftFileName = await combineSegments(selectedSegments);
    return await convertToFinalAspectRatio(draftFileName);
  } catch (error) {
    console.error('Error in breakVideoToSegments:', error);
  }
};
