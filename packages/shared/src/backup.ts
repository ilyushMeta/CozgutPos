import { z } from 'zod';

/** Ätiýaçlyk nusga dikeltmek (SPEC §5.14) — the file itself travels as multipart form-data. */
export const restoreBackupSchema = z.object({
  password: z.string().min(1),
});
export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;

export interface BackupFileInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}
