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
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // profile photo, 2 MB
export const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;

/** Required, and the declared type must be image/* (same as the frontend's accept="image/*"). */
export function assertImageFile(file: Express.Multer.File | undefined, label = 'Image') {
  assertFileProvided(file, label);
  if (!file!.mimetype.startsWith('image/')) throw new BadRequestException(`${label} must be an image`);
  // the declared type is only a claim: the first bytes must be a real png/jpeg/gif/webp (so no svg/html in disguise)
  if (!hasImageSignature(file!.buffer)) throw new BadRequestException(`${label} must be a png, jpg, gif or webp image`);
}

export function hasImageSignature(b: Buffer): boolean {
  if (!b || b.length < 4) return false;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const gif = b.subarray(0, 4).toString('latin1') === 'GIF8';
  const webp = b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP';
  return png || jpg || gif || webp;
}
