import { WritableStream } from 'web-streams-polyfill';
import streamSaver from 'streamsaver';

export const makeWriter = (filename: string, size: number): WritableStreamDefaultWriter => {
  if (!window.WritableStream) {
    streamSaver.WritableStream = WritableStream as any;
    window.WritableStream = WritableStream as any;
  }

  const fileStream = streamSaver.createWriteStream(filename, { size });
  return fileStream.getWriter();
}

export const makeReader = (file: File) => {
  return file.stream().getReader();
}
