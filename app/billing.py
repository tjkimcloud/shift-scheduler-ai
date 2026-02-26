import stripe
import os
from dotenv import load_dotenv

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID")

def create_checkout_session(user_id: str, email: str) -> str:
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price": PRO_PRICE_ID,
            "quantity": 1
        }],
        mode="subscription",
        success_url="http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url="http://localhost:3000/cancel",
        customer_email=email,
        metadata={"user_id": user_id}
    )
    return session.url

def create_portal_session(stripe_customer_id: str) -> str:
    session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url="http://localhost:3000/dashboard"
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