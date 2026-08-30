import razorpay
import hmac
import hashlib
import logging
from typing import Optional, Dict, Any, List
from app.config import settings

logger = logging.getLogger(__name__)

class RazorpayService:
    def __init__(self):
        self.key_id = settings.RAZORPAY_KEY_ID
        self.key_secret = settings.RAZORPAY_KEY_SECRET
        self.webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
        self._init_client()

    def _init_client(self):
        try:
            if self.key_id and self.key_secret and not self.key_id.startswith("rzp_test_XXXX"):
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
            else:
                # Default client instance
                self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
        except Exception as e:
            logger.error(f"Failed to initialize Razorpay client: {e}")
            self.client = None

    def verify_webhook_signature(self, body: str, signature: str) -> bool:
        """
        Verifies Razorpay HMAC SHA256 webhook signature.
        If RAZORPAY_WEBHOOK_SECRET is configured, strictly checks HMAC signature.
        """
        secret = settings.RAZORPAY_WEBHOOK_SECRET or self.webhook_secret
        if not secret or secret == "XXXXXXXXXXXXXX":
            # If no secret configured in test sandbox, return True only for dummy local testing
            logger.warning("RAZORPAY_WEBHOOK_SECRET not configured; permitting payload in sandbox mode.")
            return True

        if not signature:
            return False

        try:
            expected_signature = hmac.new(
                key=secret.encode('utf-8'),
                msg=body.encode('utf-8'),
                digestmod=hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(expected_signature, signature)
        except Exception as e:
            logger.error(f"Webhook signature verification error: {e}")
            return False

    def create_order(self, amount: int, currency: str = "INR", receipt: Optional[str] = None, notes: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Creates a real Order in Razorpay Test Mode."""
        if not self.client:
            return None
        try:
            data = {
                "amount": amount,
                "currency": currency,
                "receipt": receipt or f"rcpt_{hash(amount) % 1000000}",
                "notes": notes or {}
            }
            return self.client.order.create(data=data)
        except Exception as e:
            logger.error(f"Failed to create order via Razorpay API: {e}")
            return None

    def fetch_orders(self, count: int = 20) -> List[Dict[str, Any]]:
        """Fetches recent orders from Razorpay API."""
        if not self.client:
            return []
        try:
            res = self.client.order.all({"count": count})
            return res.get("items", [])
        except Exception as e:
            logger.error(f"Failed to fetch orders: {e}")
            return []

    def fetch_payments(self, count: int = 20) -> List[Dict[str, Any]]:
        """Fetches recent payments from Razorpay API."""
        if not self.client:
            return []
        try:
            res = self.client.payment.all({"count": count})
            return res.get("items", [])
        except Exception as e:
            logger.error(f"Failed to fetch payments: {e}")
            return []

    def fetch_payment(self, payment_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            return self.client.payment.fetch(payment_id)
        except Exception as e:
            logger.error(f"Failed to fetch payment {payment_id}: {e}")
            return None

    def fetch_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            return self.client.order.fetch(order_id)
        except Exception as e:
            logger.error(f"Failed to fetch order {order_id}: {e}")
            return None

    def create_payment_link(self, amount: int, currency: str = "INR", description: str = "Order Payment", customer: Optional[Dict[str, Any]] = None, expire_by: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Creates a real Payment Link in Razorpay Test Mode."""
        if not self.client:
            return None
        try:
            data = {
                "amount": amount,
                "currency": currency,
                "description": description,
                "customer": customer or {},
                "notify": {"sms": True, "email": True},
                "reminder_enable": True
            }
            if expire_by:
                data["expire_by"] = expire_by
            return self.client.payment_link.create(data)
        except Exception as e:
            logger.error(f"Failed to create payment link: {e}")
            return None

    def fetch_invoices(self, count: int = 20) -> List[Dict[str, Any]]:
        """Fetches recent invoices from Razorpay API."""
        if not self.client:
            return []
        try:
            res = self.client.invoice.all({"count": count})
            return res.get("items", [])
        except Exception as e:
            logger.error(f"Failed to fetch invoices: {e}")
            return []

    def create_invoice(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            return self.client.invoice.create(data)
        except Exception as e:
            logger.error(f"Failed to create invoice: {e}")
            return None

    def notify_invoice(self, invoice_id: str, medium: str = "email") -> bool:
        if not self.client:
            return False
        try:
            self.client.invoice.notify_by(invoice_id, medium)
            return True
        except Exception as e:
            logger.error(f"Failed to notify invoice {invoice_id}: {e}")
            return False

    def fetch_payment_link(self, link_id: str) -> Optional[Dict[str, Any]]:
        if not self.client:
            return None
        try:
            return self.client.payment_link.fetch(link_id)
        except Exception as e:
            logger.error(f"Failed to fetch payment link {link_id}: {e}")
            return None


razorpay_service = RazorpayService()


