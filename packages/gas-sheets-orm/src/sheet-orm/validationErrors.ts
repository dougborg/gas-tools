/**
 * Fluent accumulator for `DomainModel.validate()` implementations.
 *
 * Pattern: chain per-field checks, call `result()` to get the standard
 * `{ valid, errors }` shape. Checks are independent — each validator only
 * fires its own error, and each treats whitespace-only strings as empty,
 * so `required().maxLength()` and `maxLength().required()` yield the same
 * errors regardless of order.
 *
 * @example
 * ```ts
 * validate(): { valid: boolean; errors: string[] } {
 *   return new ValidationErrors()
 *     .required(this.sku, 'SKU')
 *     .maxLength(this.sku, 50, 'SKU')
 *     .positive(this.quantity, 'Quantity')
 *     .result();
 * }
 * ```
 */
export class ValidationErrors {
  private readonly errors: string[] = [];

  private static isEmptyString(value: unknown): boolean {
    return value === null || value === undefined || value === '' || (typeof value === 'string' && value.trim() === '');
  }

  required(value: unknown, name: string): this {
    if (ValidationErrors.isEmptyString(value)) {
      this.errors.push(`${name} is required`);
    }
    return this;
  }

  maxLength(value: string | null | undefined, max: number, name: string): this {
    // Skip empty/whitespace-only values — that's `required()`'s job.
    if (ValidationErrors.isEmptyString(value)) return this;
    if (value && value.length > max) {
      this.errors.push(`${name} must be ${max} characters or less`);
    }
    return this;
  }

  positive(value: number, name: string): this {
    if (value <= 0) {
      this.errors.push(`${name} must be greater than zero (got ${value})`);
    }
    return this;
  }

  integer(value: number, name: string): this {
    if (!Number.isInteger(value)) {
      this.errors.push(`${name} must be a whole number (got ${value})`);
    }
    return this;
  }

  max(value: number, max: number, name: string): this {
    if (value > max) {
      this.errors.push(`${name} must be ${max} or less (got ${value})`);
    }
    return this;
  }

  nonNegative(value: number | null | undefined, name: string): this {
    if (value !== null && value !== undefined && value < 0) {
      this.errors.push(`${name} cannot be negative (got ${value})`);
    }
    return this;
  }

  custom(condition: boolean, message: string): this {
    if (condition) {
      this.errors.push(message);
    }
    return this;
  }

  result(): { valid: boolean; errors: string[] } {
    return { valid: this.errors.length === 0, errors: [...this.errors] };
  }
}
