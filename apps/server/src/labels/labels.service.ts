import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';

// ~50x30mm in PDF points (1mm ≈ 2.83465pt) — a common thermal label size.
const LABEL_WIDTH = 141.73;
const LABEL_HEIGHT = 85.04;

/**
 * Product label / QR PDF printing (SPEC §5.3, §7.2). Uses pdfkit directly
 * (rather than pdfmake) so labels need no bundled TTF font files — PDFKit's
 * built-in standard fonts (Helvetica) render everywhere with zero setup.
 */
@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async buildLabelPdf(productId: number, copies: number): Promise<Buffer> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { batches: { where: { qtyRemaining: { gt: 0 } }, orderBy: { receivedAt: 'asc' } } },
    });
    if (!product) throw new NotFoundException('product not found');

    const price = product.batches[0]?.sellPrice ?? null;
    const qrPng = await QRCode.toBuffer(product.code, { width: 120, margin: 0 });

    const doc = new PDFDocument({ size: [LABEL_WIDTH, LABEL_HEIGHT], margin: 6 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    for (let i = 0; i < Math.max(1, copies); i++) {
      if (i > 0) doc.addPage({ size: [LABEL_WIDTH, LABEL_HEIGHT], margin: 6 });
      doc.image(qrPng, 6, 6, { width: 50, height: 50 });
      doc.fontSize(9).text(product.name, 62, 8, { width: 74, height: 28 });
      doc.fontSize(13).text(price ? `${price} TMT` : '—', 62, 38);
      doc.fontSize(7).text(product.code, 62, 62);
    }
    doc.end();

    return finished;
  }
}
