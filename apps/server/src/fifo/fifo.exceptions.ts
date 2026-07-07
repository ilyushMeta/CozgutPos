/** Thrown by FifoService when a product's remaining stock can't cover the requested qty. */
export class FifoInsufficientStockException extends Error {
  constructor(
    public readonly productId: number,
    public readonly shortfall: string,
  ) {
    super(`insufficient stock for product ${productId}: short by ${shortfall}`);
    this.name = 'FifoInsufficientStockException';
  }
}
