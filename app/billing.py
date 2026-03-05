import stripe
import os
from dotenv import load_dotenv

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID")
BUSINESS_PRICE_ID = os.getenv("STRIPE_BUSINESS_PRICE_ID")

BASE_URL = os.getenv("NEXT_PUBLIC_APP_URL", "https://schedio.cloud")

def create_checkout_session(user_id: str, email: str, plan: str = "pro") -> str:
    price_id = BUSINESS_PRICE_ID if plan == "business" else PRO_PRICE_ID

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price": price_id,
            "quantity": 1
        }],
        mode="subscription",
        success_url=f"{BASE_URL}/dashboard?upgraded=true",
        cancel_url=f"{BASE_URL}/upgrade",
        customer_email=email,
        metadata={"user_id": user_id, "plan": plan}
    )
    return session.url

def create_portal_session(stripe_customer_id: str) -> str:
    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=f"{BASE_URL}/dashboard"
    )
    return session.url

def get_subscription_status(stripe_customer_id: str) -> bool:
    subscriptions = stripe.Subscription.list(
        customer=stripe_customer_id,
        status="active"
    )
    return len(subscriptions.data) > 0

def handle_webhook(payload: bytes, sig_header: str) -> dict:
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except Exception as e:
        raise ValueError(f"Webhook error: {str(e)}")
    
    return event