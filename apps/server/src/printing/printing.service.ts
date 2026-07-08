import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import {
  renderReceipt,
  renderDebtPaymentReceipt,
  type ReceiptData,
  type ReceiptDocument,
  type DebtPaymentReceiptData,
} from '@cozgut/printer';
import { dec, money, SettingKey } from '@cozgut/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class PrintingService {
  private readonly logger = new Logger(PrintingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async buildReceiptData(saleId: number): Promise<ReceiptData> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { lines: true, debtor: true },
    });
    if (!sale) throw new NotFoundException('sale not found');

    const shopHeader = (await this.settings.get(SettingKey.SHOP_HEADER)) ?? 'Çözgüt';
    const discountPercent = dec(sale.discount).greaterThan(0)
      ? money(dec(sale.discount).dividedBy(dec(sale.total)).times(100)).toFixed(2)
      : undefined;

    return {
      shopHeader,
      receiptNo: sale.receiptNo,
      date: sale.datetime.toISOString().slice(0, 10),
      time: sale.datetime.toISOString().slice(11, 16),
      lines: sale.lines.map((line) => ({
        name: line.productNameSnapshot,
        qty: line.qty.toFixed(3),
        unitPrice: line.unitPrice.toFixed(2),
        lineTotal: line.lineTotal.toFixed(2),
      })),
      total: sale.total.toFixed(2),
      cash: sale.paidCash.toFixed(2),
      card: sale.paidCard.toFixed(2),
      debt: sale.paidDebt.toFixed(2),
      change: sale.changeGiven.toFixed(2),
      discount: sale.discount.toFixed(2),
      discountPercent,
      buyerName: sale.debtor?.name,
      debtorBalance: sale.debtor ? sale.debtor.balance.toFixed(2) : undefined,
    };
  }

  /**
   * Sends the receipt to the configured ESC/POS printer (SPEC §7.1). Never
   * throws — an unconfigured or unreachable printer must not roll back or
   * block the sale (same soft-fail pattern as SMS/PLU): the caller shows a
   * toast from `printed:false`.
   */
  async printReceipt(
    saleId: number,
    copies?: number,
  ): Promise<{ printed: boolean; reason?: string }> {
    const count = copies ?? Number((await this.settings.get(SettingKey.PRINT_COPIES)) ?? '1');
    const data = await this.buildReceiptData(saleId);
    return this.printDocument(renderReceipt(data), count);
  }

  /** Karz tölemek confirmation slip (SPEC §5.5) — same soft-fail contract as printReceipt. */
  async printDebtPaymentReceipt(
    data: Omit<DebtPaymentReceiptData, 'shopHeader' | 'date' | 'time'>,
  ): Promise<{ printed: boolean; reason?: string }> {
    const shopHeader = (await this.settings.get(SettingKey.SHOP_HEADER)) ?? 'Çözgüt';
    const now = new Date();
    const doc = renderDebtPaymentReceipt({
      ...data,
      shopHeader,
      date: now.toISOString().slice(0, 10),
      time: now.toISOString().slice(11, 16),
    });
    return this.printDocument(doc, 1);
  }

  private async printDocument(
    doc: ReceiptDocument,
    copies: number,
  ): Promise<{ printed: boolean; reason?: string }> {
    const interfaceStr = await this.settings.get(SettingKey.PRINTER_NAME);
    if (!interfaceStr) return { printed: false, reason: 'printer not configured' };

    try {
      const printer = new ThermalPrinter({ type: PrinterTypes.EPSON, interface: interfaceStr });
      const connected = await printer.isPrinterConnected();
      if (!connected) return { printed: false, reason: 'printer unreachable' };

      for (let i = 0; i < Math.max(1, copies); i++) {
        if (i > 0) printer.clear();
        printer.alignCenter();
        printer.bold(true);
        printer.println(doc.header);
        printer.bold(false);
        doc.meta.forEach((l: string) => printer.println(l));
        printer.drawLine();
        printer.alignLeft();
        doc.items.forEach((l: string) => printer.println(l));
        printer.drawLine();
        doc.totals.forEach((l: string) => printer.println(l));
        printer.alignCenter();
        printer.println(doc.footer);
        printer.cut();
      }
      await printer.execute();
      return { printed: true };
    } catch (e) {
      this.logger.warn(`Receipt print failed: ${(e as Error).message}`);
      return { printed: false, reason: (e as Error).message };
    }
  }
}
