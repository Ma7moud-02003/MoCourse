import { BadRequestException } from '@nestjs/common';

/** A file must have been sent (multer leaves it undefined when the field is missing). */
export function assertFileProvided(file: Express.Multer.File | undefined, label = 'File') {
  if (!file || !file.buffer || file.buffer.length === 0) throw new BadRequestException(`${label} file is required`);
}

/** A lesson PDF must declare application/pdf AND start with the %PDF header. */
export function assertPdfFile(file: Express.Multer.File) {
  const header = file.buffer?.subarray(0, 4).toString('latin1');
  if (file.mimetype !== 'application/pdf' || header !== '%PDF') throw new BadRequestException('This lessen type acccept only Pdf');
}

// Approved by the user (Nov 25): cover image 5 MB, payment proof image 10 MB. MB here means 1024*1024 bytes.
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
export const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;

/** Required, and the declared type must be image/* (same as the frontend's accept="image/*"). */
export function assertImageFile(file: Express.Multer.File | undefined, label = 'Image') {
  assertFileProvided(file, label);
  if (!file!.mimetype.startsWith('image/')) throw new BadRequestException(`${label} must be an image`);
}
