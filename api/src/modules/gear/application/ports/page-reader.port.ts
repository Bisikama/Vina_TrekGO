export const PAGE_READER_PORT = Symbol('PAGE_READER_PORT');

export interface PageReadResult {
  url: string;
  finalUrl: string;
  markdown: string;
  contentHash: string;
  title?: string;
  readAt: Date;
}

export interface PageReaderPort {
  isConfigured?(): boolean;
  readPage(url: string): Promise<PageReadResult>;
}

