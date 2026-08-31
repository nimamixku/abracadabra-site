import { NextResponse } from "next/server";
import { getOrderByPaymentIntent, isUsableShippingAddress, setOrderShippingAddress } from "@/lib/orders";

// Lets a shopper supply (or fix) a physical order's shipping address
// after payment already went through -- see the plan's shopping-order
// flexibility: a buyer can pay first and add where-to-ship afterward,
// same as they could fill it in before paying instead. Either way the
// order ends up with a real address before it ships. Trusts the payment
// intent id as an opaque per-order capability token, same model already
// used by /api/checkout/confirm and the download routes -- nothing here
// is more sensitive than a shipping address itself.
export async function POST(req) {
  try {
    const { paymentIntentId, shippingAddress } = await req.json();
    if (!paymentIntentId) {
      return NextResponse.json({ error: "Missing payment intent." }, { status: 400 });
    }
    if (!isUsableShippingAddress(shippingAddress)) {
      return NextResponse.json({ error: "That address looks incomplete." }, { status: 400 });
    }

    const order = await getOrderByPaymentIntent(paymentIntentId);
    if (!order) {
      return NextResponse.json({ error: "Unknown payment intent." }, { status: 400 });
    }
    if (order.type !== "physical") {
      return NextResponse.json({ error: "This item doesn't ship." }, { status: 400 });
    }

    await setOrderShippingAddress(paymentIntentId, shippingAddress);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
