import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { renderReceipt } from '@cozgut/printer';
import { PrintingService } from './printing.service.js';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

/** A4 faktur (invoice) PDF for a completed sale (SPEC §5.2 "Faktur print"). */
@Injectable()
export class FakturService {
  constructor(private readonly printing: PrintingService) {}

  async buildFakturPdf(saleId: number): Promise<Buffer> {
    const data = await this.printing.buildReceiptData(saleId);
    const doc = renderReceipt(data);

    const pdf = new PDFDocument({ size: [A4_WIDTH, A4_HEIGHT], margin: 50 });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve) =>
      pdf.on('end', () => resolve(Buffer.concat(chunks))),
    );

    pdf.fontSize(18).text(doc.header, { align: 'center' });
    pdf.moveDown();
    pdf.fontSize(11);
    doc.meta.forEach((l: string) => pdf.text(l));
    pdf.moveDown();

    pdf.fontSize(10);
    for (const line of doc.items) pdf.text(line);
    pdf.moveDown();

    pdf.fontSize(12);
    for (const line of doc.totals) pdf.text(line);
    pdf.moveDown(2);

    pdf.fontSize(10).text(doc.footer, { align: 'center' });
    pdf.end();

    return finished;
  }
}
