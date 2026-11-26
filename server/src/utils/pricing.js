/**
 * Two-tier membership pricing.
 *
 * - "first"   → the member's FIRST plan bill (joining month). Uses the plan's first_month_price
 *               when the owner has set one.
 * - "regular" → every bill after that (renewals). Uses the plan's normal price.
 *
 * A member counts as "already joined" once they have any plan-based invoice, on any plan,
 * so switching plans later does not re-trigger the joining price.
 */
export async function quotePlanForMember(db, plan, memberId) {
  const regular = Number(plan.price);
  const hasFirstPrice = plan.first_month_price !== null && plan.first_month_price !== undefined;

  let isFirstBill = true;
  if (memberId) {
    const { rowCount } = await db.query(
      'SELECT 1 FROM fee_invoices WHERE member_id = $1 AND plan_id IS NOT NULL LIMIT 1',
      [memberId]
    );
    isFirstBill = rowCount === 0;
  }

  if (isFirstBill && hasFirstPrice) {
    return { tier: 'first', amount: Number(plan.first_month_price), regular_price: regular };
  }
  return { tier: 'regular', amount: regular, regular_price: regular };
}

/** Invoice title that makes the tier visible to both owner and member. */
export function planInvoiceTitle(plan, tier) {
  return tier === 'first' ? `${plan.name} — Joining (First Month)` : `${plan.name} Membership`;
}
