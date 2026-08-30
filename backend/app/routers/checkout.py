import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.razorpay_client import razorpay_service
from app.services import event_ingester
from app.workers.polling_fallback import poll_razorpay_safety_net

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/checkout", tags=["checkout"])


class CreateOrderRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Amount in paise (e.g. 50000 = ₹500.00)")
    currency: str = Field(default="INR")
    receipt: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_contact: Optional[str] = None
    notes: Optional[Dict[str, Any]] = None


class CreatePaymentLinkRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Amount in paise")
    currency: str = Field(default="INR")
    description: str = Field(default="Razorpay Retain Payment Link")
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_contact: Optional[str] = None
    expire_by_minutes: Optional[int] = Field(default=1440)


class CreateInvoiceRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Amount in paise")
    currency: str = Field(default="INR")
    customer_name: str = Field(default="Acme Corp")
    customer_email: str = Field(default="billing@acmecorp.in")
    customer_contact: str = Field(default="+919876543210")
    description: str = Field(default="B2B Subscription / Service Invoice")


class ClientPaymentFailureRequest(BaseModel):
    order_id: Optional[str] = None
    payment_id: Optional[str] = None
    error_code: Optional[str] = None
    error_description: Optional[str] = None
    error_source: Optional[str] = None
    error_step: Optional[str] = None
    error_reason: Optional[str] = None
    amount: Optional[int] = None
    customer_email: Optional[str] = None
    customer_contact: Optional[str] = None


@router.get("/config")
async def get_checkout_config():
    """Returns public Razorpay configuration for client-side checkout initiation."""
    return {
        "key_id": settings.RAZORPAY_KEY_ID,
        "webhook_configured": bool(settings.RAZORPAY_WEBHOOK_SECRET and settings.RAZORPAY_WEBHOOK_SECRET != "XXXXXXXXXXXXXX"),
        "public_webhook_url": settings.PUBLIC_WEBHOOK_URL,
        "environment": settings.ENVIRONMENT,
    }


@router.post("/create-order")
async def create_order(req: CreateOrderRequest):
    """Creates a real Order on the Razorpay Test API for Standard Checkout."""
    notes = req.notes or {}
    if req.customer_email:
        notes["customer_email"] = req.customer_email
    if req.customer_contact:
        notes["customer_contact"] = req.customer_contact
    if req.customer_name:
        notes["customer_name"] = req.customer_name

    order = razorpay_service.create_order(
        amount=req.amount,
        currency=req.currency,
        receipt=req.receipt,
        notes=notes
    )

    if not order:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Razorpay Order. Verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
        )

    return {
        "order": order,
        "key_id": settings.RAZORPAY_KEY_ID
    }


@router.post("/create-payment-link")
async def create_payment_link(req: CreatePaymentLinkRequest):
    """Creates a genuine Razorpay Payment Link via Razorpay API."""
    customer = {}
    if req.customer_name:
        customer["name"] = req.customer_name
    if req.customer_email:
        customer["email"] = req.customer_email
    if req.customer_contact:
        customer["contact"] = req.customer_contact

    plink = razorpay_service.create_payment_link(
        amount=req.amount,
        currency=req.currency,
        description=req.description,
        customer=customer
    )

    if not plink:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Razorpay Payment Link."
        )

    return plink


@router.post("/create-invoice")
async def create_invoice(req: CreateInvoiceRequest):
    """Creates a genuine Razorpay Invoice via Razorpay API."""
    invoice_data = {
        "type": "invoice",
        "currency": req.currency,
        "description": req.description,
        "customer": {
            "name": req.customer_name,
            "email": req.customer_email,
            "contact": req.customer_contact
        },
        "line_items": [
            {
                "name": req.description,
                "amount": req.amount,
                "currency": req.currency,
                "quantity": 1
            }
        ]
    }

    inv = razorpay_service.create_invoice(invoice_data)
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Razorpay Invoice."
        )

    return inv


@router.post("/notify-failure")
async def notify_payment_failure(req: ClientPaymentFailureRequest, db: AsyncSession = Depends(get_db)):
    """
    Direct client-side failure hook from Razorpay Checkout modal.
    Instantly feeds the real gateway error into the diagnosis and recovery pipeline.
    """
    payload = {
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": req.payment_id or f"pay_client_{req.order_id or 'unknown'}",
                    "order_id": req.order_id,
                    "amount": req.amount or 100000,
                    "currency": "INR",
                    "status": "failed",
                    "method": "card",
                    "error_code": req.error_code or "BAD_REQUEST_ERROR",
                    "error_description": req.error_description or "Payment failed on gateway",
                    "error_source": req.error_source or "gateway",
                    "error_step": req.error_step or "payment_authorization",
                    "error_reason": req.error_reason or req.error_description or "payment_failed",
                    "email": req.customer_email,
                    "contact": req.customer_contact
                }
            }
        }
    }

    event = await event_ingester.ingest_webhook_event(db, "payment.failed", payload)
    return {
        "status": "intercepted",
        "event_id": event.id if event else None,
        "event_status": event.status if event else None
    }


@router.post("/sync-now")
async def sync_gateway_now():
    """Triggers an immediate Polling Safety Net cycle against Razorpay API."""
    result = await poll_razorpay_safety_net()
    return result
