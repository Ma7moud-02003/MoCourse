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
