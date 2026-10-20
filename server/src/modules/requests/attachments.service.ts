import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import type { Actor } from '../../domain/permissions.js';
import { detail } from './requests.service.js';
import { attachmentSelect } from './requests.repository.js';
export function detectMime(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  throw new AppError(400, 'INVALID_FILE', 'Only PDF, PNG and JPEG files are supported');
}
export async function attach(user: Actor, id: string, file?: Express.Multer.File) {
  const request = await detail(user, id);
  if (!request.allowedActions.canEdit)
    throw new AppError(
      409,
      'REQUEST_NOT_EDITABLE',
      'Only the owner of a pending request may add files',
    );
  if (!file || !file.size) throw new AppError(400, 'INVALID_FILE', 'Select a file');
  const mimeType = detectMime(file.buffer);
  const name = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 200) || 'attachment';
  return prisma.$transaction(async (tx) => {
    // Lock the parent so concurrent uploads cannot exceed the attachment cap.
    const locked = await tx.serviceRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { updatedAt: new Date() },
    });
    if (!locked.count)
      throw new AppError(409, 'STATUS_CONFLICT', 'Request changed; refresh and retry');
    if ((await tx.attachment.count({ where: { requestId: id } })) >= 5)
      throw new AppError(409, 'ATTACHMENT_LIMIT', 'A request can have at most five attachments');
    const attachment = await tx.attachment.create({
      data: {
        requestId: id,
        name,
        mimeType,
        size: file.size,
        content: new Uint8Array(file.buffer),
      },
      select: attachmentSelect,
    });
    await tx.requestHistory.create({
      data: { requestId: id, actorId: user.id, action: 'ATTACHMENT_ADDED', note: name },
    });
    return attachment;
  });
}
export async function download(user: Actor, requestId: string, attachmentId: string) {
  await detail(user, requestId);
  const file = await prisma.attachment.findFirst({ where: { id: attachmentId, requestId } });
  if (!file) throw new AppError(404, 'NOT_FOUND', 'Attachment not found');
  return file;
}
