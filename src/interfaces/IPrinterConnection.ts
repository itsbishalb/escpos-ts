// src/interfaces/IPrinterConnection.ts

export interface IPrinterConnection {
  open(): Promise<void>;
  close(): Promise<void>;
  write(data: Buffer): Promise<void>;
  read(length?: number): Promise<Buffer>;
}
