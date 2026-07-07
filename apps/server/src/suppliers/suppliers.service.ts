import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Minimal read-only slice of Supplier (SPEC §5.6 Suppliers CRUD is Phase 4).
 * Phase 2 only needs a picklist for the "Haryt goş" supplier-credit option;
 * create/update/delete/ledger views are built in Phase 4 on top of this module.
 */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.supplier.findMany({
      select: { id: true, code: true, name: true, balance: true },
      orderBy: { name: 'asc' },
    });
  }
}
